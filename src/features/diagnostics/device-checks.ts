import { File } from 'expo-file-system';
import { Asset } from 'expo-media-library';

import { formatBytes } from '@/domain/bytes';
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
