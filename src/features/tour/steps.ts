import type { TabName } from '@/domain/tabs';

/**
 * The guided tour (first run, and Settings → Help). Each step points at a
 * real control on one of the tabs, marked in the UI with <TourAnchor id>.
 * Written for someone new to apps like this: short sentences, what it does,
 * and that nothing is deleted.
 *
 * - `target`: anchor to highlight; when it isn't on screen (no results yet,
 *   say) the card shows in the middle instead.
 * - `tab`: the tab the step happens on; the tour goes there first.
 * - `tapToContinue`: the highlighted control can be tapped for real and the
 *   tour moves on (Next works too).
 */
export type TourStep = {
  id: string;
  tab: TabName;
  target?: string;
  title: string;
  body: string;
  tapToContinue?: boolean;
};

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    tab: 'index',
    title: 'Welcome to MediaCare',
    body: 'This short tour shows you around. It takes about a minute. Tap Next to go on, or Skip tour at any time.',
  },
  {
    id: 'check',
    tab: 'index',
    target: 'clean.action',
    title: 'Start here',
    body: 'This checks the photos on your iPhone for repeated shots, blurry photos, copies and big videos. Nothing is deleted, and nothing leaves your phone.',
  },
  {
    id: 'findings',
    tab: 'index',
    target: 'clean.findings',
    title: 'What MediaCare found',
    body: 'After a check, the results are listed here. Tap one to look through the photos. MediaCare suggests which to keep; you always decide.',
  },
  {
    id: 'to-library',
    tab: 'index',
    target: 'tab.library',
    title: 'All your photos',
    body: 'Tap Library at the bottom of the screen.',
    tapToContinue: true,
  },
  {
    id: 'library',
    tab: 'library',
    target: 'library.jump',
    title: 'Find a date quickly',
    body: 'Your photos are sorted by month. Tap Jump to and pick a year and month. Tap any photo to see it big; pinch to zoom, and swipe down to close it.',
  },
  {
    id: 'swipe',
    tab: 'library',
    title: 'Swipe between pages',
    body: 'You can also swipe left or right anywhere on the screen to move between Clean, Library and Studio, like turning pages.',
  },
  {
    id: 'to-studio',
    tab: 'library',
    target: 'tab.studio',
    title: 'Make something new',
    body: 'Tap Studio at the bottom of the screen.',
    tapToContinue: true,
  },
  {
    id: 'studio',
    tab: 'studio',
    target: 'studio.tools',
    title: 'Studio tools',
    body: 'Fix or resize a photo, make a collage, a slideshow or a passport photo, or trim a video. Your original is never changed: the result is saved as a new photo.',
  },
  {
    id: 'settings',
    tab: 'index',
    target: 'clean.settings',
    title: 'Settings',
    body: 'Tap the gear for Settings. Turn on Bigger text if the words are small, and you can start this tour again from there.',
  },
  {
    id: 'done',
    tab: 'index',
    title: 'You’re all set',
    body: 'A good first step: tap Check my photos on this page. You can’t break anything; MediaCare never deletes photos on its own.',
  },
];
