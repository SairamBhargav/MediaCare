import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { scanLibrary } from '@/features/media/start-scan';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { MediaTile } from '@/components/media-tile';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { listDerivatives, type DerivativeRow } from '@/db/catalog-repo';
import { formatBytes } from '@/domain/bytes';
import { savings } from '@/domain/compress';
import { hasPhotoAccess, useCatalog } from '@/state/catalog';
import { gutter, spacing } from '@/theme';

const RECENT = 9;

const madeOn = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Studio: tools that make new files from your photos. Only implemented tools
 * appear here (product rule). Phase 2 has one: smaller copies.
 */
export function StudioScreen() {
  const { width } = useWindowDimensions();
  const items = useCatalog((catalog) => catalog.items);
  const access = useCatalog((catalog) => catalog.access);
  const [copies, setCopies] = useState<DerivativeRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      listDerivatives(10)
        .then(setCopies)
        .catch(() => setCopies([]));
    }, []),
  );

  const recent = items.filter((item) => item.kind === 'photo').slice(0, RECENT);
  const tile = (width - gutter * 2 - spacing.xs * 2) / 3;

  return (
    <Screen title="Studio">
      {recent.length === 0 ? (
        <Surface>
          <EmptyState
            icon="studio"
            title="Make smaller copies of your photos"
            message="Pick a photo, choose a quality or a target size, and save a lighter JPEG copy. Your original stays exactly as it is. Scan your library first so MediaCare can show your photos here."
            action={
              <Button
                title={hasPhotoAccess(access) ? 'Scan my library' : 'Allow access and scan'}
                icon="scan"
                onPress={scanLibrary}
              />
            }
          />
        </Surface>
      ) : (
        <View style={styles.section}>
          <SectionHeader
            eyebrow="Tool"
            title="Make a smaller copy"
            action={
              <Button
                title="All photos"
                variant="plain"
                onPress={() => router.navigate('/library')}
              />
            }
          />
          <AppText variant="subhead" color="secondaryLabel">
            Choose a photo. You’ll see the real size of the copy before saving it, and your original
            stays unchanged. You can also start from any photo in the Library.
          </AppText>
          <View style={styles.grid}>
            {recent.map((item) => (
              <MediaTile
                key={item.id}
                asset={item}
                appearance="card"
                style={{ width: tile }}
                onPress={() => router.push(`/export/${encodeURIComponent(item.id)}`)}
              />
            ))}
          </View>
        </View>
      )}

      {copies.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader eyebrow="History" title="Copies you made" />
          <Surface style={styles.list}>
            {copies.map((copy) => {
              const verdict = savings(copy.source_bytes, copy.bytes);
              return (
                <View key={copy.id} style={styles.copyRow} accessible>
                  <AppText variant="subhead" style={styles.numbers}>
                    {copy.width} × {copy.height} · {formatBytes(copy.bytes)}
                  </AppText>
                  <AppText variant="footnote" color="secondaryLabel" style={styles.numbers}>
                    {madeOn.format(new Date(copy.created_at))}
                    {verdict.kind === 'smaller'
                      ? ` · ${verdict.percent}% smaller than the original`
                      : verdict.kind === 'not-smaller'
                        ? ' · not smaller than the original'
                        : ''}
                  </AppText>
                </View>
              );
            })}
          </Surface>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  list: { gap: spacing.sm },
  copyRow: { gap: 2 },
  numbers: { fontVariant: ['tabular-nums'] },
});
