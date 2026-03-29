import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

const COLORS = {
  bg: '#FFFFFF',
  text: '#03045e', 
  buttonBg: '#03045e',
  buttonText: '#FFFFFF',
  cancelButton: '#666666',
  inputBg: '#F5F5F5',
  border: '#03045e'   
};

export default function AdminConfirmationModal({ 
    visible, 
    onClose, 
    onConfirm,
    type = 'admin'
}) {
    const [otp, setOtp] = useState(['', '', '', '', '']);
    const [isVerifying, setIsVerifying] = useState(false);
    
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    const otpRefs = useRef(Array(5).fill(null).map(() => React.createRef()));

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
            setOtp(['', '', '', '', '']);
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

    const handleConfirm = async () => {
        if (otp.some(digit => digit === '') || isVerifying) return;
        
        setIsVerifying(true);
        try {
            const fullOtp = otp.join('');
            await onConfirm?.(fullOtp);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleOtpChange = (text, index) => {
        const sanitized = text.replace(/\D/g, '');
        const next = [...otp];
        next[index] = sanitized.slice(-1);
        setOtp(next);
        
        if (sanitized && index < 4) {
            otpRefs.current[index + 1]?.current?.focus();
        }
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.current?.focus();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={handleClose}
        >
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                <Animated.View style={[
                    styles.modalContainer,
                    {
                        transform: [
                            { scale: scaleAnim },
                            { translateY: slideAnim }
                        ],
                    }
                ]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Smart Educational</Text>
                        <Text style={styles.subtitle}>Companion</Text>
                    </View>

                    <Text style={styles.instruction}>Enter 5-digit OTP</Text>

                    <View style={styles.roleContainer}>
                        <Ionicons name="person" size={20} color={COLORS.text} />
                        <Text style={styles.roleText}>{type === 'admin' ? 'Admin' : 'Student'}</Text>
                    </View>

                    <View style={styles.otpContainer}>
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={otpRefs.current[index]}
                                style={[
                                    styles.otpInput,
                                    digit && styles.otpInputFilled
                                ]}
                                value={digit}
                                onChangeText={(text) => handleOtpChange(text, index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                keyboardType="numeric"
                                maxLength={1}
                                textAlign="center"
                                placeholder="0"
                                placeholderTextColor="#999999"
                                selectionColor={COLORS.text}
                            />
                        ))}
                    </View>

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
                                styles.confirmButton,
                                { 
                                    opacity: otp.every(digit => digit !== '') ? 1 : 0.5,
                                    backgroundColor: otp.every(digit => digit !== '') ? COLORS.buttonBg : '#999'
                                }
                            ]}
                            onPress={handleConfirm}
                            disabled={otp.some(digit => digit === '') || isVerifying}
                            activeOpacity={0.8}
                        >
                            {isVerifying ? (
                                <Text style={styles.confirmButtonText}>Verifying...</Text>
                            ) : (
                                <Text style={styles.confirmButtonText}>Confirm</Text>
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
        backgroundColor: COLORS.bg,
        borderRadius: 20,
        padding: 25,
        width: '90%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontFamily: 'Griffter',
        fontSize: 24,
        color: COLORS.text,
        fontWeight: 'bold',
    },
    subtitle: {
        fontFamily: 'Griffter',
        fontSize: 20,
        color: COLORS.text,
        fontWeight: 'bold',
    },
    instruction: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 20,
    },
    roleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    roleText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.text,
        marginLeft: 10,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 25,
    },
    otpInput: {
        width: 45,
        height: 45,
        backgroundColor: COLORS.inputBg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        color: COLORS.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    otpInputFilled: {
        borderWidth: 2,
        borderColor: COLORS.buttonBg,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    cancelButton: {
        backgroundColor: COLORS.cancelButton,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        flex: 0.48,
    },
    cancelButtonText: {
        color: '#FFFFFF',
        textAlign: 'center',
        fontWeight: '600',
    },
    confirmButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        flex: 0.48,
    },
    confirmButtonText: {
        color: '#FFFFFF',
        textAlign: 'center',
        fontWeight: '600',
    },
});