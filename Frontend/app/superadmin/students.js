import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import apiService from '../../services/apiService';

const COURSE_LABELS = {
  computerScience: 'Computer Science',
  physics: 'Physics',
  chemistry: 'Chemistry',
};

export default function SuperadminStudentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { course = 'computerScience' } = useLocalSearchParams();
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const courseKey = String(course);
  const title = useMemo(() => `${COURSE_LABELS[courseKey] || courseKey} Students`, [courseKey]);

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiService.getSuperadminStudentsByCourse(courseKey);
      setStudents(res?.students || []);
    } catch (error) {
      Alert.alert('Error', error?.error || error?.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [courseKey]);

  useFocusEffect(
    useCallback(() => {
      loadStudents();
    }, [loadStudents])
  );

  const filtered = students.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.fullName || '').toLowerCase().includes(q) ||
      (s.registrationNumber || '').toLowerCase().includes(q)
    );
  });

  const onDelete = (student) => {
    Alert.alert('Delete Student', `Delete ${student.fullName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteStudentBySuperadmin(student.id, courseKey);
            await loadStudents();
          } catch (error) {
            Alert.alert('Error', error?.error || error?.message || 'Delete failed');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(14, insets.top + 6) }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push(`/superadmin/add-student?course=${courseKey}`)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentWrap}>
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or registration number"
          placeholderTextColor={COLORS.link}
          style={styles.search}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.inputBg} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {filtered.map((student) => {
            const expanded = expandedId === student.id;
            return (
              <View key={student.id} style={styles.card}>
                <TouchableOpacity style={styles.cardRow} onPress={() => setExpandedId(expanded ? null : student.id)}>
                  <View>
                    <Text style={styles.name}>{student.fullName}</Text>
                    <Text style={styles.sub}>{student.registrationNumber}</Text>
                  </View>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.inputBg} />
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.details}>
                    <Text style={styles.detailText}>Father: {student.fatherName || 'N/A'}</Text>
                    <Text style={styles.detailText}>Email: {student.email || 'N/A'}</Text>
                    <Text style={styles.detailText}>Phone: {student.phoneNumber || 'N/A'}</Text>
                    <Text style={styles.detailText}>Address: {student.address || 'N/A'}</Text>
                    <View style={styles.actions}>
                      <TouchableOpacity style={[styles.actionBtn, styles.edit]} onPress={() => router.push({ pathname: '/superadmin/edit-student', params: { course: courseKey, studentData: JSON.stringify(student) } })}>
                        <Text style={styles.actionText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.delete]} onPress={() => onDelete(student)}>
                        <Text style={styles.actionText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          {!filtered.length && <Text style={styles.empty}>No students found.</Text>}
        </ScrollView>
      )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { backgroundColor: COLORS.inputBg, paddingTop: 44, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' },
  contentWrap: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontFamily: 'Griffter', fontSize: 18 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  search: { backgroundColor: '#fff', borderRadius: 12, borderColor: COLORS.inputBg, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.inputBg, fontFamily: 'Outfit' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderWidth: 2, borderColor: COLORS.inputBg, borderRadius: 14, padding: 12, marginBottom: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontFamily: 'Griffter', color: COLORS.inputBg, fontSize: 16 },
  sub: { fontFamily: 'Outfit', color: COLORS.link, marginTop: 4 },
  details: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#e8e8e8', paddingTop: 10, gap: 6 },
  detailText: { fontFamily: 'Outfit', color: COLORS.link },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  edit: { backgroundColor: '#4CAF50' },
  delete: { backgroundColor: '#F44336' },
  actionText: { color: '#fff', fontFamily: 'Outfit', fontWeight: '700' },
  empty: { textAlign: 'center', color: COLORS.link, fontFamily: 'Outfit', marginTop: 24 },
});
