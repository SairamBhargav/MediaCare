import { insertDerivative } from '@/db/catalog-repo';

import { discardFile, saveToPhotos } from './exporter';

/**
 * Saves a finished temporary file to Photos as a new item, lists it in
 * Studio's history with its source and recipe, and removes the temporary
 * file. Returns the new Photos id. The history entry is best effort.
 */
export async function saveCreation(output: {
  uri: string;
  tool: string;
  /** First source photo or video; '' when there isn't a single source. */
  sourceId: string;
  format: 'jpeg' | 'png' | 'mp4';
  width: number;
  height: number;
  bytes: number;
  sourceBytes?: number | null;
  recipe?: Record<string, unknown>;
}): Promise<string> {
  const outputId = await saveToPhotos(output.uri);
  const now = Date.now();
  await insertDerivative({
    id: `${output.tool}-${now}`,
    source_asset_id: output.sourceId,
    output_asset_id: outputId,
    recipe: JSON.stringify({ tool: output.tool, ...output.recipe }),
    format: output.format,
    width: output.width,
    height: output.height,
    bytes: output.bytes,
    source_bytes: output.sourceBytes ?? null,
    created_at: now,
  }).catch(() => {});
  discardFile(output.uri);
  return outputId;
}
