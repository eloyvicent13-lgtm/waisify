import React, { useContext, useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, Dimensions, Modal, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PlaybackContext, AuthContext } from '../_layout';
import Colors from '../../constants/Colors';
import GlassCard from '../../components/GlassCard';

const { width } = Dimensions.get('window');

const SHORTCUTS = [
  { title: 'Milo J Mix', query: 'Milo J éxitos', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Milo_J_%28cropped%29.jpg/960px-Milo_J_%28cropped%29.jpg' },
  { title: 'Trueno Hits', query: 'Trueno hits', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Trueno_%28Repero%29_2021.jpg/960px-Trueno_%28Repero%29_2021.jpg' },
  { title: 'Bizarrap Music Sessions', query: 'Bizarrap sessions', img: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/2023-11-16_Gala_de_los_Latin_Grammy%2C_04_%28cropped%29_%282%29.jpg' },
  { title: 'Duki Trap Classics', query: 'Duki éxitos mix', img: 'https://upload.wikimedia.org/wikipedia/commons/d/da/El_Duki.png' }
];

const EMISORAS = [
  { name: 'Milo J', listeners: '1.2M oyentes', query: 'Milo J éxitos', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Milo_J_%28cropped%29.jpg/960px-Milo_J_%28cropped%29.jpg' },
  { name: 'Trueno', listeners: '950K oyentes', query: 'Trueno hits', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Trueno_%28Repero%29_2021.jpg/960px-Trueno_%28Repero%29_2021.jpg' },
  { name: 'Bizarrap', listeners: '3.4M oyentes', query: 'Bizarrap sessions', img: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/2023-11-16_Gala_de_los_Latin_Grammy%2C_04_%28cropped%29_%282%29.jpg' },
  { name: 'Duki', listeners: '2.1M oyentes', query: 'Duki éxitos mix', img: 'https://upload.wikimedia.org/wikipedia/commons/d/da/El_Duki.png' }
];

const RECENTLY_PLAYED = [
  { title: 'Rara Vez', artist: 'Milo J & Taiu', query: 'Milo J Rara Vez', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Milo_J_%28cropped%29.jpg/960px-Milo_J_%28cropped%29.jpg' },
  { title: 'Real G', artist: 'Trueno & Quevedo', query: 'Trueno Real G', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Trueno_%28Repero%29_2021.jpg/960px-Trueno_%28Repero%29_2021.jpg' },
  { title: 'Bzrp Session #57', artist: 'Bizarrap & Milo J', query: 'Bizarrap Milo J session 57', img: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/2023-11-16_Gala_de_los_Latin_Grammy%2C_04_%28cropped%29_%282%29.jpg' },
  { title: 'She Don\'t Give a Fo', artist: 'Duki', query: 'Duki She Dont Give a Fo', img: 'https://upload.wikimedia.org/wikipedia/commons/d/da/El_Duki.png' }
];

export default function HomeScreen() {
  const playback = useContext(PlaybackContext);
  const auth = useContext(AuthContext);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [editName, setEditName] = useState(auth?.displayName || '');
  const [editColor, setEditColor] = useState(auth?.avatarColor || 'purple-cyan');

  useEffect(() => {
    if (auth) {
      setEditName(auth.displayName);
      setEditColor(auth.avatarColor);
    }
  }, [auth?.displayName, auth?.avatarColor]);

  const handlePlayTrack = async (item: any) => {
    if (playback) {
      const track = {
        id: item.title || item.name,
        source: 'youtube',
        title: item.title || `${item.name} Hits`,
        artist: item.artist || 'Waisify Radio',
        thumbnail: item.img,
        duration: 195,
        youtubeId: '',
      };
      await playback.playTrack(track, 0, [track]);
    }
  };

  const getGradientColors = (colorKey: string): [string, string] => {
    if (colorKey === 'mint-blue') return [Colors.mint, Colors.electricBlue];
    if (colorKey === 'lavender-neon') return [Colors.lavender, Colors.accentColor];
    return [Colors.lavender, Colors.cyan];
  };

  const handleSaveProfile = () => {
    if (auth) {
      auth.updateProfile(editName.trim() || auth.username || 'User', editColor);
      setProfileModalVisible(false);
    }
  };

  return (
    <LinearGradient
      colors={[Colors.bgGradientStart, Colors.bgGradientEnd]}
      style={styles.container}
    >
      <View style={[styles.glowOrb, styles.glowCyan, { top: -40, left: -60 }]} />
      <View style={[styles.glowOrb, styles.glowPurple, { top: 120, right: -80 }]} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.welcomeHeader}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setProfileModalVisible(true)}>
            <Text style={styles.greetingText}>Buenas tardes</Text>
            <Text style={styles.profileName}>{auth?.displayName || 'Usuario'}</Text>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="notifications-outline" size={22} color={Colors.textMain} />
            </TouchableOpacity>
            <TouchableOpacity 
              activeOpacity={0.8} 
              onPress={() => setProfileModalVisible(true)} 
              style={styles.avatarBorder}
            >
              <LinearGradient
                colors={getGradientColors(auth?.avatarColor || 'purple-cyan')}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarLetter}>
                  {(auth?.displayName || 'U').charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.shortcutsGrid}>
          {SHORTCUTS.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              onPress={() => handlePlayTrack(item)}
              style={styles.shortcutCard}
            >
              <Image source={{ uri: item.img }} style={styles.shortcutImg} />
              <View style={styles.shortcutInfo}>
                <Text numberOfLines={2} style={styles.shortcutTitle}>{item.title}</Text>
              </View>
              <View style={styles.playBadge}>
                <Ionicons name="play" size={12} color="#000" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Escuchado recientemente</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>Ver todo</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContainer}>
          {RECENTLY_PLAYED.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              onPress={() => handlePlayTrack(item)}
              style={styles.recentCard}
            >
              <Image source={{ uri: item.img }} style={styles.recentImg} />
              <Text numberOfLines={1} style={styles.recentTitle}>{item.title}</Text>
              <Text numberOfLines={1} style={styles.recentArtist}>{item.artist}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.sectionTitle, { marginTop: 36, marginBottom: 16 }]}>Emisoras más escuchadas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContainer}>
          {EMISORAS.map((item, idx) => (
            <GlassCard key={idx} style={styles.artistCard}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handlePlayTrack(item)}
                style={styles.artistCardContent}
              >
                <Image source={{ uri: item.img }} style={styles.artistImg} />
                <Text style={styles.artistName}>{item.name}</Text>
                <Text style={styles.artistDesc}>{item.listeners}</Text>
                <View style={styles.artistPlayBtn}>
                  <Ionicons name="play" size={16} color="#000" />
                </View>
              </TouchableOpacity>
            </GlassCard>
          ))}
        </ScrollView>
      </ScrollView>

      {/* Profile Edit Modal */}
      <Modal animationType="fade" transparent visible={profileModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar Perfil</Text>
            
            <Text style={styles.label}>Nombre para mostrar</Text>
            <TextInput
              placeholder="Ej: Eloy"
              placeholderTextColor={Colors.textSubtle}
              value={editName}
              onChangeText={setEditName}
              style={styles.modalInput}
            />

            <Text style={styles.label}>Tema de avatar</Text>
            <View style={styles.colorPicker}>
              <TouchableOpacity 
                onPress={() => setEditColor('purple-cyan')}
                style={[
                  styles.colorOption, 
                  editColor === 'purple-cyan' && styles.colorOptionActive
                ]}
              >
                <LinearGradient colors={getGradientColors('purple-cyan')} style={styles.colorPill} />
                <Text style={styles.colorLabel}>Neon</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setEditColor('mint-blue')}
                style={[
                  styles.colorOption, 
                  editColor === 'mint-blue' && styles.colorOptionActive
                ]}
              >
                <LinearGradient colors={getGradientColors('mint-blue')} style={styles.colorPill} />
                <Text style={styles.colorLabel}>Menta</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setEditColor('lavender-neon')}
                style={[
                  styles.colorOption, 
                  editColor === 'lavender-neon' && styles.colorOptionActive
                ]}
              >
                <LinearGradient colors={getGradientColors('lavender-neon')} style={styles.colorPill} />
                <Text style={styles.colorLabel}>Lavanda</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveProfile} style={styles.submitBtn}>
                <Text style={styles.submitBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
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
  scrollContent: {
    paddingTop: 64,
    paddingBottom: 160,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  greetingText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileName: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textMain,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBorder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.accentColor,
    padding: 1.5,
    overflow: 'hidden',
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  shortcutCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
    height: 60,
    position: 'relative',
  },
  shortcutImg: {
    width: 60,
    height: 60,
    objectFit: 'cover',
  },
  shortcutInfo: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 32,
  },
  shortcutTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
    lineHeight: 16,
  },
  playBadge: {
    position: 'absolute',
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accentColor,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accentColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textMain,
  },
  seeAllText: {
    fontSize: 12,
    color: Colors.accentColor,
    fontWeight: '700',
  },
  carouselContainer: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 16,
  },
  recentCard: {
    width: 124,
  },
  recentImg: {
    width: 124,
    height: 124,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    marginBottom: 8,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 2,
  },
  recentArtist: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  artistCard: {
    width: 150,
    borderRadius: 16,
    overflow: 'hidden',
  },
  artistCardContent: {
    alignItems: 'center',
    padding: 12,
    position: 'relative',
  },
  artistImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    borderColor: Colors.glassBorder,
    marginBottom: 12,
  },
  artistName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 4,
  },
  artistDesc: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  artistPlayBtn: {
    position: 'absolute',
    top: 76,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accentColor,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#060610',
    shadowColor: Colors.accentColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  glowOrb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.12,
  },
  glowCyan: {
    backgroundColor: Colors.cyan,
  },
  glowPurple: {
    backgroundColor: Colors.lavender,
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
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    marginBottom: 20,
  },
  colorPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  colorOption: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 8,
  },
  colorOptionActive: {
    borderColor: Colors.accentColor,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  colorPill: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    marginBottom: 6,
  },
  colorLabel: {
    fontSize: 11,
    color: Colors.textMain,
    fontWeight: '600',
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
});
