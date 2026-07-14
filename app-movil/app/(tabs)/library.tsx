import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Alert, Modal, TextInput, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { AuthContext, PlaybackContext } from '../_layout';
import Colors from '../../constants/Colors';
import axios from 'axios';
import { Playlist, Track } from '../../services/api';
import { getDownloadedTracks, deleteDownloadedTrack } from '../../services/downloadService';

export default function LibraryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const auth = useContext(AuthContext);
  const playback = useContext(PlaybackContext);

  const [activeTab, setActiveTab] = useState<'playlists' | 'downloads'>('playlists');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [downloads, setDownloads] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [importUrl, setImportUrl] = useState('');
  
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importProgress, setImportProgress] = useState(0);

  const fetchPlaylists = async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const res = await axios.get('http://149.202.84.78:8150/api/playlists', {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setPlaylists(res.data || []);
    } catch (e) {
      console.error('Failed to fetch playlists:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDownloads = async () => {
    const list = await getDownloadedTracks();
    setDownloads(list);
  };

  // Refresh lists on focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPlaylists();
      fetchDownloads();
    });
    return unsubscribe;
  }, [navigation, auth?.token]);

  useEffect(() => {
    fetchPlaylists();
    fetchDownloads();
  }, [auth?.token]);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Error', 'El nombre no puede estar vacío');
      return;
    }
    try {
      await axios.post(
        'http://149.202.84.78:8150/api/playlists',
        { name: newPlaylistName },
        { headers: { Authorization: `Bearer ${auth?.token}` } }
      );
      setNewPlaylistName('');
      setCreateModalVisible(false);
      fetchPlaylists();
    } catch (e) {
      Alert.alert('Error', 'No se pudo crear la playlist.');
    }
  };

  const handleImportPlaylist = async () => {
    if (!importUrl.trim()) {
      Alert.alert('Error', 'Debes ingresar un enlace');
      return;
    }
    setImporting(true);
    setImportStatus('Scrapeando enlaces de reproducción...');
    setImportProgress(0.1);
    
    try {
      // Simulate socket-less incremental feedback
      setTimeout(() => setImportStatus('Resolviendo canciones en YouTube...'), 1500);
      setTimeout(() => setImportProgress(0.4), 1600);
      setTimeout(() => setImportStatus('Creando playlist en tu biblioteca...'), 3500);
      setTimeout(() => setImportProgress(0.8), 3600);

      // Perform import call
      await axios.post(
        'http://149.202.84.78:8150/api/playlists/import',
        { url: importUrl },
        { headers: { Authorization: `Bearer ${auth?.token}` } }
      );

      setImportProgress(1.0);
      setImportStatus('¡Completado con éxito!');
      
      setTimeout(() => {
        setImportUrl('');
        setImportModalVisible(false);
        setImporting(false);
        fetchPlaylists();
      }, 1000);
    } catch (e) {
      Alert.alert('Error', 'No se pudo importar la lista. Verifica que sea pública.');
      setImporting(false);
    }
  };

  const handleDeleteDownload = async (trackId: string) => {
    Alert.alert(
      'Eliminar descarga',
      '¿Quieres eliminar esta canción del almacenamiento de tu teléfono?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            await deleteDownloadedTrack(trackId);
            fetchDownloads();
          }
        }
      ]
    );
  };

  const handlePlayDownloaded = async (track: Track, index: number) => {
    if (playback) {
      await playback.playTrack(track, index, downloads);
    }
  };

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/playlist', params: { id: item.id.toString(), name: item.name } })}
      style={styles.playlistRow}
    >
      <View style={styles.playlistIconBg}>
        <Ionicons name="musical-notes" size={24} color={Colors.accentColor} />
      </View>
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistName}>{item.name}</Text>
        <Text style={styles.playlistTracksCount}>Lista de reproducción de Waisify</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.textSubtle} />
    </TouchableOpacity>
  );

  const renderDownloadItem = ({ item, index }: { item: Track; index: number }) => (
    <View style={styles.downloadRow}>
      <TouchableOpacity
        onPress={() => handlePlayDownloaded(item, index)}
        style={styles.downloadPressable}
      >
        <Image 
          source={{ uri: item.thumbnail || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=80' }} 
          style={styles.downloadCover} 
        />
        <View style={styles.downloadDetails}>
          <Text numberOfLines={1} style={styles.downloadTitle}>{item.title}</Text>
          <Text numberOfLines={1} style={styles.downloadArtist}>{item.artist}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => handleDeleteDownload(item.id)} style={styles.trashBtn}>
        <Ionicons name="trash-outline" size={18} color="#ff5252" />
      </TouchableOpacity>
    </View>
  );

  return (
    <LinearGradient
      colors={[Colors.bgGradientStart, Colors.bgGradientEnd]}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Biblioteca</Text>
        {activeTab === 'playlists' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity onPress={() => setCreateModalVisible(true)} style={styles.iconButton}>
              <Ionicons name="add-circle-outline" size={26} color={Colors.textMain} />
              <Text style={styles.buttonLabel}>Crear</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setImportModalVisible(true)} style={styles.iconButton}>
              <Ionicons name="cloud-download-outline" size={26} color={Colors.accentColor} />
              <Text style={styles.buttonLabel}>Importar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tabs Selector */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          onPress={() => setActiveTab('playlists')}
          style={[styles.tabButton, activeTab === 'playlists' && styles.tabButtonActive]}
        >
          <Text style={[styles.tabText, activeTab === 'playlists' && styles.tabTextActive]}>Playlists</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setActiveTab('downloads')}
          style={[styles.tabButton, activeTab === 'downloads' && styles.tabButtonActive]}
        >
          <Text style={[styles.tabText, activeTab === 'downloads' && styles.tabTextActive]}>Descargas</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'playlists' ? (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPlaylistItem}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={fetchPlaylists}
          ListEmptyComponent={
            <Text style={styles.emptyState}>No tienes listas creadas en tu biblioteca.</Text>
          }
        />
      ) : (
        <FlatList
          data={downloads}
          keyExtractor={(item) => item.id}
          renderItem={renderDownloadItem}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={fetchDownloads}
          ListEmptyComponent={
            <Text style={styles.emptyState}>No tienes canciones descargadas en local.</Text>
          }
        />
      )}

      {/* Create Playlist Modal */}
      <Modal animationType="fade" transparent visible={createModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva playlist</Text>
            <TextInput
              placeholder="Mi lista de reproducción #1"
              placeholderTextColor={Colors.textSubtle}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreatePlaylist} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Import Playlist Modal */}
      <Modal animationType="fade" transparent visible={importModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Importar Playlist</Text>
            <Text style={styles.modalDesc}>Pega un enlace público de Spotify o YouTube para añadir sus canciones sin descargarlas en local.</Text>
            
            {!importing ? (
              <>
                <TextInput
                  placeholder="Pegar enlace de lista aquí..."
                  placeholderTextColor={Colors.textSubtle}
                  value={importUrl}
                  onChangeText={setImportUrl}
                  style={styles.modalInput}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={() => setImportModalVisible(false)} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleImportPlaylist} style={styles.submitBtn}>
                    <Text style={styles.submitBtnText}>Importar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.progressContainer}>
                <Text style={styles.statusText}>{importStatus}</Text>
                <Text style={styles.pctText}>{Math.round(importProgress * 100)}%</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${importProgress * 100}%` }]} />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textMain,
    letterSpacing: -0.5,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  iconButton: {
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 12,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButtonActive: {
    backgroundColor: Colors.accentColor,
    borderColor: Colors.accentColor,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: '#000000',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 180,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  playlistIconBg: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 4,
  },
  playlistTracksCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  downloadPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  downloadCover: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 16,
  },
  downloadDetails: {
    flex: 1,
  },
  downloadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 4,
  },
  downloadArtist: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  trashBtn: {
    padding: 8,
  },
  emptyState: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 60,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#0c0c16',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 12,
  },
  modalDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 8,
    color: Colors.textMain,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 14,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#ff5252',
    fontWeight: '700',
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.accentColor,
    borderRadius: 8,
  },
  submitBtnText: {
    color: '#000000',
    fontWeight: '700',
  },
  progressContainer: {
    alignItems: 'center',
  },
  statusText: {
    color: Colors.textMain,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  pctText: {
    color: Colors.accentColor,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accentColor,
  },
});
