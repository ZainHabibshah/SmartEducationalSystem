import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';
import { getAchievementById } from '../../data/achievements';

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

export default function AdminLeaderboardScreen() {
    const router = useRouter();
    const [leaderboard, setLeaderboard] = useState([]);
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
            console.log('🔄 Loading admin leaderboard...');
            const response = await apiService.getAdminLeaderboard();
            console.log('✅ Admin leaderboard response:', response);
            
            // Check if response is valid
            if (!response) {
                console.warn('⚠️ Empty response from admin leaderboard API');
                setError('Empty response from server. Please try again.');
                return;
            }

            if (response.success === true || response.success === undefined) {
                // Accept response even if success flag is missing (for backward compatibility)
                setLeaderboard(response.leaderboard || []);
                console.log(`✅ Loaded ${response.leaderboard?.length || 0} students`);
            } else if (response.success === false) {
                console.warn('⚠️ Admin leaderboard API returned success: false', response);
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
            console.error('❌ Error loading admin leaderboard:', err);
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
            AsyncStorage.getItem('user_role')
                .then(() => router.push('/admin'))
                .catch(() => router.push('/admin'));
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
                        <Text style={styles.headerTitle}>Achievement Leaderboard</Text>
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
                        <Text style={styles.headerTitle}>Achievement Leaderboard</Text>
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
                    <Text style={styles.headerTitle}>Achievement Leaderboard</Text>
                </View>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Summary Stats */}
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryCard}>
                        <Ionicons name="people" size={24} color={COLORS.inputBg} />
                        <Text style={styles.summaryValue}>{leaderboard.length}</Text>
                        <Text style={styles.summaryLabel}>Total Students</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Ionicons name="trophy" size={24} color={COLORS.gold} />
                        <Text style={styles.summaryValue}>
                            {leaderboard.filter(s => s.achievement_score > 0).length}
                        </Text>
                        <Text style={styles.summaryLabel}>With Achievements</Text>
                    </View>
                </View>

                {/* Leaderboard List */}
                <View style={styles.leaderboardContainer}>
                    <Text style={styles.leaderboardTitle}>Students Ranked by Achievements</Text>
                    {leaderboard.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="trophy-outline" size={64} color={COLORS.link} style={{ opacity: 0.5 }} />
                            <Text style={styles.emptyText}>No students yet</Text>
                        </View>
                    ) : (
                        leaderboard.map((student) => {
                            const rankIcon = getRankIcon(student.rank);
                            const achievementBadges = student.achievement_badges || [];
                            
                            return (
                                <TouchableOpacity
                                    key={student.student_id}
                                    style={styles.leaderboardItem}
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
                                        <Text style={styles.studentName}>{student.name}</Text>
                                        <Text style={styles.studentId}>{student.student_id_field || student.email}</Text>
                                        {/* Achievement Badges Preview */}
                                        {achievementBadges.length > 0 && (
                                            <View style={styles.badgesPreview}>
                                                {achievementBadges.slice(0, 5).map((badgeId) => {
                                                    const achievement = getAchievementById(badgeId);
                                                    if (!achievement) return null;
                                                    return (
                                                        <View
                                                            key={badgeId}
                                                            style={[
                                                                styles.badgePreview,
                                                                {
                                                                    backgroundColor: `${achievement.color}CC`,
                                                                    borderColor: achievement.color,
                                                                }
                                                            ]}
                                                        >
                                                            <Ionicons
                                                                name={achievement.icon}
                                                                size={14}
                                                                color={achievement.color}
                                                            />
                                                        </View>
                                                    );
                                                })}
                                                {achievementBadges.length > 5 && (
                                                    <Text style={styles.moreBadgesText}>
                                                        {`+{achievementBadges.length - 5}`}
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.scoreContainer}>
                                        <View style={styles.scoreItem}>
                                            <Ionicons name="trophy" size={20} color={getRankColor(student.rank)} />
                                            <Text style={[styles.scoreValue, { color: getRankColor(student.rank) }]}>
                                                {student.achievement_score}
                                            </Text>
                                            <Text style={styles.scoreLabel}>Achievements</Text>
                                        </View>
                                        <View style={styles.scoreItem}>
                                            <Text style={styles.scoreValue}>{student.total_quizzes}</Text>
                                            <Text style={styles.scoreLabel}>Quizzes</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
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
    summaryContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 12,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    summaryValue: {
        fontFamily: 'Griffter',
        fontSize: 28,
        color: COLORS.inputBg,
        marginTop: 8,
        fontWeight: '700',
    },
    summaryLabel: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.link,
        marginTop: 4,
        textAlign: 'center',
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
    studentId: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.link,
        marginBottom: 8,
    },
    badgesPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 4,
    },
    badgePreview: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    moreBadgesText: {
        fontFamily: 'Outfit',
        fontSize: 10,
        color: COLORS.link,
        marginLeft: 4,
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    scoreItem: {
        alignItems: 'center',
        minWidth: 60,
    },
    scoreValue: {
        fontFamily: 'Outfit',
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.inputBg,
        marginTop: 4,
    },
    scoreLabel: {
        fontFamily: 'Outfit',
        fontSize: 10,
        color: COLORS.link,
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.link,
        marginTop: 16,
        opacity: 0.7,
    },
});
