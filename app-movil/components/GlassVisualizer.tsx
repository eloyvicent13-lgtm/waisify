import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import Colors from '../constants/Colors';

interface GlassVisualizerProps {
  isPlaying: boolean;
  // Real per-track amplitude envelope (0-1, fixed length), when the backend
  // has finished computing it for the currently playing track. Null while
  // it's still being resolved/computed — falls back to a generic animation.
  waveform?: number[] | null;
  positionMs?: number;
  durationMs?: number;
}

const BAR_COUNT = 14;

// Pre-defined heights per bar to simulate realistic frequency bands
// (sub-bass → bass → mid → treble → air). Used as each bar's shape/ceiling;
// when real waveform data is available it scales this ceiling by the
// track's actual amplitude at the current playback position instead of
// looping independently of the music.
const BAND_HEIGHTS = [18, 30, 42, 50, 55, 48, 38, 32, 44, 52, 46, 36, 26, 16];
const BAND_SPEEDS  = [900, 750, 600, 500, 450, 500, 600, 650, 520, 470, 540, 620, 700, 850];

export default function GlassVisualizer({ isPlaying, waveform, positionMs = 0, durationMs = 0 }: GlassVisualizerProps) {
  const hasRealData = !!waveform && waveform.length > 0 && durationMs > 0;

  let amplitude = 0;
  if (hasRealData) {
    const progress = Math.min(1, Math.max(0, positionMs / durationMs));
    const idx = Math.min(waveform!.length - 1, Math.floor(progress * (waveform!.length - 1)));
    amplitude = waveform![idx];
  }

  return (
    <View style={styles.container}>
      {Array.from({ length: BAR_COUNT }).map((_, idx) => (
        <VisualizerBar
          key={idx}
          index={idx}
          isPlaying={isPlaying}
          amplitude={hasRealData ? amplitude : null}
        />
      ))}
    </View>
  );
}

function VisualizerBar({ index, isPlaying, amplitude }: { index: number; isPlaying: boolean; amplitude: number | null }) {
  const height = useSharedValue(6);

  useEffect(() => {
    cancelAnimation(height);

    if (!isPlaying) {
      height.value = withSpring(6, { stiffness: 120, damping: 18 });
      return;
    }

    if (amplitude !== null) {
      // Real data: smoothly move toward the track's actual amplitude at the
      // current position, scaled to this bar's shape (30% floor so it never
      // fully flatlines during quiet passages).
      const peak = BAND_HEIGHTS[index];
      const target = Math.max(6, peak * (0.3 + 0.7 * amplitude));
      height.value = withTiming(target, { duration: 350 });
      return;
    }

    // Fallback: canned infinite loop, used while waveform data is still
    // resolving/caching/computing on the backend.
    const peak    = BAND_HEIGHTS[index];
    const valley  = Math.max(6, peak * 0.2);
    const speed   = BAND_SPEEDS[index];
    const delayMs = index * 40; // stagger start so bars don't sync

    height.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withSpring(peak,   { stiffness: 160, damping: 12, mass: 0.6 }),
          withTiming(valley, { duration: speed }),
        ),
        -1,   // infinite
        true, // reverse (ping-pong)
      ),
    );
  }, [isPlaying, amplitude]);

  const barColors = [Colors.accentColor, Colors.cyan, Colors.lavender];
  const barColor  = barColors[index % barColors.length];

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { backgroundColor: barColor, shadowColor: barColor },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    height: 60,
    width: '100%',
    marginVertical: 12,
    paddingHorizontal: 24,
  },
  bar: {
    flex: 1,
    borderRadius: 3,
    opacity: 0.85,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 3,
  },
});
