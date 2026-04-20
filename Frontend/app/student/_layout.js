import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import apiService from '../../services/apiService';
import { getAchievementById } from '../../data/achievements';

export default function StudentLayout() {
    const [badgeQueue, setBadgeQueue] = useState([]);
    const [activeBadgeId, setActiveBadgeId] = useState(null);

    const activeBadge = useMemo(() => {
        if (!activeBadgeId) return null;
        return getAchievementById(activeBadgeId);
    }, [activeBadgeId]);

    const closeUnlockModal = useCallback(() => {
        setBadgeQueue((prev) => {
            if (prev.length <= 1) {
                setActiveBadgeId(null);
                return [];
            }
            const rest = prev.slice(1);
            setActiveBadgeId(rest[0] || null);
            return rest;
        });
    }, []);

    const checkForNewAchievements = useCallback(async () => {
        try {
            const result = await apiService.checkAndUpdateAchievements();
            const newlyUnlocked = (result?.newBadges || []).filter(Boolean);
            if (!newlyUnlocked.length) return;

            setBadgeQueue((prev) => {
                const deduped = Array.from(new Set([...prev, ...newlyUnlocked]));
                if (!activeBadgeId && deduped.length > 0) {
                    setActiveBadgeId(deduped[0]);
                }
                return deduped;
            });
        } catch (error) {
            // Silent fail: this runs globally and should never block navigation.
            console.log('Achievement live-check skipped:', error?.message || error);
        }
    }, [activeBadgeId]);

    useEffect(() => {
        checkForNewAchievements();
        const intervalId = setInterval(checkForNewAchievements, 15000);
        return () => clearInterval(intervalId);
    }, [checkForNewAchievements]);

    return (
        <>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="attendance" />
                <Stack.Screen name="timetable" />
                <Stack.Screen name="curriculum" />
                <Stack.Screen name="quiz" />
                <Stack.Screen name="achievements" />
                <Stack.Screen name="chatbot" />
                <Stack.Screen name="notification" />
                <Stack.Screen name="settings" />
            </Stack>

            <Modal
                visible={!!activeBadge}
                transparent
                animationType="fade"
                onRequestClose={closeUnlockModal}
            >
                <View style={styles.overlay}>
                    <View style={styles.card}>
                        <View style={styles.iconWrap}>
                            <Ionicons
                                name={activeBadge?.icon || 'trophy'}
                                size={42}
                                color={activeBadge?.color || '#10B981'}
                            />
                        </View>
                        <Text style={styles.title}>Congratulations!</Text>
                        <Text style={styles.badgeName}>{activeBadge?.name || 'Achievement Unlocked'}</Text>
                        <Text style={styles.message}>You have completed a new achievement.</Text>

                        <TouchableOpacity style={styles.button} onPress={closeUnlockModal} activeOpacity={0.85}>
                            <Text style={styles.buttonText}>Awesome</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#fff',
        borderRadius: 20,
        paddingHorizontal: 22,
        paddingVertical: 24,
        alignItems: 'center',
    },
    iconWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1F5F9',
        marginBottom: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#03045e',
        marginBottom: 6,
    },
    badgeName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#023e8a',
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 15,
        color: '#334155',
        textAlign: 'center',
        marginBottom: 18,
    },
    button: {
        width: '100%',
        backgroundColor: '#03045e',
        borderRadius: 12,
        paddingVertical: 13,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});


