import type { IconName } from '@/components/icon';
import type { FindingCategory } from '@/domain/findings';

type CategoryMeta = {
  title: string;
  icon: IconName;
  /** One-line explanation shown on cards and at the top of the category screen. */
  description: string;
  /** Noun for the findings in this category, singular and plural. */
  unit: [string, string];
};

/**
 * User-facing copy for each finding category. Exact copies and similar shots
 * are deliberately separate concepts with separate labels (docs/PRD.md).
 */
export const CATEGORY_META: Record<FindingCategory, CategoryMeta> = {
  similar: {
    title: 'Similar shots',
    icon: 'stack',
    description: 'Bursts and near-repeats. Keep the best, review the rest.',
    unit: ['group', 'groups'],
  },
  exact: {
    title: 'Exact copies',
    icon: 'duplicate',
    description: 'The same file saved more than once.',
    unit: ['set', 'sets'],
  },
  blurry: {
    title: 'Possibly blurry',
    icon: 'blur',
    description: 'Little sharp detail. Blur is sometimes on purpose, so look before you decide.',
    unit: ['photo', 'photos'],
  },
  large: {
    title: 'Large files',
    icon: 'storage',
    description: 'The biggest items, like panoramas.',
    unit: ['file', 'files'],
  },
};

export function countLabel(count: number, [singular, plural]: [string, string]): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}
