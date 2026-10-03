import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown } from 'react-native-reanimated';

import { isActive, jobFraction, type Job } from '@/domain/jobs';
import { jobProgressText, jobStatusLine, jobTitle } from '@/features/clean/job-text';
import { useCleanSession } from '@/state/clean-session';
import {
  duration,
  minTouchTarget,
  radius,
  shadows,
  spacing,
  useReduceMotion,
  useTheme,
} from '@/theme';

import { AppText } from './app-text';
import { ChromeBackground } from './chrome-background';
import { Icon, type IconName } from './icon';
import { ProgressBar } from './progress-bar';

/** Height of the compact job bar, excluding its gap above the tab row. */
export const JOB_BAR_HEIGHT = 60;
export const JOB_BAR_GAP = spacing.xs;

/**
 * Compact active-job bar, floating above the tab bar like a mini player.
 * Present only while a real (or clearly labelled sample) job exists; tapping
 * it expands into the scan sheet. It never shows invented progress.
 */
export function ActiveJobBar({ job }: { job: Job }) {
  const { colors, scheme } = useTheme();
  const reduceMotion = useReduceMotion();
  const { pauseScan, resumeScan, dismissJob } = useCleanSession.getState();
  const active = isActive(job);
  const finished = job.status === 'succeeded';

  const trailing: { icon: IconName; label: string; onPress: () => void } = active
    ? job.status === 'paused'
      ? { icon: 'play', label: 'Resume scan', onPress: resumeScan }
      : { icon: 'pause', label: 'Pause scan', onPress: pauseScan }
    : { icon: 'close', label: 'Dismiss', onPress: dismissJob };

  const open = () => {
    if (finished) {
      dismissJob();
      router.navigate('/');
    } else {
      router.push('/scan');
    }
  };

  return (
    <Animated.View
      entering={
        reduceMotion
          ? FadeIn.duration(duration.state)
          : FadeInDown.duration(duration.surface).springify().dampingRatio(0.8)
      }
      exiting={
        reduceMotion ? FadeOut.duration(duration.state) : FadeOutDown.duration(duration.state)
      }
      style={[styles.bar, scheme === 'light' && { boxShadow: shadows.raised }]}
    >
      <ChromeBackground />
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${jobTitle(job)}. ${jobStatusLine(job)}.`}
        accessibilityHint={finished ? 'Shows the results' : 'Opens scan details'}
        style={({ pressed }) => [styles.main, pressed && { backgroundColor: colors.surfaceRaised }]}
      >
        <View style={[styles.glyph, { backgroundColor: colors.accentFill }]}>
          <Icon
            name={finished ? 'check' : 'scan'}
            size={16}
            color={colors.onAccent}
            weight="semibold"
          />
        </View>
        <View style={styles.text}>
          <AppText variant="subhead" numberOfLines={1} style={styles.title}>
            {jobTitle(job)}
          </AppText>
          <AppText
            variant="caption"
            color="secondaryLabel"
            numberOfLines={1}
            style={styles.numbers}
          >
            {jobStatusLine(job)}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        onPress={trailing.onPress}
        accessibilityRole="button"
        accessibilityLabel={trailing.label}
        hitSlop={8}
        style={({ pressed }) => [styles.trailing, pressed && { opacity: 0.5 }]}
      >
        <Icon name={trailing.icon} size={18} color={colors.label} weight="semibold" />
      </Pressable>
      {active ? (
        <ProgressBar
          fraction={jobFraction(job)}
          accessibilityLabel={`${jobTitle(job)} progress`}
          valueText={jobProgressText(job)}
          height={2}
          style={styles.progress}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: JOB_BAR_HEIGHT,
    marginHorizontal: spacing.xs,
    marginBottom: JOB_BAR_GAP,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  main: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
  },
  glyph: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 1 },
  title: { fontWeight: '600' },
  numbers: { fontVariant: ['tabular-nums'] },
  trailing: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xxs,
  },
  progress: { position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: 0 },
});
