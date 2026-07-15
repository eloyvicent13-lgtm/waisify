import React, { useContext, useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Platform, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PlaybackContext } from './_layout';
import Colors from '../constants/Colors';
import axios from 'axios';
import { isDownloaded, downloadTrack, deleteDownloadedTrack } from '../services/downloadService';
import GlassVisualizer from '../components/GlassVisualizer';

const { width, height } = Dimensions.get('window');

interface LyricLine {
  text: string;
  time: number; 
  duration: number; 
}

export default function PlayerScreen() {
  const playback = useContext(PlaybackContext);
  const router = useRouter();

  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isOfflineTrack, setIsOfflineTrack] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Sync lyrics lines selection based on time
  useEffect(() => {
    if (!playback || lyrics.length === 0) return;
    const currentMs = playback.positionMs;

    let activeIdx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (currentMs >= lyrics[i].time && (i === lyrics.length - 1 || currentMs < lyrics[i + 1].time)) {
        activeIdx = i;
        break;
      }
    }

    if (activeIdx !== activeLineIndex && activeIdx !== -1) {
      setActiveLineIndex(activeIdx);
      if (showLyrics) {
        scrollRef.current?.scrollTo({
          y: activeIdx * 56 - height * 0.22,
          animated: true,
        });
      }
    }
  }, [playback?.positionMs, lyrics, showLyrics]);

  // Load track parameters and check download status
  useEffect(() => {
    if (!playback?.currentTrack) return;
    loadLyrics(playback.currentTrack);
    checkDownloadStatus(playback.currentTrack.id);
  }, [playback?.currentTrack?.id]);

  const checkDownloadStatus = async (trackId: string) => {
    const status = await isDownloaded(trackId);
    setIsOfflineTrack(status);
  };

  const handleDownload = async () => {
    if (!playback?.currentTrack) return;
    
    if (isOfflineTrack) {
      // Prompt deletion
      Alert.alert(
        'Eliminar descarga',
        '¿Quieres eliminar esta canción del almacenamiento de tu teléfono?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Eliminar', 
            style: 'destructive',
            onPress: async () => {
              await deleteDownloadedTrack(playback.currentTrack!.id);
              setIsOfflineTrack(false);
            }
          }
        ]
      );
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);
    try {
      await downloadTrack(playback.currentTrack, (p) => {
        setDownloadProgress(p);
      });
      setIsOfflineTrack(true);
      Alert.alert('Éxito', 'Canción descargada correctamente para escuchar sin conexión.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo descargar la canción.');
    } finally {
      setDownloading(false);
    }
  };

  // Synced lyrics parser from LRCLib format
  const parseLrc = (lrcText: string): LyricLine[] => {
    const lines = lrcText.split('\n');
    const parsed: LyricLine[] = [];
    
    const timeRegex = /\[(\d+):(\d+)\.(\d+)\]/;
    
    for (const line of lines) {
      const match = line.match(timeRegex);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = parseInt(match[3], 10) * 10;
        const timeMs = minutes * 60 * 1000 + seconds * 1000 + milliseconds;
        
        const text = line.replace(timeRegex, '').trim();
        if (text) {
          parsed.push({
            text,
            time: timeMs,
            duration: 3000
          });
        }
      }
    }
    
    for (let i = 0; i < parsed.length - 1; i++) {
      parsed[i].duration = parsed[i + 1].time - parsed[i].time;
    }
    
    return parsed;
  };

  // LRCLib Fetcher
  const loadLyrics = async (track: any) => {
    setLoadingLyrics(true);
    setLyrics([]);
    setActiveLineIndex(-1);

    try {
      let lrcData = null;

      // 1. Try exact match query
      try {
        const exactUrl = `https://lrclib.net/api/get?artist=${encodeURIComponent(track.artist)}&track=${encodeURIComponent(track.title)}`;
        const exactRes = await axios.get(exactUrl);
        lrcData = exactRes.data;
      } catch (err) {
        console.log('[Lyrics] LRCLib exact match failed, trying fuzzy search...');
      }

      // 2. Try fuzzy search query if exact match failed
      if (!lrcData) {
        const cleanTitle = track.title
          .replace(/\((official|lyrics|video|mv|feat|with|ft\.|audio|remaster|remastered)\)/gi, '')
          .replace(/\[(official|lyrics|video|mv|feat|with|ft\.|audio|remaster|remastered)\]/gi, '')
          .trim();
        
        let queryTerm = cleanTitle + ' ' + track.artist;
        
        // Smart split if title contains a hyphen (standard YouTube "Artist - Title" format)
        if (track.title.includes('-')) {
          const parts = track.title.split('-');
          const possibleArtist = parts[0].trim();
          const possibleTitle = parts[1]
            .replace(/\((official|lyrics|video|mv|feat|with|ft\.|audio|remaster|remastered)\)/gi, '')
            .replace(/\[(official|lyrics|video|mv|feat|with|ft\.|audio|remaster|remastered)\]/gi, '')
            .trim();
          
          queryTerm = `${possibleTitle} ${possibleArtist}`;
        }

        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(queryTerm)}`;
        const searchRes = await axios.get(searchUrl);
        const searchResults = searchRes.data || [];
        lrcData = searchResults.find((item: any) => item.syncedLyrics || item.plainLyrics);
      }
      
      if (lrcData) {
        if (lrcData.syncedLyrics) {
          const parsed = parseLrc(lrcData.syncedLyrics);
          if (parsed.length > 0) {
            setLyrics(parsed);
            setLoadingLyrics(false);
            return;
          }
        } else if (lrcData.plainLyrics) {
          const lines = lrcData.plainLyrics.split('\n')
            .map((txt: string, idx: number) => ({
              text: txt.trim(),
              time: idx * 4000,
              duration: 4000
            }))
            .filter((t: any) => t.text !== '');
          setLyrics(lines);
          setLoadingLyrics(false);
          return;
        }
      }
    } catch (e) {
      console.log('[Lyrics] LRCLib search chain failed, checking YouTube timedtext fallback');
    }

    // YouTube Subtitles fallback
    try {
      let vId = track.youtubeId;
      if (!vId) {
        const res = await axios.get(`http://149.202.84.78:8150/api/resolve?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`);
        vId = res.data.youtubeId;
      }

      if (vId) {
        const subListRes = await axios.get(`https://www.youtube.com/api/timedtext?v=${vId}&type=list`);
        const xmlText = subListRes.data;
        const langMatch = xmlText.match(/lang_code="([^"]+)"/);
        const langCode = langMatch ? langMatch[1] : 'es';

        const subtitleRes = await axios.get(`https://www.youtube.com/api/timedtext?v=${vId}&lang=${langCode}&fmt=json3`);
        const json = subtitleRes.data;
        const events = json.events || [];

        const parsed: LyricLine[] = events
          .map((ev: any) => {
            const text = (ev.segs || []).map((s: any) => s.utf8).join('').trim();
            if (!text || text.includes('===') || text.includes('---')) return null;
            return {
              text,
              time: ev.tStartMs,
              duration: ev.dDurationMs || 3000,
            };
          })
          .filter(Boolean);

        if (parsed.length > 0) {
          setLyrics(parsed);
          setLoadingLyrics(false);
          return;
        }
      }
    } catch (e) {
      console.log('[Lyrics] YouTube TimedText failed, loading simulator fallback');
    }

    const dummy: LyricLine[] = [
      { text: 'Bienvenidos a Waisify Mobile', time: 0, duration: 4000 },
      { text: 'Disfruta de tus canciones favoritas', time: 4000, duration: 5000 },
      { text: 'Con nuestro ecualizador de mezcla nativo', time: 9000, duration: 4000 },
      { text: 'Y un diseño Apple Liquid Glass inmersivo', time: 13000, duration: 6000 },
      { text: 'Estilo glassmorphism flotante adaptado para iPhone', time: 19000, duration: 5000 },
      { text: 'Desliza las letras sincronizadas en tiempo real', time: 24000, duration: 6000 },
      { text: 'Siente los graves del trap latino y phonk beats', time: 30000, duration: 5000 },
      { text: 'Waisify te conecta a Spotify y YouTube gratis', time: 35000, duration: 5000 },
      { text: 'Disfruta de la mejor calidad descargando tus temas en local', time: 40000, duration: 6000 },
    ];
    setLyrics(dummy);
    setLoadingLyrics(false);
  };

  if (!playback?.currentTrack) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.accentColor} />
      </View>
    );
  }

  const { currentTrack, isPlaying, positionMs, durationMs } = playback;
  const progressPct = durationMs > 0 ? (positionMs / durationMs) * 100 : 0;

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Blurred Cover Art Background */}
      <View style={StyleSheet.absoluteFill}>
        <Image 
          source={{ uri: currentTrack.thumbnail || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=350' }} 
          style={StyleSheet.absoluteFill}
          blurRadius={Platform.OS === 'android' ? 25 : 0}
        />
        <BlurView 
          intensity={Platform.OS === 'ios' ? 60 : 85} 
          tint="systemUltraThinMaterialDark" 
          style={StyleSheet.absoluteFill} 
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'rgba(7,7,9,0.85)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="chevron-down" size={28} color={Colors.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerSubtitle}>Reproduciendo</Text>
        <TouchableOpacity onPress={() => setShowLyrics(!showLyrics)}>
          <Ionicons 
            name="chatbubble-ellipses" 
            size={24} 
            color={showLyrics ? Colors.accentColor : Colors.textMuted} 
          />
        </TouchableOpacity>
      </View>

      {!showLyrics ? (
        <View style={styles.mainContent}>
          <View style={styles.coverShadow}>
            <Image 
              source={{ uri: currentTrack.thumbnail || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=350' }} 
              style={styles.coverImage} 
            />
          </View>

          <View style={styles.metaRow}>
            <View style={styles.trackDetails}>
              <Text numberOfLines={1} style={styles.trackTitle}>{currentTrack.title}</Text>
              <Text numberOfLines={1} style={styles.trackArtist}>{currentTrack.artist}</Text>
            </View>
            <View style={styles.metaActions}>
              <TouchableOpacity onPress={handleDownload} style={styles.actionIconBtn}>
                {downloading ? (
                  <View style={styles.progressContainer}>
                    <ActivityIndicator size="small" color={Colors.accentColor} />
                    <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}%</Text>
                  </View>
                ) : (
                  <Ionicons 
                    name={isOfflineTrack ? "checkmark-circle" : "cloud-download-outline"} 
                    size={26} 
                    color={isOfflineTrack ? Colors.mint : Colors.textMain} 
                  />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionIconBtn}>
                <Ionicons name="heart-outline" size={26} color={Colors.textMain} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.lyricsContent}>
          {loadingLyrics ? (
            <ActivityIndicator size="large" color={Colors.accentColor} style={styles.center} />
          ) : (
            <ScrollView 
              ref={scrollRef} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.lyricsScroll}
            >
              {lyrics.map((line, idx) => {
                const isActive = idx === activeLineIndex;
                return (
                  <Text 
                    key={idx}
                    style={[
                      styles.lyricLineText,
                      isActive ? styles.lyricLineActive : styles.lyricLineInactive
                    ]}
                  >
                    {line.text}
                  </Text>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* Floating Snappy Equalizer Visualizer */}
      <GlassVisualizer isPlaying={isPlaying} />

      <View style={styles.controllerPanel}>
        <View style={styles.progressRow}>
          <View style={styles.trackBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            <View style={[styles.progressHandle, { left: `${progressPct}%`, marginLeft: -5 }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
            <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
          </View>
        </View>

        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="shuffle" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => playback.playPrev()} style={styles.mediaBtn}>
            <Ionicons name="play-back" size={32} color={Colors.textMain} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => playback.togglePlay()} style={styles.playPauseBtn}>
            <Ionicons 
              name={isPlaying ? "pause" : "play"} 
              size={36} 
              color="#000000" 
              style={isPlaying ? null : { marginLeft: 4 }}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => playback.playNext()} style={styles.mediaBtn}>
            <Ionicons name="play-forward" size={32} color={Colors.textMain} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="repeat" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070709',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
    height: 100,
  },
  closeBtn: {
    padding: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  coverShadow: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 8,
    backgroundColor: '#121212',
    marginBottom: 40,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    objectFit: 'cover',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  trackDetails: {
    flex: 1,
    marginRight: 16,
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 6,
  },
  trackArtist: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  metaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionIconBtn: {
    padding: 6,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressText: {
    color: Colors.accentColor,
    fontSize: 10,
    fontWeight: '700',
  },
  lyricsContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  lyricsScroll: {
    paddingTop: height * 0.15,
    paddingBottom: height * 0.25,
  },
  lyricLineText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 32,
    marginVertical: 10,
    textAlign: 'center',
  },
  lyricLineActive: {
    color: Colors.textMain,
    fontWeight: '800',
    transform: [{ scale: 1.12 }],
    textShadowColor: Colors.accentColor,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  lyricLineInactive: {
    color: 'rgba(255, 255, 255, 0.28)',
  },
  controllerPanel: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  progressRow: {
    marginBottom: 24,
  },
  trackBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    position: 'relative',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.textMain,
    borderRadius: 2,
  },
  progressHandle: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.textMain,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  actionBtn: {
    padding: 8,
  },
  mediaBtn: {
    padding: 8,
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.textMain,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.textMain,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
});
