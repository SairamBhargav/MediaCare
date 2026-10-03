import { Linking } from 'react-native';
import {
  Asset,
  AssetField,
  MediaType,
  Query,
  addListener,
  getPermissionsAsync,
  presentPermissionsPicker,
  requestPermissionsAsync,
  type AssetMetadata,
  type MediaLibraryAssetsChangeEvent,
  type PermissionResponse,
} from 'expo-media-library';

import type { PhotoRecord } from '@/domain/media';

/**
 * Adapter over the iOS Photos library (expo-media-library, SDK 57 object API).
 *
 * Deliberately metadata-only during scans: `Query.exeForMetadata()` reads no
 * files and downloads nothing from iCloud. We avoid `Asset.getUri()` /
 * `getInfo()` here because on iOS they resolve the full-size *current*
 * rendition (edited version if edited) and download it from iCloud if needed
 * (verified in expo-media-library's iOS source; docs/CAPABILITIES.md).
 */
export type PhotoAccess = 'undetermined' | 'denied' | 'limited' | 'full';

export function toAccess(response: PermissionResponse): PhotoAccess {
  if (response.granted) return response.accessPrivileges === 'limited' ? 'limited' : 'full';
  return response.canAskAgain ? 'undetermined' : 'denied';
}

export async function getAccess(): Promise<PhotoAccess> {
  return toAccess(await getPermissionsAsync());
}

export async function requestAccess(): Promise<PhotoAccess> {
  return toAccess(await requestPermissionsAsync());
}

/** iOS sheet for changing which photos MediaCare can see (limited access only). */
export async function manageSelection() {
  await presentPermissionsPicker();
}

export function openSettings() {
  return Linking.openSettings();
}

const PAGE_SIZE = 500;

/** Every accessible asset's metadata, newest first, page by page. */
export async function listAllMetadata(
  onPage?: (fetched: number) => void,
  shouldStop?: () => boolean,
): Promise<AssetMetadata[]> {
  const all: AssetMetadata[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    if (shouldStop?.()) break;
    const page = await new Query()
      .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
      .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
      .limit(PAGE_SIZE)
      .offset(offset)
      .exeForMetadata();
    all.push(...page);
    onPage?.(all.length);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

/** Photos subtypes (screenshot, live photo, panorama…). Cheap: no file access. */
export async function getSubtypes(id: string): Promise<string[]> {
  try {
    return (await new Asset(id).getMediaSubtypes()).map(String);
  } catch {
    return [];
  }
}

export function toRecord(metadata: AssetMetadata, subtypes: readonly string[]): PhotoRecord {
  return {
    id: metadata.id,
    kind: metadata.mediaType === MediaType.VIDEO ? 'video' : 'photo',
    creationTime: metadata.creationTime,
    modificationTime: metadata.modificationTime,
    width: metadata.width,
    height: metadata.height,
    // Already milliseconds: expo-media-library maps PHAsset.duration (seconds) * 1000 (verified
    // in its iOS AssetMapper). Creation and modification times are ms since 1970.
    durationMs: metadata.duration,
    isFavorite: metadata.isFavorite,
    subtypes,
    filename: metadata.filename,
  };
}

export function watchLibrary(listener: (event: MediaLibraryAssetsChangeEvent) => void) {
  return addListener(listener);
}

/**
 * `ph://` URL that expo-image and expo-image-manipulator load straight from
 * Photos. In the SDK 57 object API, asset ids already are
 * `ph://<localIdentifier>` (expo-media-library iOS AssetMapper), so they are
 * used as-is; a bare local identifier gets the prefix. Doubling it
 * (`ph://ph://…`) makes every thumbnail fail to load.
 */
export function photoUri(id: string): string {
  return id.startsWith('ph://') ? id : `ph://${id}`;
}
