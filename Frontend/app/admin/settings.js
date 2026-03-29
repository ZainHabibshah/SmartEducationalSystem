import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import BottomNav from '../../components/BottomNav';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/apiService';

const COLORS = {
    bg: '#F5F5F5',
    heading: '#03045e',
    inputBg: '#03045e',
    inputText: '#FFFFFF',
    buttonBg: '#03045e',
    buttonText: '#FFFFFF',
    border: '#DDE8D8',
};

export default function SettingsScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadAdminProfile();
    }, []);

    const loadAdminProfile = async () => {
        try {
            const adminName = await AsyncStorage.getItem('admin_name') || '';
            const adminEmail = await AsyncStorage.getItem('admin_email') || '';
            const adminAddress = await AsyncStorage.getItem('admin_address') || '';

            setName(adminName);
            setEmail(adminEmail);
            setAddress(adminAddress);
        } catch (error) {
            console.error('Error loading admin profile:', error);
            Alert.alert('Error', 'Failed to load profile data');
        } finally {
            setIsLoading(false);
        }
    };

    const go = (key) => {
        if (key === 'home') router.push('/admin');
        if (key === 'bell') router.push('/admin/notification');
        if (key === 'chatbot') router.push('/admin/chatbot');
        if (key === 'settings') router.push('/admin/settings');
    };

    const handleSaveProfile = async () => {
        if (!name || !email) {
            Alert.alert('Error', 'Name and email are required');
            return;
        }

        setIsSaving(true);
        try {
            const result = await apiService.updateProfile({ name, email, address });
            
            if (result && result.message) {
                // Update AsyncStorage with new data
                await AsyncStorage.setItem('admin_name', name);
                await AsyncStorage.setItem('admin_email', email);
                await AsyncStorage.setItem('admin_address', address);

                Alert.alert('Success', 'Profile updated successfully!');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', error.response?.data?.error || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = () => {
        if (!currentPassword || !newPassword || newPassword !== confirmPassword) return;
        // TODO: integrate with backend
        console.log('Change password');
    };

    const handleLogout = async () => {
        try {
            // Clear all stored admin data
            await AsyncStorage.multiRemove([
                'auth_token',
                'user_role',
                'admin_name',
                'admin_email',
                'admin_course',
                'admin_id',
                'admin_address',
            ]);
            
            Alert.alert('Success', 'Logged out successfully');
            router.replace('/');
        } catch (error) {
            console.error('Error during logout:', error);
            router.replace('/');
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.inputBg} />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
                        <Ionicons name="chevron-back" size={24} color={COLORS.inputBg} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Settings</Text>
                    <View style={{ width: 44 }} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Profile</Text>
                    <Text style={styles.infoText}>Your current profile information. Click on any field to edit.</Text>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput 
                            style={styles.input} 
                            value={name} 
                            onChangeText={setName} 
                            placeholder="Your name" 
                            placeholderTextColor="#A9B8A8"
                            editable={!isSaving}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput 
                            style={styles.input} 
                            value={email} 
                            onChangeText={setEmail} 
                            placeholder="you@example.com" 
                            placeholderTextColor="#A9B8A8" 
                            autoCapitalize="none" 
                            keyboardType="email-address"
                            editable={!isSaving}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Address</Text>
                        <TextInput 
                            style={styles.input} 
                            value={address} 
                            onChangeText={setAddress} 
                            placeholder="Street, City" 
                            placeholderTextColor="#A9B8A8"
                            editable={!isSaving}
                        />
                    </View>
                    <TouchableOpacity 
                        style={[styles.primaryBtn, isSaving && styles.disabledBtn]} 
                        onPress={handleSaveProfile} 
                        activeOpacity={0.9}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color={COLORS.buttonText} />
                        ) : (
                            <Text style={styles.primaryBtnText}>Save Profile</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Change Password</Text>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Current Password</Text>
                        <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" placeholderTextColor="#A9B8A8" secureTextEntry />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>New Password</Text>
                        <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor="#A9B8A8" secureTextEntry />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirm New Password</Text>
                        <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor="#A9B8A8" secureTextEntry />
                    </View>
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleChangePassword} activeOpacity={0.9}>
                        <Text style={styles.primaryBtnText}>Update Password</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.9}>
                    <Ionicons name="log-out" size={18} color={COLORS.buttonBg} style={{ marginRight: 8 }} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <View style={{ height: 140 }} />
            </ScrollView>
            <BottomNav
                onPressHome={() => go('home')}
                onPressNotifications={() => go('bell')}
                onPressChatbot={() => go('chatbot')}
                onPressSettings={() => go('settings')}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    loadingContainer: { 
        flex: 1, 
        backgroundColor: COLORS.bg, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    loadingText: { 
        fontFamily: 'Outfit', 
        fontSize: 16, 
        color: COLORS.heading, 
        marginTop: 12 
    },
    content: { padding: 20, paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 32) : 24) + 12 },
    header: {
        height: 56,
        backgroundColor: 'transparent',
        borderRadius: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        marginTop: 0,
        marginBottom: 8,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: COLORS.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontFamily: 'Griffter',
        fontSize: 20,
        color: COLORS.inputBg,
        textAlign: 'center',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 6,
        marginBottom: 16,
    },
    sectionTitle: {
        fontFamily: 'Griffter',
        fontSize: 18,
        color: COLORS.inputBg,
        marginBottom: 8,
    },
    infoText: {
        fontFamily: 'Outfit',
        fontSize: 13,
        color: '#666',
        marginBottom: 12,
        fontStyle: 'italic',
    },
    inputGroup: { marginBottom: 12 },
    label: { fontFamily: 'Outfit', fontSize: 14, color: COLORS.heading, marginBottom: 6 },
    input: {
        height: 48,
        backgroundColor: '#F8F9FA',
        borderRadius: 14,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        fontFamily: 'Outfit',
        color: COLORS.heading,
    },
    primaryBtn: {
        marginTop: 6,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.buttonBg,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    disabledBtn: {
        backgroundColor: '#A9B8C8',
        opacity: 0.7,
    },
    primaryBtnText: { fontFamily: 'Outfit', fontSize: 16, color: COLORS.buttonText, fontWeight: '600' },
    logoutBtn: {
        marginTop: 8,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        borderWidth: 2,
        borderColor: COLORS.inputBg,
    },
    logoutText: { fontFamily: 'Outfit', fontSize: 16, color: COLORS.inputBg, fontWeight: '600' },
});


