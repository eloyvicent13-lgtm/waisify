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
}

const BAR_COUNT = 14;

// Pre-defined heights per bar to simulate realistic frequency bands
// (sub-bass → bass → mid → treble → air)
const BAND_HEIGHTS = [18, 30, 42, 50, 55, 48, 38, 32, 44, 52, 46, 36, 26, 16];
const BAND_SPEEDS  = [900, 750, 600, 500, 450, 500, 600, 650, 520, 470, 540, 620, 700, 850];

export default function GlassVisualizer({ isPlaying }: GlassVisualizerProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: BAR_COUNT }).map((_, idx) => (
        <VisualizerBar key={idx} index={idx} isPlaying={isPlaying} />
      ))}
    </View>
  );
}

function VisualizerBar({ index, isPlaying }: { index: number; isPlaying: boolean }) {
  const height = useSharedValue(6);

  useEffect(() => {
    if (isPlaying) {
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
    } else {
      // Settle smoothly to rest
      cancelAnimation(height);
      height.value = withSpring(6, { stiffness: 120, damping: 18 });
    }
  }, [isPlaying]);

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
