import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiService from '../../services/apiService';

const COLORS = {
  bg: '#F5F5F5',
  inputBg: '#03045e',
  link: '#023e8a',
  buttonText: '#FFFFFF',
};

const COURSE_OPTIONS = [
  { label: 'Computer Science', value: 'computerScience' },
  { label: 'Chemistry', value: 'chemistry' },
  { label: 'Physics', value: 'physics' },
];

export default function AssignTeacherScreen() {
  const router = useRouter();
  const [course, setCourse] = useState('computerScience');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const courseLabel = useMemo(() => COURSE_OPTIONS.find((c) => c.value === course)?.label || course, [course]);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'Please fill all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      // Call backend endpoint directly via existing axios instance
      const res = await apiService.axiosInstance.post('/auth/superadmin/assign-teacher', {
        course,
        name: name.trim(),
        email: email.trim(),
        password,
      });

      Alert.alert(
        'Success',
        `${res.created ? 'Teacher created' : 'Teacher replaced'} for ${courseLabel}.`
      );

      setName('');
      setEmail('');
      setPassword('');
    } catch (e) {
      const msg = e?.error || e?.message || e?.response?.data?.error || 'Failed to assign teacher.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={COLORS.buttonText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assign / Replace Teacher</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Course</Text>
        <View style={styles.courseRow}>
          {COURSE_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c.value}
              style={[styles.courseChip, course === c.value && styles.courseChipActive]}
              onPress={() => setCourse(c.value)}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Text style={[styles.courseChipText, course === c.value && styles.courseChipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Teacher Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={COLORS.link} editable={!saving} />

        <Text style={styles.label}>Teacher Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={COLORS.link} autoCapitalize="none" editable={!saving} />

        <Text style={styles.label}>Teacher Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Min 6 characters" placeholderTextColor={COLORS.link} secureTextEntry editable={!saving} />

        <TouchableOpacity style={styles.button} onPress={submit} activeOpacity={0.9} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontFamily: 'Griffter', fontSize: 18 },
  content: { padding: 16, paddingBottom: 30 },
  label: { fontFamily: 'Griffter', color: COLORS.inputBg, fontSize: 14, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Outfit',
    color: COLORS.inputBg,
  },
  courseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  courseChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.inputBg,
    backgroundColor: '#fff',
  },
  courseChipActive: { backgroundColor: COLORS.inputBg },
  courseChipText: { fontFamily: 'Outfit', color: COLORS.inputBg },
  courseChipTextActive: { color: '#fff', fontWeight: '700' },
  button: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontFamily: 'Griffter', fontSize: 16 },
});

