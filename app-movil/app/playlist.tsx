import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, View, Text, FlatList, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthContext, PlaybackContext } from './_layout';
import Colors from '../constants/Colors';
import axios from 'axios';
import { Track } from '../services/api';

export default function PlaylistDetailScreen() {
  const { id, name } = useLocalSearchParams();
  const router = useRouter();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  const auth = useContext(AuthContext);
  const playback = useContext(PlaybackContext);

  const fetchTracks = async () => {
    if (!auth?.token || !id) return;
    setLoading(true);
    try {
      const res = await axios.get(`http://149.202.84.78:8150/api/playlists/${id}/tracks`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      // Convert database columns (youtube_id -> youtubeId)
      const parsed: Track[] = (res.data || []).map((t: any) => ({
        id: t.id.toString(),
        source: 'youtube',
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        thumbnail: t.thumbnail,
        youtubeId: t.youtube_id
      }));
      setTracks(parsed);
    } catch (e) {
      console.error('Failed to fetch playlist tracks:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, [id, auth?.token]);

  const handlePlayTrack = async (track: Track, index: number) => {
    if (playback) {
      await playback.playTrack(track, index, tracks);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    try {
      await axios.delete(`http://149.202.84.78:8150/api/playlists/${id}/tracks/${trackId}`, {
        headers: { Authorization: `Bearer ${auth?.token}` }
      });
      setTracks(tracks.filter((t) => t.id !== trackId));
    } catch (e) {
      Alert.alert('Error', 'No se pudo eliminar la canción.');
    }
  };

  const renderTrackItem = ({ item, index }: { item: Track; index: number }) => (
    <View style={styles.trackRow}>
      <TouchableOpacity
        onPress={() => handlePlayTrack(item, index)}
        style={styles.trackPressable}
      >
        <Image 
          source={{ uri: item.thumbnail || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=80' }} 
          style={styles.cover} 
        />
        <View style={styles.details}>
          <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
          <Text numberOfLines={1} style={styles.artist}>{item.artist}</Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.rightActions}>
        <Text style={styles.duration}>
          {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
        </Text>
        <TouchableOpacity onPress={() => handleDeleteTrack(item.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color="#ff5252" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={[Colors.bgGradientStart, Colors.bgGradientEnd]}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textMain} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.headerTitle}>{name || 'Playlist'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accentColor} />
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          renderItem={renderTrackItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyState}>Esta playlist no tiene canciones todavía.</Text>
          }
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textMain,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 120,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  trackPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cover: {
    width: 46,
    height: 46,
    borderRadius: 6,
    marginRight: 16,
  },
  details: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMain,
    marginBottom: 3,
  },
  artist: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  duration: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  deleteBtn: {
    padding: 6,
  },
  emptyState: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 80,
  },
});
