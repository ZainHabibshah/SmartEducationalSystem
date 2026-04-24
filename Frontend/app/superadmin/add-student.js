import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import apiService from '../../services/apiService';

export default function SuperadminAddStudent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { course = 'computerScience' } = useLocalSearchParams();
  const [form, setForm] = useState({ fullName: '', fatherName: '', address: '', pastSchool: '', phone: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.fullName || !form.fatherName || !form.email || !form.phone || !form.password) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      await apiService.registerStudentBySuperadmin({
        course: String(course),
        full_name: form.fullName.trim(),
        father_name: form.fatherName.trim(),
        address: form.address.trim(),
        past_school: form.pastSchool.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      Alert.alert('Success', 'Student added successfully');
      router.replace(`/superadmin/students?course=${String(course)}`);
    } catch (error) {
      Alert.alert('Error', error?.error || error?.message || 'Failed to add student');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(14, insets.top + 6) }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Add Student</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {[
          ['Full Name *', 'fullName'],
          ['Father Name *', 'fatherName'],
          ['Address', 'address'],
          ['Past School', 'pastSchool'],
          ['Phone *', 'phone'],
          ['Email *', 'email'],
          ['Password *', 'password'],
        ].map(([label, key]) => (
          <View key={key} style={{ marginBottom: 12 }}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={form[key]}
              onChangeText={(v) => setField(key, v)}
              autoCapitalize={key === 'email' ? 'none' : 'sentences'}
              secureTextEntry={key === 'password'}
              placeholderTextColor={COLORS.link}
            />
          </View>
        ))}
        <TouchableOpacity style={[styles.submit, saving && { opacity: 0.7 }]} onPress={submit} disabled={saving}>
          <Text style={styles.submitText}>{saving ? 'Saving...' : 'Add Student'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: COLORS.inputBg, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 16, paddingBottom: 24 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontFamily: 'Griffter', fontSize: 18 },
  label: { color: COLORS.inputBg, fontFamily: 'Griffter', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 2, borderColor: COLORS.inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.inputBg, fontFamily: 'Outfit' },
  submit: { backgroundColor: COLORS.inputBg, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  submitText: { color: '#fff', fontFamily: 'Griffter' },
});
