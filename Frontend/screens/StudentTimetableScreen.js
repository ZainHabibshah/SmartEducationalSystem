import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomNav from '../components/BottomNav';
import apiService from '../services/apiService';
import API from '../config';

const COLORS = {
	bg: '#F5F5F5',
	heading: '#03045e',
	inputBg: '#03045e',
	inputText: '#FFFFFF',
	buttonBg: '#03045e',
	buttonText: '#FFFFFF',
	link: '#023e8a',
	success: '#28a745',
};

const { height } = Dimensions.get('window');
const BOTTOM_NAV_HEIGHT = height * 0.16;

export default function StudentTimetableScreen() {
	const router = useRouter();
	const [currentTimetable, setCurrentTimetable] = useState(null);
	const [loadingTimetable, setLoadingTimetable] = useState(true);

	useEffect(() => {
		loadCurrentTimetable();
	}, []);

	const loadCurrentTimetable = async () => {
		try {
			setLoadingTimetable(true);
			const result = await apiService.listTimetables();
			
			// Axios response wraps data in .data property
			const responseData = result?.data || result;
			console.log('📅 List timetables response:', responseData);
			
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
			console.error('❌ Error loading timetables:', error);
			setCurrentTimetable(null);
		} finally {
			setLoadingTimetable(false);
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

	const handleBottomPress = (key) => {
		switch (key) {
			case 'home':
				router.push('/student');
				break;
			case 'bell':
				router.push('/student/notification');
				break;
			case 'chat':
				router.push('/student/chatbot');
				break;
			case 'settings':
				router.push('/student/settings');
				break;
		}
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
			{/* Custom Back Button */}
			<View style={styles.customHeaderContainer}>
				<TouchableOpacity style={styles.customBackButton} onPress={handleBack} activeOpacity={0.8}>
					<Ionicons name="arrow-back" size={22} color={COLORS.inputBg} />
				</TouchableOpacity>
				<Text style={styles.customHeaderTitle}>Timetable</Text>
				<View style={styles.headerPlaceholder} />

			</View>

			<ScrollView 
				style={styles.content} 
				contentContainerStyle={styles.contentContainer}
				showsVerticalScrollIndicator={false}
			>
				{/* Timetable Box */}
				<View style={styles.timetableBox}>
					{loadingTimetable ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="large" color={COLORS.inputBg} />
							<Text style={styles.loadingText}>Loading timetable...</Text>
						</View>
					) : currentTimetable ? (
						<>
							<Image
								source={{
									uri: `${API.BASE_URL}/api/timetable/view-timetable/${currentTimetable.filename}`,
								}}
								style={styles.timetableImage}
								resizeMode="contain"
							/>
						</>
					) : (
						<View style={styles.emptyContainer}>
							<Ionicons name="calendar-outline" size={64} color="#ccc" />
							<Text style={styles.emptyText}>No timetable uploaded yet</Text>
						</View>
					)}
				</View>

				{/* Download Button */}
				{currentTimetable && (
					<TouchableOpacity
						style={styles.downloadButton}
						onPress={handleDownloadTimetable}
						activeOpacity={0.9}
					>
						<Ionicons name="download" size={20} color={COLORS.buttonText} />
						<Text style={styles.downloadButtonText}>Download Timetable</Text>
					</TouchableOpacity>
				)}

				<View style={{ height: 24 }} />
			</ScrollView>

			<BottomNav
				onPressHome={() => handleBottomPress('home')}
				onPressNotifications={() => handleBottomPress('bell')}
				onPressChatbot={() => handleBottomPress('chat')}
				onPressSettings={() => handleBottomPress('settings')}
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
		borderColor: COLORS.inputBg,
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
		color: COLORS.inputBg,
		textAlign: 'center',
		flex: 1,
	},
	headerPlaceholder: {
		width: 40,
	},
	content: {
		flex: 1,
		padding: 20,
	},
	contentContainer: {
		paddingBottom: 20 + BOTTOM_NAV_HEIGHT,
	},
	timetableBox: {
		width: '100%',
		minHeight: 400,
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		borderWidth: 1,
		borderColor: '#e6e6e6',
		padding: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 6,
		elevation: 3,
		marginBottom: 20,
	},
	timetableImage: {
		width: '100%',
		height: 400,
		borderRadius: 12,
		backgroundColor: '#F8F9FA',
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 400,
		gap: 12,
	},
	loadingText: {
		fontFamily: 'Outfit',
		fontSize: 14,
		color: COLORS.link,
	},
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 400,
		gap: 12,
	},
	emptyText: {
		fontFamily: 'Outfit',
		fontSize: 14,
		color: '#999',
	},
	downloadButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: COLORS.success,
		borderRadius: 24,
		paddingVertical: 14,
		paddingHorizontal: 24,
		gap: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	downloadButtonText: {
		fontFamily: 'Outfit',
		fontSize: 16,
		color: COLORS.buttonText,
		fontWeight: '600',
	},
});
