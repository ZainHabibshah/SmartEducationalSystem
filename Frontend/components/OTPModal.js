import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../constants/colors';

const { width, height } = Dimensions.get('window');

export default function OTPModal({ 
    visible, 
    onClose, 
    onVerify,
    onResend,
    type = 'delete', // 'delete', 'add', or 'reset'
    studentName = ''
}) {
    const [otp, setOtp] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0);
            fadeAnim.setValue(0);
            slideAnim.setValue(50);
            setOtp('');
            setIsVerifying(false);
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    };

    const handleVerify = async () => {
        if (otp.length !== 6 || isVerifying) return;
        setIsVerifying(true);
        try {
            await onVerify?.(otp);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResendOTP = () => {
        onResend?.();
    };

    const getTitle = () => {
        if (type === 'delete') {
            return 'Delete Student';
        } else if (type === 'add') {
            return 'Add Student';
        } else if (type === 'reset') {
            return 'Reset Password';
        } else if (type === 'adminLogin') {
            return 'Admin Login';
        }
        return 'OTP Verification';
    };

    const getMessage = () => {
        if (type === 'delete') {
            return `Are you sure you want to delete ${studentName}? This action cannot be undone.`;
        } else if (type === 'add') {
            return 'An OTP has been sent to your Admin email address. Please check your inbox and enter the 6-digit code below to verify your identity and add the student.';
        } else if (type === 'reset') {
            return 'Please enter the OTP sent to your email to reset your password.';
        } else if (type === 'adminLogin') {
            return 'Please enter the OTP sent to your admin email to continue.';
        }
        return 'Please enter the OTP sent to your registered mobile number.';
    };

    const getButtonText = () => {
        if (type === 'delete') {
            return 'Delete Student';
        } else if (type === 'add') {
            return 'Continue to Add';
        } else if (type === 'reset') {
            return 'Verify OTP';
        } else if (type === 'adminLogin') {
            return 'Verify OTP';
        }
        return 'Verify';
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={handleClose}
        >
            <Animated.View 
                style={[
                    styles.overlay,
                    { opacity: fadeAnim }
                ]}
            >
                <Animated.View 
                    style={[
                        styles.modalContainer,
                        {
                            transform: [
                                { scale: scaleAnim },
                                { translateY: slideAnim }
                            ],
                        }
                    ]}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Ionicons 
                                name={type === 'delete' ? 'warning' : 'shield-checkmark'} 
                                size={32} 
                                color={type === 'delete' ? '#F44336' : COLORS.inputBg} 
                            />
                        </View>
                        <Text style={styles.title}>{getTitle()}</Text>
                    </View>

                    {/* Message */}
                    <Text style={styles.message}>{getMessage()}</Text>

                    {/* OTP Input */}
                    <View style={styles.otpContainer}>
                        <Text style={styles.otpLabel}>Enter OTP:</Text>
                        <TextInput
                            style={styles.otpInput}
                            value={otp}
                            onChangeText={setOtp}
                            placeholder="000000"
                            placeholderTextColor={COLORS.link}
                            keyboardType="numeric"
                            maxLength={6}
                            textAlign="center"
                        />
                        <TouchableOpacity 
                            style={styles.resendButton}
                            onPress={handleResendOTP}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.resendButtonText}>Resend OTP</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity 
                            style={styles.cancelButton}
                            onPress={handleClose}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[
                                styles.verifyButton,
                                { opacity: otp.length === 6 ? 1 : 0.5 }
                            ]}
                            onPress={handleVerify}
                            disabled={otp.length !== 6 || isVerifying}
                            activeOpacity={0.8}
                        >
                            {isVerifying ? (
                                <Text style={styles.verifyButtonText}>Verifying...</Text>
                            ) : (
                                <Text style={styles.verifyButtonText}>{getButtonText()}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 25,
        padding: 30,
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F0F8F0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    title: {
        fontFamily: 'Griffter',
        fontSize: 24,
        color: COLORS.inputBg,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    message: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.link,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 25,
    },
    otpContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 25,
    },
    otpLabel: {
        fontFamily: 'Griffter',
        fontSize: 16,
        color: COLORS.inputBg,
        marginBottom: 10,
    },
    otpInput: {
        fontFamily: 'Outfit',
        fontSize: 24,
        color: COLORS.inputBg,
        backgroundColor: '#F8F9FA',
        borderRadius: 15,
        paddingVertical: 15,
        paddingHorizontal: 20,
        width: '100%',
        textAlign: 'center',
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        marginBottom: 15,
    },
    resendButton: {
        paddingVertical: 8,
        paddingHorizontal: 15,
    },
    resendButtonText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.link,
        textDecorationLine: 'underline',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    cancelButton: {
        backgroundColor: '#E0E0E0',
        paddingVertical: 12,
        paddingHorizontal: 25,
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
    verifyButton: {
        backgroundColor: COLORS.inputBg,
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 15,
        flex: 0.45,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    verifyButtonText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.buttonText,
        fontWeight: '600',
    },
});
