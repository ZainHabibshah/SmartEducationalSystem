import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import UploadConfirmationModal from '../components/UploadConfirmationModal';
import OTPModal from '../components/OTPModal';
import TimetableConfirmationModal from '../components/TimetableConfirmationModal';
import TimetableOtpModal from '../components/TimetableOtpModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import apiService from '../services/apiService';
import API from '../config';

const COLORS = {
	bg: '#F5F5F5',
	heading: '#03045e',
	inputBg: '#03045e',
	inputText: '#FFFFFF',
	link: '#023e8a',
	buttonBg: '#03045e',
	buttonText: '#FFFFFF',
};

export default function UploadBaseScreen() {
	const [selectedFile, setSelectedFile] = useState(null);
	const [showConfirmation, setShowConfirmation] = useState(false);
	const [showTimetableConfirmation, setShowTimetableConfirmation] = useState(false);
	const [showTimetableOtpModal, setShowTimetableOtpModal] = useState(false);
	const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [showOTPModal, setShowOTPModal] = useState(false);
	const [pendingUpload, setPendingUpload] = useState(null);
	const [currentTimetable, setCurrentTimetable] = useState(null);
	const [loadingTimetable, setLoadingTimetable] = useState(false);
	const pathname = usePathname();
	const router = useRouter();
	const isAttendance = pathname?.toLowerCase().includes('attendance');
	const isTimetable = pathname?.toLowerCase().includes('timetable');
	const isSchedule = pathname?.toLowerCase().includes('schedule');
	const isCurriculum = pathname?.toLowerCase().includes('curriculum');
	
	let title = 'Upload Document';
	if (isAttendance) {
		title = 'Upload Attendance';
	} else if (isTimetable) {
		title = 'Upload Timetable';
	} else if (isSchedule) {
		title = 'Upload Schedule';
	} else if (isCurriculum) {
		title = 'Upload Curriculum';
	}

	// Load existing timetable (for admin timetable screen) so we can show it and enforce single-timetable rule
	useEffect(() => {
		if (isTimetable) {
			loadCurrentTimetable();
		}
	}, [isTimetable]);

	const loadCurrentTimetable = async () => {
		try {
			setLoadingTimetable(true);
			const result = await apiService.listTimetables();
			
			// Axios response wraps data in .data property
			const responseData = result?.data || result;
			console.log('List timetables response:', responseData);
			
			if (responseData && responseData.timetables && responseData.timetables.length > 0) {
				// Pick the most recently uploaded timetable based on upload_date
				const sorted = [...responseData.timetables].sort((a, b) => {
					const da = new Date(a.upload_date);
					const db = new Date(b.upload_date);
					return db - da;
				});
				console.log('✅ Current timetable set to:', sorted[0]);
				setCurrentTimetable(sorted[0]);
			} else {
				console.log('⚠️ No timetables found');
				setCurrentTimetable(null);
			}
		} catch (error) {
			// Keep any already shown timetable instead of clearing it on error
			console.error('Error loading timetables:', error);
		} finally {
			setLoadingTimetable(false);
		}
	};

	const handlePickPdf = async () => {
		// Only allow PDF for curriculum, not for timetable
		if (isTimetable) {
			Alert.alert('PDF Not Allowed', 'Timetable only accepts picture files (JPG, PNG). Please select an image instead.');
			return;
		}
		const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: false });
		if (res?.assets?.[0]) {
			setSelectedFile(res.assets[0]);
		}
	};

	const handlePickImage = async () => {
		const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
		if (!res.canceled && res.assets?.[0]) {
			setSelectedFile(res.assets[0]);
		}
	};

	const handleConfirmUpload = async () => {
		if (!selectedFile) {
			Alert.alert('No file selected', 'Please select a PDF or Picture to upload.');
			return;
		}

		// For timetable: do not allow upload while an existing timetable is present
		if (isTimetable && currentTimetable) {
			Alert.alert('Timetable Exists', 'Please delete the current timetable before uploading a new one.');
			return;
		}

		try {
			// For timetable and curriculum, request OTP first
			if (isTimetable || isCurriculum) {
				setUploading(true);
				try {
					// Request OTP for upload operation
					const operationType = isTimetable ? 'upload_timetable' : 'upload_curriculum';
					await apiService.requestOperationOtp(operationType);
					
					// Store upload info for after OTP verification
					setPendingUpload({
						type: operationType,
						file: selectedFile,
					});
					
					// Show OTP modal - use timetable-specific one on timetable screen
					if (isTimetable) {
						setShowTimetableOtpModal(true);
					} else {
						setShowOTPModal(true);
					}
					setUploading(false);
				} catch (error) {
					console.error('Error requesting OTP:', error);
					Alert.alert('Error', error?.error || error?.message || 'Failed to request OTP. Please try again.');
					setUploading(false);
				}
				return;
			}
			
			// For other types, proceed without OTP
			setUploading(true);
			
			// For other types (attendance, schedule), just show confirmation
			setShowConfirmation(true);
			setUploading(false);
		} catch (error) {
			console.error('Upload error:', error);
			Alert.alert('Upload Failed', error?.message || 'Failed to upload file. Please try again.');
			setUploading(false);
		}
	};

	const handleOTPVerify = async (otp) => {
		if (!pendingUpload) {
			Alert.alert('Error', 'Upload session expired. Please try again.');
			setShowOTPModal(false);
			return;
		}

		try {
			setUploading(true);
			setShowOTPModal(false);
			setShowTimetableOtpModal(false);

			if (pendingUpload.type === 'upload_timetable') {
				// Upload timetable image with OTP
				const filename = pendingUpload.file.name || `timetable_${Date.now()}.jpg`;
				const result = await apiService.uploadTimetable(pendingUpload.file.uri, filename, otp);
				
				console.log('Upload timetable result:', result);
				
				// The result is the axios response object, data is in result.data
				const responseData = result?.data || result;
				
				if (responseData && responseData.success) {
					console.log('✅ Timetable uploaded successfully:', responseData.filename);
					// Immediately reflect the newly uploaded timetable in UI
					setCurrentTimetable({
						filename: responseData.filename || filename,
						upload_date: new Date().toISOString(),
					});
					
					// Clear selected file and reset upload state
					setSelectedFile(null);
					setPendingUpload(null);
					setUploading(false);
					
					// Show success modal for timetable
					setShowTimetableConfirmation(true);
				} else {
					Alert.alert('Upload Failed', responseData?.error || 'Failed to upload timetable. Please try again.');
					setUploading(false);
				}
			} else if (pendingUpload.type === 'upload_curriculum') {
				// For curriculum, ask which curriculum type first
				Alert.alert(
					'Select Curriculum',
					'Please select the curriculum type',
					[
						{ text: 'Physics', onPress: () => uploadCurriculumWithOTP('physics', otp) },
						{ text: 'Chemistry', onPress: () => uploadCurriculumWithOTP('chemistry', otp) },
						{ text: 'Computer Science', onPress: () => uploadCurriculumWithOTP('computer_science', otp) },
						{ text: 'Cancel', style: 'cancel', onPress: () => {
							setUploading(false);
							setPendingUpload(null);
						}},
					]
				);
			} else if (pendingUpload.type === 'delete_timetable') {
				// Delete existing timetable with OTP
				const filename = pendingUpload.filename;
				console.log('🗑️ Deleting timetable:', filename, 'with OTP:', otp);
				
				try {
					const result = await apiService.deleteTimetable(filename, otp);
					console.log('Delete timetable result:', result);
					
					// Axios response wraps data in .data property
					const responseData = result?.data || result;
					
					if (responseData && responseData.success) {
						console.log('✅ Timetable deleted successfully');
						Alert.alert('Success', 'Timetable deleted successfully.');
						setPendingUpload(null);
						setUploading(false);
						// Clear current timetable and refresh state so upload becomes available again
						setCurrentTimetable(null);
						await loadCurrentTimetable();
					} else {
						console.log('❌ Delete failed:', responseData?.error);
						Alert.alert(
							'Delete Failed',
							responseData?.error || 'Failed to delete timetable. Please try again.'
						);
						setUploading(false);
					}
				} catch (error) {
					console.error('❌ Delete timetable error:', error);
					console.error('Error details:', error?.response?.data);
					Alert.alert(
						'Delete Failed',
						error?.response?.data?.error || error?.error || error?.message || 'Failed to delete timetable. Please check your OTP and try again.'
					);
					setUploading(false);
				}
			}
		} catch (error) {
			console.error('Upload error:', error);
			Alert.alert('Upload Failed', error?.error || error?.message || 'Failed to upload file. Please check your OTP and try again.');
			setUploading(false);
			setPendingUpload(null);
		}
	};

	const uploadCurriculumWithOTP = async (curriculumType, otp) => {
		try {
			if (!pendingUpload) {
				Alert.alert('Error', 'Upload session expired. Please try again.');
				return;
			}

			const filename = pendingUpload.file.name || `curriculum_${Date.now()}.pdf`;
			const result = await apiService.uploadCurriculumPdf(pendingUpload.file.uri, filename, curriculumType, otp);
			
			if (result && result.success) {
				setShowConfirmation(true);
				setPendingUpload(null);
				setUploading(false);
			} else {
				Alert.alert('Upload Failed', result?.error || 'Failed to upload curriculum. Please try again.');
				setUploading(false);
				setPendingUpload(null);
			}
		} catch (error) {
			console.error('Curriculum upload error:', error);
			Alert.alert('Upload Failed', error?.error || error?.message || 'Failed to upload curriculum. Please try again.');
			setUploading(false);
			setPendingUpload(null);
		}
	};

	const handleOTPResend = async () => {
		if (!pendingUpload) {
			Alert.alert('Error', 'Upload session expired. Please try again.');
			setShowOTPModal(false);
			return;
		}

		try {
			await apiService.requestOperationOtp(pendingUpload.type);
			Alert.alert('OTP Sent', 'A new OTP has been sent to your admin email.');
		} catch (error) {
			console.error('Error resending OTP:', error);
			Alert.alert('Error', error?.error || error?.message || 'Failed to resend OTP. Please try again.');
		}
	};

	const handleConfirmationClose = () => {
		setShowConfirmation(false);
		router.back();
	};

	const handleTimetableConfirmationClose = () => {
		setShowTimetableConfirmation(false);
		// After timetable upload, refresh current timetable and keep admin on screen
		loadCurrentTimetable();
		setSelectedFile(null);
	};

	const handleCancel = () => {
		if (selectedFile) {
			Alert.alert(
				'Cancel Upload',
				'Are you sure you want to cancel? Your selected file will be lost.',
				[
					{ text: 'Keep File', style: 'cancel' },
					{ 
						text: 'Cancel Upload', 
						style: 'destructive',
						onPress: () => {
							setSelectedFile(null);
							router.back();
						}
					}
				]
			);
		} else {
			router.back();
		}
	};

	const handleDownloadTimetable = () => {
		console.log('⬇️ Download button clicked!');
		console.log('Current timetable:', currentTimetable);
		
		if (!currentTimetable) {
			console.log('❌ No current timetable for download');
			return;
		}
		
		const url = `${API.BASE_URL}/api/timetable/download-timetable/${currentTimetable.filename}`;
		console.log('📥 Opening download URL:', url);
		Linking.openURL(url);
	};

	const handleDeleteTimetable = () => {
		console.log('🔴 Delete button clicked!');
		console.log('Current timetable:', currentTimetable);
		
		if (!currentTimetable) {
			console.log('❌ No current timetable - returning early');
			Alert.alert('Error', 'No timetable found to delete.');
			return;
		}

		console.log('✅ Showing delete confirmation modal');
		setShowDeleteConfirmation(true);
	};

	const handleConfirmDelete = async () => {
		console.log('✅ User confirmed deletion');
		setShowDeleteConfirmation(false);
		
		try {
			setUploading(true);
			// Request OTP for delete_timetable operation
			console.log('📧 Requesting OTP for delete operation...');
			await apiService.requestOperationOtp('delete_timetable');
			console.log('✅ OTP requested successfully');
			
			// Store pending delete operation
			setPendingUpload({
				type: 'delete_timetable',
				filename: currentTimetable.filename,
			});
			
			// Use timetable-specific OTP modal
			setShowTimetableOtpModal(true);
			setUploading(false);
		} catch (error) {
			console.error('❌ Error requesting OTP for delete_timetable:', error);
			Alert.alert('Error', error?.error || error?.message || 'Failed to request OTP. Please try again.');
			setUploading(false);
		}
	};

	return (
		<View style={styles.container}>
			<TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.8}>
				<Ionicons name="arrow-back" size={24} color={COLORS.inputBg} />
				<Text style={styles.cancelText}>
					{selectedFile ? 'Cancel' : 'Back'}
				</Text>
			</TouchableOpacity>
			
			<Text style={styles.title}>{title}</Text>

			<ScrollView contentContainerStyle={styles.scrollContent}>
			<View style={styles.card}>
				{isTimetable ? (
					<>
						<Text style={styles.sectionTitle}>Select timetable picture</Text>
						<TouchableOpacity
							style={styles.timetableUploadArea}
							onPress={handlePickImage}
							activeOpacity={0.9}
						>
							<Ionicons name="image" size={80} color={COLORS.inputBg} />
							<Text style={styles.timetableUploadText}>
								{selectedFile ? 'Change selected picture' : 'Tap to choose timetable picture'}
							</Text>
						</TouchableOpacity>

						{selectedFile && (
							<View style={styles.filePreview}>
								<Ionicons name="checkmark-circle" size={20} color={COLORS.inputBg} />
								<Text style={styles.fileName} numberOfLines={1}>
									{selectedFile.name || selectedFile.uri}
								</Text>
							</View>
						)}

						<TouchableOpacity
							style={[
								styles.confirmButton,
								(uploading || !selectedFile || currentTimetable) && styles.confirmButtonDisabled,
							]}
							onPress={handleConfirmUpload}
							activeOpacity={0.9}
							disabled={uploading || !selectedFile || !!currentTimetable}
						>
							{uploading ? (
								<ActivityIndicator size="small" color={COLORS.buttonText} />
							) : (
								<Text style={styles.confirmText}>Confirm Upload</Text>
							)}
						</TouchableOpacity>

						{currentTimetable && (
							<Text style={styles.helperText}>
								To upload a new timetable, first delete the current one below.
							</Text>
						)}
					</>
				) : (
					<>
						<Text style={styles.sectionTitle}>Choose file type</Text>
						<View style={styles.row}>
							{!isTimetable && (
								<TouchableOpacity style={styles.option} onPress={handlePickPdf} activeOpacity={0.85}>
									<Ionicons name="document-text" size={22} color={COLORS.inputBg} />
									<Text style={styles.optionText}>Upload PDF</Text>
								</TouchableOpacity>
							)}
							<TouchableOpacity
								style={[styles.option, isTimetable && styles.optionFullWidth]}
								onPress={handlePickImage}
								activeOpacity={0.85}
							>
								<Ionicons name="image" size={22} color={COLORS.inputBg} />
								<Text style={styles.optionText}>Upload Picture</Text>
							</TouchableOpacity>
						</View>

						{selectedFile && (
							<View style={styles.filePreview}>
								<Ionicons name="checkmark-circle" size={20} color={COLORS.inputBg} />
								<Text style={styles.fileName} numberOfLines={1}>
									{selectedFile.name || selectedFile.uri}
								</Text>
							</View>
						)}

						<TouchableOpacity
							style={[styles.confirmButton, uploading && styles.confirmButtonDisabled]}
							onPress={handleConfirmUpload}
							activeOpacity={0.9}
							disabled={uploading || !selectedFile}
						>
							{uploading ? (
								<ActivityIndicator size="small" color={COLORS.buttonText} />
							) : (
								<Text style={styles.confirmText}>Confirm Upload</Text>
							)}
						</TouchableOpacity>
					</>
				)}
			</View>

			{/* Current timetable preview & actions (admin timetable only) */}
			{isTimetable && (
				<View style={styles.currentTimetableSection}>
					<Text style={styles.sectionTitle}>Current Timetable</Text>
					{loadingTimetable ? (
						<View style={styles.loadingTimetableContainer}>
							<ActivityIndicator size="small" color={COLORS.inputBg} />
							<Text style={styles.loadingTimetableText}>Loading current timetable...</Text>
						</View>
					) : currentTimetable ? (
						<View style={styles.timetableCard}>
							<Image
								source={{
									uri: `${API.BASE_URL}/api/timetable/view-timetable/${currentTimetable.filename}`,
								}}
								style={styles.timetableImage}
								resizeMode="contain"
							/>
							<View style={styles.timetableButtonsRow}>
								<TouchableOpacity
									style={styles.downloadButton}
									onPress={handleDownloadTimetable}
									activeOpacity={0.85}
								>
									<Ionicons name="download" size={18} color={COLORS.buttonText} />
									<Text style={styles.timetableButtonText}>Download</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={styles.deleteButton}
									onPress={handleDeleteTimetable}
									activeOpacity={0.85}
								>
									<Ionicons name="trash" size={18} color="#fff" />
									<Text style={styles.timetableButtonText}>Delete</Text>
								</TouchableOpacity>
							</View>
						</View>
					) : (
						<Text style={styles.noTimetableText}>No timetable uploaded yet.</Text>
					)}
				</View>
			)}
			</ScrollView>

			{/* OTP Modal */}
			{!isTimetable && (
				<OTPModal
					visible={showOTPModal}
					onClose={() => {
						setShowOTPModal(false);
						setPendingUpload(null);
					}}
					onVerify={handleOTPVerify}
					onResend={handleOTPResend}
					type={isCurriculum ? 'add' : 'delete'}
				/>
			)}

			{isTimetable && (
				<TimetableOtpModal
					visible={showTimetableOtpModal}
					onClose={() => {
						setShowTimetableOtpModal(false);
						setPendingUpload(null);
					}}
					onVerify={handleOTPVerify}
					onResend={handleOTPResend}
				/>
			)}

			{/* Confirmation Modal */}
			<UploadConfirmationModal
				visible={showConfirmation}
				onClose={handleConfirmationClose}
				title={`${isCurriculum ? 'Curriculum' : isSchedule ? 'Schedule' : 'Document'} Uploaded Successfully`}
				message={`Your ${isCurriculum ? 'curriculum' : isSchedule ? 'schedule' : 'document'} has been uploaded and processed successfully!`}
				operationType="upload"
			/>

			<TimetableConfirmationModal
				visible={showTimetableConfirmation}
				onClose={handleTimetableConfirmationClose}
				title="Timetable Uploaded Successfully"
				message="The timetable has been uploaded, converted into embeddings, and is now shown below."
			/>

			<DeleteConfirmationModal
				visible={showDeleteConfirmation}
				onClose={() => setShowDeleteConfirmation(false)}
				onConfirm={handleConfirmDelete}
				title="Delete Timetable"
				message="Are you sure you want to delete the current timetable? This action cannot be undone."
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: COLORS.bg,
		padding: 20,
	},
	cancelButton: {
		flexDirection: 'row',
		alignItems: 'center',
		alignSelf: 'flex-start',
		paddingVertical: 8,
		paddingHorizontal: 12,
		marginTop: Platform.select({ ios: 50, android: 20 }),
		marginBottom: 10,
		backgroundColor: '#fff',
		borderRadius: 20,
		borderWidth: 1,
		borderColor: COLORS.inputBg,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	cancelText: {
		fontFamily: 'Outfit',
		fontSize: 16,
		color: COLORS.inputBg,
		marginLeft: 6,
	},
	title: {
		fontFamily: 'Griffter',
		fontSize: 22,
		color: COLORS.inputBg,
		textAlign: 'center',
		marginTop: Platform.select({ ios: 50, android: 20 }),
		marginBottom: 16,
	},
	card: {
		backgroundColor: '#fff',
		borderRadius: 16,
		borderWidth: 2,
		borderColor: COLORS.inputBg,
		padding: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 6,
		elevation: 4,
	},
	timetableUploadArea: {
		width: '100%',
		minHeight: 180,
		borderRadius: 16,
		borderWidth: 2,
		borderColor: COLORS.inputBg,
		backgroundColor: '#F8F9FA',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 20,
		paddingHorizontal: 16,
		marginBottom: 12,
	},
	timetableUploadText: {
		marginTop: 12,
		fontFamily: 'Outfit',
		fontSize: 15,
		color: COLORS.inputBg,
		textAlign: 'center',
	},
	sectionTitle: {
		fontFamily: 'Outfit',
		fontSize: 16,
		color: COLORS.inputBg,
		marginBottom: 10,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	option: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		backgroundColor: '#F8F9FA',
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 14,
		borderLeftWidth: 4,
		borderLeftColor: COLORS.inputBg,
		width: '48%',
	},
	optionFullWidth: {
		width: '100%',
	},
	optionText: {
		fontFamily: 'Outfit',
		fontSize: 14,
		color: COLORS.inputBg,
		marginLeft: 8,
	},
	radioGroup: {
		marginTop: 8,
		marginBottom: 12,
	},
	radioRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 10,
	},
	radioOuter: {
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 2,
		borderColor: COLORS.inputBg,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 10,
	},
	radioOuterActive: {
		borderColor: COLORS.inputBg,
		backgroundColor: '#E7EFE7',
	},
	radioInner: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: COLORS.inputBg,
	},
	radioLabel: {
		fontFamily: 'Outfit',
		fontSize: 14,
		color: COLORS.inputBg,
	},
	filePreview: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		marginTop: 8,
		marginBottom: 12,
	},
	fileName: {
		flex: 1,
		fontFamily: 'Outfit',
		fontSize: 12,
		color: COLORS.link,
		marginLeft: 8,
	},
	confirmButton: {
		marginTop: 8,
		backgroundColor: COLORS.inputBg,
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: 'center',
	},
	confirmText: {
		fontFamily: 'Outfit',
		fontSize: 15,
		color: COLORS.buttonText,
	},
	confirmButtonDisabled: {
		opacity: 0.6,
	},
	timetableCard: {
		width: '100%',
		backgroundColor: '#fff',
		borderRadius: 16,
		padding: 16,
		marginTop: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 6,
		elevation: 4,
	},
	timetableImage: {
		width: '100%',
		height: 400,
		borderRadius: 12,
		backgroundColor: '#F8F9FA',
		marginBottom: 16,
	},
	timetableButtonsRow: {
		flexDirection: 'row',
		gap: 12,
		width: '100%',
	},
	downloadButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#28a745', // Green
		borderRadius: 12,
		paddingVertical: 14,
		gap: 8,
	},
	deleteButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#dc3545', // Red
		borderRadius: 12,
		paddingVertical: 14,
		gap: 8,
	},
	timetableButtonText: {
		fontFamily: 'Outfit',
		fontSize: 15,
		color: '#fff',
		fontWeight: '500',
	},
	noTimetableText: {
		fontFamily: 'Outfit',
		fontSize: 14,
		color: '#999',
		textAlign: 'center',
		marginTop: 20,
	},
});


