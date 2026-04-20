import React, { useState, useEffect } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
	Image,
	Platform,
	Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import apiService from '../services/apiService';
import API from '../config';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

const COLORS = {
	bg: '#F5F5F5',
	primary: '#003366',
	success: '#28a745',
	danger: '#dc3545',
	white: '#FFFFFF',
	text: '#333',
	textLight: '#666',
	border: '#e0e0e0',
};

const MAX_SCHEDULES = 6;

export default function ScheduleScreen() {
	const router = useRouter();
	const [schedules, setSchedules] = useState([]);
	const [loading, setLoading] = useState(false);
	const [uploadingFile, setUploadingFile] = useState(null);
	const [deleteTarget, setDeleteTarget] = useState(null);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	useEffect(() => {
		loadSchedules();
	}, []);

	const loadSchedules = async () => {
		try {
			setLoading(true);
			console.log('📡 Loading schedules from server...');
			const result = await apiService.listSchedules();
			console.log('📥 Schedules result:', result);
			
			// Response is already unwrapped by axios interceptor
			if (result?.schedules) {
				setSchedules(result.schedules);
				console.log(`✅ Loaded ${result.schedules.length} schedules`);
			} else {
				console.log('⚠️ No schedules data in response');
				setSchedules([]);
			}
		} catch (error) {
			console.error('❌ Error loading schedules:', error);
			console.error('Error details:', error);
			setSchedules([]);
		} finally {
			setLoading(false);
		}
	};

	const handlePickFile = async (type) => {
		try {
			let result;
			if (type === 'image') {
				result = await ImagePicker.launchImageLibraryAsync({
					mediaTypes: ImagePicker.MediaTypeOptions.Images,
					quality: 0.8,
				});
				console.log('📸 Image picker result:', result);
				if (!result.canceled && result.assets?.[0]) {
					uploadFile(result.assets[0], 'image');
				}
			} else {
				result = await DocumentPicker.getDocumentAsync({
					type: 'application/pdf',
					copyToCacheDirectory: true,
				});
				console.log('📄 PDF picker result:', result);
				
				// Check both old and new DocumentPicker response format
				if (result.type !== 'cancel' && result.uri) {
					// Add name property if missing (use fileName or default)
					const fileToUpload = {
						uri: result.uri,
						name: result.name || result.fileName || `document_${Date.now()}.pdf`,
						type: result.mimeType || 'application/pdf',
					};
					console.log('📤 PDF file to upload:', fileToUpload);
					uploadFile(fileToUpload, 'pdf');
				} else if (result.assets && result.assets[0]) {
					// New format (Expo SDK 48+)
					uploadFile(result.assets[0], 'pdf');
				}
			}
		} catch (error) {
			console.error('❌ Error picking file:', error);
			Alert.alert('Error', 'Failed to select file');
		}
	};

	const uploadFile = async (file, fileType) => {
		try {
			setUploadingFile(file);
			
			console.log('📤 Starting upload...');
			console.log('File details:', { uri: file.uri, name: file.name, type: fileType });
			
			// If we already have 6 schedules, delete the oldest one first
			if (schedules.length >= MAX_SCHEDULES) {
				console.log('📊 Max schedules reached, deleting oldest...');
				const oldestSchedule = schedules[0]; // Assuming sorted by date, oldest first
				await deleteScheduleFile(oldestSchedule.filename, true);
			}

			const filename = file.name || file.fileName || `schedule_${Date.now()}.${fileType === 'image' ? 'jpg' : 'pdf'}`;
			
			console.log('📤 Uploading schedule file:', filename);
			console.log('📡 Calling apiService.uploadSchedule...');
			
			const result = await apiService.uploadSchedule(file.uri, filename, fileType);
			
			console.log('📥 Upload result received:', result);
			
			// Response is already unwrapped by axios interceptor
			if (result?.success) {
				console.log('✅ Schedule uploaded successfully');
				Alert.alert('Success', 'Schedule uploaded successfully!');
				await loadSchedules(); // Reload the list
			} else {
				console.log('❌ Upload failed:', result);
				Alert.alert('Error', result?.error || 'Upload failed');
			}
		} catch (error) {
			console.error('❌ Upload error:', error);
			console.error('Error response:', error?.response);
			console.error('Error message:', error?.message);
			console.error('Error code:', error?.code);
			
			let errorMessage = 'Failed to upload';
			if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
				errorMessage = 'Upload timeout. File might be too large.';
			} else if (error?.code === 'ECONNREFUSED' || error?.message?.includes('Network Error')) {
				errorMessage = 'Cannot connect to server. Is the backend running?';
			} else if (error?.response?.status === 401) {
				errorMessage = 'Not authorized. Please login again.';
			} else if (error?.response?.data?.error) {
				errorMessage = error.response.data.error;
			} else if (error?.message) {
				errorMessage = error.message;
			}
			
			Alert.alert('Upload Error', errorMessage);
		} finally {
			setUploadingFile(null);
		}
	};

	const handleDeleteSchedule = (schedule) => {
		setDeleteTarget(schedule);
		setShowDeleteConfirm(true);
	};

	const confirmDelete = async () => {
		if (!deleteTarget) return;
		
		setShowDeleteConfirm(false);
		try {
			await deleteScheduleFile(deleteTarget.filename, false);
			Alert.alert('Success', 'Schedule deleted successfully!');
			loadSchedules();
		} catch (error) {
			console.error('❌ Delete error:', error);
			Alert.alert('Error', 'Failed to delete schedule');
		} finally {
			setDeleteTarget(null);
		}
	};

	const deleteScheduleFile = async (filename, silent = false) => {
		try {
			const result = await apiService.deleteSchedule(filename);
			// Response is already unwrapped by axios interceptor
			if (!silent && result?.success) {
				return true;
			}
			return result?.success;
		} catch (error) {
			if (!silent) {
				throw error;
			}
			console.error('Delete error (silent):', error);
			return false;
		}
	};

	const handleDownloadSchedule = (schedule) => {
		const url = `${API.BASE_URL}/api/schedules/download/${schedule.filename}`;
		console.log('📥 Downloading:', url);
		// Open in browser/download
		if (Platform.OS === 'web') {
			window.open(url, '_blank');
		} else {
			Linking.openURL(url);
		}
	};

	const renderScheduleCard = (schedule, index) => {
		const isImage = schedule.file_type === 'image' || schedule.filename?.match(/\.(jpg|jpeg|png|gif)$/i);
		const isPDF = schedule.file_type === 'pdf' || schedule.filename?.match(/\.pdf$/i);

		return (
			<View key={schedule.id || index} style={styles.scheduleCard}>
				{/* File Preview */}
				<View style={styles.filePreviewContainer}>
					{isImage ? (
						<Image
							source={{ uri: `${API.BASE_URL}/api/schedules/view/${schedule.filename}` }}
							style={styles.imagePreview}
							resizeMode="cover"
						/>
					) : (
						<View style={styles.pdfPreview}>
							<Ionicons name="document-text" size={48} color={COLORS.primary} />
							<Text style={styles.pdfText}>PDF Document</Text>
						</View>
					)}
				</View>

				{/* File Info */}
				<View style={styles.fileInfo}>
					<Text style={styles.fileName} numberOfLines={1}>
						{schedule.filename}
					</Text>
					<Text style={styles.fileDate}>
						Uploaded: {new Date(schedule.upload_date).toLocaleDateString()}
					</Text>
				</View>

				{/* Action Buttons */}
				<View style={styles.actionButtons}>
					<TouchableOpacity
						style={styles.downloadButton}
						onPress={() => handleDownloadSchedule(schedule)}
						activeOpacity={0.8}
					>
						<Ionicons name="download-outline" size={20} color={COLORS.white} />
						<Text style={styles.buttonText}>Download</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={styles.deleteButton}
						onPress={() => handleDeleteSchedule(schedule)}
						activeOpacity={0.8}
					>
						<Ionicons name="trash-outline" size={20} color={COLORS.white} />
						<Text style={styles.buttonText}>Delete</Text>
					</TouchableOpacity>
				</View>
			</View>
		);
	};

	return (
		<View style={styles.container}>
			{/* Header - same style as Timetable screen */}
			<View style={styles.customHeaderContainer}>
				<TouchableOpacity style={styles.customBackButton} onPress={() => router.back()} activeOpacity={0.8}>
					<Ionicons name="arrow-back" size={22} color={COLORS.primary} />
				</TouchableOpacity>
				<Text style={styles.customHeaderTitle}>Course</Text>
				<View style={styles.headerPlaceholder} />
			</View>

			<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
				{/* Upload Section */}
				<View style={styles.uploadSection}>
					<Text style={styles.sectionTitle}>Upload New Schedule</Text>
					<Text style={styles.sectionSubtitle}>
						Upload up to {MAX_SCHEDULES} schedules (PDF or Image). Oldest will be auto-deleted when limit is reached.
					</Text>

					<View style={styles.uploadButtonsRow}>
						<TouchableOpacity
							style={[styles.uploadButton, uploadingFile && styles.uploadButtonDisabled]}
							onPress={() => handlePickFile('pdf')}
							disabled={!!uploadingFile}
							activeOpacity={0.8}
						>
							<Ionicons name="document-text" size={32} color={COLORS.white} />
							<Text style={styles.uploadButtonText}>Upload PDF</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.uploadButton, uploadingFile && styles.uploadButtonDisabled]}
							onPress={() => handlePickFile('image')}
							disabled={!!uploadingFile}
							activeOpacity={0.8}
						>
							<Ionicons name="image" size={32} color={COLORS.white} />
							<Text style={styles.uploadButtonText}>Upload Image</Text>
						</TouchableOpacity>
					</View>

					{uploadingFile && (
						<View style={styles.uploadingIndicator}>
							<ActivityIndicator size="small" color={COLORS.primary} />
							<Text style={styles.uploadingText}>Uploading...</Text>
						</View>
					)}

					<View style={styles.scheduleCount}>
						<Text style={styles.countText}>
							{schedules.length} / {MAX_SCHEDULES} schedules
						</Text>
					</View>
				</View>

				{/* Schedules List */}
				<View style={styles.schedulesSection}>
					<Text style={styles.sectionTitle}>Current Schedules</Text>
					
					{loading ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="large" color={COLORS.primary} />
							<Text style={styles.loadingText}>Loading schedules...</Text>
						</View>
					) : schedules.length === 0 ? (
						<View style={styles.emptyContainer}>
							<Ionicons name="calendar-outline" size={64} color={COLORS.border} />
							<Text style={styles.emptyText}>No schedules uploaded yet</Text>
							<Text style={styles.emptySubtext}>Upload your first schedule above</Text>
						</View>
					) : (
						<View style={styles.gridContainer}>
							{schedules.map((schedule, index) => renderScheduleCard(schedule, index))}
						</View>
					)}
				</View>
			</ScrollView>

			{/* Delete Confirmation Modal */}
			<DeleteConfirmationModal
				visible={showDeleteConfirm}
				onClose={() => {
					setShowDeleteConfirm(false);
					setDeleteTarget(null);
				}}
				onConfirm={confirmDelete}
				title="Delete Schedule"
				message={`Are you sure you want to delete "${deleteTarget?.filename}"? This action cannot be undone.`}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: COLORS.bg,
	},
	customHeaderContainer: {
		padding: 20,
		paddingTop: Platform.select({ ios: 70, android: 50 }),
		backgroundColor: COLORS.bg,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		position: 'relative',
	},
	customBackButton: {
		width: 40,
		height: 40,
		backgroundColor: '#fff',
		borderRadius: 20,
		borderWidth: 1,
		borderColor: COLORS.primary,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
		zIndex: 10,
	},
	customHeaderTitle: {
		fontFamily: 'Griffter',
		fontSize: 28,
		color: COLORS.primary,
		textAlign: 'center',
		flex: 1,
	},
	headerPlaceholder: {
		width: 40,
	},
	content: {
		flex: 1,
	},
	uploadSection: {
		backgroundColor: COLORS.white,
		margin: 16,
		padding: 20,
		borderRadius: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: COLORS.text,
		marginBottom: 8,
		fontFamily: 'Outfit',
	},
	sectionSubtitle: {
		fontSize: 14,
		color: COLORS.textLight,
		marginBottom: 20,
		lineHeight: 20,
		fontFamily: 'Outfit',
	},
	uploadButtonsRow: {
		flexDirection: 'row',
		gap: 12,
		marginBottom: 16,
	},
	uploadButton: {
		flex: 1,
		backgroundColor: COLORS.primary,
		borderRadius: 12,
		padding: 20,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	uploadButtonDisabled: {
		opacity: 0.5,
	},
	uploadButtonText: {
		color: COLORS.white,
		fontSize: 14,
		fontWeight: '600',
		fontFamily: 'Outfit',
	},
	uploadingIndicator: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
		paddingVertical: 12,
		backgroundColor: '#f8f9fa',
		borderRadius: 8,
		marginBottom: 12,
	},
	uploadingText: {
		color: COLORS.primary,
		fontSize: 14,
		fontFamily: 'Outfit',
	},
	scheduleCount: {
		alignItems: 'center',
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: COLORS.border,
	},
	countText: {
		fontSize: 14,
		fontWeight: '500',
		color: COLORS.textLight,
		fontFamily: 'Outfit',
	},
	schedulesSection: {
		padding: 16,
		paddingTop: 0,
	},
	gridContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		gap: 16,
	},
	scheduleCard: {
		backgroundColor: COLORS.white,
		borderRadius: 16,
		width: 250,
		overflow: 'hidden',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
		marginBottom: 16,
	},
	filePreviewContainer: {
		width: 250,
		height: 250,
		backgroundColor: '#f8f9fa',
	},
	imagePreview: {
		width: '100%',
		height: '100%',
	},
	pdfPreview: {
		width: '100%',
		height: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	pdfText: {
		fontSize: 16,
		fontWeight: '500',
		color: COLORS.primary,
		fontFamily: 'Outfit',
	},
	fileInfo: {
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: COLORS.border,
	},
	fileName: {
		fontSize: 16,
		fontWeight: '600',
		color: COLORS.text,
		marginBottom: 4,
		fontFamily: 'Outfit',
	},
	fileDate: {
		fontSize: 13,
		color: COLORS.textLight,
		fontFamily: 'Outfit',
	},
	actionButtons: {
		flexDirection: 'row',
		gap: 12,
		padding: 16,
	},
	downloadButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: COLORS.success,
		borderRadius: 12,
		paddingVertical: 12,
		gap: 8,
	},
	deleteButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: COLORS.danger,
		borderRadius: 12,
		paddingVertical: 12,
		gap: 8,
	},
	buttonText: {
		color: COLORS.white,
		fontSize: 14,
		fontWeight: '600',
		fontFamily: 'Outfit',
	},
	loadingContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 40,
		gap: 12,
	},
	loadingText: {
		fontSize: 14,
		color: COLORS.textLight,
		fontFamily: 'Outfit',
	},
	emptyContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 60,
		gap: 12,
	},
	emptyText: {
		fontSize: 16,
		fontWeight: '500',
		color: COLORS.text,
		fontFamily: 'Outfit',
	},
	emptySubtext: {
		fontSize: 14,
		color: COLORS.textLight,
		fontFamily: 'Outfit',
	},
});
