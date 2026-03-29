import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';

const { width, height } = Dimensions.get('window');

const COLORS = {
    bg: '#F5F5F5',
    heading: '#03045e',
    inputBg: '#03045e',
    inputText: '#FFFFFF',
    buttonBg: '#03045e',
    buttonText: '#FFFFFF',
    link: '#023e8a',
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
};

export default function LeaderboardScreen() {
    const router = useRouter();
    const [leaderboard, setLeaderboard] = useState([]);
    const [currentUserData, setCurrentUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        initializeAndLoad();
    }, []);

    const initializeAndLoad = async () => {
        try {
            // Load token from AsyncStorage and set it in apiService
            const token = await AsyncStorage.getItem('access_token');
            if (token) {
                apiService.setToken(token);
                console.log('✅ Token loaded from AsyncStorage');
            } else {
                console.warn('⚠️ No token found in AsyncStorage');
            }
        } catch (error) {
            console.error('Error loading token:', error);
        }
        // Load leaderboard after token is set
        loadLeaderboard();
    };

    const loadLeaderboard = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('🔄 Loading leaderboard...');
            const response = await apiService.getLeaderboard();
            console.log('✅ Leaderboard response:', response);
            
            // Check if response is valid
            if (!response) {
                console.warn('⚠️ Empty response from leaderboard API');
                setError('Empty response from server. Please try again.');
                return;
            }

            if (response.success === true || response.success === undefined) {
                // Accept response even if success flag is missing (for backward compatibility)
                setLeaderboard(response.leaderboard || []);
                setCurrentUserData(response.current_user_data || null);
                console.log(`✅ Loaded ${response.leaderboard?.length || 0} students`);
            } else if (response.success === false) {
                console.warn('⚠️ Leaderboard API returned success: false', response);
                setError(response?.error || response?.message || 'Failed to load leaderboard');
            } else {
                // Response exists but format is unexpected
                console.warn('⚠️ Unexpected response format:', response);
                // Try to extract data anyway
                if (Array.isArray(response.leaderboard) || Array.isArray(response)) {
                    setLeaderboard(Array.isArray(response.leaderboard) ? response.leaderboard : response);
                } else {
                    setError(response?.error || response?.message || 'Unexpected response format');
                }
            }
        } catch (err) {
            console.error('❌ Error loading leaderboard:', err);
            // Provide more specific error messages
            if (err.code === 'TIMEOUT' || err.code === 'ECONNABORTED') {
                setError('Request timed out. The server is taking too long to respond. Please try again.');
            } else if (err.code === 'NETWORK_ERROR' || err.message?.includes('Network Error')) {
                setError('Network error. Please check your connection and try again.');
            } else {
                setError(err.message || err.error || 'Failed to load leaderboard. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.push('/student');
        }
    };

    const getRankIcon = (rank) => {
        if (rank === 1) return { icon: 'trophy', color: COLORS.gold };
        if (rank === 2) return { icon: 'medal', color: COLORS.silver };
        if (rank === 3) return { icon: 'medal', color: COLORS.bronze };
        return null;
    };

    const getRankColor = (rank) => {
        if (rank === 1) return COLORS.gold;
        if (rank === 2) return COLORS.silver;
        if (rank === 3) return COLORS.bronze;
        return COLORS.inputBg;
    };

    const TOP_PAD = Platform.select({ ios: 70, android: (StatusBar?.currentHeight || 24) + 20 });

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={COLORS.inputBg} />
                <View style={styles.headerContainer}>
                    <TouchableOpacity 
                        style={[styles.backButton, { top: TOP_PAD }]} 
                        onPress={handleBack} 
                        activeOpacity={0.8}
                    >
                        <Ionicons name="arrow-back" size={22} color={COLORS.inputBg} />
                    </TouchableOpacity>
                    <View style={[styles.titleContainer, { paddingTop: TOP_PAD }]}>
                        <Text style={styles.headerTitle}>Leaderboard</Text>
                    </View>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.inputBg} />
                    <Text style={styles.loadingText}>Loading leaderboard...</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={COLORS.inputBg} />
                <View style={styles.headerContainer}>
                    <TouchableOpacity 
                        style={[styles.backButton, { top: TOP_PAD }]} 
                        onPress={handleBack} 
                        activeOpacity={0.8}
                    >
                        <Ionicons name="arrow-back" size={22} color={COLORS.inputBg} />
                    </TouchableOpacity>
                    <View style={[styles.titleContainer, { paddingTop: TOP_PAD }]}>
                        <Text style={styles.headerTitle}>Leaderboard</Text>
                    </View>
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={loadLeaderboard}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const studentsAhead = leaderboard.filter(s => s.rank < (currentUserData?.rank || 0));
    const studentsBehind = leaderboard.filter(s => s.rank > (currentUserData?.rank || 0));

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.inputBg} />
            <View style={styles.headerContainer}>
                <TouchableOpacity 
                    style={[styles.backButton, { top: TOP_PAD }]} 
                    onPress={handleBack} 
                    activeOpacity={0.8}
                >
                    <Ionicons name="arrow-back" size={22} color={COLORS.inputBg} />
                </TouchableOpacity>
                <View style={[styles.titleContainer, { paddingTop: TOP_PAD }]}>
                    <Text style={styles.headerTitle}>Leaderboard</Text>
                </View>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Current User Stats */}
                {currentUserData && (
                    <View style={styles.userStatsContainer}>
                        <View style={styles.userStatsCard}>
                            <Text style={styles.userStatsTitle}>Your Position</Text>
                            <View style={styles.userStatsRow}>
                                <View style={styles.userStatItem}>
                                    <Ionicons name="trophy" size={24} color={getRankColor(currentUserData.rank)} />
                                    <Text style={styles.userStatValue}>#{currentUserData.rank}</Text>
                                    <Text style={styles.userStatLabel}>Rank</Text>
                                </View>
                                <View style={styles.userStatItem}>
                                    <Ionicons name="star" size={24} color={COLORS.inputBg} />
                                    <Text style={styles.userStatValue}>{currentUserData.total_score}</Text>
                                    <Text style={styles.userStatLabel}>Total Score</Text>
                                </View>
                                <View style={styles.userStatItem}>
                                    <Ionicons name="stats-chart" size={24} color={COLORS.inputBg} />
                                    <Text style={styles.userStatValue}>{currentUserData.avg_percentage}%</Text>
                                    <Text style={styles.userStatLabel}>Avg Score</Text>
                                </View>
                            </View>
                            <View style={styles.userStatsRow}>
                                <View style={styles.userStatItem}>
                                    <Ionicons name="arrow-up" size={20} color="#FF6B6B" />
                                    <Text style={styles.userStatValue}>{studentsAhead.length}</Text>
                                    <Text style={styles.userStatLabel}>Ahead of You</Text>
                                </View>
                                <View style={styles.userStatItem}>
                                    <Ionicons name="arrow-down" size={20} color="#4ECDC4" />
                                    <Text style={styles.userStatValue}>{studentsBehind.length}</Text>
                                    <Text style={styles.userStatLabel}>Behind You</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* Leaderboard List */}
                <View style={styles.leaderboardContainer}>
                    <Text style={styles.leaderboardTitle}>All Students</Text>
                    {leaderboard.map((student, index) => {
                        const isCurrentUser = student.is_current_user;
                        const rankIcon = getRankIcon(student.rank);
                        
                        return (
                            <TouchableOpacity
                                key={student.student_id}
                                style={[
                                    styles.leaderboardItem,
                                    isCurrentUser && styles.leaderboardItemCurrent
                                ]}
                                activeOpacity={0.8}
                            >
                                <View style={styles.rankContainer}>
                                    {rankIcon ? (
                                        <Ionicons name={rankIcon.icon} size={28} color={rankIcon.color} />
                                    ) : (
                                        <Text style={[
                                            styles.rankText,
                                            { color: getRankColor(student.rank) }
                                        ]}>
                                            #{student.rank}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.studentInfo}>
                                    <Text style={[
                                        styles.studentName,
                                        isCurrentUser && styles.studentNameCurrent
                                    ]}>
                                        {student.name}
                                        {isCurrentUser && ' (You)'}
                                    </Text>
                                    <Text style={styles.studentId}>{student.student_id_field || student.email}</Text>
                                </View>
                                <View style={styles.scoreContainer}>
                                    <View style={styles.scoreItem}>
                                        <Text style={styles.scoreValue}>{student.total_score}</Text>
                                        <Text style={styles.scoreLabel}>Score</Text>
                                    </View>
                                    <View style={styles.scoreItem}>
                                        <Text style={styles.scoreValue}>{student.avg_percentage}%</Text>
                                        <Text style={styles.scoreLabel}>Avg</Text>
                                    </View>
                                    <View style={styles.scoreItem}>
                                        <Text style={styles.scoreValue}>{student.total_quizzes}</Text>
                                        <Text style={styles.scoreLabel}>Quizzes</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
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
    headerContainer: {
        padding: 20,
        backgroundColor: COLORS.bg,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
        width: 40,
        height: 40,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.inputBg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 5,
        position: 'absolute',
        left: 20,
        zIndex: 1000,
    },
    titleContainer: {
        width: '100%',
        paddingLeft: 60,
        paddingRight: 60,
    },
    headerTitle: {
        fontFamily: 'Griffter',
        fontSize: 28,
        color: COLORS.inputBg,
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: COLORS.link,
        fontFamily: 'Outfit',
    },
    errorText: {
        fontSize: 16,
        color: '#FF6B6B',
        fontFamily: 'Outfit',
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: COLORS.inputBg,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: COLORS.buttonText,
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    contentContainer: {
        paddingBottom: 20,
    },
    userStatsContainer: {
        marginBottom: 20,
    },
    userStatsCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
    },
    userStatsTitle: {
        fontFamily: 'Griffter',
        fontSize: 20,
        color: COLORS.inputBg,
        marginBottom: 16,
        textAlign: 'center',
    },
    userStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    userStatItem: {
        alignItems: 'center',
        flex: 1,
    },
    userStatValue: {
        fontFamily: 'Outfit',
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.inputBg,
        marginTop: 8,
    },
    userStatLabel: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.link,
        marginTop: 4,
    },
    leaderboardContainer: {
        marginTop: 10,
    },
    leaderboardTitle: {
        fontFamily: 'Griffter',
        fontSize: 22,
        color: COLORS.inputBg,
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    leaderboardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 3,
    },
    leaderboardItemCurrent: {
        backgroundColor: '#F0F8FF',
        borderColor: COLORS.inputBg,
        borderWidth: 3,
    },
    rankContainer: {
        width: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankText: {
        fontFamily: 'Griffter',
        fontSize: 20,
        fontWeight: '700',
    },
    studentInfo: {
        flex: 1,
        marginLeft: 12,
    },
    studentName: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.inputBg,
        marginBottom: 4,
    },
    studentNameCurrent: {
        color: COLORS.inputBg,
        fontWeight: '700',
    },
    studentId: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.link,
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    scoreItem: {
        alignItems: 'center',
        minWidth: 50,
    },
    scoreValue: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.inputBg,
    },
    scoreLabel: {
        fontFamily: 'Outfit',
        fontSize: 10,
        color: COLORS.link,
        marginTop: 2,
    },
});
