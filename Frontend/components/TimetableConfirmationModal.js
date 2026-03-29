import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const COLORS = {
  bg: '#F5F5F5',
  heading: '#03045e',
  buttonBg: '#03045e',
  buttonText: '#FFFFFF',
  danger: '#F44336',
};

export default function TimetableConfirmationModal({ visible, onClose, title, message }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>{title || 'Timetable Updated'}</Text>
          <Text style={styles.message}>
            {message ||
              'The timetable image has been uploaded, processed into embeddings, and is now available below.'}
          </Text>

          <TouchableOpacity style={styles.okButton} onPress={onClose} activeOpacity={0.9}>
            <Text style={styles.okButtonText}>OK</Text>
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
    fontSize: 15,
    color: '#444',
    textAlign: 'center',
    marginBottom: 20,
  },
  okButton: {
    backgroundColor: COLORS.buttonBg,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  okButtonText: {
    fontFamily: 'Outfit',
    fontSize: 16,
    color: COLORS.buttonText,
    fontWeight: '600',
  },
});

