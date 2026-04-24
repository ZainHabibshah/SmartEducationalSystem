import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomNav from '../components/BottomNav';
import apiService from '../services/apiService';

const COURSE_OPTIONS = [
  { label: 'Computer Science', value: 'computerScience' },
  { label: 'Chemistry', value: 'chemistry' },
  { label: 'Physics', value: 'physics' },
];

const COLORS = {
  bg: '#F5F5F5',
  heading: '#03045e',
  border: '#DDE8D8',
  buttonBg: '#03045e',
  buttonText: '#FFFFFF',
};

export default function SuperAdminNotificationScreen() {
  const router = useRouter();
  const [course, setCourse] = useState('computerScience');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState([]);

  const courseLabel = useMemo(
    () => COURSE_OPTIONS.find((item) => item.value === course)?.label || course,
    [course]
  );

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const result = await apiService.getSuperadminNotificationHistory();
      setHistory(result?.history || []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const sendNotification = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a notification message.');
      return;
    }

    setSending(true);
    try {
      const result = await apiService.sendNotificationToTeacher(course, 'Notification', message.trim());
      Alert.alert(
        'Success',
        result?.teacher?.email
          ? `Notification sent to ${result.teacher.email}.`
          : `Notification sent to ${courseLabel} teacher.`
      );
      setMessage('');
      await loadHistory();
    } catch (error) {
      Alert.alert('Error', error?.error || error?.message || 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  };

  const handleBottomPress = (key) => {
    if (key === 'home') router.push('/superadmin');
    if (key === 'bell') router.push('/superadmin/notification');
    if (key === 'settings') router.push('/superadmin/settings');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color={COLORS.heading} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Send to Teacher</Text>
          <Text style={styles.label}>Select Course</Text>
          <View style={styles.courseRow}>
            {COURSE_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[styles.courseChip, course === item.value && styles.courseChipActive]}
                onPress={() => setCourse(item.value)}
                activeOpacity={0.85}
              >
                <Text style={[styles.courseChipText, course === item.value && styles.courseChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={styles.textArea}
            placeholder={`Write your message to ${courseLabel} teacher...`}
            placeholderTextColor="#A9B8A8"
            multiline
            numberOfLines={6}
            value={message}
            onChangeText={setMessage}
          />

          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={sendNotification}
            activeOpacity={0.9}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.buttonText} />
            ) : (
              <Ionicons name="send" size={18} color={COLORS.buttonText} style={{ marginRight: 8 }} />
            )}
            <Text style={styles.sendButtonText}>{sending ? 'Sending...' : 'Send Notification'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, styles.historyCard]}>
          <Text style={styles.sectionTitle}>Notification History</Text>
          {loadingHistory ? (
            <ActivityIndicator color={COLORS.heading} />
          ) : history.length === 0 ? (
            <Text style={styles.emptyText}>No notifications sent yet.</Text>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item, index) => item?.id || `history-${index}`}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <Text style={styles.historyMessage}>{item?.message || 'No message'}</Text>
                  <Text style={styles.historyMeta}>
                    {(item?.course || '').trim() || 'Unknown course'} - {(item?.recipients || []).join(', ') || 'N/A'}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {item?.readByTeacher ? 'Read by teacher in app' : 'Unread by teacher'}
                  </Text>
                  <Text style={styles.historyTime}>
                    {item?.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown time'}
                  </Text>
                  {!!item?.readAt && (
                    <Text style={styles.historyTime}>Read at: {new Date(item.readAt).toLocaleString()}</Text>
                  )}
                </View>
              )}
            />
          )}
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      <BottomNav
        onPressHome={() => handleBottomPress('home')}
        onPressNotifications={() => handleBottomPress('bell')}
        onPressChatbot={() => handleBottomPress('home')}
        onPressSettings={() => handleBottomPress('settings')}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.heading,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Griffter', fontSize: 20, color: COLORS.heading },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.heading,
  },
  historyCard: { marginTop: 16 },
  sectionTitle: { fontFamily: 'Griffter', fontSize: 18, color: COLORS.heading, marginBottom: 12 },
  label: { fontFamily: 'Outfit', color: COLORS.heading, marginBottom: 8, marginTop: 8 },
  courseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  courseChip: {
    borderWidth: 1.5,
    borderColor: COLORS.heading,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  courseChipActive: { backgroundColor: COLORS.heading },
  courseChipText: { fontFamily: 'Outfit', color: COLORS.heading },
  courseChipTextActive: { color: '#fff', fontWeight: '600' },
  textArea: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#F8F9FA',
    padding: 14,
    textAlignVertical: 'top',
    fontFamily: 'Outfit',
    color: COLORS.heading,
  },
  sendButton: {
    marginTop: 16,
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: COLORS.buttonBg,
  },
  sendButtonDisabled: { opacity: 0.65 },
  sendButtonText: { fontFamily: 'Outfit', color: COLORS.buttonText, fontSize: 16, fontWeight: '600' },
  emptyText: { fontFamily: 'Outfit', color: '#475569' },
  historyItem: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  historyMessage: { fontFamily: 'Outfit', color: COLORS.heading, fontSize: 14, fontWeight: '600' },
  historyMeta: { fontFamily: 'Outfit', color: '#334155', fontSize: 12, marginTop: 4 },
  historyTime: { fontFamily: 'Outfit', color: '#64748b', fontSize: 11, marginTop: 4 },
});
