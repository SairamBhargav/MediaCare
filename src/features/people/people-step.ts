import {
  loadFaceScans,
  loadFaces,
  saveFaceScans,
  saveGrouping,
  type FaceScanResult,
} from '@/db/people-repo';
import { groupFaces } from '@/domain/people';
import {
  FACES_IMPLEMENTATION,
  facesAvailable,
  findFaces,
  type FacesResult,
} from '@/services/media/visual-analysis';
import type { PeopleStep } from '@/services/scan/visual-analysis-job';
import { useCatalog } from '@/state/catalog';
import { usePeople } from '@/state/people';
import { yieldToUi } from '@/utils/yield-to-ui';

/** Results that are final for this photo; the rest (still in iCloud, failed) are tried again next time. */
const FINAL = new Set(['ok', 'missing', 'unsupported']);

/** The People step of the photo check (ADR-0011), or undefined where this build can't find faces. */
export function peopleStep(): PeopleStep | undefined {
  if (!facesAvailable()) return undefined;
  return {
    scanned: async () => {
      const { byId } = useCatalog.getState();
      const rows = await loadFaceScans();
      return new Set(
        rows
          .filter(
            (row) =>
              row.implementation === FACES_IMPLEMENTATION &&
              row.assetVersion === (byId.get(row.assetId)?.version ?? null),
          )
          .map((row) => row.assetId),
      );
    },
    find: findFaces,
    save: async (items, results) => {
      const byId = new Map((results as FacesResult[]).map((result) => [result.id, result]));
      const rows: FaceScanResult[] = [];
      for (const item of items) {
        const result = byId.get(item.id);
        if (!result || !FINAL.has(result.status)) continue;
        rows.push({
          assetId: item.id,
          assetVersion: item.version,
          status: result.status,
          faces: (result.faces ?? [])
            .filter((face) => face.status === 'ok')
            .map((face) => ({
              x: face.x,
              y: face.y,
              width: face.width,
              height: face.height,
              quality: face.quality,
              applePrint: face.applePrint ?? null,
              modelPrint: face.modelPrint ?? null,
            })),
        });
      }
      await saveFaceScans(rows, FACES_IMPLEMENTATION, Date.now());
    },
    group: async () => {
      const faces = await loadFaces({ prints: true });
      const grouping = await groupFaces(faces, { onYield: yieldToUi });
      await saveGrouping(grouping, Date.now());
      await usePeople.getState().load();
    },
  };
}
