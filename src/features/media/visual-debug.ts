import { featureDistance, normalize } from '@/domain/visual-findings';
import { useCatalog } from '@/state/catalog';

/**
 * Development-build tuning readout: how alike two photos look (feature
 * print distance) and how sharp each is, from stored analysis. Null when
 * either photo hasn't been looked at. Shown only in development builds.
 */
export function tuningLine(photoId: string, keeperId: string): string | null {
  const rows = useCatalog.getState().visualRows;
  const photo = rows.get(photoId);
  const keeper = rows.get(keeperId);
  if (!photo?.featurePrint || !keeper?.featurePrint) return null;
  const distance = featureDistance(normalize(photo.featurePrint), normalize(keeper.featurePrint));
  return `Tuning: looks-alike ${distance.toFixed(3)} · sharpness ${Math.round(
    photo.sharpnessMaxTile ?? 0,
  )} vs keeper ${Math.round(keeper.sharpnessMaxTile ?? 0)}`;
}
