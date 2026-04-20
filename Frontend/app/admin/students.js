import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Animated,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator
} from 'react-native';
import OTPModal from '../../components/OTPModal';
import UploadConfirmationModal from '../../components/UploadConfirmationModal';
import { COLORS } from '../../constants/colors';
import apiService from '../../services/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export default function StudentsListScreen() {
    const router = useRouter();
    const [basePath, setBasePath] = useState('/admin');
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedStudent, setExpandedStudent] = useState(null);
    const [showOTPModal, setShowOTPModal] = useState(false);
    const [otpModalType, setOtpModalType] = useState('delete'); // currently used for delete only
    const [studentToDelete, setStudentToDelete] = useState(null);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmVariant, setConfirmVariant] = useState('success');
    const [confirmTitle, setConfirmTitle] = useState('');
    const [confirmMessage, setConfirmMessage] = useState('');
    
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        (async () => {
            try {
                setBasePath('/admin');
            } catch {
                setBasePath('/admin');
            }
        })();

        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const fetchStudents = async () => {
        try {
            setIsLoading(true);
            const result = await apiService.getStudents();
            console.log('📊 Students API Response:', JSON.stringify(result, null, 2));
            
            if (result && result.students) {
                // Ensure all required fields have default values
                const formattedStudents = result.students.map(student => ({
                    ...student,
                    fullName: student.fullName || student.name || 'N/A',
                    fatherName: student.fatherName || 'N/A',
                    address: student.address || 'N/A',
                    pastSchool: student.pastSchool || 'N/A',
                    phoneNumber: student.phoneNumber || student.phone || 'N/A',
                    email: student.email || 'N/A',
                    registrationNumber: student.registrationNumber || student.student_id || 'N/A',
                    quizHistory: student.quizHistory || [],
                }));
                
                console.log('✅ Formatted students:', formattedStudents.length);
                setStudents(formattedStudents);
                setFilteredStudents(formattedStudents);
            } else {
                console.warn('⚠️ No students in response:', result);
                setStudents([]);
                setFilteredStudents([]);
            }
        } catch (error) {
            console.error('❌ Error fetching students:', error);
            setConfirmVariant('error');
            setConfirmTitle('Error');
            setConfirmMessage(error?.error || error?.message || 'Failed to load students. Please try again.');
            setConfirmVisible(true);
            // Set empty arrays on error
            setStudents([]);
            setFilteredStudents([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Refresh students list when screen comes into focus (e.g., after adding a student)
    useFocusEffect(
        useCallback(() => {
            fetchStudents();
        }, [])
    );

    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.trim() === '') {
            setFilteredStudents(students);
        } else {
            const filtered = students.filter(student => 
                student.fullName.toLowerCase().includes(query.toLowerCase()) ||
                student.registrationNumber.toLowerCase().includes(query.toLowerCase())
            );
            setFilteredStudents(filtered);
        }
    };

    const handleExpandStudent = (studentId) => {
        setExpandedStudent(expandedStudent === studentId ? null : studentId);
    };

    const handleEditStudent = (student) => {
        router.push({
            pathname: `${basePath}/edit-student`,
            params: { studentData: JSON.stringify(student) }
        });
    };

    const handleDeleteStudent = async (student) => {
        try {
            setStudentToDelete(student);
            setOtpModalType('delete');
            
            // Request OTP for delete operation
            await apiService.requestOperationOtp('delete_student');
            
            // Show OTP modal after OTP is sent
            setShowOTPModal(true);
        } catch (error) {
            console.error('Error requesting OTP:', error);
            setConfirmVariant('error');
            setConfirmTitle('Error');
            setConfirmMessage(error?.error || error?.message || 'Failed to send OTP. Please try again.');
            setConfirmVisible(true);
        }
    };

    const handleAddStudent = () => {
        // Directly navigate to add-student; OTP will be requested at the end of the add flow
        router.push(`${basePath}/add-student`);
    };

    const requestAddStudentOtp = async () => {
        try {
            // Request OTP for delete operation (resend)
            await apiService.requestOperationOtp('delete_student');
            setConfirmVariant('success');
            setConfirmTitle('OTP Sent');
            setConfirmMessage('A new OTP has been sent to your admin email.');
            setConfirmVisible(true);
        } catch (error) {
            console.error('Error resending OTP:', error);
            setConfirmVariant('error');
            setConfirmTitle('Error');
            setConfirmMessage(error?.error || error?.message || 'Failed to resend OTP. Please try again.');
            setConfirmVisible(true);
        }
    };

    const handleOTPVerification = async (otp) => {
        try {
            if (otpModalType === 'delete' && studentToDelete) {
                // Delete student with OTP verification
                const result = await apiService.deleteStudent(studentToDelete.id, otp);
                
                if (result && result.message) {
                    // Remove student from local state
                    const updatedStudents = students.filter(s => s.id !== studentToDelete.id);
                    setStudents(updatedStudents);
                    setFilteredStudents(updatedStudents.filter(student => 
                        student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        student.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase())
                    ));
                    setStudentToDelete(null);
                    setShowOTPModal(false);
                    setConfirmVariant('success');
                    setConfirmTitle('Deleted');
                    setConfirmMessage(result.message || 'Student deleted successfully.');
                    setConfirmVisible(true);
                } else {
                    throw new Error('Delete operation failed');
                }
            }
        } catch (error) {
            console.error('Error deleting student:', error);
            setConfirmVariant('error');
            setConfirmTitle('Error');
            setConfirmMessage(error?.error || error?.message || 'Failed to delete student. Please check your OTP and try again.');
            setConfirmVisible(true);
        }
    };

    const StudentCard = ({ student, isExpanded }) => {
        // Ensure student data exists
        if (!student) {
            return null;
        }
        
        return (
        <View style={styles.studentCard}>
            <View style={styles.studentCardHeader}>
                <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.fullName || 'N/A'}</Text>
                    <Text style={styles.fatherName}>{student.fatherName || 'N/A'}</Text>
                </View>
                <TouchableOpacity 
                    style={styles.expandButton}
                    onPress={() => handleExpandStudent(student.id)}
                    activeOpacity={0.8}
                >
                    <Ionicons 
                        name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                        size={24} 
                        color={COLORS.inputBg} 
                    />
                </TouchableOpacity>
            </View>
            
            {isExpanded && (
                <Animated.View style={styles.expandedContent}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Address:</Text>
                        <Text style={styles.detailValue}>{student.address || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Past School:</Text>
                        <Text style={styles.detailValue}>{student.pastSchool || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Phone:</Text>
                        <Text style={styles.detailValue}>{student.phoneNumber || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Email:</Text>
                        <Text style={styles.detailValue}>{student.email || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Registration No:</Text>
                        <Text style={styles.detailValue}>{student.registrationNumber || 'N/A'}</Text>
                    </View>
                    {student.class && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Class:</Text>
                            <Text style={styles.detailValue}>{student.class}</Text>
                        </View>
                    )}
                    {student.section && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Section:</Text>
                            <Text style={styles.detailValue}>{student.section}</Text>
                        </View>
                    )}

                    {/* Quiz History Box */}
                    <View style={styles.sectionBox}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>Quiz History (Last 10)</Text>
                        </View>
                        <View style={styles.sectionBody}>
                            {student.quizHistory && student.quizHistory.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={{ minWidth: 720 }}>
                                        <View style={styles.tableHeaderRow}>
                                            <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Date</Text>
                                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Time</Text>
                                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Score</Text>
                                            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>%</Text>
                                            <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>Topic</Text>
                                            <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Difficulty</Text>
                                        </View>
                                        <ScrollView style={{ maxHeight: 220 }}>
                                            {student.quizHistory.map((quiz, idx) => {
                                                // Parse date - handle both completedAt (datetime) and date/time (strings)
                                                let dateStr = 'N/A';
                                                let timeStr = 'N/A';
                                                
                                                if (quiz.completedAt) {
                                                    // Normal submission with completedAt datetime
                                                    const dateObj = new Date(quiz.completedAt);
                                                    if (!isNaN(dateObj.getTime())) {
                                                        dateStr = dateObj.toLocaleDateString();
                                                        timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                    }
                                                } else if (quiz.date && quiz.time) {
                                                    // Auto-submitted quiz with separate date and time strings
                                                    dateStr = quiz.date;
                                                    timeStr = quiz.time;
                                                } else if (quiz.date) {
                                                    // Only date available
                                                    dateStr = quiz.date;
                                                    timeStr = 'N/A';
                                                }
                                                
                                                // Get remarks based on score
                                                const percentage = quiz.percentage || 0;
                                                let remarks = 'Needs Work';
                                                let remarksColor = '#F44336';
                                                if (percentage >= 80) {
                                                    remarks = 'Excellent';
                                                    remarksColor = '#4CAF50';
                                                } else if (percentage >= 50) {
                                                    remarks = 'Good';
                                                    remarksColor = '#FF9800';
                                                }
                                                
                                                return (
                                                    <View key={idx} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                                                        <Text style={[styles.tableCell, { flex: 1.2 }]}>{dateStr}</Text>
                                                        <Text style={[styles.tableCell, { flex: 1 }]}>{timeStr}</Text>
                                                        <Text style={[styles.tableCell, { flex: 1 }]}>
                                                            {quiz.score}/{quiz.totalQuestions}
                                                        </Text>
                                                        <Text style={[styles.tableCell, { flex: 1, color: remarksColor, fontWeight: '600' }]}>
                                                            {Math.round(percentage)}%
                                                        </Text>
                                                        <Text style={[styles.tableCell, { flex: 1.6 }]} numberOfLines={2}>
                                                            {quiz.topic}
                                                        </Text>
                                                        <Text style={[styles.tableCell, { flex: 1.2, textTransform: 'capitalize' }]}>
                                                            {quiz.difficulty}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                </ScrollView>
                            ) : (
                                <View style={styles.emptyQuizHistory}>
                                    <Ionicons name="clipboard-outline" size={48} color="#ccc" />
                                    <Text style={styles.emptyQuizText}>No quiz attempts yet</Text>
                                    <Text style={styles.emptyQuizSubtext}>Student hasn't taken any quizzes</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Achievements grid removed as per requirements */}
                    
                    <View style={styles.actionButtons}>
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.editButton]}
                            onPress={() => handleEditStudent(student)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="create" size={20} color="#fff" />
                            <Text style={styles.actionButtonText}>Edit Information</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.deleteButton]}
                            onPress={() => handleDeleteStudent(student)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="trash" size={20} color="#fff" />
                            <Text style={styles.actionButtonText}>Delete Student</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}
        </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <Animated.View 
                style={[
                    styles.header,
                    {
                        transform: [{ translateY: slideAnim }],
                        opacity: fadeAnim,
                    }
                ]}
            >
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => router.back()}
                    activeOpacity={0.8}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.buttonText} />
                </TouchableOpacity>
                
                <Text style={styles.headerTitle}>Students Management</Text>
                
                <TouchableOpacity 
                    style={styles.addButton}
                    onPress={handleAddStudent}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add" size={24} color={COLORS.buttonText} />
                </TouchableOpacity>
            </Animated.View>

            {/* Search Section */}
            <Animated.View 
                style={[
                    styles.searchSection,
                    {
                        opacity: fadeAnim,
                    }
                ]}
            >
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={COLORS.link} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or registration number..."
                        placeholderTextColor={COLORS.link}
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                </View>
                
                <TouchableOpacity 
                    style={styles.searchButton}
                    onPress={() => handleSearch(searchQuery)}
                    activeOpacity={0.8}
                >
                    <Text style={styles.searchButtonText}>Search</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Students List */}
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.inputBg} />
                    <Text style={styles.loadingText}>Loading students...</Text>
                </View>
            ) : (
                <ScrollView 
                    style={styles.studentsList}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.studentsListContent}
                >
                    {filteredStudents.map((student) => (
                        <StudentCard 
                            key={student.id} 
                            student={student} 
                            isExpanded={expandedStudent === student.id}
                        />
                    ))}
                    
                    {filteredStudents.length === 0 && (
                        <View style={styles.noResultsContainer}>
                            <Ionicons name="people-outline" size={64} color={COLORS.link} />
                            <Text style={styles.noResultsText}>No students found</Text>
                            <Text style={styles.noResultsSubtext}>
                                {searchQuery ? 'Try adjusting your search criteria' : 'No students registered yet. Add a new student to get started.'}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* OTP Modal */}
            <OTPModal
                visible={showOTPModal}
                onClose={() => setShowOTPModal(false)}
                onVerify={handleOTPVerification}
                onResend={requestAddStudentOtp}
                type={otpModalType}
                studentName={studentToDelete?.fullName}
            />

            {/* Confirmation Modal */}
            <UploadConfirmationModal
                visible={confirmVisible}
                onClose={() => setConfirmVisible(false)}
                title={confirmTitle}
                message={confirmMessage}
                variant={confirmVariant}
                operationType={otpModalType === 'delete' ? 'delete' : 'otp'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    header: {
        backgroundColor: COLORS.inputBg,
        paddingHorizontal: 20,
        paddingTop: Math.max(20, height * 0.03),
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomLeftRadius: 25,
        borderBottomRightRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontFamily: 'Griffter',
        fontSize: 24,
        color: COLORS.buttonText,
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 20,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchSection: {
        padding: 20,
        backgroundColor: 'transparent',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 15,
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginBottom: 15,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.inputBg,
    },
    searchButton: {
        backgroundColor: COLORS.inputBg,
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    searchButtonText: {
        fontFamily: 'Griffter',
        fontSize: 16,
        color: COLORS.buttonText,
    },
    studentsList: {
        flex: 1,
        paddingHorizontal: 20,
    },
    studentsListContent: {
        paddingBottom: 20,
    },
    studentCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 15,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 6,
    },
    studentCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    studentInfo: {
        flex: 1,
    },
    studentName: {
        fontFamily: 'Griffter',
        fontSize: 18,
        color: COLORS.inputBg,
        marginBottom: 4,
    },
    fatherName: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.link,
    },
    expandButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    expandedContent: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    sectionBox: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        marginTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionHeader: {
        height: 50,
        backgroundColor: COLORS.link,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeaderText: {
        fontFamily: 'Griffter',
        fontSize: 18,
        color: '#FFFFFF',
    },
    sectionBody: {
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
        marginBottom: 10,
    },
    tableHeaderCell: {
        fontFamily: 'Outfit',
        fontSize: 13,
        color: COLORS.heading,
        fontWeight: '600',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f2f2f2',
    },
    tableRowAlt: {
        backgroundColor: '#FAFAFA',
    },
    tableCell: {
        fontFamily: 'Outfit',
        fontSize: 13,
        color: COLORS.heading,
    },
    achievementsGrid: {
        padding: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 8,
    },
    achievementCard: {
        width: '31.5%',
        aspectRatio: 1,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: COLORS.inputBg,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
        marginBottom: 8,
    },
    achievementInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
    },
    achievementIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0F8F0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    achievementText: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.inputBg,
    },
    detailRow: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-start',
    },
    detailLabel: {
        fontFamily: 'Griffter',
        fontSize: 14,
        color: COLORS.inputBg,
        width: 120,
        marginRight: 10,
    },
    detailValue: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.link,
        flex: 1,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 15,
        flex: 0.48,
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    editButton: {
        backgroundColor: '#4CAF50',
    },
    deleteButton: {
        backgroundColor: '#F44336',
    },
    actionButtonText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: '#fff',
        marginLeft: 8,
        fontWeight: '600',
    },
    noResultsContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    noResultsText: {
        fontFamily: 'Griffter',
        fontSize: 20,
        color: COLORS.inputBg,
        marginTop: 20,
        marginBottom: 8,
    },
    noResultsSubtext: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.link,
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
    emptyQuizHistory: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyQuizText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.heading,
        marginTop: 12,
    },
    emptyQuizSubtext: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: '#999',
        marginTop: 4,
    },
});

