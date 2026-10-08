import Constants from 'expo-constants';
import { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Surface } from '@/components/surface';
import {
  editedCheck,
  exportCheck,
  fileCheck,
  livePhotoCheck,
  visionCheck,
} from '@/features/diagnostics/device-checks';
import { visualAnalysisAvailable } from '@/services/media/visual-analysis';
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
  const [editedReport, setEditedReport] = useState<string | null>(null);
  const [liveReport, setLiveReport] = useState<string | null>(null);
  const [visionReport, setVisionReport] = useState<string | null>(null);
  const [busy, setBusy] = useState<'file' | 'export' | 'edited' | 'live' | 'vision' | null>(null);

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
    '',
    'EDITED PHOTO CHECK',
    editedReport ?? 'not run',
    '',
    'LIVE PHOTO CHECK',
    liveReport ?? 'not run',
    '',
    'VISION CHECK',
    visionReport ?? 'not run',
  ].join('\n');

  const run = async (kind: 'file' | 'export' | 'edited' | 'live' | 'vision') => {
    setBusy(kind);
    try {
      if (kind === 'file') setFileReport(await fileCheck(photos.slice(0, 3)));
      else if (kind === 'edited') setEditedReport(await editedCheck(items));
      else if (kind === 'live') setLiveReport(await livePhotoCheck(items));
      else if (kind === 'vision') {
        setVisionReport(
          await visionCheck(items).catch((error: unknown) =>
            error instanceof Error ? `Failed: ${error.message}` : 'Failed',
          ),
        );
      } else if (photos[0]) setExportReport(await exportCheck(photos[0]));
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

      <Surface style={styles.section}>
        <AppText variant="headline">Edited photo check</AppText>
        <AppText variant="footnote" color="secondaryLabel">
          For exact copies: edit a photo in Photos (crop it), Scan again, then run this. Shows the
          file iOS returns for the 5 photos modified longest after capture and whether it passes the
          camera-original test. Photos in iCloud only are skipped, not downloaded.
        </AppText>
        <Button
          title={busy === 'edited' ? 'Checking…' : 'Run edited photo check'}
          variant="secondary"
          loading={busy === 'edited'}
          disabled={photos.length === 0 || busy !== null}
          onPress={() => run('edited')}
        />
        {editedReport ? <Mono text={editedReport} /> : null}
      </Surface>

      <Surface style={styles.section}>
        <AppText variant="headline">Live Photo check (up to 3)</AppText>
        <AppText variant="footnote" color="secondaryLabel">
          For exact copies: the still file and the paired video iOS returns for Live Photos. Photos
          in iCloud only are skipped, not downloaded.
        </AppText>
        <Button
          title={busy === 'live' ? 'Checking…' : 'Run Live Photo check'}
          variant="secondary"
          loading={busy === 'live'}
          disabled={photos.length === 0 || busy !== null}
          onPress={() => run('live')}
        />
        {liveReport ? <Mono text={liveReport} /> : null}
      </Surface>

      <Surface style={styles.section}>
        <AppText variant="headline">Vision check (12 newest photos)</AppText>
        <AppText variant="footnote" color="secondaryLabel">
          {visualAnalysisAvailable()
            ? 'Raw on-device scores used for similar shots, blur, eyes and exposure, and how alike each photo is to the next. Used to tune the thresholds on real photos.'
            : 'Needs the MediaCare app build; not available in Expo Go.'}
        </AppText>
        <Button
          title={busy === 'vision' ? 'Checking…' : 'Run Vision check'}
          variant="secondary"
          loading={busy === 'vision'}
          disabled={!visualAnalysisAvailable() || photos.length === 0 || busy !== null}
          onPress={() => run('vision')}
        />
        {visionReport ? <Mono text={visionReport} /> : null}
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
