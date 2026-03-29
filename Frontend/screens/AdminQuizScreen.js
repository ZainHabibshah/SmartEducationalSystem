import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import BottomNav from '../components/BottomNav';
import apiService from '../services/apiService';

const COLORS = {
    bg: '#F5F5F5',
    heading: '#03045e',
    inputBg: '#03045e',
    inputText: '#FFFFFF',
    buttonBg: '#03045e',
    buttonText: '#FFFFFF',
    link: '#023e8a',
    success: '#4CAF50',
    danger: '#F44336',
    warning: '#FF9800',
    purple: '#9333ea',
    cyan: '#06b6d4',
};

const { height, width } = Dimensions.get('window');

export default function AdminQuizScreen() {
    const router = useRouter();
    const [topics, setTopics] = useState([]);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [difficulty, setDifficulty] = useState('easy');
    const [isSending, setIsSending] = useState(false);
    const [loadingTopics, setLoadingTopics] = useState(true);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [confirmFinishModalVisible, setConfirmFinishModalVisible] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [quizStatus, setQuizStatus] = useState({ submitted: 0, pending: 0, totalStudents: 0 });
    const [lastUpdate, setLastUpdate] = useState(Date.now());
    const [activeQuizId, setActiveQuizId] = useState(null);
    const [finishingQuiz, setFinishingQuiz] = useState(false);
    const [adminId, setAdminId] = useState(null);
    const [adminCourse, setAdminCourse] = useState(null);
    const [quizHistory, setQuizHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [expandedQuizId, setExpandedQuizId] = useState(null);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        loadAdminData();
        loadTopics();
        // Entrance animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    useEffect(() => {
        if (adminCourse) {
            loadQuizHistory();
        }
    }, [adminCourse]);

    const loadAdminData = async () => {
        try {
            const id = await AsyncStorage.getItem('admin_id');
            const course = await AsyncStorage.getItem('admin_course');
            setAdminId(id);
            setAdminCourse(course);
        } catch (error) {
            console.error('Error loading admin data:', error);
        }
    };

    const loadTopics = async () => {
        try {
            setLoadingTopics(true);
            console.log('📚 Loading admin quiz topics...');
            const response = await apiService.getAdminQuizTopics();
            const topicsData = response.data?.topics || response.topics;
            
            if (topicsData && Array.isArray(topicsData)) {
                console.log('✅ Loaded admin topics:', topicsData);
                setTopics(topicsData);
            } else {
                setTopics([]);
            }
        } catch (error) {
            console.error('❌ Error loading topics:', error);
            setModalMessage('Failed to load topics. Make sure you have uploaded attendance with topics.');
            setErrorModalVisible(true);
            setTopics([]);
        } finally {
            setLoadingTopics(false);
        }
    };

    const loadQuizHistory = async () => {
        if (!adminCourse) return;
        
        try {
            setLoadingHistory(true);
            console.log('📊 Loading quiz history for course:', adminCourse);
            const response = await apiService.getAdminQuizHistory(adminCourse);
            
            // The axios interceptor already unwraps response.data
            if (response?.quizHistory) {
                console.log('✅ Loaded quiz history:', response.quizHistory.length, 'quizzes');
                setQuizHistory(response.quizHistory);
            } else {
                setQuizHistory([]);
            }
        } catch (error) {
            console.error('❌ Error loading quiz history:', error);
            setQuizHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const canSend = selectedTopic && difficulty && !isSending;

    const handleSendQuiz = async () => {
        if (!canSend) {
            setModalMessage('Please select a topic');
            setErrorModalVisible(true);
            return;
        }
        setConfirmModalVisible(true);
    };

    const handleConfirmSend = async () => {
        setConfirmModalVisible(false);
        
        try {
            setIsSending(true);
            console.log('📤 Sending quiz to class...');
            
            const response = await apiService.sendQuizToClass({
                topic: selectedTopic,
                difficulty,
                adminId,
                course: adminCourse
            });

            console.log('✅ Quiz sent response:', response);

            // The axios interceptor already unwraps response.data
            if (response && response.success) {
                setActiveQuizId(response.quizId);
                setQuizStatus({
                    submitted: 0,
                    pending: response.totalStudents || 0,
                    totalStudents: response.totalStudents || 0
                });
                setStatusModalVisible(true);
                // Reload quiz history after sending
                loadQuizHistory();
            } else {
                setModalMessage('Failed to send quiz');
                setErrorModalVisible(true);
            }
        } catch (error) {
            console.error('❌ Error sending quiz:', error);
            setModalMessage(error.error || error.message || 'Failed to send quiz');
            setErrorModalVisible(true);
        } finally {
            setIsSending(false);
        }
    };

    const refreshQuizStatus = useCallback(async () => {
        if (!activeQuizId || !adminCourse) {
            console.log('⚠️  Cannot refresh: missing activeQuizId or adminCourse', { activeQuizId, adminCourse });
            return;
        }

        try {
            console.log('🔄 Refreshing quiz status for:', activeQuizId, adminCourse);
            const response = await apiService.getQuizStatus(activeQuizId, adminCourse);
            console.log('📊 Got quiz status response:', response);
            
            // The axios interceptor already unwraps response.data, so response is the actual data
            const newStatus = {
                submitted: response.submitted || 0,
                pending: response.pending || 0,
                totalStudents: response.totalStudents || 0
            };
            console.log('✅ Updating state with:', newStatus);
            
            // Force state update with a new object reference
            setQuizStatus(prev => {
                console.log('📝 Previous state:', prev);
                console.log('📝 New state:', newStatus);
                return { ...newStatus };
            });
            
            setLastUpdate(Date.now());
            console.log('🕐 Last update timestamp set');
        } catch (error) {
            console.error('❌ Error refreshing quiz status:', error);
        }
    }, [activeQuizId, adminCourse]);

    const handleFinishQuiz = async () => {
        if (!activeQuizId) return;
        // Temporarily hide status modal to show confirmation modal on top
        setStatusModalVisible(false);
        setConfirmFinishModalVisible(true);
    };

    const handleConfirmFinish = async () => {
        setConfirmFinishModalVisible(false);
        
        try {
            setFinishingQuiz(true);
            const response = await apiService.finishQuiz(activeQuizId, adminCourse);
            
            setModalMessage(`Quiz finished! ${response.autoSubmitted || 0} students were auto-submitted.`);
            setSuccessModalVisible(true);
            setStatusModalVisible(false);
            setActiveQuizId(null);
            
            // Reload quiz history after finishing
            loadQuizHistory();
        } catch (error) {
            console.error('Error finishing quiz:', error);
            setModalMessage(error.error || error.message || 'Failed to finish quiz');
            setErrorModalVisible(true);
        } finally {
            setFinishingQuiz(false);
        }
    };

    useEffect(() => {
        let interval;
        if (statusModalVisible && activeQuizId && adminCourse) {
            // Immediately refresh once
            refreshQuizStatus();
            // Then set up interval for auto-refresh
            interval = setInterval(refreshQuizStatus, 3000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [statusModalVisible, activeQuizId, adminCourse, refreshQuizStatus]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.push('/admin');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.inputBg} />

            {/* Custom Header */}
            <View style={styles.customHeaderContainer}>
                <TouchableOpacity style={styles.customBackButton} onPress={handleBack} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={22} color={COLORS.inputBg} />
                </TouchableOpacity>
                <Text style={styles.customHeaderTitle}>Quiz</Text>
                <View style={styles.headerPlaceholder} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {loadingTopics ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.link} />
                        <Text style={styles.loadingText}>Loading topics...</Text>
                    </View>
                ) : topics.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="book-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No topics available yet</Text>
                        <Text style={styles.emptySubtext}>Add topics by uploading attendance</Text>
                    </View>
                ) : (
                    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
                        {/* Info Card */}
                        <View style={styles.infoCard}>
                            <View style={styles.infoGradient}>
                                <Ionicons name="school" size={32} color="#fff" />
                                <Text style={styles.infoTitle}>Send Quiz to Class</Text>
                                <Text style={styles.infoSubtitle}>Select a topic, choose difficulty, and send AI-generated quiz to all students!</Text>
                            </View>
                        </View>

                        {/* Topics Section */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="library" size={20} color={COLORS.inputBg} />
                                <Text style={styles.sectionTitle}>Select Topic</Text>
                            </View>
                            <View style={styles.topicsGrid}>
                                {topics.map((topic, index) => {
                                    const isSelected = selectedTopic === topic;
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[styles.topicCard, isSelected && styles.topicCardActive]}
                                            activeOpacity={0.8}
                                            onPress={() => setSelectedTopic(isSelected ? null : topic)}
                                        >
                                            <View style={[styles.topicGradient, isSelected && styles.topicGradientActive]}>
                                                <Ionicons
                                                    name={isSelected ? 'checkmark-circle' : 'book-outline'}
                                                    size={24}
                                                    color={isSelected ? '#fff' : COLORS.inputBg}
                                                />
                                                <Text style={[styles.topicText, isSelected && styles.topicTextActive]}>
                                                    {topic}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Difficulty Section */}
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="speedometer" size={20} color={COLORS.inputBg} />
                                <Text style={styles.sectionTitle}>Difficulty Level</Text>
                            </View>
                            <View style={styles.diffRow}>
                                {[
                                    { level: 'easy', icon: 'happy', color: COLORS.success },
                                    { level: 'medium', icon: 'flash', color: COLORS.warning },
                                    { level: 'hard', icon: 'flame', color: COLORS.danger },
                                ].map(({ level, icon, color }) => {
                                    const isSelected = difficulty === level;
                                    return (
                                        <TouchableOpacity
                                            key={level}
                                            style={[styles.diffCard, isSelected && { borderColor: color, borderWidth: 2 }]}
                                            onPress={() => setDifficulty(level)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={[styles.diffIconContainer, { backgroundColor: color }]}>
                                                <Ionicons name={icon} size={28} color="#fff" />
                                            </View>
                                            <Text style={[styles.diffText, isSelected && { color: color, fontWeight: '700' }]}>
                                                {level.charAt(0).toUpperCase() + level.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Send Button */}
                        <TouchableOpacity
                            style={[styles.generateBtn, !canSend && styles.generateBtnDisabled]}
                            onPress={handleSendQuiz}
                            disabled={!canSend}
                            activeOpacity={0.85}
                        >
                            {isSending ? (
                                <View style={styles.generateGradient}>
                                    <ActivityIndicator size="small" color="#fff" />
                                    <Text style={styles.generateBtnText}>
                                        Generating AI Quiz... (30-60s)
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.generateGradient}>
                                    <Ionicons name="paper-plane" size={24} color={canSend ? '#fff' : '#999'} />
                                    <Text style={[styles.generateBtnText, !canSend && styles.generateBtnTextDisabled]}>
                                        Send Quiz to Class
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Quiz History Section */}
                        <View style={styles.historySection}>
                        <View style={styles.historySectionHeader}>
                            <Ionicons name="time-outline" size={24} color={COLORS.link} />
                            <Text style={styles.historySectionTitle}>Quiz History</Text>
                        </View>

                        {loadingHistory ? (
                            <View style={styles.historyLoadingContainer}>
                                <ActivityIndicator size="small" color={COLORS.link} />
                                <Text style={styles.historyLoadingText}>Loading quiz history...</Text>
                            </View>
                        ) : quizHistory.length === 0 ? (
                            <View style={styles.historyEmptyContainer}>
                                <Ionicons name="document-text-outline" size={48} color="#ccc" />
                                <Text style={styles.historyEmptyText}>No quiz history yet</Text>
                                <Text style={styles.historyEmptySubtext}>Sent quizzes will appear here</Text>
                            </View>
                        ) : (
                            <View style={styles.historyList}>
                                {quizHistory.map((quiz, index) => (
                                    <View key={quiz.quizId || index} style={styles.historyItem}>
                                        <TouchableOpacity
                                            style={styles.historyItemHeader}
                                            onPress={() => setExpandedQuizId(expandedQuizId === quiz.quizId ? null : quiz.quizId)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.historyItemLeft}>
                                                <View style={styles.historyItemTopRow}>
                                                    <Text style={styles.historyItemTopic} numberOfLines={1}>
                                                        {quiz.topic}
                                                    </Text>
                                                    <View style={[styles.difficultyBadge, { backgroundColor: 
                                                        quiz.difficulty === 'easy' ? '#4CAF50' :
                                                        quiz.difficulty === 'medium' ? '#FF9800' :
                                                        '#F44336'
                                                    }]}>
                                                        <Text style={styles.difficultyBadgeText}>{quiz.difficulty}</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.historyItemDate}>
                                                    {quiz.sentDate} • {quiz.sentTime} • {quiz.students.length} students
                                                </Text>
                                            </View>
                                            <Ionicons 
                                                name={expandedQuizId === quiz.quizId ? "chevron-up" : "chevron-down"} 
                                                size={24} 
                                                color={COLORS.link} 
                                            />
                                        </TouchableOpacity>

                                        {expandedQuizId === quiz.quizId && (
                                            <View style={styles.historyItemDetails}>
                                                {/* Table Header */}
                                                <View style={styles.tableHeader}>
                                                    <Text style={[styles.tableHeaderText, styles.tableColName]}>Name</Text>
                                                    <Text style={[styles.tableHeaderText, styles.tableColMarks]}>Total Marks</Text>
                                                    <Text style={[styles.tableHeaderText, styles.tableColMarks]}>Obtained</Text>
                                                </View>

                                                {/* Table Rows */}
                                                {quiz.students.map((student, idx) => (
                                                    <View key={idx} style={[
                                                        styles.tableRow,
                                                        student.autoSubmitted && styles.tableRowAutoSubmit
                                                    ]}>
                                                        <Text style={[styles.tableRowText, styles.tableColName]} numberOfLines={1}>
                                                            {student.name}
                                                            {student.autoSubmitted && (
                                                                <Text style={styles.autoSubmitBadge}> (Auto)</Text>
                                                            )}
                                                        </Text>
                                                        <Text style={[styles.tableRowText, styles.tableColMarks]}>
                                                            {student.totalQuestions}
                                                        </Text>
                                                        <Text style={[
                                                            styles.tableRowText, 
                                                            styles.tableColMarks,
                                                            { color: student.percentage >= 50 ? COLORS.success : COLORS.danger }
                                                        ]}>
                                                            {student.score} ({student.percentage}%)
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                    </Animated.View>
                )}
            </ScrollView>

            <BottomNav currentRoute="/admin/quiz" />

            {/* Confirmation Modal */}
            <Modal visible={confirmModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmCard}>
                        <Ionicons name="help-circle-outline" size={60} color={COLORS.link} style={{ alignSelf: 'center', marginBottom: 16 }} />
                        <Text style={styles.confirmTitle}>Send Quiz to Class</Text>
                        <Text style={styles.confirmMessage}>
                            Send {difficulty} quiz on "{selectedTopic}" to all students?
                        </Text>
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity
                                style={[styles.confirmButton, { backgroundColor: '#E0E0E0' }]}
                                onPress={() => setConfirmModalVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.confirmButtonText, { color: COLORS.heading }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmButton, { backgroundColor: COLORS.link }]}
                                onPress={handleConfirmSend}
                                disabled={isSending}
                                activeOpacity={0.8}
                            >
                                {isSending ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Send</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Confirm Finish Modal - Higher z-index to appear on top */}
            <Modal visible={confirmFinishModalVisible} animationType="fade" transparent>
                <View style={[styles.modalOverlay, { zIndex: 9999 }]}>
                    <View style={[styles.confirmCard, { elevation: 20, zIndex: 9999 }]}>
                        <Ionicons name="warning-outline" size={60} color={COLORS.warning} style={{ alignSelf: 'center', marginBottom: 16 }} />
                        <Text style={styles.confirmTitle}>Finish Quiz</Text>
                        <Text style={styles.confirmMessage}>
                            This will auto-submit all pending quizzes and notify students. Continue?
                        </Text>
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity
                                style={[styles.confirmButton, { backgroundColor: '#E0E0E0' }]}
                                onPress={() => {
                                    setConfirmFinishModalVisible(false);
                                    setStatusModalVisible(true); // Reopen status modal
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.confirmButtonText, { color: COLORS.heading }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmButton, { backgroundColor: COLORS.danger }]}
                                onPress={handleConfirmFinish}
                                disabled={finishingQuiz}
                                activeOpacity={0.8}
                            >
                                {finishingQuiz ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Finish</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Error Modal */}
            <Modal visible={errorModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.messageCard}>
                        <Ionicons name="close-circle" size={60} color={COLORS.danger} style={{ alignSelf: 'center', marginBottom: 16 }} />
                        <Text style={styles.messageTitle}>Error</Text>
                        <Text style={styles.messageText}>{modalMessage}</Text>
                        <TouchableOpacity
                            style={[styles.messageButton, { backgroundColor: COLORS.danger }]}
                            onPress={() => setErrorModalVisible(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.messageButtonText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Success Modal */}
            <Modal visible={successModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.messageCard}>
                        <Ionicons name="checkmark-circle" size={60} color={COLORS.success} style={{ alignSelf: 'center', marginBottom: 16 }} />
                        <Text style={styles.messageTitle}>Success</Text>
                        <Text style={styles.messageText}>{modalMessage}</Text>
                        <TouchableOpacity
                            style={[styles.messageButton, { backgroundColor: COLORS.success }]}
                            onPress={() => setSuccessModalVisible(false)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.messageButtonText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Quiz Status Modal */}
            <Modal 
                visible={statusModalVisible} 
                animationType="slide" 
                transparent
                key={`status-${quizStatus.submitted}-${quizStatus.pending}`}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.statusCard}>
                        <View style={styles.statusHeader}>
                            <Text style={styles.statusTitle}>Quiz Status</Text>
                            <Pressable onPress={() => setStatusModalVisible(false)}>
                                <Ionicons name="close-circle" size={28} color={COLORS.danger} />
                            </Pressable>
                        </View>
                        
                        <View style={styles.statusRow}>
                            <View style={styles.statusBox}>
                                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                                <Text style={styles.statusNumber} key={`submitted-${quizStatus.submitted}`}>
                                    {quizStatus.submitted}
                                </Text>
                                <Text style={styles.statusLabel}>Submitted</Text>
                            </View>

                            <View style={styles.statusBox}>
                                <Ionicons name="time" size={48} color={COLORS.warning} />
                                <Text style={styles.statusNumber} key={`pending-${quizStatus.pending}`}>
                                    {quizStatus.pending}
                                </Text>
                                <Text style={styles.statusLabel}>Pending</Text>
                            </View>

                            <View style={styles.statusBox}>
                                <Ionicons name="people" size={48} color={COLORS.link} />
                                <Text style={styles.statusNumber} key={`total-${quizStatus.totalStudents}`}>
                                    {quizStatus.totalStudents}
                                </Text>
                                <Text style={styles.statusLabel}>Total</Text>
                            </View>
                        </View>

                        <View style={styles.lastUpdateContainer}>
                            <Text style={styles.lastUpdateText}>
                                Auto-refreshing every 3 seconds • Last: {new Date(lastUpdate).toLocaleTimeString()}
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.refreshBtn} onPress={refreshQuizStatus} activeOpacity={0.8}>
                            <Ionicons name="refresh" size={20} color={COLORS.link} />
                            <Text style={styles.refreshText}>Manual Refresh</Text>
                        </TouchableOpacity>

                        <View style={styles.statusButtons}>
                            <TouchableOpacity
                                style={[styles.statusButton, { backgroundColor: COLORS.danger }]}
                                onPress={handleFinishQuiz}
                                disabled={finishingQuiz}
                                activeOpacity={0.8}
                            >
                                {finishingQuiz ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.statusButtonText}>Finish Quiz</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.statusButton, { backgroundColor: '#999' }]}
                                onPress={() => setStatusModalVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.statusButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        borderColor: COLORS.inputBg,
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
        color: COLORS.inputBg,
        textAlign: 'center',
        flex: 1,
    },
    headerPlaceholder: {
        width: 40,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 100,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.link,
        marginTop: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontFamily: 'Outfit',
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.heading,
        marginTop: 16,
    },
    emptySubtext: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: '#999',
        marginTop: 8,
    },
    infoCard: {
        marginBottom: 24,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    infoGradient: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: COLORS.link,
    },
    infoTitle: {
        fontFamily: 'Griffter',
        fontSize: 24,
        color: '#fff',
        marginTop: 12,
    },
    infoSubtitle: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: '#fff',
        opacity: 0.9,
        marginTop: 8,
        textAlign: 'center',
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    sectionTitle: {
        fontFamily: 'Griffter',
        fontSize: 18,
        color: COLORS.heading,
    },
    topicsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    topicCard: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        minWidth: '47%',
        maxWidth: '48%',
    },
    topicCardActive: {
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    topicGradient: {
        padding: 16,
        alignItems: 'center',
        gap: 8,
        minHeight: 100,
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    topicGradientActive: {
        backgroundColor: COLORS.link,
    },
    topicText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.inputBg,
        textAlign: 'center',
    },
    topicTextActive: {
        color: '#fff',
    },
    diffRow: {
        flexDirection: 'row',
        gap: 12,
    },
    diffCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    diffIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    diffText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.heading,
    },
    generateBtn: {
        marginTop: 8,
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
        backgroundColor: COLORS.link,
    },
    generateBtnDisabled: {
        opacity: 0.5,
        shadowOpacity: 0,
        elevation: 0,
        backgroundColor: '#E0E0E0',
    },
    generateGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 12,
    },
    generateBtnText: {
        fontFamily: 'Outfit',
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    generateBtnTextDisabled: {
        color: '#999',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    confirmCard: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    confirmTitle: {
        fontFamily: 'Griffter',
        fontSize: 24,
        color: COLORS.heading,
        textAlign: 'center',
        marginBottom: 12,
    },
    confirmMessage: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.heading,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    confirmButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    messageCard: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    messageTitle: {
        fontFamily: 'Griffter',
        fontSize: 24,
        color: COLORS.heading,
        marginBottom: 12,
    },
    messageText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.heading,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    messageButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    messageButtonText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    statusCard: {
        width: '95%',
        maxWidth: 500,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    statusTitle: {
        fontFamily: 'Griffter',
        fontSize: 22,
        color: COLORS.inputBg,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 10,
    },
    statusBox: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 15,
        alignItems: 'center',
    },
    statusNumber: {
        fontFamily: 'Outfit',
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.heading,
        marginTop: 8,
    },
    statusLabel: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    lastUpdateContainer: {
        alignItems: 'center',
        paddingVertical: 8,
        marginBottom: 8,
    },
    lastUpdateText: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
        marginBottom: 16,
        backgroundColor: '#E3F2FD',
        borderRadius: 10,
    },
    refreshText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.link,
        fontWeight: '600',
    },
    statusButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    statusButton: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    statusButtonText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    // Quiz History Styles
    historySection: {
        marginTop: 24,
        paddingBottom: 20,
    },
    historySectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    historySectionTitle: {
        fontFamily: 'Griffter',
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.heading,
    },
    historyLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        gap: 10,
    },
    historyLoadingText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: '#666',
    },
    historyEmptyContainer: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#f5f5f5',
        borderRadius: 16,
    },
    historyEmptyText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '600',
        color: '#999',
        marginTop: 12,
    },
    historyEmptySubtext: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: '#aaa',
        marginTop: 4,
    },
    historyList: {
        gap: 12,
    },
    historyItem: {
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    historyItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fafafa',
    },
    historyItemLeft: {
        flex: 1,
        marginRight: 12,
    },
    historyItemTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    historyItemTopic: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.heading,
        flex: 1,
    },
    difficultyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    difficultyBadgeText: {
        fontFamily: 'Outfit',
        fontSize: 10,
        fontWeight: '600',
        color: '#fff',
        textTransform: 'uppercase',
    },
    historyItemDate: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: '#666',
    },
    historyItemDetails: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: 8,
        borderBottomWidth: 2,
        borderBottomColor: COLORS.link,
        marginBottom: 8,
    },
    tableHeaderText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.heading,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    tableRowAutoSubmit: {
        backgroundColor: '#fff3e0',
    },
    tableRowText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.text,
    },
    tableColName: {
        flex: 2,
        paddingRight: 8,
    },
    tableColMarks: {
        flex: 1,
        textAlign: 'center',
    },
    autoSubmitBadge: {
        fontSize: 11,
        color: COLORS.warning,
        fontWeight: '600',
    },
});
