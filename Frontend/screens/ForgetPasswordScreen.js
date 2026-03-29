import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { FONT_FAMILIES } from '../assets/fonts/config';
import Heading from '../components/heading';

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

SplashScreen.preventAutoHideAsync();

export default function ForgotPasswordScreen() {
  const [fontsLoaded] = useFonts({
    'Outfit-Regular': require('../assets/fonts/Outfit-Regular.ttf'),
    'Outfit-Bold': require('../assets/fonts/Outfit-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [focusedInput, setFocusedInput] = useState('');
  const [confirmationAnim] = useState(new Animated.Value(-100));
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleConfirm = () => {
    if (email.trim()) {
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
          }).start(() => {
            setShowConfirmation(false);
          });
        }, 3000);
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Heading />
      </View>
      
      <View style={styles.formSection}>
        <View style={[styles.inputWrapper, focusedInput === 'email' && styles.inputWrapperFocused]}>
          <TextInput
            style={styles.input}
            placeholder="Enter Your Email"
            placeholderTextColor={COLORS.inputText}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            onFocus={() => setFocusedInput('email')}
            onBlur={() => setFocusedInput('')}
          />
        </View>
      </View>

      {email && (
        <View style={styles.bottomSection}>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmText}>Confirm</Text>
            <View style={styles.confirmIconCircle}>
              <Ionicons name="arrow-forward" size={22} color={COLORS.arrow} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {showConfirmation && (
        <Animated.View style={[styles.confirmationMessage, { top: confirmationAnim }]}>
          <Text style={styles.confirmationText}>OTP sent successfully</Text>
        </Animated.View>
      )}
    </View>
  );
}


// Update styles to use font constants
const styles = StyleSheet.create({
  input: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    width: '100%',
    maxWidth: 500,
    paddingHorizontal: 16,
    height: Math.max(48, height * 0.07),
    color: COLORS.inputText,
    fontFamily: 'Outfit',
    fontSize: Math.max(16, width * 0.045), 
    alignSelf: 'center',
    textAlign: 'center',
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
    width: '90%', 
    bottom: height * 0.06,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.buttonBg,
    borderRadius: 24,
    paddingVertical: Math.max(height * 0.018, 10),
    paddingHorizontal: Math.max(width * 0.12, 32),
    width: '90%',
    maxWidth: 350,
    alignSelf: 'center',
  },
  confirmText: {
    fontFamily: FONT_FAMILIES.BOLD,
  },
  confirmationText: {
    fontFamily: FONT_FAMILIES.BOLD,
  },
});
