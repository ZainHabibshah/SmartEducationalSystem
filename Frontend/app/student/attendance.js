import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import BottomNav from '../../components/BottomNav';
import apiService from '../../services/apiService';

const COLORS = {
    bg: '#F5F5F5',
    heading: '#03045e',
    inputBg: '#03045e',
    inputText: '#FFFFFF',
    buttonBg: '#03045e',
    buttonText: '#FFFFFF',
    link: '#023e8a',
};

const { height } = Dimensions.get('window');
const BOTTOM_NAV_HEIGHT = height * 0.16;

function AttendanceDonut({ present, absent, size = 200, strokeWidth = 22 }) {
    const total = Math.max(present + absent, 1);
    const presentPct = present / total;
    const absentPct = absent / total;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const presentLength = circumference * presentPct;
    const absentLength = circumference * absentPct;

    // 90% indicator position
    const indicatorPct = 0.9;
    const theta = -Math.PI / 2 + indicatorPct * 2 * Math.PI; // start at top, clockwise
    const indicatorR = radius;
    const indicatorX = size / 2 + indicatorR * Math.cos(theta);
    const indicatorY = size / 2 + indicatorR * Math.sin(theta);

    return (
        <View style={styles.chartContainer}>
            <View>
                <Svg width={size} height={size}>
                    {/* Background ring */}
                    <Circle cx={size/2} cy={size/2} r={radius} stroke="#E6E6E6" strokeWidth={strokeWidth} fill="transparent" />
                    {/* Present arc */}
                    <Circle
                        cx={size/2}
                        cy={size/2}
                        r={radius}
                        stroke="#4CAF50"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={`${presentLength} ${circumference}`}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${size/2} ${size/2})`}
                    />
                    {/* Absent arc (starts after present) */}
                    <Circle
                        cx={size/2}
                        cy={size/2}
                        r={radius}
                        stroke="#F44336"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={`${absentLength} ${circumference}`}
                        strokeDashoffset={-presentLength}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${size/2} ${size/2})`}
                    />
                    {/* 90% marker */}
                    <Circle cx={indicatorX} cy={indicatorY} r={5} fill="#FFC107" stroke="#FFFFFF" strokeWidth={2} />
                </Svg>
                <View style={styles.chartCenter}>
                    <Text style={styles.chartCenterTitle}>Attendance</Text>
                    <Text style={styles.chartCenterText}>{(presentPct * 100).toFixed(1)}%</Text>
                </View>
            </View>
            {/* Indicators with arrows */}
            <View style={styles.chartIndicators}>
                <View style={styles.indicatorRow}>
                    <Ionicons name="arrow-forward" size={16} color="#4CAF50" />
                    <Text style={styles.indicatorText}>Present</Text>
                </View>
                <View style={styles.indicatorRow}>
                    <Ionicons name="arrow-forward" size={16} color="#F44336" />
                    <Text style={styles.indicatorText}>Absent</Text>
                </View>
            </View>
        </View>
    );
}

export default function StudentAttendanceScreen() {
    const router = useRouter();
    const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, absent: 0 });
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAttendance();
    }, []);

    const loadAttendance = async () => {
        try {
            setLoading(true);
            console.log('📡 Loading student attendance...');
            const result = await apiService.getStudentAttendance();
            
            console.log('📥 Attendance result:', result);
            
            if (result && result.success) {
                console.log('📊 Summary:', result.summary);
                console.log('📝 Attendance records:', result.attendance);
                
                // Set summary
                setAttendanceSummary({
                    present: result.summary?.present || 0,
                    absent: result.summary?.absent || 0
                });
                
                // Format history records
                const formattedHistory = (result.attendance || []).map(record => {
                    // Handle topics - ensure it's always a string
                    let topicsText = 'No topics recorded';
                    if (record.topics) {
                        if (typeof record.topics === 'object') {
                            // If it's an object, get the first value
                            const values = Object.values(record.topics);
                            topicsText = values.length > 0 ? values[0] : 'No topics recorded';
                        } else {
                            topicsText = record.topics;
                        }
                    }
                    
                    return {
                        date: record.date || '',
                        status: record.status || 'Unknown',
                        topics: topicsText,
                        students_present: record.students_present || 0,
                        students_absent: record.students_absent || 0,
                        total_students: record.total_students || 0
                    };
                });
                
                setAttendanceHistory(formattedHistory);
                console.log(`✅ Loaded ${formattedHistory.length} attendance records`);
                console.log('Present:', result.summary?.present, 'Absent:', result.summary?.absent);
            } else {
                console.warn('⚠️ Invalid result structure:', result);
                setAttendanceSummary({ present: 0, absent: 0 });
                setAttendanceHistory([]);
            }
        } catch (error) {
            console.error('❌ Error loading attendance:', error);
            console.error('Error details:', error.response || error.message);
            // Show empty state on error
            setAttendanceSummary({ present: 0, absent: 0 });
            setAttendanceHistory([]);
        } finally {
            setLoading(false);
        }
    };

    const handleBottomPress = (key) => {
        switch (key) {
            case 'home':
                router.push('/student');
                break;
            case 'bell':
                router.push('/student/notification');
                break;
            case 'chat':
                router.push('/student/chatbot');
                break;
            case 'settings':
                router.push('/student/settings');
                break;
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.push('/student');
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.customHeaderContainer}>
                    <TouchableOpacity style={styles.customBackButton} onPress={handleBack} activeOpacity={0.8}>
                        <Ionicons name="arrow-back" size={22} color={COLORS.inputBg} />
                    </TouchableOpacity>
                    <Text style={styles.customHeaderTitle}>Attendance</Text>
                    <View style={styles.headerPlaceholder} />
                </View>
                <View style={styles.fullScreenLoading}>
                    <ActivityIndicator size="large" color={COLORS.link} />
                    <Text style={styles.loadingText}>Loading attendance data...</Text>
                </View>
                <BottomNav
                    onPressHome={() => handleBottomPress('home')}
                    onPressNotifications={() => handleBottomPress('bell')}
                    onPressChatbot={() => handleBottomPress('chat')}
                    onPressSettings={() => handleBottomPress('settings')}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.customHeaderContainer}>
                <TouchableOpacity style={styles.customBackButton} onPress={handleBack} activeOpacity={0.8}>
                    <Ionicons name="arrow-back" size={22} color={COLORS.inputBg} />
                </TouchableOpacity>
                <Text style={styles.customHeaderTitle}>Attendance</Text>
                <View style={styles.headerPlaceholder} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Donut Chart */}
                <AttendanceDonut present={attendanceSummary.present} absent={attendanceSummary.absent} />

                {/* History Box */}
                <View style={styles.historyBox}>
                    <View style={styles.historyHeader}>
                        <Text style={styles.historyHeaderText}>History</Text>
                    </View>
                    <View style={styles.historyBody}>
                        {attendanceHistory.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="calendar-outline" size={48} color={COLORS.link} />
                                <Text style={styles.emptyText}>No attendance records yet</Text>
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 850 }}>
                                    {/* Table header */}
                                    <View style={styles.tableHeaderRow}>
                                        <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Date</Text>
                                        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Status</Text>
                                        <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Topics Covered</Text>
                                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Present</Text>
                                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Absent</Text>
                                    </View>
                                    {/* Rows */}
                                    <ScrollView showsVerticalScrollIndicator={true}>
                                        {attendanceHistory.map((item, idx) => (
                                            <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                                                <Text style={[styles.tableCell, { flex: 1.5 }]}>{item.date}</Text>
                                                <Text style={[styles.tableCell, { flex: 1.2, color: item.status === 'Present' ? '#2E7D32' : '#C62828', fontWeight: '700' }]}>{item.status}</Text>
                                                <Text style={[styles.tableCell, { flex: 3 }]} numberOfLines={2}>{item.topics}</Text>
                                                <Text style={[styles.tableCell, { flex: 1, color: '#2E7D32', fontWeight: '600', textAlign: 'center' }]}>{item.students_present}</Text>
                                                <Text style={[styles.tableCell, { flex: 1, color: '#C62828', fontWeight: '600', textAlign: 'center' }]}>{item.students_absent}</Text>
                                            </View>
                                        ))}
                                    </ScrollView>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>

                <View style={{ height: 24 }} />
            </ScrollView>

            <BottomNav
                onPressHome={() => handleBottomPress('home')}
                onPressNotifications={() => handleBottomPress('bell')}
                onPressChatbot={() => handleBottomPress('chat')}
                onPressSettings={() => handleBottomPress('settings')}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    customHeaderContainer: {
        padding: 20,
        paddingTop: Platform.select({ ios: 70, android: 50 }),
        backgroundColor: COLORS.bg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    customBackButton: {
        width: 40,
        height: 40,
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.inputBg,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    customHeaderTitle: {
        fontFamily: 'Griffter',
        fontSize: 28,
        color: COLORS.inputBg,
        textAlign: 'center',
        flex: 1,
    },
    headerPlaceholder: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    contentContainer: {
        paddingBottom: 20 + BOTTOM_NAV_HEIGHT,
    },
    chartContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    chartCenter: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chartCenterTitle: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.link,
    },
    chartCenterText: {
        fontFamily: 'Griffter',
        fontSize: 28,
        color: COLORS.inputBg,
    },
    chartCenterSub: {
        fontFamily: 'Outfit',
        fontSize: 12,
        color: COLORS.link,
    },
    chartIndicators: {
        marginTop: 12,
        flexDirection: 'row',
        gap: 16,
    },
    indicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    indicatorText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.heading,
    },
    historyBox: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#e6e6e6',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    historyHeader: {
        height: 56,
        backgroundColor: COLORS.link,
        alignItems: 'center',
        justifyContent: 'center',
    },
    historyHeaderText: {
        fontFamily: 'Griffter',
        fontSize: 20,
        color: '#FFFFFF',
    },
    historyBody: {
        maxHeight: 320,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
        marginBottom: 10,
    },
    tableHeaderCell: {
        fontFamily: 'Outfit',
        fontSize: 13,
        color: COLORS.heading,
        fontWeight: '600',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f2f2f2',
    },
    tableRowAlt: {
        backgroundColor: '#FAFAFA',
    },
    tableCell: {
        fontFamily: 'Outfit',
        fontSize: 13,
        color: COLORS.heading,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    loadingText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.link,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyText: {
        fontFamily: 'Outfit',
        fontSize: 14,
        color: COLORS.link,
    },
    fullScreenLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
        gap: 16,
    },
});