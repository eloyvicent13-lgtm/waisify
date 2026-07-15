import React, { createContext, useState, useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { Audio } from 'expo-av';
import YoutubeIframe from 'react-native-youtube-iframe';
import { View } from 'react-native';
import { useRef } from 'react';
import axios from 'axios';
import { setToken, Track } from '../services/api';
import { getDownloadedTracks } from '../services/downloadService';
import { resolveStreamUrl } from '../services/streamService';
import { documentDirectory, readAsStringAsync, writeAsStringAsync, getInfoAsync } from 'expo-file-system/legacy';

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
  const [loadingSession, setLoadingSession] = useState(true);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playerRef = useRef<any>(null);

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
    async function loadSession() {
      try {
        const sessionPath = (documentDirectory || '') + 'session.json';
        const fileInfo = await getInfoAsync(sessionPath);
        if (fileInfo.exists) {
          const content = await readAsStringAsync(sessionPath);
          const data = JSON.parse(content);
          if (data && data.token) {
            setToken(data.token);
            setTokenState(data.token);
            setUsername(data.username);
            setUserId(data.userId);
            setDisplayName(data.username || 'Eloy');
          }
        }
      } catch (err) {
        console.warn('Failed to load session:', err);
      } finally {
        setLoadingSession(false);
      }
    }
    loadSession();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loadingSession || !isReady || !navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    if (!token && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [token, segments, isReady, navigationState?.key, loadingSession]);

  const login = async (t: string, user: string, id: number) => {
    setToken(t);
    setTokenState(t);
    setUsername(user);
    setUserId(id);
    setDisplayName(user);

    try {
      const sessionPath = (documentDirectory || '') + 'session.json';
      await writeAsStringAsync(sessionPath, JSON.stringify({ token: t, username: user, userId: id }));
    } catch (err) {
      console.warn('Failed to save session:', err);
    }
  };

  const logout = async () => {
    setToken(null);
    setTokenState(null);
    setUsername(null);
    setUserId(null);
    if (sound) {
      await sound.unloadAsync();
    }

    try {
      const sessionPath = (documentDirectory || '') + 'session.json';
      await writeAsStringAsync(sessionPath, JSON.stringify({}));
    } catch (err) {
      console.warn('Failed to clear session:', err);
    }
  };

  const updateProfile = async (name: string, color: string) => {
    setDisplayName(name);
    setAvatarColor(color);

    try {
      const sessionPath = (documentDirectory || '') + 'session.json';
      const fileInfo = await getInfoAsync(sessionPath);
      if (fileInfo.exists) {
        const content = await readAsStringAsync(sessionPath);
        const data = JSON.parse(content);
        data.username = name;
        await writeAsStringAsync(sessionPath, JSON.stringify(data));
      }
    } catch (err) {
      console.warn('Failed to update profile session:', err);
    }
  };

  const playTrack = async (track: Track, index: number, newQueue: Track[]) => {
    setQueue(newQueue);
    setQueueIndex(index);
    setCurrentTrack(track);

    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
    
    setIsPlaying(false);
    setPlayingId(null);
    setPositionMs(0);

    try {
      const offlineTracks = await getDownloadedTracks();
      const offlineMatch = offlineTracks.find(t => t.id === track.id);

      if (offlineMatch && offlineMatch.localUrl) {
        console.log('[Playback] Playing offline downloaded track:', offlineMatch.localUrl);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: offlineMatch.localUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setIsPlaying(true);
      } else {
        let yId = track.youtubeId;
        if (!yId) {
          const res = await axios.get(`http://149.202.84.78:8150/api/resolve?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`);
          yId = res.data.youtubeId;
          track.youtubeId = yId;
        }

        if (yId) {
          console.log('[Playback] Playing via YouTube IFrame:', yId);
          setPlayingId(yId);
          setIsPlaying(true);
        } else {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3` },
            { shouldPlay: true },
            onPlaybackStatusUpdate
          );
          setSound(newSound);
          setIsPlaying(true);
        }
      }
    } catch (e) {
      console.error('Failed to load track audio:', e);
    }
  };

  const onYoutubeStateChange = (state: string) => {
    if (state === 'ended') {
      playNext();
    } else if (state === 'playing') {
      setIsPlaying(true);
    } else if (state === 'paused') {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isPlaying && playingId && playerRef.current) {
      interval = setInterval(async () => {
        try {
          const elapsed_sec = await playerRef.current.getCurrentTime();
          const duration_sec = await playerRef.current.getDuration();
          if (elapsed_sec > 0) {
            setPositionMs(elapsed_sec * 1000);
            setDurationMs(duration_sec * 1000);
          }
        } catch(e) {}
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playingId]);

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
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } else if (playingId) {
      setIsPlaying(!isPlaying);
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
    } else if (playingId && playerRef.current) {
      playerRef.current.seekTo(millis / 1000, true);
      setPositionMs(millis);
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
        <View style={{ position: 'absolute', top: -1000, width: 1, height: 1, opacity: 0 }} pointerEvents="none">
          <YoutubeIframe
            ref={playerRef}
            height={1}
            width={1}
            videoId={playingId || undefined}
            play={isPlaying}
            onChangeState={onYoutubeStateChange}
            initialPlayerParams={{
              controls: false,
              modestbranding: true,
              preventFullScreen: true,
            }}
          />
        </View>
      </PlaybackContext.Provider>
    </AuthContext.Provider>
  );
}
