import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import apiService from '../../services/apiService';

const COURSE_LABELS = {
  computerScience: 'Computer Science',
  physics: 'Physics',
  chemistry: 'Chemistry',
};

const { width, height } = Dimensions.get('window');

export default function SuperadminStudentsScreen() {
  const router = useRouter();
  const { course = 'computerScience' } = useLocalSearchParams();
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState(null);

  const courseKey = String(course);

  const slideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const loadStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      let res = null;
      try {
        // Prefer dedicated superadmin endpoint when available.
        res = await apiService.getSuperadminStudentsByCourse(courseKey);
      } catch {
        // Fallback to shared students endpoint to avoid blocking the three course buttons.
        res = await apiService.getAllStudents(courseKey);
      }
      const normalizedValue = (value) => {
        if (value === undefined || value === null) return '';
        const str = String(value).trim();
        return str;
      };

      const pickFirstNonEmpty = (...values) => {
        for (const value of values) {
          const normalized = normalizedValue(value);
          if (normalized.length > 0) return normalized;
        }
        return '';
      };

      const formattedStudents = (res?.students || []).map((student) => {
        const fullName = pickFirstNonEmpty(student.fullName, student.full_name, student.name);
        const fatherName = pickFirstNonEmpty(student.fatherName, student.father_name);
        const address = pickFirstNonEmpty(student.address);
        const pastSchool = pickFirstNonEmpty(student.pastSchool, student.past_school);
        const phoneNumber = pickFirstNonEmpty(
          student.phoneNumber,
          student.phone_number,
          student.phone
        );
        const email = pickFirstNonEmpty(student.email);
        const registrationNumber = pickFirstNonEmpty(
          student.registrationNumber,
          student.registration_number,
          student.rollNumber,
          student.roll_number,
          student.student_id
        );
        const quizHistory = student.quizHistory || student.quiz_history || [];
        const id = pickFirstNonEmpty(
          student.id,
          student._id,
          student.mongo_id,
          student.student_id,
          student.studentId
        );

        const stableFallbackId = pickFirstNonEmpty(
          registrationNumber,
          email,
          fullName
        );

        return {
          ...student,
          id: id || stableFallbackId || 'unknown-student',
          fullName: fullName || 'N/A',
          fatherName: fatherName || 'N/A',
          address: address || 'N/A',
          pastSchool: pastSchool || 'N/A',
          phoneNumber: phoneNumber || 'N/A',
          email: email || 'N/A',
          registrationNumber: registrationNumber || 'N/A',
          quizHistory: Array.isArray(quizHistory) ? quizHistory : [],
        };
      });
      setStudents(formattedStudents);
      setFilteredStudents(formattedStudents);
    } catch (error) {
      Alert.alert('Error', error?.error || error?.message || 'Failed to load students');
      setStudents([]);
      setFilteredStudents([]);
    } finally {
      setIsLoading(false);
    }
  }, [courseKey]);

  useFocusEffect(
    useCallback(() => {
      loadStudents();
    }, [loadStudents])
  );

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredStudents(students);
      return;
    }
    const q = query.toLowerCase();
    const filtered = students.filter((student) => (
      (student.fullName || '').toLowerCase().includes(q) ||
      (student.registrationNumber || '').toLowerCase().includes(q)
    ));
    setFilteredStudents(filtered);
  };

  const handleExpandStudent = (studentId) => {
    setExpandedStudent(expandedStudent === studentId ? null : studentId);
  };

  const onDelete = (student) => {
    Alert.alert('Delete Student', `Delete ${student.fullName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            try {
              await apiService.deleteStudentBySuperadmin(student.id, courseKey);
            } catch {
              // Fallback to existing notifications service delete route.
              await apiService.axiosInstance.delete('/api/notifications/delete-student', {
                params: { student_id: student.id, course: courseKey },
              });
            }
            await loadStudents();
          } catch (error) {
            Alert.alert('Error', error?.error || error?.message || 'Delete failed');
          }
        },
      },
    ]);
  };

  const StudentCard = ({ student, isExpanded }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentCardHeader}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student.fullName || 'N/A'}</Text>
          <Text style={styles.fatherName}>{student.fatherName || 'N/A'}</Text>
        </View>
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => handleExpandStudent(student.id)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={COLORS.inputBg}
          />
        </TouchableOpacity>
      </View>

      {isExpanded && (
        <Animated.View style={styles.expandedContent}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address:</Text>
            <Text style={styles.detailValue}>{student.address || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Past School:</Text>
            <Text style={styles.detailValue}>{student.pastSchool || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone:</Text>
            <Text style={styles.detailValue}>{student.phoneNumber || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email:</Text>
            <Text style={styles.detailValue}>{student.email || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Registration No:</Text>
            <Text style={styles.detailValue}>{student.registrationNumber || 'N/A'}</Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.editBtn]}
              onPress={() => router.push({ pathname: '/superadmin/edit-student', params: { course: courseKey, studentData: JSON.stringify(student) } })}
              activeOpacity={0.85}
            >
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => onDelete(student)}
              activeOpacity={0.85}
            >
              <Text style={styles.actionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.buttonText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{`${COURSE_LABELS[courseKey] || courseKey} Students`}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push(`/superadmin/add-student?course=${courseKey}`)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color={COLORS.buttonText} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.searchSection,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.link} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or registration number..."
            placeholderTextColor={COLORS.link}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>

        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => handleSearch(searchQuery)}
          activeOpacity={0.8}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </Animated.View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.inputBg} />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.studentsList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.studentsListContent}
        >
          {filteredStudents.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              isExpanded={expandedStudent === student.id}
            />
          ))}

          {filteredStudents.length === 0 && (
            <View style={styles.noResultsContainer}>
              <Ionicons name="people-outline" size={64} color={COLORS.link} />
              <Text style={styles.noResultsText}>No students found</Text>
              <Text style={styles.noResultsSubtext}>
                {searchQuery
                  ? 'Try adjusting your search criteria'
                  : 'No students registered yet. Tap + to add a student.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 20,
    paddingTop: Math.max(20, height * 0.03),
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Griffter',
    fontSize: width > 400 ? 22 : 18,
    color: COLORS.buttonText,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: COLORS.inputBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Outfit',
    fontSize: 16,
    color: COLORS.inputBg,
  },
  searchButton: {
    backgroundColor: COLORS.inputBg,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchButtonText: {
    fontFamily: 'Griffter',
    fontSize: 16,
    color: COLORS.buttonText,
  },
  studentsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  studentsListContent: {
    paddingBottom: 20,
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: COLORS.inputBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  studentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontFamily: 'Griffter',
    fontSize: 18,
    color: COLORS.inputBg,
    marginBottom: 4,
  },
  fatherName: {
    fontFamily: 'Outfit',
    fontSize: 14,
    color: COLORS.link,
  },
  expandButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontFamily: 'Griffter',
    fontSize: 14,
    color: COLORS.inputBg,
    width: 120,
    marginRight: 10,
  },
  detailValue: {
    fontFamily: 'Outfit',
    fontSize: 14,
    color: COLORS.link,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  editBtn: {
    backgroundColor: '#4CAF50',
  },
  deleteBtn: {
    backgroundColor: '#F44336',
  },
  actionText: {
    color: '#fff',
    fontFamily: 'Outfit',
    fontWeight: '700',
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    fontFamily: 'Griffter',
    fontSize: 20,
    color: COLORS.inputBg,
    marginTop: 20,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontFamily: 'Outfit',
    fontSize: 16,
    color: COLORS.link,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontFamily: 'Outfit',
    fontSize: 16,
    color: COLORS.link,
    marginTop: 16,
  },
});
