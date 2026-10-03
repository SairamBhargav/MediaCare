import { ActionSheetIOS, Alert, Platform } from 'react-native';

export type PhotoAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

/**
 * Native action list for a photo: the iOS action sheet, or an alert with
 * buttons elsewhere. Used for long-press; every action is also exposed as a
 * VoiceOver custom action on the photo itself, so nothing is long-press only.
 */
export function showPhotoActions(title: string, actions: readonly PhotoAction[]) {
  if (actions.length === 0) return;
  if (Platform.OS === 'ios') {
    const options = [...actions.map((action) => action.label), 'Cancel'];
    const destructiveIndex = actions.findIndex((action) => action.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
      },
      (index) => actions[index]?.onPress(),
    );
    return;
  }
  Alert.alert(title, undefined, [
    ...actions.map((action) => ({
      text: action.label,
      onPress: action.onPress,
      style: action.destructive ? ('destructive' as const) : ('default' as const),
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
