import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { MediaArtwork } from '@/components/media-artwork';
import { ChoiceRow, PreviewFrame, ToolShell } from '@/components/tool-shell';
import { formatBytes } from '@/domain/bytes';
import { COLLAGE_BACKGROUNDS, COLLAGE_SHAPES, collageCells, layoutsFor } from '@/domain/collage';
import { findMediaItem } from '@/features/media/registry';
import { saveCreation } from '@/services/exports/save-creation';
import { creationToolsAvailable, makeCollage } from '@/services/media/creations';
import { fileSize } from '@/services/media/file-fingerprint';
import { useCreationDraft } from '@/state/creation-draft';
import { haptics } from '@/utils/haptics';

const SPACINGS = [
  { id: 'none', label: 'None', value: 0 },
  { id: 'thin', label: 'Thin', value: 0.012 },
  { id: 'wide', label: 'Wide', value: 0.03 },
];

/**
 * Collage (F19): 2–6 photos in a layout. The preview is drawn live from the
 * same geometry the native compositor uses, so what you see is what's saved.
 */
export function CollageScreen() {
  const draft = useCreationDraft((state) => state.ids);
  const [ids, setIds] = useState<string[]>(() => [...draft]);
  const layouts = layoutsFor(ids.length);
  const [layoutId, setLayoutId] = useState(layouts[0]?.id ?? '');
  const [shapeId, setShapeId] = useState(COLLAGE_SHAPES[0].id);
  const [spacingId, setSpacingId] = useState('thin');
  const [backgroundId, setBackgroundId] = useState('white');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const layout = layouts.find((option) => option.id === layoutId) ?? layouts[0];
  const shape = COLLAGE_SHAPES.find((option) => option.id === shapeId) ?? COLLAGE_SHAPES[0];
  const gap = SPACINGS.find((option) => option.id === spacingId)?.value ?? 0;
  const background =
    COLLAGE_BACKGROUNDS.find((option) => option.id === backgroundId) ?? COLLAGE_BACKGROUNDS[0];

  if (!layout) {
    return (
      <ToolShell title="Collage">
        <EmptyState
          icon="collage"
          title="Choose 2 to 6 photos"
          message="Start a collage from Studio and pick the photos you want."
          action={<Button title="Close" variant="secondary" onPress={() => router.back()} />}
        />
      </ToolShell>
    );
  }
  if (saved !== null) {
    return (
      <ToolShell title="Collage">
        <EmptyState
          icon="check"
          title="Saved to Photos"
          message={`Your collage (${formatBytes(saved)}) is a new photo in your library.`}
          action={<Button title="Done" variant="secondary" onPress={() => router.back()} />}
        />
      </ToolShell>
    );
  }

  const cells = collageCells(layout, ids, shape.width, shape.height, gap);
  const [r, g, b] = background.rgb;
  const backgroundColor = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await makeCollage({
        width: shape.width,
        height: shape.height,
        cells,
        background: background.rgb,
      });
      if (result.status !== 'ok' || !result.uri) {
        setMessage(
          result.status === 'in-icloud'
            ? 'One of these photos is only in iCloud. Open it in Photos so it downloads, then try again.'
            : (result.error ?? 'The collage couldn’t be made.'),
        );
        haptics.error();
        return;
      }
      const bytes = fileSize(result.uri) ?? 0;
      await saveCreation({
        uri: result.uri,
        tool: 'collage',
        sourceId: ids[0],
        format: 'jpeg',
        width: result.width ?? shape.width,
        height: result.height ?? shape.height,
        bytes,
        recipe: { layout: layout.id, shape: shape.id, sources: ids },
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
    <ToolShell title="Collage">
      <PreviewFrame aspectRatio={shape.width / shape.height}>
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor }]}
          accessible
          accessibilityLabel={`Collage preview with ${ids.length} photos`}
        >
          {cells.map((cell) => {
            const item = findMediaItem(cell.id);
            return (
              <View
                key={cell.id}
                style={[
                  styles.cell,
                  {
                    left: `${(cell.x / shape.width) * 100}%`,
                    top: `${(cell.y / shape.height) * 100}%`,
                    width: `${(cell.width / shape.width) * 100}%`,
                    height: `${(cell.height / shape.height) * 100}%`,
                  },
                ]}
              >
                {item ? <MediaArtwork item={item} fit="cover" /> : null}
              </View>
            );
          })}
        </View>
      </PreviewFrame>

      {message ? (
        <AppText variant="subhead" color="danger">
          {message}
        </AppText>
      ) : null}

      <ChoiceRow label="Layout">
        {layouts.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={option.id === layout.id}
            onPress={() => setLayoutId(option.id)}
          />
        ))}
      </ChoiceRow>
      <ChoiceRow label="Shape">
        {COLLAGE_SHAPES.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={option.id === shape.id}
            onPress={() => setShapeId(option.id)}
          />
        ))}
      </ChoiceRow>
      <ChoiceRow label="Border">
        {SPACINGS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={option.id === spacingId}
            onPress={() => setSpacingId(option.id)}
          />
        ))}
      </ChoiceRow>
      {gap > 0 ? (
        <ChoiceRow label="Border color">
          {COLLAGE_BACKGROUNDS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={option.id === backgroundId}
              onPress={() => setBackgroundId(option.id)}
            />
          ))}
        </ChoiceRow>
      ) : null}
      <Button
        title="Change the order"
        icon="shuffle"
        variant="secondary"
        onPress={() => {
          haptics.selection();
          setIds((current) => [...current.slice(1), current[0]]);
        }}
        accessibilityHint="Moves every photo one place along"
        block
      />

      {creationToolsAvailable() ? (
        <Button
          title={saving ? 'Saving…' : 'Save to Photos'}
          icon="photo"
          loading={saving}
          disabled={saving}
          onPress={() => {
            save().catch(() => {});
          }}
          block
        />
      ) : (
        <AppText variant="subhead" color="secondaryLabel">
          Saving a collage needs the latest MediaCare app; Expo Go can only show the preview.
        </AppText>
      )}
      <AppText variant="footnote" color="secondaryLabel">
        {shape.width} × {shape.height} px. Saved as a new photo; your originals stay as they are.
      </AppText>
    </ToolShell>
  );
}

const styles = StyleSheet.create({
  cell: { position: 'absolute', overflow: 'hidden' },
});
