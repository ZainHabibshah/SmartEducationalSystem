import React, { useState, useEffect } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Image,
	Platform,
	Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import apiService from '../services/apiService';
import API from '../config';

const COLORS = {
	bg: '#F5F5F5',
	primary: '#03045e',
	success: '#28a745',
	white: '#FFFFFF',
	text: '#333',
	textLight: '#666',
	border: '#e0e0e0',
};

export default function StudentCurriculumScreen() {
	const router = useRouter();
	const [schedules, setSchedules] = useState([]);
	const [loading, setLoading] = useState(false);

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

				{/* Action Button - Download Only */}
				<View style={styles.actionButtons}>
					<TouchableOpacity
						style={styles.downloadButton}
						onPress={() => handleDownloadSchedule(schedule)}
						activeOpacity={0.8}
					>
						<Ionicons name="download-outline" size={20} color={COLORS.white} />
						<Text style={styles.buttonText}>Download</Text>
					</TouchableOpacity>
				</View>
			</View>
		);
	};

	const handleBack = () => {
		console.log('Back button pressed');
		if (router.canGoBack()) {
			router.back();
		} else {
			router.push('/student');
		}
	};

	return (
		<View style={styles.container}>
			{/* Custom Header - Same as Attendance */}
			<View style={styles.customHeaderContainer}>
				<TouchableOpacity style={styles.customBackButton} onPress={handleBack} activeOpacity={0.8}>
					<Ionicons name="arrow-back" size={22} color={COLORS.primary} />
				</TouchableOpacity>
				<Text style={styles.customHeaderTitle}>Courses Contents</Text>
				<View style={styles.headerPlaceholder} />
			</View>

			<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
				{/* Info Section */}
				<View style={styles.infoSection}>
					<View style={styles.infoCard}>
						<Ionicons name="information-circle" size={24} color={COLORS.primary} />
						<Text style={styles.infoText}>
							View and download course materials uploaded by your instructor
						</Text>
					</View>
				</View>

				{/* Schedules List */}
				<View style={styles.schedulesSection}>
					<Text style={styles.sectionTitle}>Available Course Materials</Text>
					
					{loading ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="large" color={COLORS.primary} />
							<Text style={styles.loadingText}>Loading course materials...</Text>
						</View>
					) : schedules.length === 0 ? (
						<View style={styles.emptyContainer}>
							<Ionicons name="folder-open-outline" size={64} color={COLORS.border} />
							<Text style={styles.emptyText}>No course materials available yet</Text>
							<Text style={styles.emptySubtext}>Check back later for updates from your instructor</Text>
						</View>
					) : (
						<View style={styles.gridContainer}>
							{schedules.map((schedule, index) => renderScheduleCard(schedule, index))}
						</View>
					)}
				</View>
			</ScrollView>
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
	infoSection: {
		padding: 16,
	},
	infoCard: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: COLORS.white,
		borderRadius: 12,
		padding: 16,
		gap: 12,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	infoText: {
		flex: 1,
		fontSize: 14,
		color: COLORS.text,
		lineHeight: 20,
		fontFamily: 'Outfit',
	},
	schedulesSection: {
		padding: 16,
		paddingTop: 0,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: COLORS.text,
		marginBottom: 16,
		fontFamily: 'Griffter',
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
		padding: 16,
	},
	downloadButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: COLORS.success,
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
