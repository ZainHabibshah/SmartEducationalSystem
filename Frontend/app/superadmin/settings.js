import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BottomNav from '../../components/BottomNav';

const COLORS = {
  bg: '#F5F5F5',
  heading: '#03045e',
  inputBg: '#03045e',
  buttonBg: '#03045e',
  buttonText: '#FFFFFF',
  border: '#DDE8D8',
};

export default function SuperAdminSettings() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setName((await AsyncStorage.getItem('superadmin_name')) || '');
        setEmail((await AsyncStorage.getItem('superadmin_email')) || '');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const go = (key) => {
    if (key === 'home') router.push('/superadmin');
    if (key === 'settings') router.push('/superadmin/settings');
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'access_token',
        'user_role',
        'superadmin_name',
        'superadmin_email',
        'superadmin_id',
      ]);
      Alert.alert('Success', 'Logged out successfully');
      router.replace('/');
    } catch {
      router.replace('/');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.inputBg} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color={COLORS.heading} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile (read-only)</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} editable={false} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} editable={false} />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.9}>
          <Ionicons name="log-out" size={18} color={COLORS.buttonBg} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 140 }} />
      </ScrollView>
      <BottomNav
        onPressHome={() => go('home')}
        onPressNotifications={() => go('home')}
        onPressChatbot={() => go('home')}
        onPressSettings={() => go('settings')}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, marginTop: 40 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Griffter', fontSize: 22, color: COLORS.heading },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  sectionTitle: { fontFamily: 'Griffter', fontSize: 18, color: COLORS.heading, marginBottom: 8 },
  inputGroup: { marginBottom: 12 },
  label: { fontFamily: 'Outfit', fontSize: 14, color: '#333', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontFamily: 'Outfit', fontSize: 15, color: '#111', backgroundColor: '#FAFAFA' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 14, marginTop: 6 },
  logoutText: { fontFamily: 'Griffter', fontSize: 16, color: COLORS.buttonBg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  loadingText: { fontFamily: 'Outfit', fontSize: 16, color: '#666', marginTop: 14 },
});

