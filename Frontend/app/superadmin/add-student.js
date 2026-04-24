import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import UploadConfirmationModal from '../../components/UploadConfirmationModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import apiService from '../../services/apiService';

export default function SuperadminAddStudent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { course = 'computerScience' } = useLocalSearchParams();
  const [form, setForm] = useState({ fullName: '', fatherName: '', address: '', pastSchool: '', phone: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationVariant, setConfirmationVariant] = useState('success');
  const [confirmationTitle, setConfirmationTitle] = useState('Student Added Successfully');
  const [confirmationMessage, setConfirmationMessage] = useState('Student has been added successfully.');

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const selectedCourse = Array.isArray(course) ? course[0] : course;
  const courseKey = String(selectedCourse || 'computerScience');

  const showErrorModal = (message) => {
    setConfirmationVariant('error');
    setConfirmationTitle('Submission Rejected');
    setConfirmationMessage(message);
    setShowConfirmationModal(true);
  };

  const submit = async () => {
    if (!form.fullName || !form.fatherName || !form.email || !form.phone || !form.password) {
      showErrorModal('Please fill all required fields (Full Name, Father Name, Email, Phone, Password).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      showErrorModal('Please enter a valid email address.');
      return;
    }

    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phoneRegex.test(form.phone.trim())) {
      showErrorModal('Please enter a valid phone number (10 to 15 digits, optional +).');
      return;
    }

    setSaving(true);
    try {
      const response = await apiService.registerStudentBySuperadmin({
        course: courseKey,
        full_name: form.fullName.trim(),
        father_name: form.fatherName.trim(),
        address: form.address.trim(),
        past_school: form.pastSchool.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      setConfirmationVariant('success');
      setConfirmationTitle('Student Added Successfully');
      setConfirmationMessage(
        response?.registration_number
          ? `Student has been added to ${courseKey}.\nRegistration No: ${response.registration_number}`
          : `Student has been added to ${courseKey} successfully.`
      );
      setShowConfirmationModal(true);
    } catch (error) {
      showErrorModal(error?.error || error?.message || 'Failed to add student');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmationClose = () => {
    const wasSuccess = confirmationVariant === 'success';
    setShowConfirmationModal(false);
    if (wasSuccess) {
      router.replace(`/superadmin/students?course=${courseKey}`);
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

      <UploadConfirmationModal
        visible={showConfirmationModal}
        onClose={handleConfirmationClose}
        title={confirmationTitle}
        message={confirmationMessage}
        operationType="add"
        variant={confirmationVariant}
      />
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
