import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const [course, setCourse] = useState('computerScience');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState(null);
  const [teacherLoadError, setTeacherLoadError] = useState('');

  const courseLabel = useMemo(() => COURSE_OPTIONS.find((c) => c.value === course)?.label || course, [course]);

  const normalizeTeacher = (res) => {
    const candidate =
      res?.teacher ||
      res?.data?.teacher ||
      res?.current_teacher ||
      res?.data?.current_teacher ||
      res?.admin ||
      res?.data?.admin ||
      null;

    if (!candidate || typeof candidate !== 'object') return null;

    return {
      name: candidate.name || candidate.full_name || candidate.fullName || 'N/A',
      email: candidate.email || 'N/A',
    };
  };

  const loadCurrentTeacher = async (targetCourse = course) => {
    setLoadingCurrent(true);
    setTeacherLoadError('');
    try {
      const res = await apiService.getCourseTeacher(targetCourse);
      setCurrentTeacher(normalizeTeacher(res));
    } catch (e) {
      setCurrentTeacher(null);
      setTeacherLoadError(e?.error || e?.message || 'Failed to load teacher details.');
    } finally {
      setLoadingCurrent(false);
    }
  };

  React.useEffect(() => {
    loadCurrentTeacher(course);
  }, [course]);

  useFocusEffect(
    React.useCallback(() => {
      loadCurrentTeacher(course);
    }, [course])
  );

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
      const res = await apiService.assignTeacherBySuperadmin({
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
      await loadCurrentTeacher(course);
    } catch (e) {
      const msg = e?.error || e?.message || e?.response?.data?.error || 'Failed to assign teacher.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const removeTeacher = async () => {
    Alert.alert('Remove Teacher', `Remove teacher from ${courseLabel}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const res = await apiService.removeTeacher(course);
            Alert.alert('Success', res?.message || 'Teacher removed successfully.');
            await loadCurrentTeacher(course);
          } catch (e) {
            Alert.alert('Error', e?.error || e?.message || 'Failed to remove teacher.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(14, insets.top + 6) }]}>
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

        <View style={styles.currentBox}>
          <Text style={styles.currentTitle}>Current Teacher ({courseLabel})</Text>
          {loadingCurrent ? (
            <ActivityIndicator size="small" color={COLORS.inputBg} />
          ) : currentTeacher ? (
            <>
              <Text style={styles.currentText}>Name: {currentTeacher.name || 'N/A'}</Text>
              <Text style={styles.currentText}>Email: {currentTeacher.email || 'N/A'}</Text>
            </>
          ) : (
            <Text style={styles.currentText}>No teacher assigned yet.</Text>
          )}
          {!!teacherLoadError && !loadingCurrent && (
            <Text style={styles.currentErrorText}>{teacherLoadError}</Text>
          )}
        </View>

        <TouchableOpacity style={styles.button} onPress={submit} activeOpacity={0.9} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.removeButton} onPress={removeTeacher} activeOpacity={0.9} disabled={saving}>
          <Text style={styles.buttonText}>Remove Teacher</Text>
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
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 16, paddingBottom: 30 },
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
  removeButton: {
    backgroundColor: '#C62828',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  currentBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E3F0',
    backgroundColor: '#fff',
  },
  currentTitle: {
    fontFamily: 'Griffter',
    fontSize: 14,
    color: COLORS.inputBg,
    marginBottom: 6,
  },
  currentText: {
    fontFamily: 'Outfit',
    color: COLORS.link,
    marginBottom: 4,
  },
  currentErrorText: {
    fontFamily: 'Outfit',
    color: '#C62828',
    marginTop: 6,
  },
});

