import React, { useState, useContext } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../_layout';
import Colors from '../../constants/Colors';
import GlassCard from '../../components/GlassCard';

const EQ_BANDS = ['60Hz', '230Hz', '910Hz', '4KHz', '14KHz'];

export default function SettingsScreen() {
  const [eqValues, setEqValues] = useState<number[]>([50, 60, 45, 70, 55]); 
  const auth = useContext(AuthContext);

  const handleTouch = (bandIndex: number, pageY: number, containerHeight: number) => {
    const value = Math.max(0, Math.min(100, Math.round(((containerHeight - pageY) / containerHeight) * 100)));
    const updated = [...eqValues];
    updated[bandIndex] = value;
    setEqValues(updated);
  };

  return (
    <LinearGradient
      colors={[Colors.bgGradientStart, Colors.bgGradientEnd]}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ajustes</Text>
      </View>

      <View style={styles.content}>
        <GlassCard style={styles.card}>
          <Text style={styles.cardHeader}>ECUALIZADOR GRÁFICO</Text>
          <Text style={styles.cardDesc}>Personaliza la frecuencia de salida del audio.</Text>

          <View style={styles.eqBoard}>
            {EQ_BANDS.map((band, idx) => {
              const val = eqValues[idx];
              return (
                <View key={idx} style={styles.eqColumn}>
                  <View 
                    style={styles.sliderContainer}
                    onTouchStart={(e) => handleTouch(idx, e.nativeEvent.locationY, 150)}
                    onTouchMove={(e) => handleTouch(idx, e.nativeEvent.locationY, 150)}
                  >
                    <View style={styles.sliderTrack}>
                      <View style={[styles.sliderFill, { height: `${val}%` }]} />
                    </View>
                    <View style={[styles.sliderHandle, { bottom: `${val}%`, marginBottom: -8 }]} />
                  </View>
                  <Text style={styles.bandLabel}>{band}</Text>
                  <Text style={styles.bandValue}>{val - 50 > 0 ? `+${val - 50}` : val - 50}dB</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        <TouchableOpacity 
          onPress={() => auth?.logout()} 
          style={styles.logoutButton}
        >
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <Text style={styles.versionInfo}>Waisify Mobile v1.0.0 (Expo) • By Antigravity</Text>
      </View>
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
  },
  content: {
    padding: 16,
    gap: 24,
  },
  card: {
    padding: 16,
  },
  cardHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: Colors.textSubtle,
    marginBottom: 24,
  },
  eqBoard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 200,
    alignItems: 'flex-end',
  },
  eqColumn: {
    alignItems: 'center',
    width: '18%',
  },
  sliderContainer: {
    height: 150,
    width: 28,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  sliderTrack: {
    width: 4,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  sliderFill: {
    width: '100%',
    backgroundColor: Colors.accentColor,
  },
  sliderHandle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.textMain,
    borderWidth: 2,
    borderColor: Colors.accentColor,
    shadowColor: Colors.accentColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  bandLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 12,
  },
  bandValue: {
    fontSize: 10,
    color: Colors.textSubtle,
    marginTop: 2,
  },
  logoutButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.2)',
    borderRadius: 8,
  },
  logoutText: {
    color: '#ff5252',
    fontWeight: '700',
    fontSize: 14,
  },
  versionInfo: {
    fontSize: 11,
    color: Colors.textSubtle,
    textAlign: 'center',
    marginTop: 24,
  },
});
