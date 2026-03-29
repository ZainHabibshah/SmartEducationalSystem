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
            // Get admin data from AsyncStorage (refresh in case it changed)
            const adminName = await AsyncStorage.getItem('admin_name') || 'Administrator';
            const adminEmail = await AsyncStorage.getItem('admin_email') || '';
            
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
            // Get admin data from AsyncStorage
            const adminName = await AsyncStorage.getItem('admin_name') || 'Administrator';
            const adminEmail = await AsyncStorage.getItem('admin_email') || '';
            
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

    const loadEducationalNews = async () => {
        try {
            // Check if we have cached news and if it's still fresh (< 24 hours)
            const cachedNews = await AsyncStorage.getItem('educational_news');
            const cachedDate = await AsyncStorage.getItem('news_cached_date');
            
            const now = new Date();
            let shouldFetchNew = true;
            
            if (cachedNews && cachedDate) {
                const cacheDate = new Date(cachedDate);
                const hoursDiff = (now - cacheDate) / (1000 * 60 * 60);
                
                // Use cache if less than 24 hours old
                if (hoursDiff < 24) {
                    setNewsData(JSON.parse(cachedNews));
                    console.log('📰 Using cached news (fresh)');
                    shouldFetchNew = false;
                }
            }
            
            // Fetch new news if cache is old or doesn't exist
            if (shouldFetchNew) {
                console.log('📰 Fetching fresh educational news...');
                const result = await apiService.getEducationalNews();
                
                if (result && result.success && result.news) {
                    setNewsData(result.news);
                    
                    // Cache the news data
                    await AsyncStorage.setItem('educational_news', JSON.stringify(result.news));
                    await AsyncStorage.setItem('news_cached_date', now.toISOString());
                    
                    console.log('✅ Fetched and cached educational news');
                }
            }
        } catch (error) {
            console.error('Error loading educational news:', error);
            // Use fallback news if API fails
            const fallbackNews = [
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
            setNewsData(fallbackNews);
        }
    };


    const handlePressCard = (key) => {
        if (key === 'students') {
            router.push('/admin/students');
        } else if (key === 'attendance') {
            router.push('/admin/attendance');
        } else if (key === 'timetable') {
            router.push('/admin/timetable');
        } else if (key === 'schedules') {
            router.push('/admin/schedule');
        } else if (key === 'quiz') {
            router.push('/admin/quiz');
        }
    };

    const handleBottomPress = (key) => {
        if (key === 'home') {
            router.push('/admin');
        } else if (key === 'bell') {
            router.push('/admin/notification');
		} else if (key === 'calendar') {
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
                { key: 'attendance', icon: 'checkbox-outline', label: 'Attendance' },
                { key: 'timetable', icon: 'calendar', label: 'Timetable' },
                { key: 'schedules', icon: 'time', label: 'Schedules' },
            ]}
            centerButton={{
                icon: 'podium',
                label: 'Leaderboard',
                onPress: () => router.push('/admin/leaderboard'),
            }}
            footerButton={{
                icon: 'help-circle',
                label: 'Quiz',
                onPress: () => router.push('/admin/quiz'),
            }}
            bottomIcons={[
                { key: 'home', icon: 'home', onPress: () => handleBottomPress('home') },
                { key: 'bell', icon: 'notifications', onPress: () => handleBottomPress('bell') },
                { key: 'calendar', icon: 'chatbubbles', onPress: () => handleBottomPress('calendar') },
                { key: 'settings', icon: 'settings', onPress: () => handleBottomPress('settings') },
            ]}
        />
    );
}

// styles removed in favor of reusable DashboardLayout
