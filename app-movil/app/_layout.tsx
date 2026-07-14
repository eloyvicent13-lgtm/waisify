import React, { createContext, useState, useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { Audio } from 'expo-av';
import axios from 'axios';
import { setToken, Track } from '../services/api';
import { getDownloadedTracks } from '../services/downloadService';

export const AuthContext = createContext<{
  token: string | null;
  username: string | null;
  userId: number | null;
  displayName: string;
  avatarColor: string;
  login: (token: string, username: string, userId: number) => void;
  logout: () => void;
  updateProfile: (name: string, color: string) => void;
} | null>(null);

export const PlaybackContext = createContext<{
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  queueIndex: number;
  positionMs: number;
  durationMs: number;
  playTrack: (track: Track, index: number, newQueue: Track[]) => Promise<void>;
  togglePlay: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
} | null>(null);

export default function RootLayout() {
  const [token, setTokenState] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('Eloy');
  const [avatarColor, setAvatarColor] = useState('purple-cyan');

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function setupAudio() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (err) {
        console.warn('[Audio] Setup failed:', err);
      }
    }
    setupAudio();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || !navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [token, segments, isReady, navigationState?.key]);

  const login = (t: string, user: string, id: number) => {
    setToken(t);
    setTokenState(t);
    setUsername(user);
    setUserId(id);
    setDisplayName(user);
  };

  const logout = () => {
    setToken(null);
    setTokenState(null);
    setUsername(null);
    setUserId(null);
    if (sound) {
      sound.unloadAsync();
    }
  };

  const updateProfile = (name: string, color: string) => {
    setDisplayName(name);
    setAvatarColor(color);
  };

  const playTrack = async (track: Track, index: number, newQueue: Track[]) => {
    setQueue(newQueue);
    setQueueIndex(index);
    setCurrentTrack(track);

    if (sound) {
      await sound.unloadAsync();
    }

    try {
      let streamUrl = '';

      // 1. Check if track is downloaded locally
      const offlineTracks = await getDownloadedTracks();
      const offlineMatch = offlineTracks.find(t => t.id === track.id);

      if (offlineMatch && offlineMatch.localUrl) {
        console.log('[Playback] Playing offline downloaded track:', offlineMatch.localUrl);
        streamUrl = offlineMatch.localUrl;
      } else {
        // 2. Fetch network stream URL from backend
        let youtubeId = track.youtubeId;
        if (!youtubeId) {
          const res = await axios.get(`http://149.202.84.78:8150/api/resolve?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`);
          youtubeId = res.data.youtubeId;
          track.youtubeId = youtubeId;
        }

        if (youtubeId) {
          try {
            const streamRes = await axios.get(`http://149.202.84.78:8150/api/stream?youtubeId=${youtubeId}`);
            streamUrl = streamRes.data.streamUrl;
          } catch (err) {
            console.warn('[Playback] Failed to resolve live streaming URL, using fallback:', err);
          }
        }
      }

      // 3. Fallback to demo audio
      if (!streamUrl) {
        streamUrl = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(true);
    } catch (e) {
      console.error('Failed to load track audio:', e);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPositionMs(status.positionMillis);
      setDurationMs(status.durationMillis || 180000);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        playNext();
      }
    }
  };

  const togglePlay = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  const playNext = async () => {
    const nextIdx = queueIndex + 1;
    if (nextIdx < queue.length) {
      await playTrack(queue[nextIdx], nextIdx, queue);
    }
  };

  const playPrev = async () => {
    const prevIdx = queueIndex - 1;
    if (prevIdx >= 0) {
      await playTrack(queue[prevIdx], prevIdx, queue);
    }
  };

  const seekTo = async (millis: number) => {
    if (sound) {
      await sound.setPositionAsync(millis);
    }
  };

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  return (
    <AuthContext.Provider value={{ token, username, userId, displayName, avatarColor, login, logout, updateProfile }}>
      <PlaybackContext.Provider value={{
        currentTrack,
        isPlaying,
        queue,
        queueIndex,
        positionMs,
        durationMs,
        playTrack,
        togglePlay,
        playNext,
        playPrev,
        seekTo
      }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#070709' } }}>
          <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="player" options={{ presentation: 'modal', gestureEnabled: true }} />
        </Stack>
      </PlaybackContext.Provider>
    </AuthContext.Provider>
  );
}
