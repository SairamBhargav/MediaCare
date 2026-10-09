import type { Href } from 'expo-router';

import type { IconName } from '@/components/icon';
import { MAX_COLLAGE_PHOTOS, MIN_COLLAGE_PHOTOS } from '@/domain/collage';
import { MAX_SLIDESHOW_PHOTOS, MIN_SLIDESHOW_PHOTOS } from '@/domain/video';
import { creationToolsAvailable } from '@/services/media/creations';
import { visualAnalysisAvailable } from '@/services/media/visual-analysis';

export type StudioToolId =
  | 'copy'
  | 'adjust'
  | 'enhance'
  | 'red-eye'
  | 'cutout'
  | 'passport'
  | 'collage'
  | 'slideshow'
  | 'video';

type StudioTool = {
  title: string;
  /** One plain sentence for the Studio card. */
  description: string;
  icon: IconName;
  accepts: 'photo' | 'video';
  min: number;
  max: number;
  /** Where the tool opens; multi-item tools read their items from the draft. */
  route: (id: string) => Href;
  /** Whether this build can run it (Expo Go and older builds lack native tools). */
  available: () => boolean;
};

const always = () => true;

export const STUDIO_TOOLS: Record<StudioToolId, StudioTool> = {
  copy: {
    title: 'Smaller copy',
    description: 'Make a lighter copy for email or forms, with the real size shown first.',
    icon: 'compress',
    accepts: 'photo',
    min: 1,
    max: 1,
    route: (id) => ({ pathname: '/export/[id]', params: { id } }),
    available: always,
  },
  adjust: {
    title: 'Adjust',
    description: 'Turn, straighten, crop, and change brightness, color and warmth.',
    icon: 'adjust',
    accepts: 'photo',
    min: 1,
    max: 1,
    route: (id) => ({ pathname: '/adjust/[id]', params: { id } }),
    available: creationToolsAvailable,
  },
  enhance: {
    title: 'Enhance',
    description: 'Apple’s automatic fix for light, color and contrast.',
    icon: 'enhance',
    accepts: 'photo',
    min: 1,
    max: 1,
    route: (id) => ({ pathname: '/tool/[id]', params: { id, tool: 'enhance' } }),
    available: visualAnalysisAvailable,
  },
  'red-eye': {
    title: 'Fix red-eye',
    description: 'Finds red eyes from a flash and corrects them.',
    icon: 'eye',
    accepts: 'photo',
    min: 1,
    max: 1,
    route: (id) => ({ pathname: '/tool/[id]', params: { id, tool: 'red-eye' } }),
    available: visualAnalysisAvailable,
  },
  cutout: {
    title: 'Remove background',
    description: 'Lift the subject off the background as a transparent picture.',
    icon: 'cutout',
    accepts: 'photo',
    min: 1,
    max: 1,
    route: (id) => ({ pathname: '/tool/[id]', params: { id, tool: 'cutout' } }),
    available: visualAnalysisAvailable,
  },
  passport: {
    title: 'Passport photo',
    description: 'Frame a face to the official U.S. size, and fine-tune it yourself.',
    icon: 'passport',
    accepts: 'photo',
    min: 1,
    max: 1,
    route: (id) => ({ pathname: '/passport/[id]', params: { id } }),
    available: visualAnalysisAvailable,
  },
  collage: {
    title: 'Collage',
    description: 'Put 2 to 6 photos together in one picture.',
    icon: 'collage',
    accepts: 'photo',
    min: MIN_COLLAGE_PHOTOS,
    max: MAX_COLLAGE_PHOTOS,
    route: () => '/collage',
    available: creationToolsAvailable,
  },
  slideshow: {
    title: 'Slideshow',
    description: 'Turn photos into a short video with gentle fades.',
    icon: 'slideshow',
    accepts: 'photo',
    min: MIN_SLIDESHOW_PHOTOS,
    max: MAX_SLIDESHOW_PHOTOS,
    route: () => '/slideshow',
    available: creationToolsAvailable,
  },
  video: {
    title: 'Trim or shrink a video',
    description: 'Cut the start or end, or make a smaller copy to share.',
    icon: 'video',
    accepts: 'video',
    min: 1,
    max: 1,
    route: (id) => ({ pathname: '/video/[id]', params: { id } }),
    available: creationToolsAvailable,
  },
};

export const STUDIO_ORDER: readonly StudioToolId[] = [
  'adjust',
  'collage',
  'slideshow',
  'video',
  'copy',
  'enhance',
  'passport',
  'cutout',
  'red-eye',
];

/** Single-photo tools offered from the photo viewer's Edit menu. */
export const PHOTO_EDIT_TOOLS: readonly StudioToolId[] = [
  'adjust',
  'enhance',
  'red-eye',
  'cutout',
  'passport',
];

export function isStudioToolId(value: unknown): value is StudioToolId {
  return typeof value === 'string' && value in STUDIO_TOOLS;
}
