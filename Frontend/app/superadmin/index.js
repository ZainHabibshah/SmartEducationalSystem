import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DashboardLayout from '../../components/DashboardLayout';
import apiService from '../../services/apiService';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState({ name: 'Super Admin', email: '' });
  const [newsData, setNewsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const name = await AsyncStorage.getItem('superadmin_name');
        const email = await AsyncStorage.getItem('superadmin_email');
        setData({ name: name || 'Super Admin', email: email || '' });
      } finally {
        setLoading(false);
      }
    })();
    loadEducationalNews();
  }, []);

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

  const belowNews = null;

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }

  return (
    <DashboardLayout
      headerWelcome="Welcome Back!"
      name={data.name}
      email={data.email}
      extraTopInfo="Manage course teachers"
      showNews
      newsTitle="Educational News"
      newsData={newsData}
      belowNews={belowNews}
      onPressCard={(key) => {
        if (key === 'assignTeacher') router.push('/superadmin/assign-teacher');
        if (key === 'computerScienceStudents') router.push('/superadmin/students?course=computerScience');
        if (key === 'physicsStudents') router.push('/superadmin/students?course=physics');
        if (key === 'chemistryStudents') router.push('/superadmin/students?course=chemistry');
      }}
      gridItems={[
        { key: 'computerScienceStudents', icon: 'school', label: 'Computer Science Students' },
        { key: 'physicsStudents', icon: 'flask', label: 'Physics Students' },
        { key: 'chemistryStudents', icon: 'color-filter', label: 'Chemistry Students' },
      ]}
      centerButton={{
        icon: 'people',
        label: 'Assign / Replace Teacher',
        onPress: () => router.push('/superadmin/assign-teacher'),
      }}
      footerButton={null}
      bottomIcons={[
        { key: 'home', icon: 'home', onPress: () => router.push('/superadmin') },
        { key: 'notification', icon: 'notifications', onPress: () => router.push('/superadmin/notification') },
        { key: 'settings', icon: 'settings', onPress: () => router.push('/superadmin/settings') },
      ]}
    />
  );
}

const COLORS = {
  navy: '#03045e',
  muted: '#5a6b8c',
};

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginBottom: 14,
    marginTop: 2,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#E0E8F5',
    shadowColor: '#03045e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
    minHeight: 128,
  },
  actionCardLeft: {
    marginRight: 8,
    borderTopWidth: 3,
    borderTopColor: '#03045e',
  },
  actionCardRight: {
    marginLeft: 8,
    borderTopWidth: 3,
    borderTopColor: '#FFC107',
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontFamily: 'Griffter',
    fontSize: 17,
    color: COLORS.navy,
    marginBottom: 4,
  },
  actionHint: {
    fontFamily: 'Outfit',
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 15,
    paddingRight: 18,
  },
  actionChevron: {
    position: 'absolute',
    right: 10,
    bottom: 14,
    opacity: 0.85,
  },
});
