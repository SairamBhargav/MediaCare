import Constants from 'expo-constants';
import { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Surface } from '@/components/surface';
import { exportCheck, fileCheck } from '@/features/diagnostics/device-checks';
import { formatFacts, libraryFacts } from '@/features/diagnostics/library-facts';
import { useCatalog } from '@/state/catalog';
import { gutter, spacing, useTheme } from '@/theme';

/**
 * Development diagnostics: gathers on-device evidence for the open
 * capability questions (docs/CAPABILITIES.md) into a report the owner can
 * share. Library facts read only the catalog; the file and copy checks run
 * only when asked because they read full photos.
 */
export function DiagnosticsScreen() {
  const { colors } = useTheme();
  const items = useCatalog((catalog) => catalog.items);
  const access = useCatalog((catalog) => catalog.access);
  const [fileReport, setFileReport] = useState<string | null>(null);
  const [exportReport, setExportReport] = useState<string | null>(null);
  const [busy, setBusy] = useState<'file' | 'export' | null>(null);

  const photos = items.filter((item) => item.kind === 'photo');
  const header = [
    `MediaCare diagnostics, ${new Date().toISOString()}`,
    `App ${Constants.expoConfig?.version ?? '?'} · Expo SDK ${Constants.expoConfig?.sdkVersion ?? '?'} · ${Platform.OS} ${String(Platform.Version)}`,
    `Photo access: ${access}`,
  ].join('\n');
  const facts = formatFacts(libraryFacts(items));
  const report = [
    header,
    '',
    'LIBRARY FACTS',
    facts,
    '',
    'FILE CHECK',
    fileReport ?? 'not run',
    '',
    'COPY CHECK',
    exportReport ?? 'not run',
  ].join('\n');

  const run = async (kind: 'file' | 'export') => {
    setBusy(kind);
    try {
      if (kind === 'file') setFileReport(await fileCheck(photos.slice(0, 3)));
      else if (photos[0]) setExportReport(await exportCheck(photos[0]));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <AppText variant="body" color="secondaryLabel">
        These checks gather facts about how iOS hands MediaCare your photos. Nothing is uploaded;
        share the report only if you want to.
      </AppText>

      <Section
        title="Library facts"
        body={items.length === 0 ? 'Scan your library first.' : facts}
      />

      <Surface style={styles.section}>
        <AppText variant="headline">File check (3 newest photos)</AppText>
        <AppText variant="footnote" color="secondaryLabel">
          Reads the full-size file iOS returns for each photo. Photos stored only in iCloud will be
          downloaded.
        </AppText>
        <Button
          title={busy === 'file' ? 'Checking…' : 'Run file check'}
          variant="secondary"
          loading={busy === 'file'}
          disabled={photos.length === 0 || busy !== null}
          onPress={() => run('file')}
        />
        {fileReport ? <Mono text={fileReport} /> : null}
      </Surface>

      <Surface style={styles.section}>
        <AppText variant="headline">Copy check (newest photo)</AppText>
        <AppText variant="footnote" color="secondaryLabel">
          Makes three temporary JPEG copies, measures them and checks they open. Nothing is saved to
          Photos.
        </AppText>
        <Button
          title={busy === 'export' ? 'Checking…' : 'Run copy check'}
          variant="secondary"
          loading={busy === 'export'}
          disabled={photos.length === 0 || busy !== null}
          onPress={() => run('export')}
        />
        {exportReport ? <Mono text={exportReport} /> : null}
      </Surface>

      <Button
        title="Share report"
        icon="info"
        onPress={() => {
          Share.share({ message: report }).catch(() => {});
        }}
        block
      />
    </ScrollView>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <Surface style={styles.section}>
      <AppText variant="headline">{title}</AppText>
      <Mono text={body} />
    </Surface>
  );
}

function Mono({ text }: { text: string }) {
  return (
    <AppText variant="footnote" style={styles.mono} selectable>
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  content: { padding: gutter, gap: spacing.lg, paddingBottom: spacing.xxxl },
  section: { gap: spacing.xs },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
});
