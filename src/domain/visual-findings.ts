import type { GroupFinding, ItemFinding } from './findings';
import type { PhotoItem } from './media';

/**
 * Findings from on-device visual analysis (Apple Vision, Phase 3). Pure:
 * the scores come from the MediaAnalysis native module and are stored with
 * the catalog; this module only decides.
 *
 * Honesty rules:
 *  - Nothing is flagged for removal automatically. Flags say "possibly"
 *    and give the measurement behind them.
 *  - Thresholds are provisional until tuned on the owner's photos with
 *    Diagnostics → Vision check. They live in one place, below.
 *  - A keeper is suggested with the reason that made it win, never "best"
 *    without saying why.
 */

export type VisualFace = {
  quality: number;
  leftEyeOpen: number;
  rightEyeOpen: number;
  width: number;
  height: number;
};

/** One person's confident body joints: name → [x, y], normalized, origin bottom-left. */
export type Pose = Readonly<Record<string, readonly [number, number]>>;

/** Stored analysis for one photo. */
export type VisualScores = {
  /** L2-normalized Vision feature print. */
  featurePrint: Float32Array | null;
  sharpness: number;
  sharpnessMaxTile: number;
  brightness: number;
  darkFraction: number;
  brightFraction: number;
  faces: readonly VisualFace[];
  /** People's body poses; empty if none found or not analyzed. */
  poses: readonly Pose[];
  /** 8×8 brightness grid (0–1), or null if not analyzed. */
  layout: readonly number[] | null;
};

/** Provisional thresholds; tune with Diagnostics → Vision check on real photos. */
export const VISUAL_THRESHOLDS = {
  /**
   * Normalized feature-print distance at or below which two photos look alike
   * (0 identical, 2 opposite). Device data (2026-10-08, iPhone 17): a repeat
   * shot 0.18; same scene, different moment 0.42; different scenes 0.9+.
   */
  similarDistance: 0.3,
  /**
   * Mean joint distance (pose scaled to its own size) above which the same
   * person is in a different pose: not similar, however alike the scene is.
   */
  poseDifferent: 0.18,
  /** Mean layout-grid difference above which the framing differs: not similar. */
  layoutDifferent: 0.09,
  /** Only photos taken this close in time are compared (similar shots happen together). */
  similarWindowMs: 10 * 60_000,
  /** Compare each photo with at most this many following photos. */
  similarNeighbours: 30,
  /** Sharpest-tile Laplacian variance below this: possibly blurry everywhere. */
  blurMaxTile: 60,
  /** Eye height/width below this counts as closed. */
  eyeClosed: 0.12,
  /** Faces smaller than this share of the frame (width × height) are ignored for eyes. */
  minFaceArea: 0.01,
  /** Mean brightness below this and at least `darkShare` near-black: very dark. */
  darkBrightness: 0.12,
  darkShare: 0.5,
  /** At least this share near-white: mostly blown out. */
  brightShare: 0.4,
} as const;

/** Scales a vector to unit length, so distances don't depend on the Vision revision. */
export function normalize(values: ArrayLike<number>): Float32Array {
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) sum += values[index] * values[index];
  const length = Math.sqrt(sum) || 1;
  const out = new Float32Array(values.length);
  for (let index = 0; index < values.length; index += 1) out[index] = values[index] / length;
  return out;
}

/** Euclidean distance between two normalized feature prints; Infinity if not comparable. */
export function featureDistance(a: Float32Array | null, b: Float32Array | null): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    const delta = a[index] - b[index];
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

/** The person with the most confident joints, or null. */
function mainPose(poses: readonly Pose[]): Pose | null {
  let best: Pose | null = null;
  for (const pose of poses) {
    if (!best || Object.keys(pose).length > Object.keys(best).length) best = pose;
  }
  return best;
}

/**
 * How different two body poses are: the main person's shared joints, each
 * pose centred and scaled to its own size, mean distance between matching
 * joints. Null when there's no person or fewer than 5 shared joints (then
 * pose doesn't decide).
 */
export function poseDistance(a: readonly Pose[], b: readonly Pose[]): number | null {
  const left = mainPose(a);
  const right = mainPose(b);
  if (!left || !right) return null;
  const joints = Object.keys(left).filter((name) => name in right);
  if (joints.length < 5) return null;

  const normalized = (pose: Pose) => {
    const points = joints.map((name) => pose[name]);
    const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
    const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const scale =
      Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
    return points.map(([x, y]) => [(x - cx) / scale, (y - cy) / scale] as const);
  };
  const p = normalized(left);
  const q = normalized(right);
  let total = 0;
  for (let index = 0; index < p.length; index += 1) {
    total += Math.hypot(p[index][0] - q[index][0], p[index][1] - q[index][1]);
  }
  return total / p.length;
}

/** How differently light and dark sit in the frame (each grid centred on its own mean). Null if unknown. */
export function layoutDistance(
  a: readonly number[] | null,
  b: readonly number[] | null,
): number | null {
  if (!a || !b || a.length !== b.length || a.length === 0) return null;
  const mean = (grid: readonly number[]) =>
    grid.reduce((sum, value) => sum + value, 0) / grid.length;
  const ma = mean(a);
  const mb = mean(b);
  let total = 0;
  for (let index = 0; index < a.length; index += 1)
    total += Math.abs(a[index] - ma - (b[index] - mb));
  return total / a.length;
}

/**
 * Whether two photos count as similar shots: they look alike (feature
 * print), and neither the person's pose nor the framing clearly differs.
 * Returns the feature distance when similar, otherwise Infinity.
 */
export function similarity(
  a: VisualScores,
  b: VisualScores,
  thresholds = VISUAL_THRESHOLDS,
): number {
  const distance = featureDistance(a.featurePrint, b.featurePrint);
  if (distance > thresholds.similarDistance) return Number.POSITIVE_INFINITY;
  const pose = poseDistance(a.poses, b.poses);
  if (pose !== null && pose > thresholds.poseDifferent) return Number.POSITIVE_INFINITY;
  const layout = layoutDistance(a.layout, b.layout);
  if (layout !== null && layout > thresholds.layoutDifferent) return Number.POSITIVE_INFINITY;
  return distance;
}

function capturedAt(item: PhotoItem): number | null {
  return item.capturedMs !== null && Number.isFinite(item.capturedMs) ? item.capturedMs : null;
}

/**
 * Groups photos that look alike and were taken close together. Photos are
 * taken in time order; a photo joins an open group only if it is within
 * the distance threshold of *every* photo already in it (complete
 * linkage). That stops chaining: in a dance sequence where each pose looks
 * a bit like the next, A–B and B–C being close no longer pulls A and C
 * (clearly different poses) into one group. A group stays open while its
 * last photo is within the time window and the neighbour limit.
 */
export function similarSets(
  items: readonly PhotoItem[],
  scores: ReadonlyMap<string, VisualScores>,
  thresholds = VISUAL_THRESHOLDS,
): string[][] {
  const photos = items
    .filter((item) => item.kind === 'photo' && !item.subtypes.includes('screenshot'))
    .map((item) => ({
      item,
      at: capturedAt(item),
      scores: scores.get(item.id) ?? null,
    }))
    .filter(
      (entry): entry is { item: PhotoItem; at: number; scores: VisualScores } =>
        entry.at !== null && !!entry.scores?.featurePrint,
    )
    .sort((a, b) => a.at - b.at || a.item.id.localeCompare(b.item.id));

  type Group = { members: typeof photos; lastIndex: number; lastAt: number };
  const closed: Group[] = [];
  let open: Group[] = [];

  photos.forEach((photo, index) => {
    // Groups whose last photo is too long ago or too many photos back can't grow.
    const still: Group[] = [];
    for (const group of open) {
      const fresh =
        photo.at - group.lastAt <= thresholds.similarWindowMs &&
        index - group.lastIndex <= thresholds.similarNeighbours;
      (fresh ? still : closed).push(group);
    }
    open = still;

    let best: Group | null = null;
    let bestWorst = Number.POSITIVE_INFINITY;
    for (const group of open) {
      let worst = 0;
      for (const member of group.members) {
        worst = Math.max(worst, similarity(member.scores, photo.scores, thresholds));
        if (worst > thresholds.similarDistance) break;
      }
      if (worst <= thresholds.similarDistance && worst < bestWorst) {
        best = group;
        bestWorst = worst;
      }
    }
    if (best) {
      best.members.push(photo);
      best.lastIndex = index;
      best.lastAt = photo.at;
    } else {
      open.push({ members: [photo], lastIndex: index, lastAt: photo.at });
    }
  });

  return [...closed, ...open]
    .filter((group) => group.members.length >= 2)
    .sort((a, b) => a.members[0].at - b.members[0].at)
    .map((group) => group.members.map((member) => member.item.id));
}

/** Faces big enough to judge, with whether their eyes look closed. */
function judgedFaces(scores: VisualScores, thresholds = VISUAL_THRESHOLDS) {
  return scores.faces
    .filter((face) => face.width * face.height >= thresholds.minFaceArea)
    .map((face) => {
      const known = face.leftEyeOpen >= 0 && face.rightEyeOpen >= 0;
      const closed =
        known &&
        face.leftEyeOpen < thresholds.eyeClosed &&
        face.rightEyeOpen < thresholds.eyeClosed;
      return { face, known, closed };
    });
}

export type QualityBreakdown = {
  score: number;
  sharpness: number;
  facesJudged: number;
  eyesClosed: number;
  faceQuality: number | null;
};

/**
 * A comparable quality score within a group: sharpness (log scale) plus
 * face quality, minus closed eyes and bad exposure. Only meaningful for
 * comparing photos of the same moment.
 */
export function qualityOf(scores: VisualScores, thresholds = VISUAL_THRESHOLDS): QualityBreakdown {
  const faces = judgedFaces(scores, thresholds);
  const eyesClosed = faces.filter((entry) => entry.closed).length;
  const qualities = faces.map((entry) => entry.face.quality).filter((value) => value >= 0);
  const faceQuality =
    qualities.length > 0
      ? qualities.reduce((sum, value) => sum + value, 0) / qualities.length
      : null;
  const sharp = Math.log10(1 + Math.max(0, scores.sharpnessMaxTile));
  const exposurePenalty =
    (scores.darkFraction > thresholds.darkShare ? 0.5 : 0) +
    (scores.brightFraction > thresholds.brightShare ? 0.5 : 0);
  return {
    score: sharp + (faceQuality ?? 0) * 2 - eyesClosed * 1.5 - exposurePenalty,
    sharpness: scores.sharpnessMaxTile,
    facesJudged: faces.length,
    eyesClosed,
    faceQuality,
  };
}

/** Picks a keeper for a set and says why, in plain words. */
export function chooseKeeper(
  members: readonly PhotoItem[],
  scores: ReadonlyMap<string, VisualScores>,
): { keeperId: string; reason: string } {
  const favorite = members.find((member) => member.isFavorite);
  if (favorite) return { keeperId: favorite.id, reason: 'Marked as a favorite in Photos' };

  const rated = members
    .map((member) => ({ member, scores: scores.get(member.id) }))
    .filter((entry): entry is { member: PhotoItem; scores: VisualScores } => !!entry.scores)
    .map((entry) => ({ ...entry, quality: qualityOf(entry.scores) }))
    .sort((a, b) => b.quality.score - a.quality.score || a.member.id.localeCompare(b.member.id));
  if (rated.length === 0) return { keeperId: members[0].id, reason: 'First shot' };

  const [best, ...rest] = rated;
  const reasons: string[] = [];
  if (rest.every((other) => best.quality.sharpness >= other.quality.sharpness)) {
    reasons.push('sharpest');
  }
  if (best.quality.facesJudged > 0 && best.quality.eyesClosed === 0) {
    if (rest.some((other) => other.quality.eyesClosed > 0)) reasons.push('eyes open');
  }
  if (
    best.quality.faceQuality !== null &&
    rest.every(
      (other) =>
        other.quality.faceQuality === null ||
        best.quality.faceQuality! >= other.quality.faceQuality,
    ) &&
    rest.some((other) => other.quality.faceQuality !== null)
  ) {
    reasons.push('best faces');
  }
  const reason =
    reasons.length > 0
      ? `${reasons.join(', ').replace(/^./, (first) => first.toUpperCase())} of the group`
      : 'Best overall of the group (sharpness, faces and exposure combined)';
  return { keeperId: best.member.id, reason };
}

const groupTitle = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Similar-shot groups ready for review. */
export function similarFindings(
  items: readonly PhotoItem[],
  scores: ReadonlyMap<string, VisualScores>,
  thresholds = VISUAL_THRESHOLDS,
): GroupFinding[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return similarSets(items, scores, thresholds)
    .map((ids) => ids.map((id) => byId.get(id)!).filter(Boolean))
    .map((members) => {
      const { keeperId, reason } = chooseKeeper(members, scores);
      const first = members[0];
      return {
        kind: 'group' as const,
        id: `similar-${first.id}`,
        category: 'similar' as const,
        title:
          first.capturedMs !== null
            ? groupTitle.format(new Date(first.capturedMs))
            : `${members.length} similar photos`,
        memberIds: members.map((member) => member.id),
        keeperId,
        keeperReason: reason,
      };
    })
    .reverse();
}

/** Single-photo flags: possibly blurry, eyes closed, too dark or too bright. */
export function qualityFlags(
  items: readonly PhotoItem[],
  scores: ReadonlyMap<string, VisualScores>,
  thresholds = VISUAL_THRESHOLDS,
): ItemFinding[] {
  const findings: ItemFinding[] = [];
  for (const item of items) {
    if (item.kind !== 'photo' || item.subtypes.includes('screenshot')) continue;
    const score = scores.get(item.id);
    if (!score) continue;

    if (score.sharpnessMaxTile < thresholds.blurMaxTile) {
      findings.push({
        kind: 'item',
        id: `blurry-${item.id}`,
        category: 'blurry',
        assetId: item.id,
        reason: `Little sharp detail anywhere (sharpness ${Math.round(score.sharpnessMaxTile)})`,
      });
    }

    const faces = judgedFaces(score, thresholds);
    const closed = faces.filter((entry) => entry.closed).length;
    if (closed > 0) {
      findings.push({
        kind: 'item',
        id: `eyes-closed-${item.id}`,
        category: 'eyes-closed',
        assetId: item.id,
        reason:
          faces.length === 1
            ? 'Eyes may be closed'
            : `Eyes may be closed (${closed} of ${faces.length} people)`,
      });
    }

    const dark =
      score.brightness < thresholds.darkBrightness && score.darkFraction >= thresholds.darkShare;
    const bright = score.brightFraction >= thresholds.brightShare;
    if (dark || bright) {
      findings.push({
        kind: 'item',
        id: `exposure-${item.id}`,
        category: 'exposure',
        assetId: item.id,
        reason: dark
          ? `Very dark (${Math.round(score.darkFraction * 100)}% near black)`
          : `Mostly blown out (${Math.round(score.brightFraction * 100)}% near white)`,
      });
    }
  }
  return findings;
}
