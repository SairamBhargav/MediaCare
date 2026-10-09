import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Surface } from '@/components/surface';
import { TourAnchor } from '@/components/tour-anchor';
import { listDerivatives, type DerivativeRow } from '@/db/catalog-repo';
import { creationLabel } from '@/domain/activity';
import { scanLibrary } from '@/features/media/start-scan';
import { STUDIO_ORDER, STUDIO_TOOLS, type StudioToolId } from '@/features/studio/tools';
import { photoUri } from '@/services/media/photo-library';
import { hasPhotoAccess, useCatalog } from '@/state/catalog';
import { gutter, radius, spacing, useTheme } from '@/theme';

/**
 * Studio: every tool that makes something new from your photos and videos.
 * Each card opens a picker for what the tool needs; results are always new
 * items, and originals never change. Tools this build can't run say so.
 */
export function StudioScreen() {
  const { width } = useWindowDimensions();
  const items = useCatalog((catalog) => catalog.items);
  const access = useCatalog((catalog) => catalog.access);
  const [made, setMade] = useState<DerivativeRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      listDerivatives(12)
        .then(setMade)
        .catch(() => setMade([]));
    }, []),
  );

  const cardWidth = (width - gutter * 2 - spacing.sm) / 2;
  const madeWidth = (width - gutter * 2 - spacing.sm * 2) / 3;
  const scanned = items.length > 0;

  return (
    <Screen title="Studio">
      {!scanned ? (
        <Surface elevation="raised" style={styles.intro}>
          <AppText variant="headline">Make something from your photos</AppText>
          <AppText variant="subhead" color="secondaryLabel">
            Collages, slideshows, adjusted photos, passport photos and smaller copies. Your
            originals always stay as they are. Scan your library first so MediaCare can show your
            photos.
          </AppText>
          <Button
            title={hasPhotoAccess(access) ? 'Scan my library' : 'Allow access and scan'}
            icon="scan"
            onPress={scanLibrary}
            block
          />
        </Surface>
      ) : null}

      <TourAnchor id="studio.tools" style={styles.grid}>
        {STUDIO_ORDER.map((id) => (
          <ToolCard key={id} id={id} width={cardWidth} disabled={!scanned} />
        ))}
      </TourAnchor>

      {made.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Recently made"
            action={
              <Button title="Activity" variant="plain" onPress={() => router.push('/activity')} />
            }
          />
          {/* A grid, not a sideways shelf: sideways swipes switch tabs. */}
          <View style={styles.madeGrid}>
            {made.slice(0, 6).map((row) => (
              <MadeTile key={row.id} row={row} width={madeWidth} />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function ToolCard({ id, width, disabled }: { id: StudioToolId; width: number; disabled: boolean }) {
  const { colors } = useTheme();
  const tool = STUDIO_TOOLS[id];
  const available = tool.available();
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/pick', params: { tool: id } })}
      disabled={disabled || !available}
      accessibilityRole="button"
      accessibilityLabel={tool.title}
      accessibilityHint={available ? tool.description : 'Needs the latest MediaCare app'}
      accessibilityState={{ disabled: disabled || !available }}
      style={[
        styles.card,
        { width, backgroundColor: colors.surface, opacity: available && !disabled ? 1 : 0.55 },
      ]}
    >
      <View style={[styles.iconWell, { backgroundColor: colors.surfaceRaised }]}>
        <Icon name={tool.icon} size={22} color={colors.accent} weight="semibold" />
      </View>
      <AppText variant="headline">{tool.title}</AppText>
      <AppText variant="footnote" color="secondaryLabel">
        {available ? tool.description : 'Needs the latest MediaCare app.'}
      </AppText>
    </PressableScale>
  );
}

function MadeTile({ row, width }: { row: DerivativeRow; width: number }) {
  const { colors } = useTheme();
  const label = creationLabel(row.recipe, row.format);
  return (
    <View style={[styles.made, { width }]} accessible accessibilityLabel={label}>
      {row.output_asset_id ? (
        <Image
          source={{ uri: photoUri(row.output_asset_id) }}
          style={[styles.madeImage, { backgroundColor: colors.mediaPlaceholder }]}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.madeImage, { backgroundColor: colors.mediaPlaceholder }]} />
      )}
      <AppText variant="caption" color="secondaryLabel" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    gap: spacing.xxs,
    padding: spacing.md,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    minHeight: 150,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  section: { gap: spacing.sm },
  madeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  made: { gap: spacing.xxs },
  madeImage: { width: '100%', aspectRatio: 1, borderRadius: radius.control },
});
