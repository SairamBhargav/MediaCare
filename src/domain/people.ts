/**
 * People (ADR-0011): grouping faces into people, on device. Pure rules; the
 * native step (FaceTools.swift) supplies each face's fingerprints and the
 * job in services/scan stores them.
 *
 * Two fingerprints per face, combined:
 *  - the face model's (SFace), trained to tell people apart, when the
 *    build includes it, and
 *  - Apple's general image fingerprint of the aligned face, always.
 * With both, a confident model match is enough and a borderline one needs
 * Apple's to agree. With Apple's only, the bar is strict. Mistakes should
 * split a person into two groups (easy to merge) rather than mix two
 * people. Every threshold is provisional until tuned on real photos.
 *
 * The user's word wins: a face they confirmed stays, and a face they said
 * isn't someone is never put back with that person.
 */

export const FACE_THRESHOLDS = {
  /** Faces Vision rates below this (blurry, turned away) aren't grouped. */
  minQuality: 0.3,
  /** Model cosine similarity that alone means "same person" (stricter than OpenCV's, to prefer splitting). */
  modelSure: 0.45,
  /** OpenCV's own SFace match threshold; at or above it but below modelSure, Apple's must agree. */
  modelMaybe: 0.363,
  /** Apple cosine similarity that supports a borderline model match. */
  appleSupport: 0.8,
  /** Apple cosine similarity needed when there is no model fingerprint. */
  appleOnly: 0.9,
} as const;

/** People with fewer faces than this are hidden unless named (passers-by). */
export const MIN_FACES_TO_SHOW = 2;

export type FaceBox = { x: number; y: number; width: number; height: number };

export type FaceRecord = {
  id: number;
  assetId: string;
  box: FaceBox;
  quality: number;
  applePrint: Float32Array | null;
  modelPrint: Float32Array | null;
  personId: number | null;
  /** The user said this face is this person. */
  confirmed: boolean;
  /** The user said this face is not this person. */
  rejectedPersonId: number | null;
};

export type Person = {
  id: number;
  name: string | null;
  hidden: boolean;
  createdAt: number;
};

// MARK: - Fingerprints

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Map([...BASE64].map((char, index) => [char, index]));

/** Base64 of little-endian Float32 (as the native module writes it) to numbers. */
export function decodePrint(base64: string | null | undefined): Float32Array | null {
  if (!base64) return null;
  const clean = base64.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    const value = LOOKUP.get(char);
    if (value === undefined) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 0xff;
      buffer &= (1 << bits) - 1;
    }
  }
  if (index % 4 !== 0 || index === 0) return null;
  const view = new DataView(bytes.buffer, 0, index);
  const values = new Float32Array(index / 4);
  for (let i = 0; i < values.length; i += 1) values[i] = view.getFloat32(i * 4, true);
  return values;
}

/** Numbers to base64 of little-endian Float32 (tests and storage round trips). */
export function encodePrint(values: ArrayLike<number>): string {
  const view = new DataView(new ArrayBuffer(values.length * 4));
  for (let i = 0; i < values.length; i += 1) view.setFloat32(i * 4, values[i], true);
  const bytes = new Uint8Array(view.buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += BASE64[(chunk >> 18) & 63] + BASE64[(chunk >> 12) & 63];
    out += i + 1 < bytes.length ? BASE64[(chunk >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? BASE64[chunk & 63] : '=';
  }
  return out;
}

function dot(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return Number.NaN;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

// MARK: - Grouping

/** Running sum of a person's normalized fingerprints; its direction is the person's "average face". */
class Centroid {
  model: Float32Array | null = null;
  apple: Float32Array | null = null;
  private modelNorm = 0;
  private appleNorm = 0;

  add(face: FaceRecord) {
    if (face.modelPrint) {
      this.model = accumulate(this.model, face.modelPrint);
      this.modelNorm = Math.sqrt(dot(this.model, this.model));
    }
    if (face.applePrint) {
      this.apple = accumulate(this.apple, face.applePrint);
      this.appleNorm = Math.sqrt(dot(this.apple, this.apple));
    }
  }

  modelSimilarity(print: Float32Array | null): number | null {
    if (!print || !this.model || this.modelNorm === 0) return null;
    const value = dot(print, this.model) / this.modelNorm;
    return Number.isFinite(value) ? value : null;
  }

  appleSimilarity(print: Float32Array | null): number | null {
    if (!print || !this.apple || this.appleNorm === 0) return null;
    const value = dot(print, this.apple) / this.appleNorm;
    return Number.isFinite(value) ? value : null;
  }
}

function accumulate(sum: Float32Array | null, print: Float32Array): Float32Array {
  if (!sum || sum.length !== print.length) return Float32Array.from(print);
  for (let i = 0; i < sum.length; i += 1) sum[i] += print[i];
  return sum;
}

/**
 * How well a face matches a person, or null if it isn't a match. Higher is
 * better; model and Apple scores aren't mixed in one ranking because a
 * person either has model fingerprints or doesn't.
 */
export function matchScore(face: FaceRecord, person: Centroid): number | null {
  const t = FACE_THRESHOLDS;
  const model = person.modelSimilarity(face.modelPrint);
  const apple = person.appleSimilarity(face.applePrint);
  if (model !== null) {
    if (model >= t.modelSure) return model;
    if (model >= t.modelMaybe && apple !== null && apple >= t.appleSupport) return model;
    return null;
  }
  if (apple !== null && apple >= t.appleOnly) return apple;
  return null;
}

export function isGroupable(face: FaceRecord): boolean {
  return (
    face.quality >= FACE_THRESHOLDS.minQuality &&
    (face.modelPrint !== null || face.applePrint !== null)
  );
}

export type Grouping = {
  /** Face id → existing person id. */
  toExisting: Map<number, number>;
  /** New people, each a list of face ids. */
  newPeople: number[][];
};

/**
 * Puts every ungrouped face with someone: the best-matching existing person
 * or a new group started from it, best-quality faces first so groups start
 * from clear faces. Already grouped faces only shape their person's
 * average. `onYield` lets a long run hand control back to the UI.
 */
export async function groupFaces(
  faces: readonly FaceRecord[],
  { yieldEvery = 200, onYield }: { yieldEvery?: number; onYield?: () => Promise<void> } = {},
): Promise<Grouping> {
  const centroids = new Map<number, Centroid>();
  const pending: FaceRecord[] = [];
  for (const face of faces) {
    if (face.personId !== null) {
      let centroid = centroids.get(face.personId);
      if (!centroid) centroids.set(face.personId, (centroid = new Centroid()));
      centroid.add(face);
    } else if (isGroupable(face)) {
      pending.push(face);
    }
  }
  pending.sort((a, b) => b.quality - a.quality);

  const toExisting = new Map<number, number>();
  const fresh: { centroid: Centroid; faces: number[] }[] = [];
  for (let index = 0; index < pending.length; index += 1) {
    if (onYield && index > 0 && index % yieldEvery === 0) await onYield();
    const face = pending[index];

    let best: { score: number; existing?: number; fresh?: number } | null = null;
    for (const [personId, centroid] of centroids) {
      if (personId === face.rejectedPersonId) continue;
      const score = matchScore(face, centroid);
      if (score !== null && (!best || score > best.score)) best = { score, existing: personId };
    }
    for (let group = 0; group < fresh.length; group += 1) {
      const score = matchScore(face, fresh[group].centroid);
      if (score !== null && (!best || score > best.score)) best = { score, fresh: group };
    }

    if (best?.existing !== undefined) {
      toExisting.set(face.id, best.existing);
      centroids.get(best.existing)!.add(face);
    } else if (best?.fresh !== undefined) {
      fresh[best.fresh].faces.push(face.id);
      fresh[best.fresh].centroid.add(face);
    } else {
      const centroid = new Centroid();
      centroid.add(face);
      fresh.push({ centroid, faces: [face.id] });
    }
  }
  return { toExisting, newPeople: fresh.map((group) => group.faces) };
}

// MARK: - What the People screen shows

export type PersonSummary = {
  person: Person;
  /** Photos with this person, newest first is up to the caller. */
  assetIds: string[];
  /** The clearest face, for the person's picture. */
  cover: FaceRecord;
};

/** Visible people: named ones, and unnamed ones seen in at least MIN_FACES_TO_SHOW photos. Most photos first. */
export function peopleSummaries(
  people: readonly Person[],
  faces: readonly FaceRecord[],
): PersonSummary[] {
  const byPerson = new Map<number, FaceRecord[]>();
  for (const face of faces) {
    if (face.personId === null) continue;
    const list = byPerson.get(face.personId);
    if (list) list.push(face);
    else byPerson.set(face.personId, [face]);
  }
  const summaries: PersonSummary[] = [];
  for (const person of people) {
    const list = byPerson.get(person.id);
    if (!list || person.hidden) continue;
    const assetIds = [...new Set(list.map((face) => face.assetId))];
    if (!person.name && assetIds.length < MIN_FACES_TO_SHOW) continue;
    const cover = list.reduce((best, face) => (face.quality > best.quality ? face : best));
    summaries.push({ person, assetIds, cover });
  }
  return summaries.sort(
    (a, b) =>
      Number(Boolean(b.person.name)) - Number(Boolean(a.person.name)) ||
      b.assetIds.length - a.assetIds.length,
  );
}

/**
 * Where to draw a photo so a face fills a `size`×`size` circle. The face
 * box is normalized with origin bottom-left (Vision); the photo is
 * `width`×`height` px as Photos reports it. `margin` leaves room around the
 * face. Returns the photo's drawn size and offset inside the circle.
 */
export function faceCrop(
  box: FaceBox,
  width: number,
  height: number,
  size: number,
  margin = 1.6,
): { width: number; height: number; left: number; top: number } {
  const side = Math.max(box.width * width, box.height * height) * margin;
  const scale = side > 0 ? size / side : 1;
  const centerX = (box.x + box.width / 2) * width;
  const centerY = (1 - box.y - box.height / 2) * height;
  return {
    width: width * scale,
    height: height * scale,
    left: size / 2 - centerX * scale,
    top: size / 2 - centerY * scale,
  };
}
