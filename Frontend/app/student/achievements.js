import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Dimensions, ScrollView, StatusBar, StyleSheet, Text, View, TouchableOpacity, Modal, ActivityIndicator, Platform, Pressable } from 'react-native';
import BottomNav from '../../components/BottomNav';
import { ACHIEVEMENTS } from '../../data/achievements';
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
};

export default function StudentAchievementsScreen() {
    const router = useRouter();
    const [selectedAchievement, setSelectedAchievement] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [unlockedBadges, setUnlockedBadges] = useState(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUnlockedBadges();
    }, []);

    const loadUnlockedBadges = async () => {
        try {
            setLoading(true);
            // First check and update achievements based on latest quiz history
            await apiService.checkAndUpdateAchievements();
            // Then get the updated badges
            const response = await apiService.getStudentAchievements();
            if (response && response.badges) {
                setUnlockedBadges(new Set(response.badges));
            }
        } catch (error) {
            console.error('Error loading achievements:', error);
            // Fallback: try to get achievements without checking
            try {
                const response = await apiService.getStudentAchievements();
                if (response && response.badges) {
                    setUnlockedBadges(new Set(response.badges));
                }
            } catch (fallbackError) {
                console.error('Error loading achievements (fallback):', fallbackError);
            }
        } finally {
            setLoading(false);
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

    const handleAchievementPress = (achievement) => {
        setSelectedAchievement(achievement);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setSelectedAchievement(null);
    };

    const handleBack = () => {
        console.log('🔙 Back button pressed on achievements screen');
        if (router.canGoBack()) {
            console.log('✅ Can go back, navigating back');
            router.back();
        } else {
            console.log('⚠️ Cannot go back, navigating to student dashboard');
            router.push('/student');
        }
    };

    const isUnlocked = (achievementId) => {
        return unlockedBadges.has(achievementId);
    };

    const getAchievementIcon = (achievement, iconSize = 40) => {
        const IconComponent = Ionicons;
        const iconName = achievement.icon;
        const isUnlockedAchievement = isUnlocked(achievement.id);
        
        // Use full vibrant color for completed achievements, dimmed for locked
        const iconColor = isUnlockedAchievement 
            ? achievement.color  // Full color for completed (100% opacity)
            : `${achievement.color}60`; // 60% opacity for locked
        
        return (
            <IconComponent
                name={iconName}
                size={iconSize}
                color={iconColor}
            />
        );
    };

    const renderAchievementCard = (achievement) => {
        const isUnlockedAchievement = isUnlocked(achievement.id);
        const cardSize = (width - 48) / 3; // Exactly 3 cells per row (100% of original size)
        const iconContainerSize = cardSize * 0.4; // 40% of card size
        const iconSize = iconContainerSize * 0.6; // Icon is 60% of container

        return (
            <TouchableOpacity
                key={achievement.id}
                style={[
                    styles.card,
                    {
                        width: cardSize,
                        height: cardSize,
                        opacity: isUnlockedAchievement ? 1 : 0.7,
                    },
                ]}
                onPress={() => handleAchievementPress(achievement)}
                activeOpacity={0.7}
            >
                <View style={styles.cardInner}>
                    {isUnlockedAchievement && (
                        <View style={styles.unlockedBadge}>
                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        </View>
                    )}
                    <View
                        style={[
                            styles.iconWrap,
                            {
                                width: iconContainerSize,
                                height: iconContainerSize,
                                borderRadius: iconContainerSize / 2,
                                backgroundColor: isUnlockedAchievement
                                    ? `${achievement.color}CC`  // 80% opacity for completed (very vibrant)
                                    : `${achievement.color}20`, // 12% opacity for locked
                                // 3D effect with shadows - enhanced for completed
                                shadowColor: isUnlockedAchievement ? achievement.color : '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: isUnlockedAchievement ? 0.5 : 0.1, // Increased shadow for completed
                                shadowRadius: 10,
                                elevation: isUnlockedAchievement ? 10 : 4,
                                // Border for 3D effect - full color for completed
                                borderWidth: isUnlockedAchievement ? 4 : 2,
                                borderColor: isUnlockedAchievement 
                                    ? achievement.color  // Full color border for completed
                                    : `${achievement.color}50`,
                            },
                        ]}
                    >
                        {getAchievementIcon(achievement, iconSize)}
                    </View>
                    <Text
                        style={[
                            styles.cardTitle,
                            { color: isUnlockedAchievement ? COLORS.inputBg : '#9CA3AF' },
                        ]}
                        numberOfLines={2}
                    >
                        {achievement.name}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderModal = () => {
        if (!selectedAchievement) return null;

        const isUnlockedAchievement = isUnlocked(selectedAchievement.id);

        return (
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={closeModal}
            >
                <Pressable style={styles.modalOverlay} onPress={closeModal}>
                    <Pressable style={styles.modalContent} onPress={() => {}}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalHeaderTitle}>Achievement Details</Text>
                            <TouchableOpacity onPress={closeModal} style={styles.closeButton} activeOpacity={0.8}>
                                <Ionicons name="close" size={28} color={COLORS.inputBg} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.modalScrollView}
                            contentContainerStyle={styles.modalScrollContent}
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            <View
                                style={[
                                    styles.modalIconContainer,
                                    {
                                        backgroundColor: isUnlockedAchievement
                                            ? `${selectedAchievement.color}CC`  // 80% opacity for completed (very vibrant)
                                            : `${selectedAchievement.color}20`,
                                        borderWidth: isUnlockedAchievement ? 5 : 2,
                                        borderColor: isUnlockedAchievement 
                                            ? selectedAchievement.color  // Full color for completed
                                            : `${selectedAchievement.color}50`,
                                        shadowColor: isUnlockedAchievement ? selectedAchievement.color : '#000',
                                        shadowOffset: { width: 0, height: 6 },
                                        shadowOpacity: isUnlockedAchievement ? 0.6 : 0.2, // Increased for completed
                                        shadowRadius: 15,
                                        elevation: isUnlockedAchievement ? 15 : 6,
                                    },
                                ]}
                            >
                                {getAchievementIcon(selectedAchievement, 60)}
                                {isUnlockedAchievement && (
                                    <View style={styles.unlockedLabel}>
                                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        <Text style={styles.unlockedText}>Unlocked</Text>
                                    </View>
                                )}
                            </View>

                            <Text style={styles.modalTitle}>{selectedAchievement.name}</Text>
                            <Text style={styles.modalDescription}>
                                {selectedAchievement.description}
                            </Text>

                            <View style={styles.difficultyBadge}>
                                <Text
                                    style={[
                                        styles.difficultyText,
                                        {
                                            color:
                                                selectedAchievement.difficulty === 'easy'
                                                    ? '#10B981'
                                                    : selectedAchievement.difficulty === 'medium'
                                                    ? '#F59E0B'
                                                    : '#EF4444',
                                        },
                                    ]}
                                >
                                    {selectedAchievement.difficulty.toUpperCase()}
                                </Text>
                            </View>

                            <View style={styles.tasksSection}>
                                <Text style={styles.tasksTitle}>How to Unlock:</Text>
                                {selectedAchievement.tasks.map((task, index) => (
                                    <View key={index} style={styles.taskItem}>
                                        <Ionicons
                                            name="checkmark-circle-outline"
                                            size={20}
                                            color={
                                                isUnlockedAchievement ? '#10B981' : '#6B7280'
                                            }
                                        />
                                        <Text
                                            style={[
                                                styles.taskText,
                                                {
                                                    color: isUnlockedAchievement
                                                        ? COLORS.inputBg
                                                        : '#6B7280',
                                                },
                                            ]}
                                        >
                                            {task}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={styles.modalDoneButton}
                                onPress={closeModal}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.modalDoneButtonText}>Done</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        );
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
                        <Text style={styles.headerTitle}>Achievements</Text>
                    </View>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.inputBg} />
                    <Text style={styles.loadingText}>Loading achievements...</Text>
                </View>
                <BottomNav
                    onPressHome={() => handleBottomPress('home')}
                    onPressNotifications={() => handleBottomPress('bell')}
                    onPressChatbot={() => handleBottomPress('chat')}
                    onPressSettings={() => handleBottomPress('settings')}
                />
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
                    <Text style={styles.headerTitle}>Achievements</Text>
                </View>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{unlockedBadges.size}</Text>
                        <Text style={styles.statLabel}>Unlocked</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{ACHIEVEMENTS.length - unlockedBadges.size}</Text>
                        <Text style={styles.statLabel}>Remaining</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {Math.round((unlockedBadges.size / ACHIEVEMENTS.length) * 100)}%
                        </Text>
                        <Text style={styles.statLabel}>Progress</Text>
                    </View>
                </View>

                <View style={styles.grid}>
                    {ACHIEVEMENTS.map((achievement) => renderAchievementCard(achievement))}
                </View>
                <View style={{ height: 24 }} />
            </ScrollView>

            {renderModal()}

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
        paddingBottom: height * 0.16,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: COLORS.link,
        fontFamily: 'Outfit',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    contentContainer: {
        paddingBottom: height * 0.16 + 20,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.inputBg,
        marginBottom: 4,
        fontFamily: 'Griffter',
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.link,
        textTransform: 'uppercase',
        fontFamily: 'Outfit',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 4,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
    },
    cardInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        position: 'relative',
    },
    unlockedBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 1,
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        // 3D effect styling will be applied inline based on card size
    },
    cardTitle: {
        fontFamily: 'Outfit',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        maxHeight: '88%',
        minHeight: '70%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#F8FAFC',
    },
    modalHeaderTitle: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.inputBg,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    modalScrollView: {
        flex: 1,
    },
    modalScrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 28,
    },
    modalIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 20,
        position: 'relative',
    },
    unlockedLabel: {
        position: 'absolute',
        bottom: -8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    unlockedText: {
        marginLeft: 4,
        fontSize: 12,
        fontWeight: '600',
        color: '#10B981',
        fontFamily: 'Outfit',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.inputBg,
        textAlign: 'center',
        marginBottom: 8,
        fontFamily: 'Griffter',
    },
    modalDescription: {
        fontSize: 16,
        color: COLORS.link,
        textAlign: 'center',
        marginBottom: 16,
        fontFamily: 'Outfit',
    },
    difficultyBadge: {
        alignSelf: 'center',
        backgroundColor: COLORS.bg,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 24,
    },
    difficultyText: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        fontFamily: 'Outfit',
    },
    tasksSection: {
        marginTop: 8,
    },
    tasksTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.inputBg,
        marginBottom: 16,
        fontFamily: 'Griffter',
    },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        paddingRight: 8,
    },
    taskText: {
        flex: 1,
        fontSize: 14,
        marginLeft: 12,
        lineHeight: 20,
        fontFamily: 'Outfit',
    },
    modalDoneButton: {
        marginTop: 18,
        backgroundColor: COLORS.inputBg,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    modalDoneButtonText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});
