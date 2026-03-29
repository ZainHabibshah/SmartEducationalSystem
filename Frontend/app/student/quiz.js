import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
import Svg, { Circle } from 'react-native-svg';
import BottomNav from '../../components/BottomNav';
import apiService from '../../services/apiService';

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
const BOTTOM_NAV_HEIGHT = height * 0.16;

function TimerDonut({ totalSeconds = 600, running, onComplete }) {
    const size = 160;
    const strokeWidth = 16;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (running) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                setSecondsLeft((s) => {
                    if (s <= 1) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                        onComplete && onComplete();
                        return 0;
                    }
                    return s - 1;
                });
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [running, onComplete]);

    const progress = secondsLeft / totalSeconds;
    const dashoffset = circumference * (1 - progress);
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;

    return (
        <View style={styles.timerContainer}>
            <Svg width={size} height={size}>
                <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#E6E6E6" strokeWidth={strokeWidth} fill="transparent" />
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={progress > 0.33 ? COLORS.success : COLORS.danger}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
            <View style={styles.timerCenter}>
                <Text style={styles.timerLabel}>Time Left</Text>
                <Text style={styles.timerText}>{`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}</Text>
            </View>
        </View>
    );
}

export default function StudentQuizScreen() {
    const router = useRouter();
    const [topics, setTopics] = useState([]);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [difficulty, setDifficulty] = useState('easy');
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingTopics, setLoadingTopics] = useState(true);
    const [quizModalVisible, setQuizModalVisible] = useState(false);
    const [resultModalVisible, setResultModalVisible] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [score, setScore] = useState(0);
    const [remarks, setRemarks] = useState('');
    const [quizStartTime, setQuizStartTime] = useState(null);
    const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
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

    const loadTopics = async () => {
        try {
            setLoadingTopics(true);
            console.log('📚 Loading quiz topics...');
            const result = await apiService.getQuizTopics();
            console.log('✅ Topics loaded:', result);
            setTopics(result.topics || []);
        } catch (error) {
            console.error('❌ Error loading topics:', error);
            setTopics([]);
        } finally {
            setLoadingTopics(false);
        }
    };

    const canGenerate = selectedTopic && difficulty && !isGenerating;

    const handleGenerateQuiz = async () => {
        if (!canGenerate) return;

        try {
            setIsGenerating(true);
            console.log('🎯 Generating quiz:', { topic: selectedTopic, difficulty });
            
            const result = await apiService.generateQuiz(selectedTopic, difficulty);
            console.log('✅ Quiz generated:', result);
            
            setQuestions(result.questions || []);
            setAnswers({});
            setShowCorrectAnswers(false);
            setQuizStartTime(Date.now());
            setQuizModalVisible(true);
        } catch (error) {
            console.error('❌ Error generating quiz:', error);
            alert('Failed to generate quiz. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const submitQuiz = async () => {
        const s = questions.reduce((acc, q) => acc + ((answers[q.id] ?? -1) === q.correctIndex ? 1 : 0), 0);
        const timeTaken = quizStartTime ? Math.floor((Date.now() - quizStartTime) / 1000) : 0;
        
        setScore(s);
        setRemarks(s >= 8 ? 'Excellent! 🎉' : s >= 5 ? 'Good Job! 👍' : 'Keep Practicing! 💪');
        setShowCorrectAnswers(true);
        
        // Save result to backend
        try {
            await apiService.saveQuizResult({
                topic: selectedTopic,
                difficulty,
                score: s,
                totalQuestions: questions.length,
                timeTaken,
            });
            console.log('✅ Quiz result saved');
        } catch (error) {
            console.error('❌ Error saving quiz result:', error);
        }
        
        setQuizModalVisible(false);
        setResultModalVisible(true);
    };

    const onTimeUp = () => {
        submitQuiz();
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
        if (router.canGoBack()) {
            router.back();
        } else {
            router.push('/student');
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
                        <Text style={styles.emptySubtext}>Your instructor hasn't added any topics</Text>
                    </View>
                ) : (
                    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
                        {/* Info Card */}
                        <View style={styles.infoCard}>
                            <View style={styles.infoGradient}>
                                <Ionicons name="bulb" size={32} color="#fff" />
                                <Text style={styles.infoTitle}>AI-Powered Quiz</Text>
                                <Text style={styles.infoSubtitle}>Select a topic, choose difficulty, and test your knowledge!</Text>
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

                        {/* Generate Button */}
                        <TouchableOpacity
                            style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
                            onPress={handleGenerateQuiz}
                            disabled={!canGenerate}
                            activeOpacity={0.85}
                        >
                            {isGenerating ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <View style={styles.generateGradient}>
                                    <Ionicons name="flash" size={24} color={canGenerate ? '#fff' : '#999'} />
                                    <Text style={[styles.generateBtnText, !canGenerate && styles.generateBtnTextDisabled]}>
                                        {isGenerating ? 'Generating...' : 'Generate Quiz'}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </ScrollView>

            <BottomNav
                onPressHome={() => handleBottomPress('home')}
                onPressNotifications={() => handleBottomPress('bell')}
                onPressChatbot={() => handleBottomPress('chat')}
                onPressSettings={() => handleBottomPress('settings')}
            />

            {/* Quiz Modal */}
            <Modal visible={quizModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderInfo}>
                                <Text style={styles.modalTitle}>{selectedTopic}</Text>
                                <Text style={styles.modalSubtitle}>{difficulty.toUpperCase()} • {questions.length} Questions</Text>
                            </View>
                            <Pressable onPress={() => setQuizModalVisible(false)} style={styles.closeButton}>
                                <Ionicons name="close-circle" size={28} color={COLORS.danger} />
                            </Pressable>
                        </View>
                        <View style={styles.modalTimerRow}>
                            <TimerDonut totalSeconds={600} running={quizModalVisible} onComplete={onTimeUp} />
                        </View>
                        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 12 }}>
                            {questions.map((q) => {
                                const userAnswer = answers[q.id];
                                const isCorrect = userAnswer === q.correctIndex;
                                
                                return (
                                    <View key={q.id} style={styles.questionBlock}>
                                        <Text style={styles.questionText}>
                                            {q.id}. {q.question}
                                        </Text>
                                        {q.options.map((opt, idx) => {
                                            const selected = userAnswer === idx;
                                            const isCorrectOption = showCorrectAnswers && idx === q.correctIndex;
                                            const isWrongSelection = showCorrectAnswers && selected && !isCorrect;

                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={[
                                                        styles.optionRow,
                                                        selected && styles.optionRowSelected,
                                                        isCorrectOption && styles.optionRowCorrect,
                                                        isWrongSelection && styles.optionRowWrong,
                                                    ]}
                                                    activeOpacity={0.8}
                                                    onPress={() => !showCorrectAnswers && setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                                                    disabled={showCorrectAnswers}
                                                >
                                                    <View
                                                        style={[
                                                            styles.optionDot,
                                                            selected && styles.optionDotSelected,
                                                            isCorrectOption && styles.optionDotCorrect,
                                                            isWrongSelection && styles.optionDotWrong,
                                                        ]}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.optionText,
                                                            selected && styles.optionTextSelected,
                                                            isCorrectOption && styles.optionTextCorrect,
                                                            isWrongSelection && styles.optionTextWrong,
                                                        ]}
                                                    >
                                                        {opt}
                                                    </Text>
                                                    {isCorrectOption && <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />}
                                                    {isWrongSelection && <Ionicons name="close-circle" size={20} color={COLORS.danger} />}
                                                </TouchableOpacity>
                                            );
                                        })}
                                        {showCorrectAnswers && q.explanation && (
                                            <View style={styles.explanationBox}>
                                                <Ionicons name="information-circle" size={16} color={COLORS.link} />
                                                <Text style={styles.explanationText}>{q.explanation}</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </ScrollView>
                        {!showCorrectAnswers && (
                            <TouchableOpacity style={styles.uploadBtn} onPress={submitQuiz} activeOpacity={0.85}>
                                <View style={styles.uploadGradient}>
                                    <Ionicons name="checkmark-done" size={20} color="#fff" />
                                    <Text style={styles.uploadBtnText}>Submit Quiz</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Result Modal */}
            <Modal visible={resultModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.resultCard}>
                        <View
                            style={[
                                styles.resultGradient,
                                score >= 8 ? styles.resultExcellent : score >= 5 ? styles.resultGood : styles.resultNeedsWork
                            ]}
                        >
                            <Ionicons
                                name={score >= 8 ? 'trophy' : score >= 5 ? 'ribbon' : 'sad'}
                                size={64}
                                color="#fff"
                            />
                            <Text style={styles.resultTitle}>Quiz Completed!</Text>
                            <Text style={styles.resultScore}>
                                {score}/{questions.length}
                            </Text>
                            <Text style={styles.resultPercentage}>{Math.round((score / questions.length) * 100)}%</Text>
                            <Text style={styles.resultRemarks}>{remarks}</Text>
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={() => {
                                    setResultModalVisible(false);
                                    setSelectedTopic(null);
                                }}
                            >
                                <Text style={styles.closeBtnText}>Close</Text>
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
        paddingBottom: 20 + BOTTOM_NAV_HEIGHT,
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
    modalCard: {
        width: '100%',
        maxHeight: '90%',
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#f8f9fa',
    },
    modalHeaderInfo: {
        flex: 1,
    },
    modalTitle: {
        fontFamily: 'Griffter',
        fontSize: 20,
        color: COLORS.inputBg,
    },
    modalSubtitle: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.link,
        marginTop: 4,
    },
    closeButton: {
        marginLeft: 12,
    },
    modalTimerRow: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        backgroundColor: '#f8f9fa',
    },
    modalBody: {
        paddingHorizontal: 16,
        flex: 1,
    },
    questionBlock: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f2f2f2',
    },
    questionText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.heading,
        marginBottom: 12,
        lineHeight: 24,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 8,
        backgroundColor: '#f8f9fa',
    },
    optionRowSelected: {
        backgroundColor: '#E3F2FD',
        borderWidth: 1,
        borderColor: COLORS.link,
    },
    optionRowCorrect: {
        backgroundColor: '#E8F5E9',
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    optionRowWrong: {
        backgroundColor: '#FFEBEE',
        borderWidth: 1,
        borderColor: COLORS.danger,
    },
    optionDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#999',
        marginRight: 12,
    },
    optionDotSelected: {
        backgroundColor: COLORS.link,
        borderColor: COLORS.link,
    },
    optionDotCorrect: {
        backgroundColor: COLORS.success,
        borderColor: COLORS.success,
    },
    optionDotWrong: {
        backgroundColor: COLORS.danger,
        borderColor: COLORS.danger,
    },
    optionText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.heading,
        flex: 1,
        lineHeight: 20,
    },
    optionTextSelected: {
        fontWeight: '600',
        color: COLORS.link,
    },
    optionTextCorrect: {
        fontWeight: '600',
        color: COLORS.success,
    },
    optionTextWrong: {
        fontWeight: '600',
        color: COLORS.danger,
    },
    explanationBox: {
        flexDirection: 'row',
        backgroundColor: '#E3F2FD',
        padding: 12,
        borderRadius: 8,
        marginTop: 8,
        gap: 8,
    },
    explanationText: {
        fontFamily: 'Outfit',
        fontSize: 13,
        color: COLORS.link,
        flex: 1,
        lineHeight: 18,
    },
    uploadBtn: {
        margin: 16,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
        backgroundColor: COLORS.success,
    },
    uploadGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    uploadBtnText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    resultCard: {
        width: '90%',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    resultGradient: {
        padding: 32,
        alignItems: 'center',
    },
    resultExcellent: {
        backgroundColor: COLORS.success,
    },
    resultGood: {
        backgroundColor: COLORS.warning,
    },
    resultNeedsWork: {
        backgroundColor: COLORS.danger,
    },
    resultTitle: {
        fontFamily: 'Griffter',
        fontSize: 28,
        color: '#fff',
        marginTop: 16,
    },
    resultScore: {
        fontFamily: 'Griffter',
        fontSize: 48,
        color: '#fff',
        marginTop: 16,
    },
    resultPercentage: {
        fontFamily: 'Outfit',
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        opacity: 0.9,
    },
    resultRemarks: {
        fontFamily: 'Outfit',
        fontSize: 18,
        color: '#fff',
        marginTop: 12,
        opacity: 0.95,
    },
    closeBtn: {
        backgroundColor: 'rgba(255,255,255,0.3)',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
        marginTop: 24,
        borderWidth: 2,
        borderColor: '#fff',
    },
    closeBtnText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    timerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerCenter: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerLabel: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.link,
    },
    timerText: {
        fontFamily: 'Griffter',
        fontSize: 24,
        color: COLORS.inputBg,
        marginTop: 4,
    },
});
