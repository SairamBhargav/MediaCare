import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';
import { Asset } from 'expo-media-library';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import { capLongEdge, type EncodeFn, type Encoded } from '@/domain/compress';
import { photoUri } from '@/services/media/photo-library';

/**
 * Makes smaller JPEG copies of a Photos item. The original is never
 * modified: every output is a new temporary file, measured with the file
 * system (real bytes, not estimates), decoded again to verify it, and only
 * saved to Photos as a *new* item when the user asks.
 */

/** Whether the full-size photo lives only in iCloud (checking does not download it). */
export async function isInCloud(id: string): Promise<boolean> {
  try {
    return await new Asset(id).getIsInCloud();
  } catch {
    return false;
  }
}

/**
 * Size of the photo's current full-size file. iOS resolves the current
 * version (the edited one, if edited) and downloads it from iCloud if
 * needed, so only call this after the user chose to make a copy.
 */
export async function measureSource(
  id: string,
): Promise<{ bytes: number | null; uri: string | null }> {
  try {
    const uri = await new Asset(id).getUri();
    const file = new File(uri);
    return { uri, bytes: file.exists ? file.size : null };
  } catch {
    return { uri: null, bytes: null };
  }
}

export type EncoderSession = {
  encode: EncodeFn;
  /** Deletes every temporary output except `keep`. */
  cleanup: (keep?: string) => void;
};

/**
 * Encoder for one photo. Renders once per long edge and re-encodes from that
 * render for each quality, so a size search doesn't decode the original
 * again for every attempt.
 */
export function createEncoder(id: string, width: number, height: number): EncoderSession {
  const renders = new Map<number, Promise<ImageRef>>();
  const outputs: string[] = [];

  const render = (longEdge: number) => {
    let ref = renders.get(longEdge);
    if (!ref) {
      const context = ImageManipulator.manipulate(photoUri(id));
      const resize = capLongEdge(width, height, longEdge);
      if (resize) context.resize(resize);
      ref = context.renderAsync();
      renders.set(longEdge, ref);
    }
    return ref;
  };

  const encode: EncodeFn = async (quality, longEdge) => {
    const image = await render(longEdge);
    const result = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    outputs.push(result.uri);
    const file = new File(result.uri);
    return {
      uri: result.uri,
      bytes: file.size,
      width: result.width,
      height: result.height,
      quality,
      longEdge,
    };
  };

  return {
    encode,
    cleanup(keep) {
      for (const uri of outputs) {
        if (uri === keep) continue;
        try {
          const file = new File(uri);
          if (file.exists) file.delete();
        } catch {
          // Temporary file already gone.
        }
      }
    },
  };
}

export type Verification = { ok: true } | { ok: false; reason: string };

/** Confirms the copy exists, isn't empty, and decodes at the expected size. */
export async function verifyOutput(output: Encoded): Promise<Verification> {
  try {
    const file = new File(output.uri);
    if (!file.exists) return { ok: false, reason: 'The copy wasn’t written.' };
    if (file.size <= 0) return { ok: false, reason: 'The copy is empty.' };
    const decoded = await ImageManipulator.manipulate(output.uri).renderAsync();
    if (decoded.width !== output.width || decoded.height !== output.height) {
      return { ok: false, reason: 'The copy didn’t decode at the expected size.' };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'The copy couldn’t be read back.',
    };
  }
}

/** Saves the copy into Photos as a new item. Returns the new asset id. */
export async function saveToPhotos(uri: string): Promise<string> {
  const asset = await Asset.create(uri);
  return asset.id;
}

export async function shareFile(uri: string) {
  if (await isAvailableAsync())
    await shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
}

export function discardFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}
