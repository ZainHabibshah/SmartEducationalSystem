import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const COLORS = {
  heading: '#03045e',
  inputBg: '#03045e',
  inputText: '#FFFFFF',
  buttonBg: '#03045e',
  buttonText: '#FFFFFF',
  link: '#023e8a',
};

export default function TimetableOtpModal({ visible, onClose, onVerify, onResend }) {
  const [otp, setOtp] = useState('');

  const handleConfirm = () => {
    if (!otp.trim()) {
      return;
    }
    onVerify?.(otp.trim());
    setOtp('');
  };

  const handleClose = () => {
    setOtp('');
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
          <Text style={styles.title}>Enter OTP to Upload Timetable</Text>
          <Text style={styles.message}>
            An OTP has been sent to your admin email. Please enter the code below to confirm
            uploading this timetable and generating its embeddings.
          </Text>

          <TextInput
            style={styles.otpInput}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="Enter 6-digit OTP"
            placeholderTextColor="#ccc"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.resendButton} onPress={onResend} activeOpacity={0.8}>
              <Text style={styles.resendText}>Resend OTP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} activeOpacity={0.9}>
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={handleClose} activeOpacity={0.8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: width * 0.9,
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontFamily: 'Griffter',
    fontSize: 22,
    color: COLORS.heading,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontFamily: 'Outfit',
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginBottom: 18,
  },
  otpInput: {
    width: '100%',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontFamily: 'Outfit',
    fontSize: 18,
    color: COLORS.inputText,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resendButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  resendText: {
    fontFamily: 'Outfit',
    fontSize: 14,
    color: COLORS.link,
    textDecorationLine: 'underline',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.buttonBg,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  confirmText: {
    fontFamily: 'Outfit',
    fontSize: 16,
    color: COLORS.buttonText,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: 'Outfit',
    fontSize: 14,
    color: '#666',
  },
});

