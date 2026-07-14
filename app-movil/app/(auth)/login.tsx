import React, { useState, useContext } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../_layout';
import GlassCard from '../../components/GlassCard';
import GlassInput from '../../components/GlassInput';
import Colors from '../../constants/Colors';
import axios from 'axios';

export default function LoginScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);

  const auth = useContext(AuthContext);

  const handleSubmit = async () => {
    const user = usernameInput.trim();
    const pass = passwordInput;

    if (!user || !pass) {
      Alert.alert('Error', 'Por favor rellena todos los campos');
      return;
    }

    setLoading(true);
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';

    try {
      const response = await axios.post(`http://149.202.84.78:8150${endpoint}`, {
        username: user,
        password: pass,
      });

      const data = response.data;
      if (auth) {
        auth.login(data.token, data.username, data.userId);
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Error al conectar con el servidor';
      Alert.alert('Fallo en autenticación', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[Colors.bgGradientStart, Colors.bgGradientEnd]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logoText}>Waisify</Text>
            <Text style={styles.subtext}>Música ilimitada con diseño Liquid Glass</Text>
          </View>

          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>{isRegister ? 'Registro' : 'Iniciar Sesión'}</Text>
            
            <GlassInput
              label="Nombre de usuario"
              placeholder="Ej: eloy123"
              value={usernameInput}
              onChangeText={setUsernameInput}
              autoCapitalize="none"
            />
            
            <GlassInput
              label="Contraseña"
              placeholder="********"
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Procesando...' : isRegister ? 'Crear Cuenta' : 'Acceder'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsRegister(!isRegister)}
              style={styles.switchButton}
            >
              <Text style={styles.switchButtonText}>
                {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.textMain,
    letterSpacing: -1,
  },
  subtext: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    width: '100%',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: Colors.accentColor,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.accentColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 15,
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  switchButtonText: {
    color: Colors.accentColor,
    fontSize: 13,
    fontWeight: '600',
  },
});
