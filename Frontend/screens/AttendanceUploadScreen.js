import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { Alert, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import TopicInputModal from '../components/TopicInputModal';
import UploadConfirmationModal from '../components/UploadConfirmationModal';
import apiService from '../services/apiService';

const { width, height } = Dimensions.get('window');

const COLORS = {
	bg: '#F5F5F5',
	heading: '#03045e',
	inputBg: '#03045e',
	inputText: '#FFFFFF',
	arrow: '#03045e',
	link: '#023e8a',
	buttonBg: '#03045e',
	buttonText: '#FFFFFF',
	success: '#4CAF50',
	danger: '#F44336',
};


// Circular Progress Component - logical split between Present (Green) and Absent (Red)
const CircularProgress = ({ presentPercentage = 0, absentPercentage = 0, size = 60, strokeWidth = 10 }) => {
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;

	// Normalize so both always add up to 100 visually
	const safePresent = Math.max(0, Math.min(100, presentPercentage));
	const safeAbsent = Math.max(0, Math.min(100, absentPercentage));
	const total = safePresent + safeAbsent || 1;
	const presentPct = safePresent / total;
	const absentPct = safeAbsent / total;

	const presentLength = circumference * presentPct;
	const absentLength = circumference * absentPct;

	return (
		<View style={styles.circularProgressContainer}>
			<Svg width={size} height={size} style={styles.circularProgressSvg}>
				{/* Background circle */}
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					stroke="#E0E0E0"
					strokeWidth={strokeWidth}
					fill="transparent"
				/>
				{/* Present arc (green) */}
				{presentLength > 0 && (
					<Circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						stroke={COLORS.success}
						strokeWidth={strokeWidth}
						fill="transparent"
						strokeDasharray={`${presentLength} ${circumference}`}
						strokeLinecap="round"
						transform={`rotate(-90 ${size / 2} ${size / 2})`}
					/>
				)}
				{/* Absent arc (red), starting right after the green one */}
				{absentLength > 0 && (
					<Circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						stroke={COLORS.danger}
						strokeWidth={strokeWidth}
						fill="transparent"
						strokeDasharray={`${absentLength} ${circumference}`}
						strokeDashoffset={-presentLength}
						strokeLinecap="round"
						transform={`rotate(-90 ${size / 2} ${size / 2})`}
					/>
				)}
			</Svg>
			{/* Inner text shows the true green (present) percentage from backend */}
			<Text style={styles.circularProgressText}>{Math.round(presentPercentage)}%</Text>
		</View>
	);
};

export default function AttendanceUploadScreen() {
	const router = useRouter();
	const [students, setStudents] = useState([]);
	const [attendanceStatus, setAttendanceStatus] = useState({});
	const [showConfirmation, setShowConfirmation] = useState(false);
	const [showTopicModal, setShowTopicModal] = useState(false);
	const [todayTopics, setTodayTopics] = useState({});
	const [isLoading, setIsLoading] = useState(true);
	const [adminCourse, setAdminCourse] = useState(null);

	// Fetch students from API when screen comes into focus
	useFocusEffect(
		useCallback(() => {
			fetchStudents();
		}, [])
	);

	// Fetch students from API
	const fetchStudents = async () => {
		try {
			setIsLoading(true);
			const result = await apiService.getAttendanceStudents();
			if (result && result.students) {
				setStudents(result.students);
				// Store admin course for topic modal
				if (result.course) {
					setAdminCourse(result.course);
				}
				// Initialize attendance status for all students
				const initialStatus = {};
				result.students.forEach(student => {
					initialStatus[student.id] = null; 
				});
				setAttendanceStatus(initialStatus);
			} else {
				setStudents([]);
				setAttendanceStatus({});
			}
		} catch (error) {
			console.error('Error fetching students:', error);
			Alert.alert(
				'Error',
				error?.error || error?.message || 'Failed to load students. Please try again.'
			);
			setStudents([]);
			setAttendanceStatus({});
		} finally {
			setIsLoading(false);
		}
	};

	// Initialize attendance status when students change
	useEffect(() => {
		const initialStatus = {};
		students.forEach(student => {
			initialStatus[student.id] = null; 
		});
		setAttendanceStatus(initialStatus);
	}, [students]);

	const handleAttendanceChange = (studentId, isPresent) => {
		setAttendanceStatus(prev => ({
			...prev,
			[studentId]: isPresent
		}));
	};

	const handleBack = () => {
		router.back();
	};

	const handleTopicSave = async (topics) => {
		setTodayTopics(topics);
		setShowTopicModal(false);
		
		// Save attendance to backend
		try {
			await apiService.saveAttendance(attendanceStatus, topics);
			setShowConfirmation(true);
		} catch (error) {
			console.error('Error saving attendance:', error);
			Alert.alert(
				'Error',
				error?.error || error?.message || 'Failed to save attendance. Please try again.'
			);
		}
	};

	const handleUploadAttendance = () => {
		const unmarkedStudents = students.filter(student => attendanceStatus[student.id] === null);
		
		if (unmarkedStudents.length > 0) {
			Alert.alert(
				'Incomplete Attendance',
				`Please mark attendance for ${unmarkedStudents.length} student(s) before uploading.`,
				[{ text: 'OK' }]
			);
			return;
		}

		setShowTopicModal(true);
	};

	const handleConfirmationClose = () => {
		setShowConfirmation(false);
		setTodayTopics({}); 
		// Reset attendance status and refresh students to get updated percentages
		setAttendanceStatus({});
		fetchStudents(); // Refresh to get updated attendance percentages
	};

	const isAllMarked = students.every(student => attendanceStatus[student.id] !== null);

	return (
		<View style={styles.container}>
			{/* Header with Back Button */}
			<TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.8}>
				<Ionicons name="arrow-back" size={24} color={COLORS.inputBg} />
				<Text style={styles.backText}>Back</Text>
			</TouchableOpacity>

			{/* Title */}
			<Text style={styles.title}>Attendance</Text>

			{/* Upload Button */}
			<TouchableOpacity 
				style={[
					styles.uploadButton, 
					!isAllMarked && styles.uploadButtonDisabled
				]} 
				onPress={handleUploadAttendance} 
				activeOpacity={0.8}
				disabled={!isAllMarked}
			>
				<Ionicons name="cloud-upload" size={20} color={isAllMarked ? COLORS.buttonText : '#999'} />
				<Text style={[
					styles.uploadText,
					!isAllMarked && styles.uploadTextDisabled
				]}>
					Upload Attendance
				</Text>
			</TouchableOpacity>

			{isLoading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={COLORS.inputBg} />
					<Text style={styles.loadingText}>Loading students...</Text>
				</View>
			) : students.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Ionicons name="people-outline" size={64} color={COLORS.link} />
					<Text style={styles.emptyText}>No students found</Text>
					<Text style={styles.emptySubtext}>Add students to start marking attendance</Text>
				</View>
			) : (
				<ScrollView 
					style={styles.studentsContainer}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={styles.studentsContent}
				>
					{students.map((student) => (
						<View key={student.id} style={styles.studentCard}>
							{/* Student Info */}
							<View style={styles.studentInfo}>
								<View style={styles.studentInfoLeft}>
									<Text style={styles.registrationNumber}>{student.registrationNumber}</Text>
									<Text style={styles.fullName}>{student.fullName}</Text>
									<Text style={styles.fatherName}>{student.fatherName}</Text>
								</View>
								<View style={styles.studentInfoRight}>
									<CircularProgress 
										presentPercentage={student.attendancePercentage || 0} 
										absentPercentage={student.absentPercentage || 0}
									/>
								</View>
							</View>

						<View style={styles.radioGroup}>
							<TouchableOpacity 
								style={styles.radioRow} 
								onPress={() => handleAttendanceChange(student.id, true)}
								activeOpacity={0.7}
							>
								<View style={[
									styles.radioOuter,
									attendanceStatus[student.id] === true && styles.radioOuterActive
								]}>
									{attendanceStatus[student.id] === true && <View style={styles.radioInner} />}
								</View>
								<Text style={[
									styles.radioLabel,
									attendanceStatus[student.id] === true && styles.radioLabelActive
								]}>
									Present
								</Text>
							</TouchableOpacity>

							<TouchableOpacity 
								style={styles.radioRow} 
								onPress={() => handleAttendanceChange(student.id, false)}
								activeOpacity={0.7}
							>
								<View style={[
									styles.radioOuter,
									attendanceStatus[student.id] === false && styles.radioOuterActive
								]}>
									{attendanceStatus[student.id] === false && <View style={styles.radioInner} />}
								</View>
								<Text style={[
									styles.radioLabel,
									attendanceStatus[student.id] === false && styles.radioLabelActive
								]}>
									Absent
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				))}
			</ScrollView>
			)}

			<TopicInputModal
				visible={showTopicModal}
				onClose={() => setShowTopicModal(false)}
				onSave={handleTopicSave}
				course={adminCourse}
			/>

			<UploadConfirmationModal
				visible={showConfirmation}
				onClose={handleConfirmationClose}
				title="Attendance & Topic Uploaded Successfully"
				message={`Student attendance and today's ${adminCourse === 'computerScience' ? 'Computer Science' : adminCourse === 'chemistry' ? 'Chemistry' : adminCourse === 'physics' ? 'Physics' : ''} topic have been recorded and uploaded successfully!`}
				operationType="attendance"
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
	backButton: {
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
	backText: {
		fontFamily: 'Outfit',
		fontSize: 16,
		color: COLORS.inputBg,
		marginLeft: 6,
	},
	title: {
		fontFamily: 'Griffter',
		fontSize: 28,
		color: COLORS.inputBg,
		textAlign: 'center',
		marginBottom: 20,
	},
	uploadButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: COLORS.buttonBg,
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 25,
		marginBottom: 20,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	uploadButtonDisabled: {
		backgroundColor: '#E0E0E0',
	},
	uploadText: {
		fontFamily: 'Outfit',
		fontSize: 16,
		color: COLORS.buttonText,
		marginLeft: 8,
		fontWeight: '600',
	},
	uploadTextDisabled: {
		color: '#999',
	},
	studentsContainer: {
		flex: 1,
	},
	studentsContent: {
		paddingBottom: 20,
	},
	studentCard: {
		backgroundColor: 'rgba(255, 255, 255, 0.9)',
		borderRadius: 20,
		padding: 20,
		marginBottom: 16,
		borderWidth: 2,
		borderColor: COLORS.inputBg,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 6,
		elevation: 4,
	},
	studentInfo: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	studentInfoLeft: {
		flex: 1,
		paddingRight: 20,
	},
	studentInfoRight: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingLeft: 20,
		paddingRight: 10,
	},
	registrationNumber: {
		fontFamily: 'Griffter',
		fontSize: 16,
		color: COLORS.inputBg,
		fontWeight: 'bold',
		marginBottom: 4,
	},
	fullName: {
		fontFamily: 'Outfit',
		fontSize: 18,
		color: COLORS.inputBg,
		fontWeight: '600',
		marginBottom: 4,
	},
	fatherName: {
		fontFamily: 'Outfit',
		fontSize: 14,
		color: COLORS.link,
		marginBottom: 8,
	},
	circularProgressContainer: {
		position: 'relative',
		alignItems: 'center',
		justifyContent: 'center',
	},
	circularProgressSvg: {
		position: 'absolute',
	},
	circularProgressText: {
		fontFamily: 'Griffter',
		fontSize: 12,
		fontWeight: 'bold',
		color: COLORS.inputBg,
		textAlign: 'center',
	},
	radioGroup: {
		flexDirection: 'row',
		justifyContent: 'space-around',
	},
	radioRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
		paddingHorizontal: 12,
	},
	radioOuter: {
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 2,
		borderColor: COLORS.inputBg,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 8,
	},
	radioOuterActive: {
		borderColor: COLORS.inputBg,
		backgroundColor: COLORS.inputBg,
	},
	radioInner: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: '#fff',
	},
	radioLabel: {
		fontFamily: 'Outfit',
		fontSize: 16,
		color: COLORS.inputBg,
	},
	radioLabelActive: {
		fontWeight: '600',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 60,
	},
	loadingText: {
		fontFamily: 'Outfit',
		fontSize: 16,
		color: COLORS.link,
		marginTop: 16,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 60,
	},
	emptyText: {
		fontFamily: 'Griffter',
		fontSize: 20,
		color: COLORS.inputBg,
		marginTop: 20,
		marginBottom: 8,
	},
	emptySubtext: {
		fontFamily: 'Outfit',
		fontSize: 16,
		color: COLORS.link,
	},
});