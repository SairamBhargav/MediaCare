/**
 * Passport photo framing (Phase 5). Pure geometry: given where Vision found
 * the face, choose a square crop whose head size falls inside the official
 * range. docs/PRIVACY_AND_SAFETY.md, "Passport / ID workflow": only
 * geometric formatting (crop, scale); no retouching, no generated
 * backgrounds; never promise acceptance.
 *
 * Rules are versioned with their source and the date they were checked.
 */
export type PassportRules = {
  id: string;
  label: string;
  /** Official page the numbers come from. */
  source: string;
  /** When the numbers were last checked against the source. */
  reviewed: string;
  /** Square output size in pixels for the digital photo. */
  minPx: number;
  maxPx: number;
  /** Head (chin to top of head) as a share of the photo height. */
  headMin: number;
  headMax: number;
  /** Checks the app can't do and the person must confirm. */
  checklist: readonly string[];
};

/**
 * U.S. passport, from travel.state.gov (checked 2026-10-08): 2 × 2 in;
 * head 1–1⅜ in (25–35 mm) from chin to top of head, i.e. 50–69% of the
 * height; digital 600×600 to 1200×1200 px.
 */
export const US_PASSPORT: PassportRules = {
  id: 'us-passport-2x2',
  label: 'U.S. passport (2 × 2 in)',
  source: 'https://travel.state.gov/content/travel/en/passports/how-apply/photos.html',
  reviewed: '2026-10-08',
  minPx: 600,
  maxPx: 1200,
  headMin: 25 / 51,
  headMax: 35 / 51,
  checklist: [
    'Plain white or off-white background, no shadows',
    'Facing the camera, neutral expression or natural smile, both eyes open',
    'No glasses; hats or head coverings only for religious or medical reasons',
    'Taken in the last 6 months, not edited or filtered',
  ],
};

/** Vision face box: normalized, origin bottom-left. */
export type FaceBox = { x: number; y: number; width: number; height: number };

/**
 * Vision's face box runs roughly from the brow to the chin; the top of the
 * head is above it. This estimate of how much higher is shown to the person
 * as guide lines to check, never claimed as measured.
 */
export const CROWN_ABOVE_FACE_BOX = 0.45;
/** Aim for the middle of the allowed head range. */
const TARGET_HEAD = 0.6;
/** Space above the head as a share of the photo. */
const TOP_MARGIN = 0.1;

export type PassportFrame = {
  /** Square crop in image pixels, top-left origin. */
  crop: { originX: number; originY: number; width: number; height: number };
  /** Output side in pixels (within the rules' range). */
  outputPx: number;
  /** Estimated head share of the photo height (see CROWN_ABOVE_FACE_BOX). */
  headShare: number;
  /** Estimated head top and chin as shares from the top of the photo, for guides. */
  headTop: number;
  chin: number;
  problems: string[];
};

export function passportFrame(
  imageWidth: number,
  imageHeight: number,
  faces: readonly FaceBox[],
  rules: PassportRules = US_PASSPORT,
): PassportFrame | { problems: string[] } {
  if (faces.length === 0) return { problems: ['No face was found.'] };
  if (faces.length > 1)
    return { problems: ['More than one face was found. Use a photo of one person.'] };

  const face = faces[0];
  const faceTop = (1 - (face.y + face.height)) * imageHeight;
  const chin = (1 - face.y) * imageHeight;
  const faceHeight = face.height * imageHeight;
  const headTop = faceTop - CROWN_ABOVE_FACE_BOX * faceHeight;
  const headHeight = chin - headTop;
  const centerX = (face.x + face.width / 2) * imageWidth;

  const side = Math.round(headHeight / TARGET_HEAD);
  const problems: string[] = [];
  let originX = Math.round(centerX - side / 2);
  let originY = Math.round(headTop - TOP_MARGIN * side);

  if (side > imageWidth || side > imageHeight) {
    problems.push(
      'The face is too close to the camera to fit a passport frame. Step back and retake.',
    );
  }
  // Nudge inside the photo if there's room; flag if the head would be cut.
  originX = Math.min(Math.max(0, originX), Math.max(0, imageWidth - side));
  if (originY < 0) {
    problems.push('Not enough space above the head. Leave more room above the head and retake.');
    originY = 0;
  }
  if (originY + side > imageHeight) {
    problems.push('Not enough space below the chin. Include the shoulders and retake.');
    originY = Math.max(0, imageHeight - side);
  }
  if (side < rules.minPx) {
    problems.push(
      `The face is too small in this photo (crop would be ${side} px; at least ${rules.minPx} px is needed). Move closer and retake.`,
    );
  }

  const headTopShare = (headTop - originY) / side;
  const chinShare = (chin - originY) / side;
  return {
    crop: { originX, originY, width: side, height: side },
    outputPx: Math.max(rules.minPx, Math.min(rules.maxPx, side)),
    headShare: chinShare - headTopShare,
    headTop: headTopShare,
    chin: chinShare,
    problems,
  };
}

export function isFrame(value: PassportFrame | { problems: string[] }): value is PassportFrame {
  return 'crop' in value;
}
