import {
  Button as NativeButton,
  FieldGroup,
  Host,
  Picker,
  Row,
  Spacer,
  Switch,
  Text,
} from '@expo/ui';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { openSettings } from '@/services/media/photo-library';
import { useCatalog } from '@/state/catalog';
import { useCleanSession } from '@/state/clean-session';
import { usePreferences, type AppearancePreference } from '@/state/preferences';
import { gutter, spacing, useTheme } from '@/theme';

/**
 * Settings sheet. Grouped rows use native controls from @expo/ui (a SwiftUI
 * Form on iOS), so switches and menus behave exactly like iOS Settings.
 */
export function SettingsScreen() {
  const { colors } = useTheme();
  const {
    appearance,
    lessMotion,
    haptics,
    allowRemoval,
    setAppearance,
    setLessMotion,
    setHaptics,
    setAllowRemoval,
  } = usePreferences();

  const access = useCatalog((catalog) => catalog.access);
  const cataloged = useCatalog((catalog) => catalog.items.length);

  const accessLabel =
    access === 'full'
      ? 'All photos'
      : access === 'limited'
        ? 'Selected photos'
        : access === 'denied'
          ? 'Not allowed'
          : 'Not asked yet';

  const confirmClear = () =>
    Alert.alert(
      'Clear MediaCare data?',
      'This removes MediaCare’s catalog, scan history, protection marks and list of copies from this iPhone. Your photos in Photos are not touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear data',
          style: 'destructive',
          onPress: () => {
            useCleanSession.getState().reset();
            useCatalog
              .getState()
              .clear()
              .catch(() => {});
          },
        },
      ],
    );

  const version = Constants.expoConfig?.version ?? 'unknown';
  const sdk = Constants.expoConfig?.sdkVersion ?? 'unknown';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <AppText variant="title2">Settings</AppText>
        <Button title="Done" variant="plain" onPress={() => router.back()} />
      </View>

      <Host style={styles.host} seedColor={colors.accent}>
        <FieldGroup>
          <FieldGroup.Section title="Appearance">
            <Row>
              <Text>Theme</Text>
              <Spacer />
              <Picker<AppearancePreference>
                selectedValue={appearance}
                onValueChange={setAppearance}
                appearance="menu"
              >
                <Picker.Item label="System" value="system" />
                <Picker.Item label="Light" value="light" />
                <Picker.Item label="Dark" value="dark" />
              </Picker>
            </Row>
          </FieldGroup.Section>

          <FieldGroup.Section title="Motion & Feedback">
            <Switch label="Less motion" value={lessMotion} onValueChange={setLessMotion} />
            <Switch label="Haptics" value={haptics} onValueChange={setHaptics} />
            <FieldGroup.SectionFooter>
              <Text>
                Less motion replaces movement with simple fades. If Reduce Motion is on in iOS
                Settings, MediaCare always follows it.
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          <FieldGroup.Section title="Photos">
            <Row>
              <Text>Access</Text>
              <Spacer />
              <Text>{accessLabel}</Text>
            </Row>
            {access === 'limited' ? (
              <NativeButton
                variant="text"
                label="Manage selected photos"
                onPress={() => {
                  useCatalog
                    .getState()
                    .manageSelection()
                    .catch(() => {});
                }}
              />
            ) : null}
            {access !== 'undetermined' && access !== 'unknown' ? (
              <NativeButton
                variant="text"
                label="Change in iOS Settings"
                onPress={() => {
                  openSettings().catch(() => {});
                }}
              />
            ) : null}
            <FieldGroup.SectionFooter>
              <Text>
                In Expo Go, photo access belongs to the Expo Go app: Settings, Expo Go, Photos.
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          <FieldGroup.Section title="Privacy & Data">
            <Text>
              MediaCare works on your iPhone. It has no account and uploads nothing. Scans read
              dates, sizes and types, not the pictures.
            </Text>
            <Row>
              <Text>Items in MediaCare’s catalog</Text>
              <Spacer />
              <Text>{cataloged.toLocaleString()}</Text>
            </Row>
            <Switch
              label="Allow removing photos"
              value={allowRemoval}
              onValueChange={setAllowRemoval}
            />
            <NativeButton variant="text" label="Clear MediaCare data…" onPress={confirmClear} />
            <FieldGroup.SectionFooter>
              <Text>
                With removing on, the Removal plan can move the photos you marked to Recently
                Deleted in Photos, after iOS asks you to confirm. Clearing MediaCare data never
                deletes anything from Photos.
              </Text>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>

          <FieldGroup.Section title="Help">
            <NativeButton
              variant="text"
              label="Show introduction again"
              onPress={() => {
                router.back();
                router.push('/welcome');
              }}
            />
            <NativeButton
              variant="text"
              label="About photo access"
              onPress={() => {
                router.back();
                router.push('/access');
              }}
            />
          </FieldGroup.Section>

          {__DEV__ ? (
            <FieldGroup.Section title="Developer">
              <NativeButton
                variant="text"
                label="Components & Motion gallery"
                onPress={() => {
                  router.back();
                  router.push('/gallery');
                }}
              />
              <NativeButton
                variant="text"
                label="Diagnostics"
                onPress={() => {
                  router.back();
                  router.push('/diagnostics');
                }}
              />
            </FieldGroup.Section>
          ) : null}

          <FieldGroup.Section title="About">
            <Row>
              <Text>Version</Text>
              <Spacer />
              <Text>{version}</Text>
            </Row>
            <Row>
              <Text>Expo SDK</Text>
              <Spacer />
              <Text>{sdk}</Text>
            </Row>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  host: { flex: 1 },
});
