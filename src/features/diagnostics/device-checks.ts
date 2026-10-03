import { File } from 'expo-file-system';
import { Asset } from 'expo-media-library';

import { formatBytes } from '@/domain/bytes';
import { provesCameraOriginal } from '@/domain/exact-copies';
import type { PhotoItem } from '@/domain/media';
import { createEncoder, verifyOutput } from '@/services/exports/exporter';

import { extensionOf } from './library-facts';

/**
 * On-device checks for open capability questions. Each produces plain text
 * for a report the owner can share. Run only on explicit request: the file
 * check can download photos from iCloud.
 */

/** Spike S1: what file does iOS hand back for a photo, and is it the original? */
export async function fileCheck(items: readonly PhotoItem[]): Promise<string> {
  const lines: string[] = [];
  for (const item of items) {
    const asset = new Asset(item.id);
    try {
      const inCloud = await asset.getIsInCloud();
      const started = Date.now();
      const uri = await asset.getUri();
      const elapsed = Date.now() - started;
      const file = new File(uri);
      const info = file.info({ md5: true });
      const uriExtension = extensionOf(uri.split('/').pop() ?? null);
      const nameExtension = extensionOf(item.filename);
      lines.push(
        [
          `• ${item.filename ?? 'no name'} (${item.width}×${item.height})`,
          `  in iCloud only before check: ${inCloud ? 'yes' : 'no'}; resolve took ${elapsed} ms`,
          `  file returned: .${uriExtension}${uriExtension === nameExtension ? ' (matches name)' : ` (name says .${nameExtension}: likely an edited or converted rendition)`}`,
          `  path ends: .../${uri.split('/').slice(-3).join('/')}`,
          `  size: ${info.size !== undefined ? formatBytes(info.size) : 'unknown'}; md5: ${info.md5 ?? 'n/a'}`,
        ].join('\n'),
      );
    } catch (error) {
      lines.push(
        `• ${item.filename ?? item.id}: failed (${error instanceof Error ? error.message : 'unknown error'})`,
      );
    }
  }
  return lines.join('\n');
}

const tail = (uri: string) => `.../${uri.split('/').slice(-3).join('/')}`;

/** Size and MD5 of a local file, for the report. */
function describeFile(uri: string): string {
  try {
    const info = new File(uri).info({ md5: true });
    return `size: ${info.size !== undefined ? formatBytes(info.size) : 'unknown'}; md5: ${info.md5 ?? 'n/a'}`;
  } catch (error) {
    return `unreadable (${error instanceof Error ? error.message : 'unknown error'})`;
  }
}

/**
 * P2-DUP-001 evidence: what file iOS returns for photos that were probably
 * edited (modified well after capture). The exact copies check counts only
 * files that pass the camera-original test; this shows whether edited
 * photos fail it as expected. Photos stored only in iCloud are skipped,
 * never downloaded.
 */
export async function editedCheck(items: readonly PhotoItem[]): Promise<string> {
  const candidates = items
    .filter(
      (item) =>
        item.kind === 'photo' &&
        !item.subtypes.includes('livePhoto') &&
        item.version !== null &&
        item.capturedMs !== null,
    )
    .sort((a, b) => b.version! - b.capturedMs! - (a.version! - a.capturedMs!))
    .slice(0, 5);
  if (candidates.length === 0) return 'No non-Live photos in the catalog.';
  const lines = [
    'Most-modified-after-capture photos first. Edit a photo in Photos (e.g. crop it), Scan again, then run this.',
  ];
  for (const item of candidates) {
    const asset = new Asset(item.id);
    const modifiedAfter = Math.round((item.version! - item.capturedMs!) / 1000);
    try {
      if (await asset.getIsInCloud()) {
        lines.push(`• ${item.filename ?? item.id}: in iCloud only, skipped (not downloaded)`);
        continue;
      }
      const uri = await asset.getUri();
      lines.push(
        [
          `• ${item.filename ?? 'no name'}: modified ${modifiedAfter.toLocaleString()} s after capture`,
          `  file returned: ${tail(uri)}`,
          `  passes camera-original test: ${provesCameraOriginal(uri, item.filename) ? 'YES (would be checked)' : 'no (reported as edited/not original)'}`,
          `  ${describeFile(uri)}`,
        ].join('\n'),
      );
    } catch (error) {
      lines.push(
        `• ${item.filename ?? item.id}: failed (${error instanceof Error ? error.message : 'unknown error'})`,
      );
    }
  }
  return lines.join('\n');
}

/**
 * P2-DUP-001 evidence: for Live Photos, the still file iOS returns and the
 * paired video. Live Photos are excluded from exact copies until both
 * halves can be compared. Photos stored only in iCloud are skipped.
 */
export async function livePhotoCheck(items: readonly PhotoItem[]): Promise<string> {
  const live = items.filter((item) => item.subtypes.includes('livePhoto')).slice(0, 3);
  if (live.length === 0) return 'No Live Photos in the catalog.';
  const lines: string[] = [];
  for (const item of live) {
    const asset = new Asset(item.id);
    try {
      if (await asset.getIsInCloud()) {
        lines.push(`• ${item.filename ?? item.id}: in iCloud only, skipped (not downloaded)`);
        continue;
      }
      const uri = await asset.getUri();
      const video = await asset.getLivePhotoVideoUri();
      lines.push(
        [
          `• ${item.filename ?? 'no name'}`,
          `  still: ${tail(uri)}; camera-original test: ${provesCameraOriginal(uri, item.filename) ? 'passes' : 'fails'}`,
          `  still ${describeFile(uri)}`,
          video
            ? `  paired video: ${tail(video)}; ${describeFile(video)}`
            : '  paired video: none returned',
        ].join('\n'),
      );
    } catch (error) {
      lines.push(
        `• ${item.filename ?? item.id}: failed (${error instanceof Error ? error.message : 'unknown error'})`,
      );
    }
  }
  return lines.join('\n');
}

/** Spike S5: what do copies made with the image manipulator look like? */
export async function exportCheck(item: PhotoItem): Promise<string> {
  const encoder = createEncoder(item.id, item.width, item.height);
  const longEdge = Math.max(item.width, item.height);
  const lines: string[] = [`Source: ${item.filename ?? item.id} (${item.width}×${item.height})`];
  try {
    for (const [quality, edge] of [
      [0.9, longEdge],
      [0.75, 2048],
      [0.6, 1080],
    ] as const) {
      const output = await encoder.encode(quality, Math.min(edge, longEdge));
      const verification = await verifyOutput(output);
      lines.push(
        `• JPEG q${Math.round(quality * 100)} @ ${output.width}×${output.height}: ${formatBytes(output.bytes)}, ${verification.ok ? 'decodes OK' : `FAILED: ${verification.reason}`}`,
      );
    }
    lines.push(
      'Orientation: compare the copies with the original in Photos (tilted photos are the real test).',
    );
  } catch (error) {
    lines.push(`Failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  } finally {
    encoder.cleanup();
  }
  return lines.join('\n');
}
