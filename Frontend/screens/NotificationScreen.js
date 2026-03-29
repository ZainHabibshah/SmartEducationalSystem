import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '../components/BottomNav';
import UploadConfirmationModal from '../components/UploadConfirmationModal';
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

export default function NotificationScreen() {
    const router = useRouter();
    const [message, setMessage] = useState('');
    const [recipientType, setRecipientType] = useState('single');
    const [singleEmail, setSingleEmail] = useState('');
    const [groupCountOpen, setGroupCountOpen] = useState(false);
    const [groupCount, setGroupCount] = useState(2);
    const [groupEmails, setGroupEmails] = useState(['', '']);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showError, setShowError] = useState(false);
    const [errorText, setErrorText] = useState('Please fill all required fields.');
    const [refreshing, setRefreshing] = useState(false);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [students, setStudents] = useState([]);
    const [adminCourse, setAdminCourse] = useState('computerScience');
    const [showSingleDropdown, setShowSingleDropdown] = useState(false);
    const [showGroupDropdown, setShowGroupDropdown] = useState(null); // Tracks which group input is active
    const [filteredStudents, setFilteredStudents] = useState([]);

    const handleBottomPress = (key) => {
        if (key === 'home') {
            router.push('/admin');
        } else if (key === 'bell') {
            router.push('/admin/notification');
        } else if (key === 'chatbot') {
            router.push('/admin/chatbot');
        } else if (key === 'settings') {
            router.push('/admin/settings');
        }
    };

    const filterStudents = (searchText) => {
        if (!searchText.trim()) {
            setFilteredStudents(students);
            return;
        }
        const filtered = students.filter(student => {
            const name = student.name?.toLowerCase() || '';
            const email = student.email?.toLowerCase() || '';
            const search = searchText.toLowerCase();
            return name.includes(search) || email.includes(search);
        });
        setFilteredStudents(filtered);
    };

    const handleSingleEmailChange = (text) => {
        setSingleEmail(text);
        filterStudents(text);
        setShowSingleDropdown(true);
    };

    const handleGroupEmailChange = (text, index) => {
        setGroupEmails((prev) => {
            const next = [...prev];
            next[index] = text;
            return next;
        });
        filterStudents(text);
        setShowGroupDropdown(index);
    };

    const selectStudent = (student, isGroup = false, groupIndex = null) => {
        if (isGroup && groupIndex !== null) {
            setGroupEmails((prev) => {
                const next = [...prev];
                next[groupIndex] = student.email;
                return next;
            });
            setShowGroupDropdown(null);
        } else {
            setSingleEmail(student.email);
            setShowSingleDropdown(false);
        }
    };

    const handleSend = async () => {
        // Close any open dropdowns
        setShowSingleDropdown(false);
        setShowGroupDropdown(null);
        
        // Basic validation
        if (!message.trim()) {
            setErrorText('Message is required.');
            setShowError(true);
            return;
        }
        if (recipientType === 'single') {
            if (!singleEmail.trim()) {
                setErrorText('Student email is required.');
                setShowError(true);
                return;
            }
        } else if (recipientType === 'group') {
            const missing = groupEmails.some((e) => !e.trim());
            if (missing) {
                setErrorText('Please fill all group email fields.');
                setShowError(true);
                return;
            }
        }

        try {
            setSending(true);
            let result;

            if (recipientType === 'single') {
                // Find student ID by email
                const student = students.find(s => s.email === singleEmail.trim());
                if (!student) {
                    setErrorText('Student not found with this email.');
                    setShowError(true);
                    setSending(false);
                    return;
                }
                result = await apiService.sendNotificationToStudents(
                    [student.student_id || student.mongo_id],
                    'Notification',
                    message.trim(),
                    adminCourse
                );
            } else if (recipientType === 'group') {
                // Find student IDs by emails
                const studentIds = groupEmails
                    .map(email => email.trim())
                    .map(email => {
                        const student = students.find(s => s.email === email);
                        return student ? (student.student_id || student.mongo_id) : null;
                    })
                    .filter(id => id !== null);
                
                if (studentIds.length === 0) {
                    setErrorText('No valid students found.');
                    setShowError(true);
                    setSending(false);
                    return;
                }
                result = await apiService.sendNotificationToStudents(
                    studentIds,
                    'Notification',
                    message.trim(),
                    adminCourse
                );
            } else {
                // Send to all students
                result = await apiService.sendNotificationToAll(
                    'Notification',
                    message.trim(),
                    adminCourse
                );
            }

            if (result && result.success) {
                // Reload history from backend
                await loadNotificationHistory();
                
                // Clear form
                setMessage('');
                setSingleEmail('');
                setGroupEmails(['', '']);
                
                setShowConfirm(true);
            } else {
                setErrorText(result?.error || 'Failed to send notification.');
                setShowError(true);
            }
        } catch (error) {
            console.error('Error sending notification:', error);
            setErrorText(error?.message || 'Failed to send notification. Please try again.');
            setShowError(true);
        } finally {
            setSending(false);
        }
    };

    const closeConfirm = () => {
        setShowConfirm(false);
    };

    useEffect(() => {
        setGroupEmails((prev) => {
            if (prev.length === groupCount) return prev;
            if (prev.length < groupCount) {
                return [...prev, ...Array(groupCount - prev.length).fill('')];
            }
            return prev.slice(0, groupCount);
        });
    }, [groupCount]);


    const loadStudents = async (course) => {
        try {
            const courseToUse = course || adminCourse || 'computerScience';
            const result = await apiService.getAllStudents(courseToUse);
            if (result && result.success && result.students) {
                setStudents(result.students);
                setFilteredStudents(result.students);
            }
        } catch (error) {
            console.error('Error loading students:', error);
        }
    };

    const loadNotificationHistory = async () => {
        try {
            setLoading(true);
            const result = await apiService.getAdminNotificationHistory();
            if (result && result.success && result.history) {
                setHistory(result.history);
                console.log(`📜 Loaded ${result.history.length} notification history entries`);
            }
        } catch (error) {
            console.error('Error loading notification history:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Load admin course from storage
        const loadAdminData = async () => {
            try {
                const course = await AsyncStorage.getItem('admin_course');
                if (course) {
                    setAdminCourse(course);
                }
                // Load students and history with the course
                await loadStudents(course || 'computerScience');
                await loadNotificationHistory();
            } catch (error) {
                console.error('Error loading admin course:', error);
            }
        };
        
        loadAdminData();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadStudents(), loadNotificationHistory()]);
        setRefreshing(false);
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView 
                contentContainerStyle={styles.container} 
                keyboardShouldPersistTaps="handled"
                onScroll={() => {
                    setShowSingleDropdown(false);
                    setShowGroupDropdown(null);
                }}
                scrollEventThrottle={16}
            >
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
                        <Ionicons name="chevron-back" size={24} color={COLORS.inputBg} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notification</Text>
                    <View style={{ width: 44 }} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Notification Box</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Message</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Write your message to students..."
                            placeholderTextColor="#A9B8A8"
                            multiline
                            numberOfLines={6}
                            value={message}
                            onChangeText={setMessage}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Send To</Text>
                        <View style={styles.segment}>
                            {['single', 'class', 'group'].map((key) => (
                                <TouchableOpacity
                                    key={key}
                                    style={[styles.segmentItem, recipientType === key && styles.segmentItemActive]}
                                    onPress={() => setRecipientType(key)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.segmentText, recipientType === key && styles.segmentTextActive]}>
                                        {key === 'single' ? 'Single' : key === 'class' ? 'Class' : 'Group'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {recipientType === 'single' && (
                        <View style={[styles.inputGroup, { zIndex: 9999 }]}>
                            <Text style={styles.label}>Student Email</Text>
                            <View style={{ position: 'relative', zIndex: 9999 }}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. student@example.com"
                                    placeholderTextColor="#A9B8A8"
                                    value={singleEmail}
                                    onChangeText={handleSingleEmailChange}
                                    onFocus={() => {
                                        setShowSingleDropdown(true);
                                        setFilteredStudents(students);
                                    }}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                                {showSingleDropdown && filteredStudents.length > 0 && (
                                    <View style={styles.studentDropdown}>
                                        <ScrollView 
                                            style={styles.studentDropdownScroll}
                                            nestedScrollEnabled={true}
                                            keyboardShouldPersistTaps="handled"
                                        >
                                            {filteredStudents.slice(0, 10).map((student, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={styles.studentDropdownItem}
                                                    onPress={() => selectStudent(student, false)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.studentInfo}>
                                                        <Text style={styles.studentName}>{student.name || 'Unknown'}</Text>
                                                        <Text style={styles.studentEmail}>{student.email}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {recipientType === 'group' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Number of Students</Text>
                            <View>
                                <TouchableOpacity
                                    style={styles.dropdown}
                                    onPress={() => setGroupCountOpen((o) => !o)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.dropdownText}>{groupCount}</Text>
                                    <Ionicons
                                        name={groupCountOpen ? 'chevron-up' : 'chevron-down'}
                                        size={18}
                                        color={COLORS.inputBg}
                                    />
                                </TouchableOpacity>
                                {groupCountOpen && (
                                    <View style={styles.dropdownList}>
                                        {Array.from({ length: 9 }, (_, i) => i + 2).map((num) => (
                                            <TouchableOpacity
                                                key={num}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setGroupCount(num);
                                                    setGroupCountOpen(false);
                                                }}
                                            >
                                                <Text style={styles.dropdownItemText}>{num}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View style={{ height: 12 }} />
                            <Text style={styles.label}>Enter Emails</Text>
                            {groupEmails.map((value, idx) => (
                                <View key={idx} style={{ marginBottom: 10, position: 'relative', zIndex: 9999 - idx }}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={`Email ${idx + 1}`}
                                        placeholderTextColor="#A9B8A8"
                                        value={value}
                                        onChangeText={(text) => handleGroupEmailChange(text, idx)}
                                        onFocus={() => {
                                            setShowGroupDropdown(idx);
                                            setFilteredStudents(students);
                                        }}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                    {showGroupDropdown === idx && filteredStudents.length > 0 && (
                                        <View style={styles.studentDropdown}>
                                            <ScrollView 
                                                style={styles.studentDropdownScroll}
                                                nestedScrollEnabled={true}
                                                keyboardShouldPersistTaps="handled"
                                            >
                                                {filteredStudents.slice(0, 10).map((student, studentIdx) => (
                                                    <TouchableOpacity
                                                        key={studentIdx}
                                                        style={styles.studentDropdownItem}
                                                        onPress={() => selectStudent(student, true, idx)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <View style={styles.studentInfo}>
                                                            <Text style={styles.studentName}>{student.name || 'Unknown'}</Text>
                                                            <Text style={styles.studentEmail}>{student.email}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={{ marginTop: 20 }} />
                    <TouchableOpacity 
                        style={[styles.sendButton, sending && styles.sendButtonDisabled]} 
                        onPress={handleSend} 
                        activeOpacity={0.9}
                        disabled={sending}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color={COLORS.buttonText} />
                        ) : (
                            <Ionicons name="send" size={18} color={COLORS.buttonText} style={{ marginRight: 8 }} />
                        )}
                        <Text style={styles.sendButtonText}>
                            {sending ? 'Sending...' : 'Send Notification'}
                        </Text>
                    </TouchableOpacity>
                </View>


                <View style={[styles.card, styles.cardSpacer]}>
                    <Text style={styles.sectionTitle}>Notification History</Text>
                    {history.length === 0 ? (
                        <Text style={styles.emptyText}>No notifications sent yet.</Text>
                    ) : (
                        <FlatList
                            data={history}
                            keyExtractor={(item) => item.id}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                            renderItem={({ item }) => (
                                <View style={styles.historyItem}>
                                    <View style={styles.historyLeft}>
                                        <Text style={styles.historyMessage}>{item.message}</Text>
                                        <Text style={styles.historyTime}>
                                            {new Date(item.createdAt).toLocaleString()}
                                        </Text>
                                    </View>
                                    <View style={styles.historyRight}>
                                        <Text style={styles.historyRecipientType}>
                                            {item.recipientType === 'single' ? '👤 Single' : 
                                             item.recipientType === 'group' ? '👥 Group' : 
                                             '🎓 Class'}
                                        </Text>
                                        <Text style={styles.historyRecipients} numberOfLines={2}>
                                            {Array.isArray(item.recipients) 
                                                ? item.recipients.slice(0, 2).join(', ') + 
                                                  (item.recipients.length > 2 ? ` +${item.recipients.length - 2}` : '')
                                                : item.recipients}
                                        </Text>
                                    </View>
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
                onPressChatbot={() => handleBottomPress('chatbot')}
                onPressSettings={() => handleBottomPress('settings')}
            />

            <UploadConfirmationModal
                visible={showConfirm}
                onClose={closeConfirm}
                title="Notification Sent"
                message="Your notification has been queued to be sent via email."
                operationType="notification"
            />
            <UploadConfirmationModal
                visible={showError}
                onClose={() => setShowError(false)}
                title="Action Required"
                message={errorText}
                operationType="notification"
                variant="error"
            />
        </KeyboardAvoidingView>
    );
}

const TOP_SAFE = Platform.OS === 'android' ? (StatusBar.currentHeight || 32) : 24;

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingTop: TOP_SAFE + 12,
    },
    header: {
        height: 56,
        backgroundColor: 'transparent',
        borderRadius: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        marginTop: 0,
        marginBottom: 8,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: COLORS.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontFamily: 'Griffter',
        fontSize: 20,
        color: COLORS.inputBg,
        textAlign: 'center',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        borderWidth: 2,
        borderColor: COLORS.inputBg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 6,
    },
    sectionTitle: {
        fontFamily: 'Griffter',
        fontSize: 18,
        color: COLORS.inputBg,
        marginBottom: 12,
    },
    inputGroup: {
        marginBottom: 16,
        position: 'relative',
    },
    label: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.heading,
        marginBottom: 8,
    },
    textArea: {
        minHeight: 120,
        backgroundColor: '#F8F9FA',
        borderRadius: 14,
        padding: 14,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#DDE8D8',
        fontFamily: 'Outfit',
        color: COLORS.heading,
    },
    input: {
        height: 48,
        backgroundColor: '#F8F9FA',
        borderRadius: 14,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#DDE8D8',
        fontFamily: 'Outfit',
        color: COLORS.heading,
    },
    segment: {
        flexDirection: 'row',
        backgroundColor: '#F0F5EE',
        borderRadius: 14,
        padding: 4,
        borderWidth: 1,
        borderColor: '#DDE8D8',
    },
    segmentItem: {
        flex: 1,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentItemActive: {
        backgroundColor: COLORS.inputBg,
    },
    segmentText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.inputBg,
    },
    segmentTextActive: {
        color: COLORS.buttonText,
        fontWeight: '600',
    },
    dropdown: {
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#DDE8D8',
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dropdownText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.heading,
    },
    dropdownList: {
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#DDE8D8',
        borderRadius: 12,
        backgroundColor: '#fff',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    dropdownItem: {
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    dropdownItemText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.inputBg,
    },
    sendButton: {
        marginTop: 8,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.buttonBg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sendButtonText: {
        fontFamily: 'Outfit',
        fontSize: 16,
        color: COLORS.buttonText,
        fontWeight: '600',
    },
    cardSpacer: { marginTop: 16 },
    emptyText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.link,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 14,
        marginBottom: 12,
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#DDE8D8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    historyLeft: {
        flex: 1,
        marginRight: 12,
    },
    historyMessage: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.heading,
        fontWeight: '600',
        marginBottom: 4,
    },
    historyTime: {
        fontFamily: 'Outfit',
        fontSize: 11,
        color: COLORS.link,
        opacity: 0.7,
    },
    historyRight: {
        alignItems: 'flex-end',
        maxWidth: '40%',
    },
    historyRecipientType: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.inputBg,
        fontWeight: '600',
        marginBottom: 4,
        backgroundColor: '#F0F5EE',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    historyRecipients: {
        fontFamily: 'Outfit',
        fontSize: 11,
        color: COLORS.heading,
        textAlign: 'right',
    },
    sendButtonDisabled: {
        opacity: 0.6,
    },
    studentDropdown: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#DDE8D8',
        maxHeight: 250,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 20,
        zIndex: 9999,
        marginTop: 2,
    },
    studentDropdownScroll: {
        maxHeight: 250,
    },
    studentDropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F5EE',
        backgroundColor: '#fff',
    },
    studentInfo: {
        flexDirection: 'column',
    },
    studentName: {
        fontFamily: 'Outfit',
        fontSize: 15,
        color: COLORS.heading,
        fontWeight: '600',
        marginBottom: 2,
    },
    studentEmail: {
        fontFamily: 'Outfit',
        fontSize: 13,
        color: COLORS.link,
    },
});


