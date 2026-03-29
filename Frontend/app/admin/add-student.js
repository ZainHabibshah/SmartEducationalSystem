import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import OTPModal from '../../components/OTPModal';
import UploadConfirmationModal from '../../components/UploadConfirmationModal';
import { COLORS } from '../../constants/colors';
import apiService from '../../services/apiService';

const { width, height } = Dimensions.get('window');

export default function AddStudentScreen() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        fullName: '',
        fatherName: '',
        address: '',
        pastSchool: '',
        phoneNumber: '',
        email: '',
        password: '',
    });
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [confirmationVariant, setConfirmationVariant] = useState('success'); // 'success' | 'error'
    const [confirmationTitle, setConfirmationTitle] = useState('Student Added Successfully');
    const [confirmationMessage, setConfirmationMessage] = useState('The new student has been added to the system successfully!');
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [isRequestingOtp, setIsRequestingOtp] = useState(false);
    const [pendingFormData, setPendingFormData] = useState(null);
    const navigationTimeoutRef = useRef(null);
    
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
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

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async () => {
        // Validate required fields
        if (!formData.fullName.trim() || !formData.fatherName.trim() || !formData.email.trim() || !formData.phoneNumber.trim() || !formData.password.trim()) {
            setConfirmationVariant('error');
            setConfirmationTitle('Submission Rejected');
            setConfirmationMessage('Please fill in all required fields (Full Name, Father Name, Email, Phone Number, Password).');
            setShowConfirmationModal(true);
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) {
            setConfirmationVariant('error');
            setConfirmationTitle('Submission Rejected');
            setConfirmationMessage('Please enter a valid email address.');
            setShowConfirmationModal(true);
            return;
        }

        // Validate phone number format
        const phoneRegex = /^\+92-\d{3}-\d{7}$/;
        if (!phoneRegex.test(formData.phoneNumber.trim())) {
            setConfirmationVariant('error');
            setConfirmationTitle('Submission Rejected');
            setConfirmationMessage('Please enter phone number in format: +92-XXX-XXXXXXX');
            setShowConfirmationModal(true);
            return;
        }

        // Validate password length
        if (formData.password.trim().length < 6) {
            setConfirmationVariant('error');
            setConfirmationTitle('Submission Rejected');
            setConfirmationMessage('Password must be at least 6 characters long.');
            setShowConfirmationModal(true);
            return;
        }

        // Store form data for later submission after OTP verification
        // IMPORTANT: Don't trim password - preserve it as-is to avoid any issues
        const payload = {
            full_name: formData.fullName.trim(),
            father_name: formData.fatherName.trim(),
            address: formData.address.trim(),
            past_school: formData.pastSchool.trim(),
            phone: formData.phoneNumber.trim(),
            email: formData.email.trim(),
            password: formData.password, // Don't trim password - keep original
        };
        
        // Validate password one more time before storing
        if (!payload.password || payload.password.length < 6) {
            setConfirmationVariant('error');
            setConfirmationTitle('Submission Rejected');
            setConfirmationMessage(`Password must be at least 6 characters long. Current length: ${payload.password?.length || 0}`);
            setShowConfirmationModal(true);
            return;
        }
        
        console.log('💾 Storing pending form data with password length:', payload.password.length);
        setPendingFormData(payload);

        // Request OTP before proceeding
        await handleRequestOtp();
    };

    const handleRequestOtp = async () => {
        setIsRequestingOtp(true);
        try {
            console.log('📧 Requesting OTP for add_student operation...');
            const result = await apiService.requestOperationOtp('add_student');
            console.log('✅ OTP request successful:', result);
            // Show OTP modal immediately - user will see message in modal
            console.log('🔔 Setting showOtpModal to true');
            setShowOtpModal(true);
            console.log('✅ OTP modal should now be visible');
        } catch (error) {
            console.error('❌ OTP request error:', error);
            console.error('Error details:', {
                error: error?.error,
                message: error?.message,
                response: error?.response?.data,
                status: error?.response?.status,
                code: error?.code,
            });
            
            // Check if it's a timeout error - email might still be sent
            if (error?.code === 'TIMEOUT_ERROR' || error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
                // Even if timeout, show OTP modal because email was likely sent
                console.log('⏱️ Request timed out, but OTP email may have been sent. Showing OTP modal...');
                setShowOtpModal(true);
                return;
            }
            
            setConfirmationVariant('error');
            setConfirmationTitle('OTP Request Failed');
            
            // Better error message extraction
            let errorMsg = 'Failed to send OTP. Please try again.';
            if (error?.response?.data?.error) {
                errorMsg = error.response.data.error;
            } else if (error?.error) {
                errorMsg = error.error;
            } else if (error?.message) {
                errorMsg = error.message;
            } else if (typeof error === 'string') {
                errorMsg = error;
            }
            
            // Check for network errors
            if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
                errorMsg = 'Cannot connect to server. Please check your internet connection and ensure the backend is running.';
            }
            
            // Check for authentication errors
            if (error?.response?.status === 401 || error?.response?.status === 403) {
                errorMsg = 'Authentication failed. Please log in again.';
            }
            
            setConfirmationMessage(errorMsg);
            setShowConfirmationModal(true);
            setPendingFormData(null);
        } finally {
            setIsRequestingOtp(false);
        }
    };

    const handleOtpVerify = async (otp) => {
        if (!pendingFormData) {
            setShowOtpModal(false);
            return;
        }

        if (!otp || otp.length !== 6) {
            setConfirmationVariant('error');
            setConfirmationTitle('Invalid OTP');
            setConfirmationMessage('Please enter a valid 6-digit OTP.');
            setShowConfirmationModal(true);
            return;
        }

        try {
            console.log('🔐 Verifying OTP and registering student...');
            console.log('📋 Pending form data:', {
                ...pendingFormData,
                password: pendingFormData.password ? `${pendingFormData.password.substring(0, 2)}***` : 'MISSING',
                passwordLength: pendingFormData.password?.length || 0
            });
            
            // Ensure password is present and has correct length
            if (!pendingFormData.password || pendingFormData.password.trim().length < 6) {
                console.error('❌ Password validation failed:', {
                    password: pendingFormData.password ? 'present' : 'missing',
                    length: pendingFormData.password?.length || 0
                });
                setConfirmationVariant('error');
                setConfirmationTitle('Submission Rejected');
                setConfirmationMessage('Password must be at least 6 characters long. Please go back and check your form.');
                setShowOtpModal(false);
                setPendingFormData(null);
                setShowConfirmationModal(true);
                return;
            }
            
            // Submit student registration with OTP - backend will verify OTP automatically
            const registrationPayload = {
                ...pendingFormData,
                otp: otp,
            };
            
            console.log('📤 Sending registration request with payload:', {
                ...registrationPayload,
                password: registrationPayload.password ? `${registrationPayload.password.substring(0, 2)}***` : 'MISSING'
            });
            
            const result = await apiService.registerStudent(registrationPayload);

            console.log('✅ Student registered successfully:', result);
            
            // Close OTP modal first
            setShowOtpModal(false);
            setPendingFormData(null);
            
            // Clear form data
            setFormData({
                fullName: '',
                fatherName: '',
                address: '',
                pastSchool: '',
                phoneNumber: '',
                email: '',
                password: '',
            });
            
            // Set confirmation modal content
            setConfirmationVariant('success');
            setConfirmationTitle('Student Added Successfully!');
            const courseName = result.course_display_name || result.course || 'your course';
            setConfirmationMessage(
                `Student has been added successfully to ${courseName}.\n\nRegistration No: ${result.registration_number}\n\nA welcome email with login credentials has been sent to the student.`
            );
            
            // Small delay to ensure OTP modal is fully closed before showing confirmation modal
            setTimeout(() => {
                setShowConfirmationModal(true);
            }, 300);
        } catch (error) {
            console.error('❌ Student registration error:', error);
            console.error('Error details:', {
                error: error?.error,
                message: error?.message,
                response: error?.response?.data,
                status: error?.response?.status,
            });
            
            setConfirmationVariant('error');
            setConfirmationTitle('Submission Rejected');
            
            // Better error message extraction
            let errorMsg = 'Failed to add student. Please try again.';
            if (error?.response?.data?.error) {
                errorMsg = error.response.data.error;
            } else if (error?.error) {
                errorMsg = error.error;
            } else if (error?.message) {
                errorMsg = error.message;
            } else if (typeof error === 'string') {
                errorMsg = error;
            }
            
            // Check for OTP-specific errors
            if (errorMsg.includes('OTP') || errorMsg.includes('otp')) {
                // Keep OTP modal open for OTP errors
                setConfirmationMessage(errorMsg + '\n\nPlease check your OTP and try again, or resend OTP.');
            } else {
                // Close OTP modal for other errors
                setShowOtpModal(false);
                setPendingFormData(null);
            }
            
            setShowConfirmationModal(true);
        }
    };

    const handleOtpResend = async () => {
        await handleRequestOtp();
    };

    const handleOtpClose = () => {
        setShowOtpModal(false);
        setPendingFormData(null);
    };

    const handleCancel = () => {
        Alert.alert(
            'Discard Form',
            'Are you sure you want to discard this form? All entered data will be lost.',
            [
                { text: 'Keep Editing', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => router.back() }
            ]
        );
    };

    const handleConfirmationClose = () => {
        // Clear the auto-navigation timeout if modal is closed manually
        if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
            navigationTimeoutRef.current = null;
        }
        
        setShowConfirmationModal(false);
        // Always navigate to students list after closing confirmation modal (whether success or error)
        // This ensures admin sees the updated student list
        router.push('/admin/students');
    };

    // OTP flow removed for add-student; backend is protected by admin JWT.

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
                    onPress={handleCancel}
                    activeOpacity={0.8}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.buttonText} />
                </TouchableOpacity>
                
                <Text style={styles.headerTitle}>Add New Student</Text>

            </Animated.View>

            {/* Form */}
            <ScrollView 
                style={styles.formContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.formContent}
            >
                <Animated.View 
                    style={[
                        styles.formCard,
                        {
                            opacity: fadeAnim,
                        }
                    ]}
                >
                    {/* Full Name */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Full Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.fullName}
                            onChangeText={(value) => handleInputChange('fullName', value)}
                            placeholder="Enter full name"
                            placeholderTextColor={COLORS.link}
                        />
                    </View>

                    {/* Father Name */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Father Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.fatherName}
                            onChangeText={(value) => handleInputChange('fatherName', value)}
                            placeholder="Enter father's name"
                            placeholderTextColor={COLORS.link}
                        />
                    </View>

                    {/* Address */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Address</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.address}
                            onChangeText={(value) => handleInputChange('address', value)}
                            placeholder="Enter address"
                            placeholderTextColor={COLORS.link}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* Past School */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Past School</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.pastSchool}
                            onChangeText={(value) => handleInputChange('pastSchool', value)}
                            placeholder="Enter previous school name"
                            placeholderTextColor={COLORS.link}
                        />
                    </View>

                    {/* Phone Number */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Phone Number *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.phoneNumber}
                            onChangeText={(value) => handleInputChange('phoneNumber', value)}
                            placeholder="+92-XXX-XXXXXXX"
                            placeholderTextColor={COLORS.link}
                            keyboardType="phone-pad"
                        />
                        <Text style={styles.helpText}>Format: +92-XXX-XXXXXXX (e.g., +92-300-1234567)</Text>
                    </View>

                    {/* Email */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.email}
                            onChangeText={(value) => handleInputChange('email', value)}
                            placeholder="Enter email address"
                            placeholderTextColor={COLORS.link}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Password */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Password *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.password}
                            onChangeText={(value) => handleInputChange('password', value)}
                            placeholder="Enter password (min 6 characters)"
                            placeholderTextColor={COLORS.link}
                            secureTextEntry
                        />
                    </View>

                    {/* Registration number is auto-generated on the backend as Class09XXX */}

                    {/* Action Buttons */}
                    <View style={styles.actionButtons}>
                        <TouchableOpacity 
                            style={styles.cancelButton}
                            onPress={handleCancel}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={styles.saveButton}
                            onPress={handleSave}
                            activeOpacity={0.8}
                            disabled={isRequestingOtp}
                        >
                            <Text style={styles.saveButtonText}>
                                {isRequestingOtp ? 'Requesting OTP...' : 'Add Student'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </ScrollView>

            {/* Confirmation Modal */}
            <UploadConfirmationModal
                visible={showConfirmationModal}
                onClose={handleConfirmationClose}
                title={confirmationTitle}
                message={confirmationMessage}
                operationType="add"
                variant={confirmationVariant}
            />

            {/* OTP Modal */}
            <OTPModal
                visible={showOtpModal}
                onClose={handleOtpClose}
                onVerify={handleOtpVerify}
                onResend={handleOtpResend}
                type="add"
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
    saveButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    formContainer: {
        flex: 1,
        padding: 20,
    },
    formContent: {
        paddingBottom: 20,
    },
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 25,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 6,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontFamily: 'Griffter',
        fontSize: 16,
        color: COLORS.inputBg,
        marginBottom: 8,
    },
    input: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.inputBg,
        backgroundColor: '#F8F9FA',
        borderRadius: 15,
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        textAlignVertical: 'top',
    },
    helpText: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.link,
        fontStyle: 'italic',
        marginTop: 5,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 30,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    cancelButton: {
        backgroundColor: '#E0E0E0',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 15,
        flex: 0.45,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: COLORS.inputBg,
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 15,
        flex: 0.45,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    saveButtonText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.buttonText,
        fontWeight: '600',
    },
});
