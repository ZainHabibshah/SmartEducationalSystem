import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/colors';

export default function PasswordResetModal({
  visible,
  onClose,
  onSubmit,
  roleLabel = 'User',
  email = '',
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = () => {
    if (!password || !confirmPassword) {
      setError('Please enter and confirm your new password');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    onSubmit?.(password);
  };

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    setError('');
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={22} color={COLORS.heading} />
          </TouchableOpacity>

          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {roleLabel} ({email})
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputField]}
              placeholder="New password"
              placeholderTextColor={COLORS.inputText}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={COLORS.inputText}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputField]}
              placeholder="Confirm new password"
              placeholderTextColor={COLORS.inputText}
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={COLORS.inputText}
              />
            </TouchableOpacity>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity style={styles.confirmButton} onPress={handleSubmit} activeOpacity={0.8}>
            <Text style={styles.confirmText}>Update Password</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  title: {
    fontFamily: 'Griffter',
    fontSize: 22,
    color: COLORS.inputBg,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Outfit',
    fontSize: 14,
    color: COLORS.link,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
    color: COLORS.inputText,
    fontFamily: 'Outfit',
    fontSize: 14,
    marginBottom: 10,
  },
  errorText: {
    fontFamily: 'Outfit',
    fontSize: 12,
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: COLORS.buttonBg,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmText: {
    fontFamily: 'Outfit',
    fontSize: 16,
    color: COLORS.buttonText,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    marginBottom: 10,
  },
  inputField: {
    flex: 1,
    marginBottom: 0,
  },
  eyeIcon: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});