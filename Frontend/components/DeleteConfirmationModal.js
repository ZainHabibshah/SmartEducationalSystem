import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
	inputBg: '#003366',
	buttonText: '#FFFFFF',
};

export default function DeleteConfirmationModal({ visible, onClose, onConfirm, title, message }) {
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
			<View style={styles.overlay}>
				<View style={styles.modalContainer}>
					<View style={styles.iconContainer}>
						<Ionicons name="warning" size={48} color="#dc3545" />
					</View>
					
					<Text style={styles.title}>{title || 'Confirm Delete'}</Text>
					<Text style={styles.message}>
						{message || 'Are you sure you want to delete this item? This action cannot be undone.'}
					</Text>

					<View style={styles.buttonRow}>
						<TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.8}>
							<Text style={styles.cancelButtonText}>Cancel</Text>
						</TouchableOpacity>
						
						<TouchableOpacity style={styles.deleteButton} onPress={onConfirm} activeOpacity={0.8}>
							<Text style={styles.deleteButtonText}>Delete</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	modalContainer: {
		backgroundColor: '#fff',
		borderRadius: 20,
		padding: 24,
		width: '100%',
		maxWidth: 400,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 8,
	},
	iconContainer: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: '#fee',
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 16,
	},
	title: {
		fontFamily: 'Outfit',
		fontSize: 20,
		fontWeight: '600',
		color: '#333',
		marginBottom: 12,
		textAlign: 'center',
	},
	message: {
		fontFamily: 'Outfit',
		fontSize: 15,
		color: '#666',
		textAlign: 'center',
		marginBottom: 24,
		lineHeight: 22,
	},
	buttonRow: {
		flexDirection: 'row',
		gap: 12,
		width: '100%',
	},
	cancelButton: {
		flex: 1,
		backgroundColor: '#e9ecef',
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: 'center',
	},
	cancelButtonText: {
		fontFamily: 'Outfit',
		fontSize: 15,
		fontWeight: '600',
		color: '#495057',
	},
	deleteButton: {
		flex: 1,
		backgroundColor: '#dc3545',
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: 'center',
	},
	deleteButtonText: {
		fontFamily: 'Outfit',
		fontSize: 15,
		fontWeight: '600',
		color: '#fff',
	},
});
