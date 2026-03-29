import { useEffect } from 'react';
import LoginScreen from '../screens/LoginScreen';
import apiService from '../services/apiService';
import API from '../config';

export default function Index() {
  useEffect(() => {
    // Test backend connection on app start and log connection info
    const testConnection = async () => {
      console.log('🔍 [App] Testing backend connection...');
      console.log('🔍 [App] Backend URL:', API.BASE_URL);
      
      try {
        const result = await apiService.healthCheck();
        console.log('✅ [App] Backend is connected!', result);
      } catch (error) {
        console.error('❌ [App] Backend connection failed!');
        console.error('❌ [App] Error:', error.message || error);
        console.error('❌ [App] Attempted URL:', API.BASE_URL);
        console.error('💡 [App] Troubleshooting:');
        console.error('   1. Make sure backend is running: cd Backend && python app.py');
        console.error('   2. Check if IP is correct:', API.BASE_URL);
        console.error('   3. Ensure both devices are on same WiFi');
        console.error('   4. Check Windows Firewall allows port 8081');
        console.warn('⚠️ App will continue loading, but backend features may not work');
      }
    };

    // Delay connection test slightly to ensure Expo has initialized
    const timer = setTimeout(() => {
      testConnection();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return <LoginScreen />;
}