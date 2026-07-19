import React, { createContext, useState, useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import TrackPlayer, {
  Capability,
  Event,
  State,
  useProgress,
  useTrackPlayerEvents,
  usePlaybackState,
} from 'react-native-track-player';
import axios from 'axios';
import { setToken, Track } from '../services/api';
import { getDownloadedTracks } from '../services/downloadService';
import { setRemoteHandlers } from '../services/trackPlayerService';
import { documentDirectory, readAsStringAsync, writeAsStringAsync, getInfoAsync } from 'expo-file-system/legacy';

const API_BASE = 'http://149.202.84.78:8150';

let playerSetupPromise: Promise<void> | null = null;
function ensurePlayerSetup(): Promise<void> {
  if (!playerSetupPromise) {
    playerSetupPromise = (async () => {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.Stop,
        ],
        compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious],
      });
    })();
  }
  return playerSetupPromise;
}

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
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [isReady, setIsReady] = useState(false);

  // Native truth for playback state / position / duration — no manual
  // isPlaying flag to desync, no hardcoded duration fallback to overflow.
  const playbackState = usePlaybackState();
  const isPlaying = playbackState.state === State.Playing || playbackState.state === State.Buffering;
  const progress = useProgress(500);
  const positionMs = progress.position * 1000;
  const durationMs = progress.duration * 1000;

  useEffect(() => {
    ensurePlayerSetup().catch((err) => console.warn('[TrackPlayer] Setup failed:', err));
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
    try {
      await TrackPlayer.reset();
    } catch {}

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

    try {
      await ensurePlayerSetup();

      const offlineTracks = await getDownloadedTracks();
      const offlineMatch = offlineTracks.find(t => t.id === track.id);

      let uri: string | null = null;

      if (offlineMatch && offlineMatch.localUrl) {
        console.log('[Playback] Playing offline downloaded track:', offlineMatch.localUrl);
        uri = offlineMatch.localUrl;
      } else {
        let yId = track.youtubeId;
        if (!yId) {
          const res = await axios.get(`${API_BASE}/api/resolve?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`);
          yId = res.data.youtubeId;
          track.youtubeId = yId;
        }
        if (yId) {
          // Proxied through our backend (not a raw googlevideo URL) so it
          // isn't IP-locked to whoever resolved it, and supports Range
          // requests for native seeking.
          uri = `${API_BASE}/api/audio?youtubeId=${yId}`;
        }
      }

      if (!uri) {
        console.error('[Playback] No stream resolved for track, aborting playback:', track.title);
        return;
      }

      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: track.id,
        url: uri,
        title: track.title,
        artist: track.artist,
        artwork: track.thumbnail || undefined,
      });
      await TrackPlayer.play();
    } catch (e) {
      console.error('Failed to load track audio:', e);
    }
  };

  const togglePlay = async () => {
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
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
    await TrackPlayer.seekTo(millis / 1000);
  };

  // Refs so the queue-ended listener and the lock-screen remote-control
  // handlers always call the *current* playNext/playPrev — both are
  // registered once (empty dep effects) but must never close over a stale
  // queue/queueIndex from whatever render they were created in.
  const playNextRef = useRef(playNext);
  const playPrevRef = useRef(playPrev);
  useEffect(() => {
    playNextRef.current = playNext;
    playPrevRef.current = playPrev;
  });

  useEffect(() => {
    setRemoteHandlers({
      onNext: () => playNextRef.current(),
      onPrevious: () => playPrevRef.current(),
    });
  }, []);

  useTrackPlayerEvents([Event.PlaybackQueueEnded, Event.PlaybackActiveTrackChanged], (event) => {
    if (event.type === Event.PlaybackQueueEnded) {
      playNextRef.current();
    }
  });

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
