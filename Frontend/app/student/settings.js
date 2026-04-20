import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import BottomNav from '../../components/BottomNav';
import UploadConfirmationModal from '../../components/UploadConfirmationModal';
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

export default function StudentSettingsScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [studentId, setStudentId] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Confirmation modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [modalVariant, setModalVariant] = useState('success'); // 'success' | 'error'

    useEffect(() => {
        loadStudentProfile();
    }, []);

    const loadStudentProfile = async () => {
        try {
            setIsLoading(true);
            
            // First try to get from backend (includes actual student_id from database)
            try {
                const result = await apiService.getStudentProfile();
                if (result && result.success) {
                    setName(result.name || '');
                    setEmail(result.email || '');
                    setStudentId(result.student_id || '');
                    
                    // Update AsyncStorage with latest data
                    if (result.name) await AsyncStorage.setItem('student_name', result.name);
                    if (result.email) await AsyncStorage.setItem('student_email', result.email);
                    if (result.student_id) await AsyncStorage.setItem('student_id', result.student_id);
                    
                    return; // Successfully loaded from backend
                }
            } catch (apiError) {
                console.warn('Failed to load from backend, using AsyncStorage:', apiError);
            }
            
            // Fallback to AsyncStorage if backend fails
            const studentName = await AsyncStorage.getItem('student_name') || '';
            const studentEmail = await AsyncStorage.getItem('student_email') || '';
            const studentIdValue = await AsyncStorage.getItem('student_id') || '';

            setName(studentName);
            setEmail(studentEmail);
            setStudentId(studentIdValue);
        } catch (error) {
            console.error('Error loading student profile:', error);
            Alert.alert('Error', 'Failed to load profile data');
        } finally {
            setIsLoading(false);
        }
    };

    const showModal = (title, message, variant = 'success') => {
        setModalTitle(title);
        setModalMessage(message);
        setModalVariant(variant);
        setModalVisible(true);
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

    const handleSaveProfile = async () => {
        if (!email) {
            showModal('Error', 'Email is required', 'error');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showModal('Invalid Email', 'Please enter a valid email address', 'error');
            return;
        }

        setIsSaving(true);
        try {
            // Only send email - name and student_id are read-only
            const result = await apiService.updateProfile({ email });
            
            if (result && result.message) {
                // Update AsyncStorage with new email
                await AsyncStorage.setItem('student_email', email);
                showModal('Profile Updated', 'Your email has been updated successfully.', 'success');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showModal('Error', error.error || error.message || 'Failed to update profile', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            // Clear all stored student data
            await AsyncStorage.multiRemove([
                'auth_token',
                'user_role',
                'student_name',
                'student_email',
                'student_course',
                'student_class',
                'student_id',
            ]);
            
            showModal('Success', 'Logged out successfully', 'success');
            setTimeout(() => {
                router.replace('/');
            }, 1000);
        } catch (error) {
            console.error('Error during logout:', error);
            router.replace('/');
        }
    };

    const handleChangePassword = async () => {
        // Basic validations
        if (!currentPassword || !newPassword || !confirmPassword) {
            showModal('Missing Information', 'Please fill all password fields.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showModal('Weak Password', 'New password must be at least 6 characters.', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showModal('Password Mismatch', 'New password and confirm password do not match.', 'error');
            return;
        }

        try {
            const result = await apiService.changePassword(currentPassword, newPassword);
            if (result && result.message) {
                showModal('Password Changed', 'Your password has been updated successfully.', 'success');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            showModal('Error', error.error || error.message || 'Failed to change password', 'error');
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

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.push('/student');
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.inputBg} />
            
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={22} color={COLORS.inputBg} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                {/* Profile Information Section */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Profile</Text>
                    <Text style={styles.infoText}>Your profile information. Full Name and Student ID are assigned by admin and cannot be changed.</Text>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name</Text>
                        <TextInput
                            style={[styles.input, styles.disabledInput]}
                            value={name}
                            editable={false}
                            placeholder="Full Name"
                            placeholderTextColor="#999"
                        />
                        <Text style={styles.readOnlyHint}>Assigned by admin</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="you@example.com"
                            placeholderTextColor="#A9B8A8"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            editable={!isSaving}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Student ID</Text>
                        <TextInput
                            style={[styles.input, styles.disabledInput]}
                            value={studentId}
                            editable={false}
                            placeholder="Student ID"
                            placeholderTextColor="#999"
                        />
                        <Text style={styles.readOnlyHint}>Default ID - cannot be changed</Text>
                    </View>

                    <TouchableOpacity 
                        style={[styles.saveButton, isSaving && styles.disabledBtn]} 
                        onPress={handleSaveProfile}
                        disabled={isSaving}
                        activeOpacity={0.9}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color={COLORS.buttonText} />
                        ) : (
                            <Text style={styles.saveButtonText}>Save Profile</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Change Password Section */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Change Password</Text>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Current Password</Text>
                        <TextInput
                            style={styles.input}
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="Enter current password"
                            placeholderTextColor={COLORS.inputText}
                            secureTextEntry
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>New Password</Text>
                        <TextInput
                            style={styles.input}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="Enter new password"
                            placeholderTextColor={COLORS.inputText}
                            secureTextEntry
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Confirm New Password</Text>
                        <TextInput
                            style={styles.input}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Confirm new password"
                            placeholderTextColor={COLORS.inputText}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword}>
                        <Text style={styles.saveButtonText}>Change Password</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.9}>
                         <Ionicons name="log-out" size={18} color={COLORS.buttonBg} style={{ marginRight: 8 }} />
                         <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Navigation */}
            <BottomNav
                onPressHome={() => handleBottomPress('home')}
                onPressNotifications={() => handleBottomPress('bell')}
                onPressChatbot={() => handleBottomPress('chat')}
                onPressSettings={() => handleBottomPress('settings')}
            />

            {/* Confirmation / Error Modal */}
            <UploadConfirmationModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={modalTitle}
                message={modalMessage}
                variant={modalVariant}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: COLORS.bg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.heading,
        marginTop: 12,
    },
    header: {
        backgroundColor: COLORS.bg,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 70 : (StatusBar.currentHeight || 24) + 20,
        paddingBottom: 15,
    },
    backBtn: {
        position: 'absolute',
        left: 20,
        top: Platform.OS === 'ios' ? 70 : (StatusBar.currentHeight || 24) + 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
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
    headerTitle: {
        fontFamily: 'Griffter',
        fontSize: 28,
        color: COLORS.inputBg,
        textAlign: 'center',
    },
    backButton: {
        padding: 8,
        marginRight: 10,
    },
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
    headerTitle: {
        fontFamily: 'Outfit',
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.inputText,
        flex: 1,
    },
    headerSpacer: {
        width: 40,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 6,
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
    inputGroup: {
        marginBottom: 12,
    },
    label: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.heading,
        marginBottom: 6,
    },
    input: {
        height: 48,
        backgroundColor: '#F8F9FA',
        borderRadius: 14,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.heading,
    },
    disabledInput: {
        backgroundColor: '#F5F5F5',
        color: '#666666',
        borderColor: '#E0E0E0',
    },
    readOnlyHint: {
        fontFamily: 'Outfit',
        fontSize: 11,
        color: '#999',
        marginTop: 4,
        fontStyle: 'italic',
    },
    saveButton: {
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
    saveButtonText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.buttonText,
        fontWeight: '600',
    },
    logoutText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.inputBg,
        fontWeight: '600',
    },
});