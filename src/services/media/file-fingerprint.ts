import { File } from 'expo-file-system';
import { Asset } from 'expo-media-library';

import { bytesEqual } from '@/domain/exact-copies';

/**
 * File access for "Find exact copies", verified against the installed SDK 57
 * sources (expo-media-library ios/next, expo-file-system ios):
 *
 *  - `getIsInCloud()` asks Photos for the content editing input with
 *    network access off, so it never downloads. If iOS omits the in-cloud
 *    flag, the answer is "not in iCloud".
 *  - `getUri()` returns `PHContentEditingInput.fullSizeImageURL` with
 *    network access on. It is only called after `getIsInCloud()` said the
 *    photo is on this iPhone, so nothing should download.
 *  - `File.info({ md5: true })` hashes in 64 KB chunks natively (bounded
 *    memory) but is synchronous, so it holds the JS thread while it runs.
 *  - `FileHandle.readBytes(n)` returns up to n bytes, empty at the end.
 */

export function isInCloud(id: string): Promise<boolean> {
  return new Asset(id).getIsInCloud();
}

export function resolveUri(id: string): Promise<string> {
  return new Asset(id).getUri();
}

export function fileSize(uri: string): number | null {
  try {
    const info = new File(uri).info();
    return info.exists && info.size !== undefined ? info.size : null;
  } catch {
    return null;
  }
}

export function fileMd5(uri: string): string | null {
  try {
    return new File(uri).info({ md5: true }).md5 ?? null;
  } catch {
    return null;
  }
}

const CHUNK_BYTES = 256 * 1024;
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Compares two files byte by byte in 256 KB chunks, yielding between
 * chunks. Any doubt (different sizes, a short read, an error) answers
 * "not identical": a missed match is acceptable, a false one is not.
 */
export async function sameBytes(uriA: string, uriB: string): Promise<boolean> {
  const sizeA = fileSize(uriA);
  if (sizeA === null || sizeA !== fileSize(uriB)) return false;
  let a: ReturnType<File['open']> | null = null;
  let b: ReturnType<File['open']> | null = null;
  try {
    a = new File(uriA).open();
    b = new File(uriB).open();
    let compared = 0;
    for (;;) {
      const chunkA = a.readBytes(CHUNK_BYTES);
      const chunkB = b.readBytes(CHUNK_BYTES);
      if (!bytesEqual(chunkA, chunkB)) return false;
      if (chunkA.length === 0) return compared === sizeA;
      compared += chunkA.length;
      await yieldToUi();
    }
  } catch {
    return false;
  } finally {
    a?.close();
    b?.close();
  }
}
