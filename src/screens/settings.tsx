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
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { usePreferences, type AppearancePreference } from '@/state/preferences';
import { gutter, spacing, useTheme } from '@/theme';

/**
 * Settings sheet. Grouped rows use native controls from @expo/ui (a SwiftUI
 * Form on iOS), so switches and menus behave exactly like iOS Settings.
 */
export function SettingsScreen() {
  const { colors } = useTheme();
  const { appearance, lessMotion, haptics, setAppearance, setLessMotion, setHaptics } =
    usePreferences();

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

          <FieldGroup.Section title="Privacy">
            <Text>
              MediaCare works on your iPhone. It has no account and does not upload your photos.
              This build does not request photo access yet; it shows sample images only.
            </Text>
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
