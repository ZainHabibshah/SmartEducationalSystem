import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Modal, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomNav from '../../components/BottomNav';
import apiService from '../../services/apiService';

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
};

export default function StudentNotificationScreen() {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [expandedItems, setExpandedItems] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [studentId, setStudentId] = useState(null);
    const [studentCourse, setStudentCourse] = useState(null);
    const [submittedQuizIds, setSubmittedQuizIds] = useState(new Set()); // Track submitted quizzes
    
    // Quiz modal states
    const [quizModalVisible, setQuizModalVisible] = useState(false);
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [quizAnswers, setQuizAnswers] = useState({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [quizScore, setQuizScore] = useState(0);
    const [quizTimeRemaining, setQuizTimeRemaining] = useState(null);

    // Get student ID from AsyncStorage or use email
    useEffect(() => {
        loadStudentId();
    }, []);

    const loadStudentId = async () => {
        try {
            // Try to get student ID or email from storage
            const storedEmail = await AsyncStorage.getItem('student_email');
            const storedStudentId = await AsyncStorage.getItem('student_id');
            const storedCourse = await AsyncStorage.getItem('student_course');
            const id = storedStudentId || storedEmail;
            if (id) {
                setStudentId(id);
                const course = storedCourse || 'computerScience';
                setStudentCourse(course);
                console.log('👤 Student loaded:', id, 'Course:', course);
                fetchNotifications(id, course);
            } else {
                setLoading(false);
                Alert.alert('Error', 'Please login again to view notifications');
            }
        } catch (error) {
            console.error('Error loading student ID:', error);
            setLoading(false);
        }
    };

    const fetchNotifications = async (id, course = null) => {
        try {
            setLoading(true);
            const studentCourseToUse = course || studentCourse || 'computerScience';
            console.log('📡 Fetching notifications for:', id, 'Course:', studentCourseToUse);
            
            const result = await apiService.getStudentNotifications(id, studentCourseToUse);
            console.log('📥 Notifications result:', result);
            
            // Also fetch submitted quiz IDs
            try {
                const submittedResult = await apiService.getSubmittedQuizIds();
                if (submittedResult && submittedResult.success && submittedResult.submittedQuizIds) {
                    setSubmittedQuizIds(new Set(submittedResult.submittedQuizIds));
                    console.log('✅ Loaded submitted quiz IDs:', submittedResult.submittedQuizIds);
                }
            } catch (error) {
                console.error('❌ Error fetching submitted quiz IDs:', error);
            }
            
            if (result && result.success && result.notifications) {
                // Format notifications for display - now with real read status!
                const formattedNotifications = result.notifications.map((notif, index) => ({
                    id: notif.id || `notif-${index}`,  // Use backend ID
                    title: notif.title || 'Notification',
                    content: notif.message || '',
                    date: formatDate(notif.date || new Date().toISOString()),
                    isRead: notif.isRead || false,  // Get real read status from backend
                    priority: 'medium', // Default priority
                    type: notif.type || 'normal',  // quiz or normal
                    quizData: notif.quizData || null,  // Quiz data if type is quiz
                    quizId: notif.quizId || null,
                    expired: notif.expired || false,
                    finishedByAdmin: notif.finishedByAdmin || false
                }));
                // Sort by date (newest first)
                formattedNotifications.sort((a, b) => new Date(b.date) - new Date(a.date));
                console.log(`✅ Loaded ${formattedNotifications.length} notifications`);
                setNotifications(formattedNotifications);
            } else {
                console.log('⚠️ No notifications in response');
                setNotifications([]);
            }
        } catch (error) {
            console.error('❌ Error fetching notifications:', error);
            Alert.alert('Error', 'Failed to load notifications. Please try again.');
            setNotifications([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const formatDate = (dateString) => {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            return date.toLocaleDateString();
        } catch (error) {
            return 'Recently';
        }
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

    const toggleExpanded = async (id) => {
        console.log('📖 Toggle expanded for notification:', id);
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(id)) {
            console.log('🔽 Collapsing notification');
            newExpanded.delete(id);
        } else {
            console.log('🔼 Expanding notification - will mark as read');
            newExpanded.add(id);
            // Automatically mark as read when expanded
            const notification = notifications.find(n => n.id === id);
            console.log('📧 Notification data:', notification);
            if (!notification?.isRead) {
                console.log('✉️ Marking notification as read...');
                await handleMarkRead(id);
            } else {
                console.log('✅ Already read, skipping');
            }
        }
        setExpandedItems(newExpanded);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        if (studentId && studentCourse) {
            await fetchNotifications(studentId, studentCourse);
        } else {
            await loadStudentId();
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return '#F44336';
            case 'medium': return '#FF9800';
            case 'low': return '#4CAF50';
            default: return COLORS.link;
        }
    };

    const handleDelete = async (id) => {
        try {
            console.log('🗑️ Deleting notification:', id);
            
            // Update UI immediately (optimistic update)
            setNotifications((prev) => prev.filter((n) => n.id !== id));
            setExpandedItems((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            
            // Call backend to persist the soft delete
            if (studentId && studentCourse) {
                await apiService.deleteNotification(id, studentId, studentCourse);
                console.log('✅ Notification deleted from student view');
            }
        } catch (error) {
            console.error('❌ Error deleting notification:', error);
            // Optionally: Revert UI change if backend fails
            // For now, we'll keep the UI updated even if backend fails
        }
    };

    const handleTakeQuiz = (notification) => {
        // Check if quiz is already submitted
        if (submittedQuizIds.has(notification.quizId)) {
            Alert.alert(
                'Quiz Already Submitted', 
                'You have already submitted this quiz. Each quiz can only be taken once.',
                [{ text: 'OK' }]
            );
            return;
        }
        
        // Check if quiz was finished by admin
        if (notification.expired && notification.finishedByAdmin) {
            Alert.alert(
                'Quiz Finished by Instructor', 
                'This quiz has been closed by your instructor. You can no longer submit this quiz.',
                [{ text: 'OK' }]
            );
            return;
        }
        
        if (notification.expired) {
            Alert.alert('Quiz Expired', 'This quiz has been closed by your instructor.');
            return;
        }

        if (!notification.quizData) {
            Alert.alert('Error', 'Quiz data not available');
            return;
        }

        // Calculate remaining time
        const endTime = new Date(notification.quizData.endTime);
        const now = new Date();
        const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));

        if (remainingSeconds <= 0) {
            Alert.alert('Quiz Expired', 'The time for this quiz has ended.');
            return;
        }

        setSelectedQuiz(notification);
        setQuizTimeRemaining(remainingSeconds);
        setQuizAnswers({});
        setQuizSubmitted(false);
        setQuizScore(0);
        setQuizModalVisible(true);
    };

    // Timer for quiz
    useEffect(() => {
        let interval;
        if (quizModalVisible && quizTimeRemaining !== null && quizTimeRemaining > 0 && !quizSubmitted) {
            interval = setInterval(() => {
                setQuizTimeRemaining((prev) => {
                    if (prev <= 1) {
                        // Time's up - auto submit
                        handleSubmitQuiz(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [quizModalVisible, quizTimeRemaining, quizSubmitted]);

    // Check if quiz was finished by admin while student is taking it
    useEffect(() => {
        let checkInterval;
        if (quizModalVisible && selectedQuiz && !quizSubmitted) {
            // Check every 3 seconds if quiz is still active
            checkInterval = setInterval(async () => {
                try {
                    // Fetch fresh notifications to check quiz status
                    if (studentId && studentCourse) {
                        const result = await apiService.getStudentNotifications(studentId, studentCourse);
                        if (result && result.success && result.notifications) {
                            // Find current quiz notification
                            const currentQuizNotif = result.notifications.find(
                                n => n.quizId === selectedQuiz.quizId
                            );
                            
                            // If quiz was finished by admin, auto-submit current progress
                            if (currentQuizNotif && currentQuizNotif.expired && currentQuizNotif.finishedByAdmin) {
                                console.log('⚠️ Quiz was finished by admin! Auto-submitting current progress...');
                                
                                // Calculate score based on current answers
                                let correctCount = 0;
                                selectedQuiz.quizData.questions.forEach((q, index) => {
                                    if (quizAnswers[index] === q.correctAnswer) {
                                        correctCount++;
                                    }
                                });
                                
                                const totalQuestions = selectedQuiz.quizData.questions.length;
                                const answeredCount = Object.keys(quizAnswers).length;
                                const percentage = Math.round((correctCount / totalQuestions) * 100);
                                
                                // Submit current progress
                                try {
                                    await apiService.submitQuizFromNotification({
                                        quizId: selectedQuiz.quizId,
                                        topic: selectedQuiz.quizData.topic,
                                        difficulty: selectedQuiz.quizData.difficulty,
                                        score: correctCount,
                                        totalQuestions: totalQuestions,
                                        percentage: percentage
                                    });
                                    console.log(`✅ Auto-submitted: ${correctCount}/${totalQuestions} (${answeredCount} answered)`);
                                    
                                    // Add to submitted list
                                    setSubmittedQuizIds(prev => new Set([...prev, selectedQuiz.quizId]));
                                } catch (error) {
                                    console.error('Error auto-submitting quiz:', error);
                                }
                                
                                // Close modal and show result
                                setQuizModalVisible(false);
                                
                                Alert.alert(
                                    'Quiz Finished by Instructor',
                                    `The quiz has been closed by your instructor.\n\n` +
                                    `Your progress has been automatically submitted:\n` +
                                    `• Answered: ${answeredCount}/${totalQuestions} questions\n` +
                                    `• Correct: ${correctCount}/${totalQuestions}\n` +
                                    `• Score: ${percentage}%`,
                                    [{ 
                                        text: 'OK',
                                        onPress: () => {
                                            // Reload notifications to update UI
                                            fetchNotifications(studentId, studentCourse);
                                        }
                                    }]
                                );
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error checking quiz status:', error);
                }
            }, 3000); // Check every 3 seconds
        }
        
        return () => {
            if (checkInterval) clearInterval(checkInterval);
        };
    }, [quizModalVisible, selectedQuiz, quizSubmitted, studentId, studentCourse, quizAnswers]);

    const handleQuizAnswerSelect = (questionIndex, answerIndex) => {
        if (quizSubmitted) return;
        setQuizAnswers((prev) => ({
            ...prev,
            [questionIndex]: answerIndex
        }));
    };

    const handleSubmitQuiz = async (autoSubmit = false) => {
        try {
            if (!autoSubmit) {
                // Check if all questions answered
                const totalQuestions = selectedQuiz.quizData.questions.length;
                const answeredCount = Object.keys(quizAnswers).length;
                
                if (answeredCount < totalQuestions) {
                    Alert.alert(
                        'Incomplete Quiz',
                        `You have answered ${answeredCount} out of ${totalQuestions} questions. Submit anyway?`,
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Submit', onPress: () => submitQuizToBackend() }
                        ]
                    );
                    return;
                }
            }
            
            await submitQuizToBackend();
        } catch (error) {
            console.error('Error submitting quiz:', error);
            Alert.alert('Error', 'Failed to submit quiz');
        }
    };

    const submitQuizToBackend = async () => {
        // Calculate score
        let correctCount = 0;
        selectedQuiz.quizData.questions.forEach((q, index) => {
            if (quizAnswers[index] === q.correctAnswer) {
                correctCount++;
            }
        });

        const totalQuestions = selectedQuiz.quizData.questions.length;
        const percentage = Math.round((correctCount / totalQuestions) * 100);

        setQuizScore(correctCount);
        setQuizSubmitted(true);

        // Save to backend
        try {
            await apiService.submitQuizFromNotification({
                quizId: selectedQuiz.quizId,
                topic: selectedQuiz.quizData.topic,
                difficulty: selectedQuiz.quizData.difficulty,
                score: correctCount,
                totalQuestions: totalQuestions,
                percentage: percentage
            });
            console.log('✅ Quiz result saved');
            
            // Add quiz ID to submitted list to prevent retaking
            setSubmittedQuizIds(prev => new Set([...prev, selectedQuiz.quizId]));
        } catch (error) {
            console.error('Error saving quiz result:', error);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleMarkRead = async (id) => {
        try {
            console.log('🔄 handleMarkRead called for:', id);
            console.log('👤 Student ID:', studentId);
            console.log('📚 Student Course:', studentCourse);
            
            // Update UI immediately for better UX
            setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
            console.log('✅ UI updated - notification marked as read locally');
            
            // Call backend to persist the change
            if (studentId && studentCourse) {
                console.log('📡 Calling backend API to mark as read...');
                const result = await apiService.markNotificationRead(id, studentId, studentCourse);
                console.log('✅ Backend response:', result);
                console.log('✅ Notification marked as read in database:', id);
            } else {
                console.warn('⚠️ Missing studentId or studentCourse:', { studentId, studentCourse });
            }
        } catch (error) {
            console.error('❌ Error marking notification as read:', error);
            console.error('❌ Error details:', error.response?.data || error.message);
            // Revert UI change if backend call fails
            setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: false } : n));
        }
    };

    const renderNotification = ({ item }) => {
        const isExpanded = expandedItems.has(item.id);
        const isQuiz = item.type === 'quiz';
        
        // Calculate remaining time for quiz
        let quizTimeLeft = null;
        if (isQuiz && item.quizData && !item.expired) {
            const endTime = new Date(item.quizData.endTime);
            const now = new Date();
            const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
            quizTimeLeft = remainingSeconds;
        }

        return (
            <View style={[
                styles.notificationCard,
                !item.isRead && styles.unreadCard,
                isQuiz && styles.quizCard
            ]}>
                {!item.isRead && <View style={styles.unreadDot} />}
                {isQuiz && !item.expired && <View style={styles.quizBadge}><Text style={styles.quizBadgeText}>QUIZ</Text></View>}
                
                <View style={styles.headerRow}>
                    <View style={styles.titleContainer}>
                        <Text style={[styles.notificationTitle, !item.isRead && styles.unreadTitle]} numberOfLines={2}>
                            {item.title}
                        </Text>
                        {isQuiz && quizTimeLeft !== null && quizTimeLeft > 0 && (
                            <View style={styles.timerContainer}>
                                <Ionicons name="time-outline" size={16} color="#FF5722" />
                                <Text style={styles.timerText}>{formatTime(quizTimeLeft)}</Text>
                            </View>
                        )}
                        {isQuiz && item.expired && (
                            <Text style={[styles.expiredText, item.finishedByAdmin && { backgroundColor: '#FF5722' }]}>
                                {item.finishedByAdmin ? 'FINISHED BY ADMIN' : 'EXPIRED'}
                            </Text>
                        )}
                    </View>
                    <View style={styles.actionsInline}>
                        {isQuiz && !item.expired && quizTimeLeft > 0 && (
                            submittedQuizIds.has(item.quizId) ? (
                                <View style={styles.submittedBadge}>
                                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                    <Text style={styles.submittedBadgeText}>Submitted</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.takeQuizButton}
                                    onPress={() => handleTakeQuiz(item)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.takeQuizButtonText}>Take Quiz</Text>
                                </TouchableOpacity>
                            )
                        )}
                        <TouchableOpacity
                            style={[styles.iconOnlyButton, styles.readIconButton]}
                            onPress={() => toggleExpanded(item.id)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#4CAF50" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.iconOnlyButton, styles.deleteIconButton]}
                            onPress={() => handleDelete(item.id)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="trash" size={18} color="#E53935" />
                        </TouchableOpacity>
                    </View>
                </View>

                {isExpanded && (
                    <View style={styles.notificationContent}>
                        <Text style={styles.notificationDate}>{item.date}</Text>
                        <Text style={styles.notificationText}>{item.content}</Text>
                        {isQuiz && item.quizData && (
                            <View style={styles.quizInfo}>
                                <Text style={styles.quizInfoText}>📚 Topic: {item.quizData.topic}</Text>
                                <Text style={styles.quizInfoText}>⚡ Difficulty: {item.quizData.difficulty}</Text>
                                <Text style={styles.quizInfoText}>⏱️ Duration: 10 minutes</Text>
                                <Text style={styles.quizInfoText}>❓ Questions: 10</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const handleBack = () => {
        console.log('🔙 Back button pressed');
        if (router.canGoBack()) {
            router.back();
        } else {
            router.push('/student');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.inputBg} />
            
            {/* Custom Header - Same as Attendance */}
            <View style={styles.customHeaderContainer}>
                <TouchableOpacity style={styles.customBackButton} onPress={handleBack} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={22} color={COLORS.inputBg} />
                </TouchableOpacity>
                <Text style={styles.customHeaderTitle}>Notifications</Text>
                <View style={styles.headerPlaceholder} />
            </View>

            {/* Counts Bar */}
            <View style={styles.countsBar}>
                <View style={styles.countItem}>
                    <Text style={styles.countLabel}>Unread</Text>
                    <Text style={styles.countValue}>{notifications.filter((n) => !n.isRead).length}</Text>
                </View>
                <View style={styles.countDivider} />
                <View style={styles.countItem}>
                    <Text style={styles.countLabel}>Read</Text>
                    <Text style={styles.countValue}>{notifications.filter((n) => n.isRead).length}</Text>
                </View>
                <View style={styles.countDivider} />
                <View style={styles.countItem}>
                    <Text style={styles.countLabel}>Total</Text>
                    <Text style={styles.countValue}>{notifications.length}</Text>
                </View>
            </View>

            {/* Scrollable Notifications List */}
            <View style={styles.contentContainer}>
                {loading && notifications.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.inputBg} />
                        <Text style={styles.loadingText}>Loading notifications...</Text>
                    </View>
                ) : notifications.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="notifications-off" size={48} color={COLORS.link} />
                        <Text style={styles.emptyText}>No notifications yet</Text>
                        <Text style={styles.emptySubText}>You'll see notifications here when they arrive</Text>
                    </View>
                ) : (
                    <FlatList
                        data={notifications}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderNotification}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={[COLORS.inputBg]}
                                tintColor={COLORS.inputBg}
                            />
                        }
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={true}
                    />
                )}
            </View>

            {/* Quiz Modal */}
            <Modal
                visible={quizModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    if (!quizSubmitted) {
                        Alert.alert('Warning', 'Quiz in progress. Are you sure you want to exit?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Exit', onPress: () => setQuizModalVisible(false), style: 'destructive' }
                        ]);
                    } else {
                        setQuizModalVisible(false);
                    }
                }}
            >
                <View style={styles.quizModalOverlay}>
                    <View style={styles.quizModalContent}>
                        {selectedQuiz && (
                            <>
                                <View style={styles.quizModalHeader}>
                                    <Text style={styles.quizModalTitle}>{selectedQuiz.quizData.topic}</Text>
                                    {!quizSubmitted && quizTimeRemaining !== null && (
                                        <View style={styles.quizTimerBox}>
                                            <Ionicons name="timer" size={20} color="#FF5722" />
                                            <Text style={styles.quizTimerText}>{formatTime(quizTimeRemaining)}</Text>
                                        </View>
                                    )}
                                    <TouchableOpacity
                                        style={styles.quizCloseButton}
                                        onPress={() => {
                                            if (!quizSubmitted) {
                                                Alert.alert('Warning', 'Quiz in progress. Exit anyway?', [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    { text: 'Exit', onPress: () => setQuizModalVisible(false), style: 'destructive' }
                                                ]);
                                            } else {
                                                setQuizModalVisible(false);
                                            }
                                        }}
                                    >
                                        <Ionicons name="close" size={24} color="#fff" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.quizQuestionsContainer} showsVerticalScrollIndicator={false}>
                                    {selectedQuiz.quizData.questions.map((question, qIndex) => (
                                        <View key={qIndex} style={styles.questionCard}>
                                            <Text style={styles.questionNumber}>Question {qIndex + 1}</Text>
                                            <Text style={styles.questionText}>{question.question}</Text>
                                            
                                            {question.options.map((option, oIndex) => {
                                                const isSelected = quizAnswers[qIndex] === oIndex;
                                                const isCorrect = question.correctAnswer === oIndex;
                                                const showCorrect = quizSubmitted && isCorrect;
                                                const showWrong = quizSubmitted && isSelected && !isCorrect;

                                                return (
                                                    <TouchableOpacity
                                                        key={oIndex}
                                                        style={[
                                                            styles.optionButton,
                                                            isSelected && !quizSubmitted && styles.optionSelected,
                                                            showCorrect && styles.optionCorrect,
                                                            showWrong && styles.optionWrong
                                                        ]}
                                                        onPress={() => handleQuizAnswerSelect(qIndex, oIndex)}
                                                        disabled={quizSubmitted}
                                                    >
                                                        <Text style={[
                                                            styles.optionText,
                                                            (isSelected || showCorrect || showWrong) && styles.optionTextSelected
                                                        ]}>
                                                            {option}
                                                        </Text>
                                                        {showCorrect && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
                                                        {showWrong && <Ionicons name="close-circle" size={20} color="#ef4444" />}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    ))}
                                </ScrollView>

                                {quizSubmitted ? (
                                    <View style={styles.quizResultContainer}>
                                        <Text style={styles.quizResultTitle}>Quiz Completed!</Text>
                                        <Text style={styles.quizResultScore}>
                                            Score: {quizScore}/{selectedQuiz.quizData.questions.length}
                                        </Text>
                                        <Text style={styles.quizResultPercentage}>
                                            {Math.round((quizScore / selectedQuiz.quizData.questions.length) * 100)}%
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.quizDoneButton}
                                            onPress={() => setQuizModalVisible(false)}
                                        >
                                            <Text style={styles.quizDoneButtonText}>Done</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.quizSubmitButton}
                                        onPress={() => handleSubmitQuiz(false)}
                                    >
                                        <Text style={styles.quizSubmitButtonText}>Submit Quiz</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Bottom Navigation */}
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
    contentContainer: {
        flex: 1,
        paddingHorizontal: 15,
    },
    listContainer: {
        paddingVertical: 15,
        paddingBottom: 140,
    },
    countsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        marginBottom: 8,
        marginHorizontal: 15,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    countItem: {
        flex: 1,
        alignItems: 'center',
    },
    countLabel: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.heading,
        marginBottom: 2,
    },
    countValue: {
        fontFamily: 'Griffter',
        fontSize: 18,
        color: COLORS.heading,
    },
    countDivider: {
        width: 1,
        height: 24,
        backgroundColor: COLORS.inputBg,
        opacity: 0.5,
    },
    notificationCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 10,
        marginHorizontal: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        position: 'relative',
    },
    unreadCard: {
        backgroundColor: '#FFFEF7',  // Slight yellow tint for unread
        borderColor: '#FFC107',  // Golden border for unread
    },
    unreadDot: {
        position: 'absolute',
        top: -8,
        left: -8,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#FFC107',
        zIndex: 2,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 14,
        minHeight: 68,
    },
    titleContainer: {
        flex: 1,
        paddingRight: 10,
    },
    notificationTitle: {
        fontFamily: 'Griffter',
        fontSize: 18,
        color: COLORS.heading,
        flex: 1,
        marginRight: 8,
        lineHeight: 22,
    },
    unreadTitle: {
        fontWeight: '600',
    },
    actionsInline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    iconOnlyButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    readIconButton: {
        borderWidth: 2,
        borderColor: '#4CAF50',
    },
    deleteIconButton: {
        borderWidth: 2,
        borderColor: '#E53935',
    },
    actionButton: {},
    readButton: {},
    deleteButton: {},
    actionText: {},
    notificationDate: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.link,
    },
    notificationContent: {
        paddingHorizontal: 12,
        paddingBottom: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    notificationText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.heading,
        lineHeight: 20,
        marginBottom: 8,
    },
    readMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    readMoreText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.arrow,
        fontWeight: '500',
        marginRight: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    loadingText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.link,
        marginTop: 12,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
        paddingHorizontal: 40,
    },
    emptyText: {
        fontFamily: 'Griffter',
        fontSize: 20,
        color: COLORS.heading,
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.link,
        marginTop: 8,
        textAlign: 'center',
    },
    // Quiz-specific styles
    quizCard: {
        borderColor: '#9D4EDD',
        borderWidth: 2,
    },
    quizBadge: {
        position: 'absolute',
        top: -10,
        right: 10,
        backgroundColor: '#9D4EDD',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        zIndex: 2,
    },
    quizBadgeText: {
        fontFamily: 'Outfit',
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    timerText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        fontWeight: '600',
        color: '#FF5722',
    },
    expiredText: {
        fontFamily: 'Outfit',
        fontSize: 12,
        fontWeight: '600',
        color: '#999',
        marginTop: 4,
    },
    takeQuizButton: {
        backgroundColor: '#9D4EDD',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 4,
    },
    takeQuizButtonText: {
        fontFamily: 'Outfit',
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    submittedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 4,
        gap: 4,
    },
    submittedBadgeText: {
        fontFamily: 'Outfit',
        fontSize: 12,
        fontWeight: '600',
        color: '#4CAF50',
    },
    quizInfo: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
    },
    quizInfoText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.heading,
        marginBottom: 4,
    },
    // Quiz Modal styles
    quizModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quizModalContent: {
        width: width * 0.95,
        maxHeight: height * 0.9,
        backgroundColor: '#1a1f3a',
        borderRadius: 20,
        overflow: 'hidden',
    },
    quizModalHeader: {
        backgroundColor: '#6366f1',
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    quizModalTitle: {
        fontFamily: 'Griffter',
        fontSize: 20,
        color: '#fff',
        flex: 1,
    },
    quizTimerBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 10,
        gap: 6,
    },
    quizTimerText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    quizCloseButton: {
        padding: 4,
    },
    quizQuestionsContainer: {
        flex: 1,
        padding: 15,
    },
    questionCard: {
        backgroundColor: '#0a0e27',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#2d3548',
    },
    questionNumber: {
        fontFamily: 'Outfit',
        fontSize: 12,
        fontWeight: '600',
        color: '#8b5cf6',
        marginBottom: 8,
    },
    questionText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: '#fff',
        marginBottom: 12,
        lineHeight: 22,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1a1f3a',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: '#2d3548',
    },
    optionSelected: {
        borderColor: '#6366f1',
        backgroundColor: '#6366f120',
    },
    optionCorrect: {
        borderColor: '#10b981',
        backgroundColor: '#10b98120',
    },
    optionWrong: {
        borderColor: '#ef4444',
        backgroundColor: '#ef444420',
    },
    optionText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: '#94a3b8',
        flex: 1,
    },
    optionTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    quizSubmitButton: {
        backgroundColor: '#6366f1',
        padding: 18,
        alignItems: 'center',
        margin: 15,
        borderRadius: 12,
    },
    quizSubmitButtonText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    quizResultContainer: {
        padding: 20,
        alignItems: 'center',
    },
    quizResultTitle: {
        fontFamily: 'Griffter',
        fontSize: 24,
        color: '#fff',
        marginBottom: 15,
    },
    quizResultScore: {
        fontFamily: 'Outfit',
        fontSize: 20,
        color: '#94a3b8',
        marginBottom: 8,
    },
    quizResultPercentage: {
        fontFamily: 'Griffter',
        fontSize: 48,
        color: '#10b981',
        marginBottom: 20,
    },
    quizDoneButton: {
        backgroundColor: '#10b981',
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 12,
    },
    quizDoneButtonText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});