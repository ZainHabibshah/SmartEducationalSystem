import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, TouchableOpacity, View } from 'react-native';
import { FONT_FAMILIES } from '../assets/fonts/config';
const COLORS = {
  bg: '#F5F5F5',
  heading: '#03045e',
  inputBg: '#03045e',
  inputText: '#FFFFFF',
  arrow: '#03045e',
  link: '#023e8a',
  buttonBg: '#03045e',
  buttonText: '#FFFFFF',
};

const { width, height } = Dimensions.get('window');

export default function AdminForgetPasswordModal({ onClose, onSuccess }) {
  const [otp, setOtp] = useState(['', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [resendTimeout, setResendTimeout] = useState(60);
  const [confirmationAnim] = useState(new Animated.Value(-100));
  const [showConfirmation, setShowConfirmation] = useState(false);
  const otpRefs = Array(5).fill().map(() => useRef(null)); 

  // OTP Input handling
  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    
    if (text && index < 4) {
      otpRefs[index + 1].current.focus();
    }
  };

  // Resend OTP Countdown
  useEffect(() => {
    if (resendTimeout > 0) {
      const timer = setTimeout(() => setResendTimeout(resendTimeout - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimeout]);

  // Confirmation animation
  const showSuccessMessage = (message) => {
    setShowConfirmation(true);
    Animated.timing(confirmationAnim, {
      toValue: 50,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(confirmationAnim, {
          toValue: -100,
          duration: 500,
          easing: Easing.in(Easing.ease),
          useNativeDriver: false,
        }).start(() => setShowConfirmation(false));
      }, 3000);
    });
  };

  const handlePasswordChange = () => {
    if (password === confirmPassword) {
      showSuccessMessage('Password changed successfully');
      setShowPasswordFields(false);
    }
  };

  return (
    <View style={styles.modalContent}>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={24} color={COLORS.heading} />
      </TouchableOpacity>

      {}
      <View style={styles.container}>
        {}
      </View>
    </View>
  );
}

// Update styles
const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 500,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 5,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: Math.max(width * 0.07, 16),
  },
  inputWrapper: {
  },
  input: {
  },
  confirmButton: {
  },
  confirmationMessage: {
  },
  confirmationText: {
  },
  
  // New styles
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 20,
  },
  otpInput: {
    width: 50,
    height: 50,
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    marginHorizontal: 5,
    textAlign: 'center',
    color: COLORS.inputText,
    fontFamily: FONT_FAMILIES.REGULAR,
    fontSize: 20,
  },
  otpText: {
    fontFamily: FONT_FAMILIES.BOLD,
    fontSize: 18,
    color: COLORS.heading,
    marginBottom: 20,
    textAlign: 'center',
  },
  resendButton: {
    alignSelf: 'center',
    marginVertical: 15,
  },
  resendText: {
    fontFamily: FONT_FAMILIES.REGULAR,
    color: COLORS.link,
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
});