import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, ActivityIndicator, View } from 'react-native';
import DashboardLayout from '../../components/DashboardLayout';
import apiService from '../../services/apiService';
import { ACHIEVEMENTS, getAchievementById } from '../../data/achievements';

export default function StudentDashboard() {
    const router = useRouter();
    const [studentData, setStudentData] = useState({
        name: '',
        email: '',
        class: ''
    });
    const [educationalNews, setEducationalNews] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unlockedBadges, setUnlockedBadges] = useState(new Set());

    useEffect(() => {
        loadStudentData();
        loadEducationalNews();
        loadAchievements();
    }, []);

    const loadAchievements = async () => {
        try {
            // Check and update achievements
            await apiService.checkAndUpdateAchievements();
            // Get unlocked badges
            const response = await apiService.getStudentAchievements();
            if (response && response.badges) {
                setUnlockedBadges(new Set(response.badges));
            }
        } catch (error) {
            console.error('Error loading achievements:', error);
        }
    };

    const loadStudentData = async () => {
        try {
            // Get student data from AsyncStorage
            const studentName = await AsyncStorage.getItem('student_name') || 'Student';
            const studentEmail = await AsyncStorage.getItem('student_email') || '';
            const studentClass = await AsyncStorage.getItem('student_class') || '';
            const studentCourse = await AsyncStorage.getItem('student_course') || '';
            
            // Format class display - prefer class field, otherwise use course name
            let classDisplay = '';
            if (studentClass) {
                classDisplay = studentClass; // e.g., "Class09"
            } else if (studentCourse) {
                const courseDisplayNames = {
                    'computerScience': 'Computer Science',
                    'chemistry': 'Chemistry',
                    'physics': 'Physics'
                };
                classDisplay = courseDisplayNames[studentCourse] || studentCourse;
            }
            
            setStudentData({
                name: studentName,
                email: studentEmail,
                class: classDisplay
            });
        } catch (error) {
            console.error('Error loading student data:', error);
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
                    setEducationalNews(JSON.parse(cachedNews));
                    console.log('📰 Using cached news (fresh)');
                    shouldFetchNew = false;
                }
            }
            
            // Fetch new news if cache is old or doesn't exist
            if (shouldFetchNew) {
                console.log('📰 Fetching fresh educational news...');
                const result = await apiService.getEducationalNews();
                
                if (result && result.success && result.news) {
                    setEducationalNews(result.news);
                    
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
            setEducationalNews(fallbackNews);
        }
    };

    const handlePressCard = (key) => {
        if (key === 'courses-content') {
            router.push('/student/curriculum');
        } else if (key === 'attendance') {
            router.push('/student/attendance');
        } else if (key === 'timetable') {
            router.push('/student/timetable');
        } else if (key === 'Quizes') {
            router.push('/student/quiz');
        } else if (key === 'achievements') {
            router.push('/student/achievements'); 
        }
    };

    const handleBottomPress = (key) => {
        if (key === 'home') {
            router.push('/student');
        } else if (key === 'bell') {
            router.push('/student/notification');
        } else if (key === 'calendar') {
            router.push('/student/chatbot');
        } else if (key === 'settings') {
            router.push('/student/settings');
        }
    };

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
                <ActivityIndicator size="large" color="#03045e" />
            </View>
        );
    }

    // Get unlocked achievement data - show all in header
    const unlockedAchievements = Array.from(unlockedBadges)
        .map(badgeId => getAchievementById(badgeId))
        .filter(achievement => achievement !== undefined);

    return (
        <DashboardLayout
            headerWelcome="Welcome Back!"
            name={studentData.name}
            email={studentData.email}
            extraTopInfo={studentData.class ? `Class: ${studentData.class}` : ''}
            avatar={
                <Image 
                    source={require('../../assets/images/StudentLogo.jpg')}
                    style={{ width: 60, height: 60, borderRadius: 30 }}
                    resizeMode="cover"
                />
            }
            achievementBadges={unlockedAchievements}
            showNews
            newsTitle="Educational News"
            newsData={educationalNews}
            onPressCard={handlePressCard}
            gridItems={[
                { key: 'courses-content', icon: 'book', label: 'Courses Contents' },
                { key: 'attendance', icon: 'checkbox-outline', label: 'Attendance' },
                { key: 'timetable', icon: 'calendar', label: 'Timetable' },
                { key: 'Quizes', icon: 'document-text', label: 'Quize' },
            ]}
            centerButton={{
                icon: 'podium',
                label: 'Leaderboard',
                onPress: () => router.push('/student/leaderboard'),
            }}
            footerButton={{
                icon: 'trophy',
                label: 'Achievements',
                onPress: () => router.push('/student/achievements'),
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
