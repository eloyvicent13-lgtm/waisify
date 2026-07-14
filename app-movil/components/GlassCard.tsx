import React from 'react';
import { StyleSheet, View, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../constants/Colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function GlassCard({ children, style }: GlassCardProps) {
  return (
    <View style={[styles.borderWrapper, style]}>
      <BlurView 
        intensity={25} 
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterialDark' : 'dark'} 
        style={styles.blurContainer}
      >
        {/* Diagonal liquid glass reflection overlay */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.reflectionLine} />
        <View style={styles.content}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  borderWrapper: {
    borderRadius: 16,
    borderWidth: Platform.OS === 'ios' ? 0.5 : 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  blurContainer: {
    width: '100%',
  },
  reflectionLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  content: {
    padding: 16,
  },
});
