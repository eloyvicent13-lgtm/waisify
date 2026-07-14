import React, { useState, useContext } from 'react';
import { StyleSheet, View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlaybackContext } from '../_layout';
import GlassInput from '../../components/GlassInput';
import Colors from '../../constants/Colors';
import axios from 'axios';
import { Track } from '../../services/api';

const { width } = Dimensions.get('window');

const MOODS = [
  { name: 'Enfocado 🧠', query: 'lofi study focus deep concentration instrumentals', color: 'rgba(0, 229, 255, 0.04)', accent: '#00e5ff' },
  { name: 'Chill 🌊', query: 'lofi chill relax hiphop radio beats soft lofi', color: 'rgba(139, 92, 246, 0.04)', accent: '#8b5cf6' },
  { name: 'Gimnasio 🔥', query: 'workout trap motivation hardstyle gym beats bass', color: 'rgba(239, 68, 68, 0.04)', accent: '#ef4444' },
  { name: 'Melancólico 🌧️', query: 'sad pop ballads acoustic acoustic covers soft pop', color: 'rgba(59, 130, 246, 0.04)', accent: '#3b82f6' },
  { name: 'Fiesta 🕺', query: 'dance party reggaeton electro pop club hits boliche', color: 'rgba(16, 185, 129, 0.04)', accent: '#10b981' },
  { name: 'Madrugar 🌅', query: 'morning vibes acoustic folk indie warm acoustic', color: 'rgba(245, 158, 11, 0.04)', accent: '#f59e0b' }
];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  const playback = useContext(PlaybackContext);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    try {
      const res = await axios.get(`http://149.202.84.78:8150/api/search?q=${encodeURIComponent(q)}`);
      setResults(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMoodSelect = async (moodQuery: string, moodName: string) => {
    setQuery(moodName);
    setLoading(true);
    try {
      const res = await axios.get(`http://149.202.84.78:8150/api/search?q=${encodeURIComponent(moodQuery)}`);
      setResults(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayTrack = async (track: Track, index: number) => {
    if (playback) {
      await playback.playTrack(track, index, results);
    }
  };

  const renderTrackItem = ({ item, index }: { item: Track; index: number }) => (
    <TouchableOpacity
      onPress={() => handlePlayTrack(item, index)}
      style={styles.trackRow}
    >
      <Image 
        source={{ uri: item.thumbnail || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=80' }} 
        style={styles.cover} 
      />
      <View style={styles.details}>
        <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.artist}>{item.artist}</Text>
      </View>
      <Text style={styles.duration}>
        {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={[Colors.bgGradientStart, Colors.bgGradientEnd]}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Buscar</Text>
        <GlassInput
          placeholder="¿Qué quieres escuchar?"
          value={query}
          onChangeText={(txt) => {
            setQuery(txt);
            if (!txt) setResults([]);
          }}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accentColor} />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderTrackItem}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.moodsWrapper}>
          <Text style={styles.moodsTitle}>AI Mood Matcher</Text>
          <Text style={styles.moodsSubtitle}>Selecciona tu estado de ánimo para sintonizar canciones al instante:</Text>
          
          <View style={styles.moodsGrid}>
            {MOODS.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                onPress={() => handleMoodSelect(item.query, item.name)}
                style={[
                  styles.moodCard, 
                  { 
                    backgroundColor: item.color,
                    borderColor: item.accent + '30',
                  }
                ]}
              >
                <View style={[styles.glowPoint, { backgroundColor: item.accent }]} />
                <Text style={styles.moodText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
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
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  searchInput: {
    fontSize: 15,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 160,
    paddingTop: 12,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  cover: {
    width: 44,
    height: 44,
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
  duration: {
    fontSize: 13,
    color: Colors.textMuted,
    marginLeft: 16,
  },
  moodsWrapper: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 180,
  },
  moodsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 4,
  },
  moodsSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 20,
  },
  moodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  moodCard: {
    width: (width - 44) / 2,
    height: 80,
    borderWidth: 0.5,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  glowPoint: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.8,
  },
  moodText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMain,
  },
});
