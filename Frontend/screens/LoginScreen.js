import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AdminConfirmationModal from '../components/AdminConfirmationModal';
import OTPModal from '../components/OTPModal';
import PasswordResetModal from '../components/PasswordResetModal';
import apiService from '../services/apiService';

const { width, height } = Dimensions.get('window');

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

export default function LoginScreen() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [focusedInput, setFocusedInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationAnim] = useState(new Animated.Value(-100));
  const [showBanner, setShowBanner] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [loginEmailForOtp, setLoginEmailForOtp] = useState('');
  const [otpContext, setOtpContext] = useState(null);

  const roleOptions = [
    { label: 'Student', value: 'student' },
    { label: 'Teacher', value: 'admin' },          // backend role = 'admin' (teacher)
    { label: 'Admin', value: 'superadmin' },
  ];

  const isValidEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleForgetPassword = () => {
    if (!role || !email) {
      showConfirmationBanner('Please select your role and enter your email first');
      return;
    }

    if (!isValidEmail(email)) {
      showConfirmationBanner('Please enter a valid email address before resetting password');
      return;
    }

    setOtpContext('reset');
    setShowOtpModal(true);
  };
  
  const handleLogin = async () => {
    if (!role || !email || !password) {
      showConfirmationBanner('Please fill all fields');
      return;
    }

    if (!isValidEmail(email)) {
      showConfirmationBanner('Please enter a valid email address (e.g. name@example.com)');
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiService.login(role, email, password);
      if (result && result.access_token) {
        // Store token
        await AsyncStorage.setItem('access_token', result.access_token);
        
        if (role === 'admin') {
          if (result.user) {
            await AsyncStorage.setItem('user_role', 'admin');
            const displayName = result.user.name || 'Teacher';
            const displayEmail = result.user.email || email;
            await AsyncStorage.setItem('teacher_name', displayName);
            await AsyncStorage.setItem('teacher_email', displayEmail);
            await AsyncStorage.setItem('teacher_course', result.user.course || '');
            await AsyncStorage.setItem('teacher_id', result.user.admin_id || '');
            await AsyncStorage.setItem('teacher_address', result.user.address || '');
            // Legacy keys used by admin dashboard / screens (e.g. AdminQuizScreen expects admin_id / admin_course)
            await AsyncStorage.setItem('admin_name', displayName);
            await AsyncStorage.setItem('admin_email', displayEmail);
            await AsyncStorage.setItem('admin_id', result.user.admin_id || '');
            await AsyncStorage.setItem('admin_course', result.user.course || '');
          }
          showConfirmationBanner('Teacher login successful!');
          router.replace('/admin');
        } else if (role === 'superadmin') {
          if (result.user) {
            await AsyncStorage.setItem('user_role', 'superadmin');
            await AsyncStorage.setItem('superadmin_name', result.user.name || 'Super Admin');
            await AsyncStorage.setItem('superadmin_email', result.user.email || email);
            await AsyncStorage.setItem('superadmin_id', result.user.admin_id || '');
          }
          showConfirmationBanner('Super Admin login successful!');
          router.replace('/superadmin');
        } else {
          // Store student data
          await AsyncStorage.setItem('user_role', 'student');
          await AsyncStorage.setItem('student_email', email);
          if (result.user) {
            await AsyncStorage.setItem('student_name', result.user.name || 'Student');
            await AsyncStorage.setItem('student_email', result.user.email || email);
            await AsyncStorage.setItem('student_course', result.user.course || '');
            if (result.user.class) {
              await AsyncStorage.setItem('student_class', result.user.class);
            }
            if (result.user.student_id) {
              await AsyncStorage.setItem('student_id', result.user.student_id);
            } else if (result.user.id) {
              await AsyncStorage.setItem('student_id', result.user.id);
            }
          }
          showConfirmationBanner('Login successful!');
          router.replace('/student');
        }
      }
    } catch (error) {
      showConfirmationBanner(getFriendlyLoginError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminConfirm = async (otp) => {
    return;
  };

  const handleAdminClose = () => {
    setShowAdminModal(false);
  };

  const handleOtpVerify = async (otp) => {
    // OTP is now only used for password reset
    console.log('Verifying password reset OTP:', otp);

    showConfirmationBanner('OTP verified. You can now set a new password.');
    setShowOtpModal(false);
    setShowResetModal(true);
  };

  const handleOtpResend = () => {
    // OTP resend for password reset only
    showConfirmationBanner('A new OTP has been sent to your email.');
  };

  const showConfirmationBanner = (text) => {
    setBannerText(text);
    setShowBanner(true);
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
        }).start(() => setShowBanner(false));
      }, 3000);
    });
  };

  const getFriendlyLoginError = (error) => {
    if (error?.code === 'NETWORK_ERROR') {
      return 'Cannot connect to the server. Please try again in a moment.';
    }
    if (error?.code === 'ECONNABORTED') {
      return 'Login is taking longer than expected. Please check your connection and try again.';
    }
    if (error?.status === 401 || error?.status === 400) {
      return 'Incorrect email or password. Please try again.';
    }
    return 'Login failed. Please try again.';
  };

  return (
    <View style={styles.container}>
      <View style={styles.notificationWrap}>
        <Text style={styles.notificationText}>
          {isLoading ? 'Logging in...' : 'Input all fields to make the login button visible'}
        </Text>
      </View>

      <View style={styles.topSection}>
        <Text style={styles.heading}>Smart Educational Companion</Text>
      </View>

      <View style={styles.formSection}>
        <TouchableOpacity
          style={[styles.inputWrapper, dropdownOpen ? styles.inputWrapperFocused : null, role ? styles.selectedRole : null]}
          activeOpacity={0.8}
          onPress={() => setDropdownOpen(!dropdownOpen)}
          disabled={isLoading}
        >
          <Text style={[styles.roleText, role ? styles.selectedRoleText : null]}>
            {role ? roleOptions.find(r => r.value === role)?.label : 'Select Your Role'}
          </Text>
          <View style={styles.dropdownIconCircle}>
            <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={28} color={COLORS.arrow} />
          </View>
        </TouchableOpacity>

        {dropdownOpen && (
          <View style={styles.dropdownMenu}>
            {roleOptions.map(option => (
              <TouchableOpacity
                key={option.value}
                style={styles.dropdownItem}
                onPress={() => {
                  setRole(option.value);
                  setDropdownOpen(false);
                }}
                disabled={isLoading}
              >
                <Text style={styles.dropdownItemText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!dropdownOpen && (
          <>
            <View style={[styles.inputWrapper, focusedInput === 'email' && styles.inputWrapperFocused]}>
              <TextInput
                style={styles.input}
                placeholder="Enter Your Email"
                placeholderTextColor={COLORS.inputText}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (!value) {
                    setEmailError('');
                  } else if (!isValidEmail(value)) {
                    setEmailError('Please enter a valid email like name@example.com');
                  } else {
                    setEmailError('');
                  }
                }}
                keyboardType="email-address"
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput('')}
                editable={!isLoading}
              />
            </View>
            {!!emailError && (
              <Text style={styles.errorText}>
                {emailError}
              </Text>
            )}

            <View style={[styles.inputWrapper, focusedInput === 'password' && styles.inputWrapperFocused]}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your Password"
                placeholderTextColor={COLORS.inputText}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput('')}
                editable={!isLoading}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)} 
                style={styles.eyeIcon}
                disabled={isLoading}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color={COLORS.inputText}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.forgotWrapper}>
              <TouchableOpacity onPress={handleForgetPassword} disabled={isLoading}>
                <Text style={styles.forgot}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Login Button */}
      {!dropdownOpen && role && email && password && isValidEmail(email) && (
        <View style={styles.bottomSection}>
          <TouchableOpacity 
            onPress={handleLogin} 
            activeOpacity={0.8} 
            style={[styles.loginButton, isLoading && styles.disabledButton]}
            disabled={isLoading}
          >
            <Text style={styles.loginText}>
              {isLoading ? 'LOGGING IN...' : 'LOG-IN'}
            </Text>
            {!isLoading && (
              <View style={styles.loginIconCircle}>
                <Ionicons name="arrow-forward" size={22} color={COLORS.arrow} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      <AdminConfirmationModal
        visible={false}
        onClose={handleAdminClose}
        onConfirm={handleAdminConfirm}
      />

      <OTPModal
        visible={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onVerify={handleOtpVerify}
        onResend={handleOtpResend}
        type="reset"
      />

      <PasswordResetModal
        visible={showResetModal}
        onClose={() => setShowResetModal(false)}
        onSubmit={(newPassword) => {
          console.log('Password reset for', role, email, 'to', newPassword);
          setShowResetModal(false);
          showConfirmationBanner('Password changed successfully. You can now log in with your new password.');
        }}
        roleLabel={role === 'admin' ? 'Admin' : 'Student'}
        email={email}
      />

      {showBanner && (
        <Animated.View style={[styles.confirmationMessage, { top: confirmationAnim }]}>
          <Text style={styles.confirmationText}>{bannerText}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 18,
    marginTop: 4,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eyeIcon: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowButton: {
    display: "flex",
    justifyContent: "center",
    alignContent: "center"
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
  },
  dropdownItemText: {
    fontFamily: 'Outfit',
    fontSize: Math.max(16, width * 0.045),
    color: COLORS.inputBg,
    textAlign: 'center',
  },
  roleText: {
    fontFamily: 'Outfit',
    fontSize: Math.max(16, width * 0.045),
    color: COLORS.inputText,  
    flex: 1,
    textAlign: 'center',  
    paddingVertical: 12,
  },
  selectedRole: {
    backgroundColor: COLORS.inputBg,
  },
  selectedRoleText: {
    color: COLORS.inputText,
  },
  inputWrapperFocused: {
    borderWidth: 2,
    borderColor: COLORS.arrow,
    borderRadius: 18,
  },
  dropdownIconCircle: {
    position: 'absolute',
    right: "2%",
    top: "20%",
    bottom: 5,
    backgroundColor: '#fff',
    borderRadius: 50,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: "1.5%",
    paddingRight: "-11%",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Math.max(width * 0.07, 16),
    width: '100%',
    height: '100%',
    minHeight: height,
    minWidth: width,
  },
  topSection: {
    marginTop: Math.max(height * 0.08, 32),
    marginBottom: Math.max(height * 0.04, 18),
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  heading: {
    fontFamily: 'Griffter',
    fontSize: Math.max(28, Math.min(width * 0.08, height * 0.08)),
    color: COLORS.heading,
    textAlign: 'center',
    width: '90%',
  },
  formSection: {
    width: '100%',
    maxWidth: 500,
    alignItems: 'center',
    marginBottom: Math.max(height * 0.04, 18),
    alignSelf: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 18,
    width: '100%',
    maxWidth: 400,
    marginBottom: Math.max(height * 0.025, 12),
    paddingHorizontal: 12,
    position: 'relative',
    height: Math.max(48, height * 0.07),
    alignSelf: 'center',
  },
  dropdownIcon: {
    position: 'absolute',
    right: 5,
    top: 5,
    bottom: 5,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 5,
    paddingBottom: 5,
    paddingRight: 5,
  },
  notificationWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: Math.max(height * 0.02, 10),
    marginBottom: Math.max(height * 0.01, 6),
  },
  notificationText: {
    color: COLORS.heading,
    fontFamily: 'Outfit',
    fontSize: Math.max(14, width * 0.04),
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 16,
    height: Math.max(48, height * 0.07),
    color: COLORS.inputText,
    fontFamily: 'Outfit',
    fontSize: Math.max(16, width * 0.045),
        alignSelf: 'center',
        textAlign: 'center',
  },
  forgotWrapper: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: Math.max(height * 0.04, 18),
  },
  forgot: {
    fontFamily: 'Outfit',
    fontSize: Math.max(14, width * 0.04),
    color: COLORS.link,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  bottomSection: {
    textAlign: 'center',
    maxWidth: 500,
    alignItems: 'center',
    position: 'relative',
    bottom: Math.max(height * 0.06, 24),
    paddingTop: "15%",
    left: 0,
    alignSelf: 'center',
    width: 350
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.buttonBg,
    borderRadius: 24,
    paddingVertical: Math.max(height * 0.018, 10),
    paddingHorizontal: Math.max(width * 0.12, 32),
    width: '80%',
    maxWidth: 350,
    alignSelf: 'center',
  },
  loginText: {
    fontFamily: 'Outfit',
    fontSize: Math.max(18, width * 0.05),
    color: COLORS.buttonText,
    marginRight: 12,
  },
  loginIconCircle: {
    backgroundColor: "white",
    borderRadius: 50,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
  },
  modalHeading: {
    fontFamily: 'Griffter',
    fontSize: 22,
    color: COLORS.buttonText,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInputWrapper: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 18,
    width: '90%',
    maxWidth: 400,
    paddingHorizontal: 16,
    height: 48,
    color: COLORS.inputText,
    fontFamily: 'Outfit',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    maxWidth: 400,
  },
  modalButton: {
    backgroundColor: COLORS.buttonBg,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    flex: 0.45,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  modalButtonText: {
    fontFamily: 'Outfit',
    fontSize: 18,
    color: COLORS.buttonText,
  },
  confirmationMessage: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  confirmationText: {
    fontFamily: 'Outfit',
    fontSize: Math.max(16, width * 0.045),
    color: COLORS.buttonText,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.link,
    borderRadius: 18,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  otpInput: {
    width: 50,
    height: 50,
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    marginHorizontal: 5,
    textAlign: 'center',
    color: COLORS.inputText,
    fontFamily: 'Outfit',
    fontSize: 20,
  },
  resendButton: {
    marginBottom: 20,
  },
  resendText: {
    fontFamily: 'Outfit',
    color: COLORS.link,
    fontSize: 14,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  errorText: {
    fontFamily: 'Outfit',
    fontSize: Math.max(12, width * 0.035),
    color: 'red',
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginLeft: 4,
  },
});