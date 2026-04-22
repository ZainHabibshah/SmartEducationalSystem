import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { Image, ActivityIndicator, View } from 'react-native';
import DashboardLayout from '../../components/DashboardLayout';
import apiService from '../../services/apiService';

export default function AdminDashboard() {
    const router = useRouter();
    const [adminData, setAdminData] = useState({
        name: '',
        email: '',
        studentCount: 0
    });
    const [newsData, setNewsData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        loadAdminData();
        loadEducationalNews();
    }, []);

    // Refresh all dashboard data when screen is focused (e.g., after adding a student, editing, etc.)
    useFocusEffect(
        useCallback(() => {
            // Refresh all dashboard details every time admin comes to dashboard
            refreshDashboardData();
        }, [])
    );

    const refreshDashboardData = async () => {
        try {
            // Teacher login stores teacher_*; older builds used admin_*
            const adminName =
                (await AsyncStorage.getItem('teacher_name')) ||
                (await AsyncStorage.getItem('admin_name')) ||
                'Teacher';
            const adminEmail =
                (await AsyncStorage.getItem('teacher_email')) ||
                (await AsyncStorage.getItem('admin_email')) ||
                '';
            
            // Fetch student count from API (refresh to get latest count)
            let studentCount = 0;
            try {
                const studentsResult = await apiService.getStudents();
                if (studentsResult) {
                    // Prefer backend-provided count if available
                    if (typeof studentsResult.count === 'number') {
                        studentCount = studentsResult.count;
                    } else if (studentsResult.students) {
                        studentCount = studentsResult.students.length;
                    }
                }
            } catch (error) {
                console.error('Error fetching student count:', error);
            }
            
            // Update all dashboard data
            setAdminData({
                name: adminName,
                email: adminEmail,
                studentCount: studentCount
            });
        } catch (error) {
            console.error('Error refreshing dashboard data:', error);
        }
    };

    const loadStudentCount = async () => {
        try {
            const studentsResult = await apiService.getStudents();
            if (studentsResult && studentsResult.students) {
                setAdminData(prev => ({
                    ...prev,
                    studentCount: studentsResult.students.length
                }));
            }
        } catch (error) {
            console.error('Error fetching student count:', error);
        }
    };

    const loadAdminData = async () => {
        try {
            const adminName =
                (await AsyncStorage.getItem('teacher_name')) ||
                (await AsyncStorage.getItem('admin_name')) ||
                'Teacher';
            const adminEmail =
                (await AsyncStorage.getItem('teacher_email')) ||
                (await AsyncStorage.getItem('admin_email')) ||
                '';
            
            // Fetch student count from API
            let studentCount = 0;
            try {
                const studentsResult = await apiService.getStudents();
                if (studentsResult) {
                    if (typeof studentsResult.count === 'number') {
                        studentCount = studentsResult.count;
                    } else if (studentsResult.students) {
                        studentCount = studentsResult.students.length;
                    }
                }
            } catch (error) {
                console.error('Error fetching student count:', error);
            }
            
            setAdminData({
                name: adminName,
                email: adminEmail,
                studentCount: studentCount
            });
        } catch (error) {
            console.error('Error loading admin data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const FALLBACK_NEWS = [
        {
            id: 1,
            title: "AI and Machine Learning Revolutionizing Modern Education",
            url: "https://www.edweek.org/technology/ai-in-education",
            source: "Education Week",
            publishedAt: new Date().toISOString()
        },
        {
            id: 2,
            title: "Digital Literacy: Essential Skills for 21st Century Students",
            url: "https://www.edsurge.com/news/digital-literacy",
            source: "EdSurge",
            publishedAt: new Date().toISOString()
        },
        {
            id: 3,
            title: "Hybrid Learning Models Show Promising Results",
            url: "https://www.insidehighered.com/news/hybrid-learning",
            source: "Inside Higher Ed",
            publishedAt: new Date().toISOString()
        },
        {
            id: 4,
            title: "Student Mental Health Support Gains Priority in Schools",
            url: "https://www.edutopia.org/student-mental-health",
            source: "Edutopia",
            publishedAt: new Date().toISOString()
        },
        {
            id: 5,
            title: "STEM Education Initiatives Drive Student Success",
            url: "https://www.scientificamerican.com/education/stem",
            source: "Scientific American",
            publishedAt: new Date().toISOString()
        }
    ];
    
    const loadEducationalNews = async () => {
      try {
          const result = await apiService.getEducationalNews();
    
          if (result && result.success && result.news && result.news.length > 0) {
              setNewsData(result.news);
          } else {
              // ⚠️ THIS SHOULD TRIGGER
              setNewsData(FALLBACK_NEWS);
          }
      } catch (error) {
          // ⚠️ THIS SHOULD TRIGGER
          setNewsData(FALLBACK_NEWS);
      }
    };


    const handlePressCard = (key) => {
        const routes = {
            students: '/admin/students',
            attendance: '/admin/attendance',
            timetable: '/admin/timetable',
            schedule: '/admin/schedule',
            leaderboard: '/admin/leaderboard',
        };
        const path = routes[key];
        if (path) {
            router.push(path);
        }
    };

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

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
                <ActivityIndicator size="large" color="#03045e" />
            </View>
        );
    }

    return (
        <DashboardLayout
            headerWelcome="Welcome Back!"
            name={adminData.name}
            email={adminData.email}
            extraTopInfo={`Total Students: ${adminData.studentCount}`}
            avatar={
                <Image 
                    source={require('../../assets/images/AdminLogo.png')}
                    style={{ width: 60, height: 60, borderRadius: 30 }}
                    resizeMode="cover"
                />
            }
            showNews
            newsTitle="Educational News"
            newsData={newsData}
            onPressCard={handlePressCard}
            gridItems={[
                { key: 'students', icon: 'people', label: 'Students' },
                { key: 'attendance', icon: 'checkmark-done', label: 'Attendance' },
                { key: 'timetable', icon: 'calendar', label: 'Timetable' },
                { key: 'schedule', icon: 'document-text', label: 'Schedule' },
            ]}
            centerButton={{
                icon: 'trophy',
                label: 'Leaderboard',
                onPress: () => handlePressCard('leaderboard'),
            }}
            footerButton={{
                icon: 'school',
                label: 'Quiz',
                onPress: () => router.push('/admin/quiz'),
                compact: true,
            }}
            bottomIcons={[
                { key: 'home', icon: 'home', onPress: () => handleBottomPress('home') },
                { key: 'bell', icon: 'notifications', onPress: () => handleBottomPress('bell') },
                { key: 'chatbot', icon: 'chatbubbles', onPress: () => handleBottomPress('chatbot') },
                { key: 'settings', icon: 'settings', onPress: () => handleBottomPress('settings') },
            ]}
        />
    );
}

// styles removed in favor of reusable DashboardLayout
