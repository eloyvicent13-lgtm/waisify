import React, { useContext } from 'react';
import { View, StyleSheet, Text, Image, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PlaybackContext } from '../app/_layout';
import Colors from '../constants/Colors';

const { width } = Dimensions.get('window');

export default function MiniPlayer() {
  const playback = useContext(PlaybackContext);
  const router = useRouter();

  if (!playback?.currentTrack) return null;

  const { currentTrack, isPlaying, togglePlay, playNext } = playback;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push('/player')}
      style={styles.container}
    >
      <BlurView 
        intensity={30} 
        tint={Platform.OS === 'ios' ? 'systemUltraThinMaterialDark' : 'dark'} 
        style={styles.blurContainer}
      >
        {/* Diagonal glass reflection */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.reflectionLine} />
        
        <Image 
          source={{ uri: currentTrack.thumbnail || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=80' }} 
          style={styles.cover} 
        />
        
        <View style={styles.details}>
          <Text numberOfLines={1} style={styles.title}>{currentTrack.title}</Text>
          <Text numberOfLines={1} style={styles.artist}>{currentTrack.artist}</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity onPress={togglePlay} style={styles.controlBtn}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={22} color={Colors.textMain} />
          </TouchableOpacity>
          <TouchableOpacity onPress={playNext} style={styles.controlBtn}>
            <Ionicons name="play-forward" size={22} color={Colors.textMain} />
          </TouchableOpacity>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 96,
    left: width * 0.04,
    width: width * 0.92,
    borderRadius: 16,
    borderWidth: Platform.OS === 'ios' ? 0.5 : 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  blurContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  reflectionLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  cover: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  details: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 2,
  },
  artist: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    padding: 6,
  },
});
