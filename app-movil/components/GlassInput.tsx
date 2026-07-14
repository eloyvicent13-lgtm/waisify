import React from 'react';
import { StyleSheet, TextInput, View, Text, TextInputProps } from 'react-native';
import Colors from '../constants/Colors';

interface GlassInputProps extends TextInputProps {
  label?: string;
}

export default function GlassInput({ label, style, ...props }: GlassInputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputWrapper}>
        <TextInput
          placeholderTextColor={Colors.textSubtle}
          style={[styles.input, style]}
          {...props}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 8,
    overflow: 'hidden',
  },
  input: {
    color: Colors.textMain,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
  },
});
