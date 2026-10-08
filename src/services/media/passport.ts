import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

import type { FaceBox, PassportFrame } from '@/domain/passport';
import { photoUri } from '@/services/media/photo-library';
import { analyzePhotos } from '@/services/media/visual-analysis';

/** Faces Vision finds in a photo, with how open each pair of eyes looks. */
export async function findFaces(
  id: string,
): Promise<
  { status: 'ok'; faces: (FaceBox & { eyesOpen: number })[] } | { status: 'in-icloud' | 'failed' }
> {
  const [result] = await analyzePhotos([id]);
  if (!result || result.status !== 'ok') {
    return { status: result?.status === 'in-icloud' ? 'in-icloud' : 'failed' };
  }
  return {
    status: 'ok',
    faces: (result.faces ?? []).map((face) => ({
      x: face.x,
      y: face.y,
      width: face.width,
      height: face.height,
      eyesOpen: Math.min(face.leftEyeOpen, face.rightEyeOpen),
    })),
  };
}

/** Crops and scales the photo to the passport frame. Writes a temporary JPEG. */
export async function renderPassport(
  id: string,
  frame: PassportFrame,
): Promise<{ uri: string; width: number; height: number; bytes: number }> {
  const context = ImageManipulator.manipulate(photoUri(id));
  context.crop(frame.crop);
  context.resize({ width: frame.outputPx, height: frame.outputPx });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.92, format: SaveFormat.JPEG });
  return {
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
    bytes: new File(saved.uri).size,
  };
}
