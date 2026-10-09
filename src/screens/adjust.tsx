import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { MediaArtwork } from '@/components/media-artwork';
import { ChoiceRow, PreviewFrame, ToolShell } from '@/components/tool-shell';
import { ValueSlider } from '@/components/value-slider';
import {
  ASPECTS,
  NEUTRAL,
  SLIDERS,
  clampSlider,
  isNeutral,
  sliderPercent,
  toNativeOptions,
  turnedSize,
  centeredCrop,
  type Adjustments,
  type SliderKey,
} from '@/domain/adjust';
import { formatBytes } from '@/domain/bytes';
import { findMediaItem, isSample } from '@/features/media/registry';
import { discardFile } from '@/services/exports/exporter';
import { saveCreation } from '@/services/exports/save-creation';
import { adjustPhoto, creationToolsAvailable } from '@/services/media/creations';
import { fileSize } from '@/services/media/file-fingerprint';
import { spacing, useTheme } from '@/theme';
import { haptics } from '@/utils/haptics';

const PREVIEW_SIDE = 1200;
const OUTPUT_SIDE = 4096;
const PREVIEW_DELAY_MS = 250;

type Preview = { uri: string; width: number; height: number };

function problem(status: string, error?: string): string {
  if (status === 'in-icloud')
    return 'This photo is only in iCloud. Open it in Photos so it downloads, then try again.';
  if (status === 'missing') return 'This photo is no longer in your library.';
  return error ?? 'The photo couldn’t be adjusted.';
}

/**
 * Adjust (F16): turn, flip, straighten, crop to a shape, and change
 * brightness, contrast, color and warmth. A small preview updates as you go;
 * saving makes a full-size new photo. The original never changes.
 */
export function AdjustScreen({ id }: { id: string }) {
  const { colors } = useTheme();
  const item = findMediaItem(id);
  const [values, setValues] = useState<Adjustments>(NEUTRAL);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const previews = useRef<string[]>([]);
  const request = useRef(0);

  const available = creationToolsAvailable() && !!item && !isSample(item);

  // Re-render the preview shortly after the last change; only the newest one is shown.
  useEffect(() => {
    if (!available || !item || isNeutral(values)) {
      // Invalidates a preview still being made; the original is shown instead.
      request.current += 1;
      return;
    }
    const ticket = (request.current += 1);
    const timer = setTimeout(() => {
      setWorking(true);
      adjustPhoto(item.id, toNativeOptions(values, item.width, item.height, PREVIEW_SIDE))
        .then((result) => {
          if (result.uri) previews.current.push(result.uri);
          if (ticket !== request.current) return;
          if (result.status === 'ok' && result.uri) {
            setPreview({ uri: result.uri, width: result.width ?? 1, height: result.height ?? 1 });
            setMessage(null);
          } else {
            setMessage(problem(result.status, result.error));
          }
        })
        .catch((error: unknown) => {
          if (ticket === request.current)
            setMessage(error instanceof Error ? error.message : problem('failed'));
        })
        .finally(() => {
          if (ticket === request.current) setWorking(false);
        });
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [available, item, values]);

  // Previews are temporary files: remove them all on leaving.
  useEffect(
    () => () => {
      for (const uri of previews.current) discardFile(uri);
    },
    [],
  );

  if (!item || isSample(item) || item.kind !== 'photo') {
    return (
      <ToolShell title="Adjust">
        <EmptyState
          icon="photo"
          title="Adjust works on your own photos"
          message="Sample images and videos can’t be adjusted here."
        />
      </ToolShell>
    );
  }
  if (!creationToolsAvailable()) {
    return (
      <ToolShell title="Adjust">
        <EmptyState
          icon="adjust"
          title="Needs the latest MediaCare app"
          message="Adjusting uses Apple’s on-device image processing, which isn’t available in Expo Go or older builds of the app."
        />
      </ToolShell>
    );
  }

  if (saved !== null) {
    return (
      <ToolShell title="Adjust">
        <EmptyState
          icon="check"
          title="Saved to Photos"
          message={`A new photo (${formatBytes(saved)}) is in your library. The original is unchanged.`}
          action={<Button title="Done" variant="secondary" onPress={() => router.back()} />}
        />
      </ToolShell>
    );
  }

  const set = (patch: Partial<Adjustments>) => {
    haptics.selection();
    setValues((current) => ({ ...current, ...patch }));
  };
  const setSlider = (key: SliderKey, value: number) =>
    setValues((current) => ({ ...current, [key]: clampSlider(key, value) }));

  const turned = turnedSize(item.width, item.height, values.quarterTurns);
  const crop = centeredCrop(turned.width, turned.height, values.aspect);
  const shownRatio = preview
    ? preview.width / preview.height
    : (turned.width * crop.cropWidth) / Math.max(1, turned.height * crop.cropHeight) || 1;

  const save = async () => {
    setSaving(true);
    try {
      const result = await adjustPhoto(
        item.id,
        toNativeOptions(values, item.width, item.height, OUTPUT_SIDE),
      );
      if (result.status !== 'ok' || !result.uri) {
        setMessage(problem(result.status, result.error));
        haptics.error();
        return;
      }
      const bytes = fileSize(result.uri) ?? 0;
      await saveCreation({
        uri: result.uri,
        tool: 'adjust',
        sourceId: item.id,
        format: 'jpeg',
        width: result.width ?? 0,
        height: result.height ?? 0,
        bytes,
        recipe: { ...values },
      });
      haptics.success();
      setSaved(bytes);
    } catch (error) {
      haptics.error();
      setMessage(error instanceof Error ? error.message : 'Couldn’t save to Photos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ToolShell title="Adjust">
      <PreviewFrame
        label={isNeutral(values) ? 'Original' : 'Preview'}
        aspectRatio={Math.min(2, Math.max(0.5, shownRatio))}
      >
        {preview && !isNeutral(values) ? (
          <Image
            source={{ uri: preview.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            accessibilityLabel="Adjusted preview"
          />
        ) : (
          <MediaArtwork item={item} fit="contain" />
        )}
        {working ? (
          <View style={styles.spinner} pointerEvents="none">
            <ActivityIndicator color={colors.label} />
          </View>
        ) : null}
      </PreviewFrame>

      {message ? (
        <AppText variant="subhead" color="danger">
          {message}
        </AppText>
      ) : null}

      <View style={styles.turns}>
        <IconButton
          icon="rotateLeft"
          accessibilityLabel="Turn left"
          onPress={() => set({ quarterTurns: values.quarterTurns - 1 })}
        />
        <IconButton
          icon="rotateRight"
          accessibilityLabel="Turn right"
          onPress={() => set({ quarterTurns: values.quarterTurns + 1 })}
        />
        <IconButton
          icon="flip"
          accessibilityLabel={values.flip ? 'Flip back' : 'Flip'}
          onPress={() => set({ flip: !values.flip })}
        />
      </View>

      <ChoiceRow label="Shape">
        {ASPECTS.map((aspect) => (
          <Chip
            key={aspect.id}
            label={aspect.label}
            selected={values.aspect === aspect.id}
            onPress={() => set({ aspect: aspect.id })}
          />
        ))}
      </ChoiceRow>

      {(Object.keys(SLIDERS) as SliderKey[]).map((key) => (
        <ValueSlider
          key={key}
          label={SLIDERS[key].label}
          value={values[key]}
          valueText={sliderPercent(key, values[key])}
          min={SLIDERS[key].min}
          max={SLIDERS[key].max}
          step={SLIDERS[key].step}
          onChange={(value) => setSlider(key, value)}
        />
      ))}

      <AppText variant="footnote" color="secondaryLabel">
        Saved as a new photo, dated today and without location, like other copies.
      </AppText>
      <Button
        title={saving ? 'Saving…' : 'Save to Photos'}
        icon="photo"
        loading={saving}
        disabled={saving || isNeutral(values)}
        onPress={() => {
          save().catch(() => {});
        }}
        block
      />
      <Button
        title="Reset"
        variant="plain"
        disabled={isNeutral(values)}
        onPress={() => set(NEUTRAL)}
        block
      />
    </ToolShell>
  );
}

const styles = StyleSheet.create({
  spinner: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  turns: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
});
