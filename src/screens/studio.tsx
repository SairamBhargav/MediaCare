import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';

/**
 * Studio holds creation and repair tools. None is implemented yet, and the
 * product rule is to keep unbuilt tools out of navigation, so this screen
 * says plainly what is coming and why it is not here yet.
 */
export function StudioScreen() {
  return (
    <Screen title="Studio">
      <Surface>
        <EmptyState
          icon="studio"
          title="Tools arrive with photo access"
          message="Studio will make smaller or cropped copies of your photos. Your originals stay exactly as they are. It needs real photo access, which comes in a later build."
        />
      </Surface>
    </Screen>
  );
}
