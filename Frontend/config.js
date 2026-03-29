// config.js
import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_PORT = 8081;

/**
 * Automatically detects and builds backend API URL that works on any network.
 * This function automatically detects your computer's IP from Expo's Metro bundler,
 * so it works on any WiFi network without manual configuration.
 *
 * Resolution order:
 * 1. Explicit env override (EXPO_PUBLIC_API_URL) - for manual override if needed
 * 2. Host detected from Expo/Metro bundler - AUTO DETECTS IP from current network
 * 3. Platform-specific localhost fallbacks
 */
const resolveBaseUrl = () => {
  const normalize = (value) =>
    value?.endsWith("/") ? value.slice(0, -1) : value;

  // 1. Check environment variable first (manual override if needed)
  const envUrl = normalize(process.env.EXPO_PUBLIC_API_URL);
  if (envUrl) {
    console.log('📡 [Config] Using API URL from EXPO_PUBLIC_API_URL:', envUrl);
    return envUrl;
  }

  // 2. AUTO-DETECT: Get host from Expo/Metro bundler connection
  // This automatically uses the same IP that Expo uses to connect your device
  // Works on ANY WiFi network without manual configuration!
  
  // Try multiple sources for the host URI
  const hostUri =
    Constants.expoGoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    Constants.expoConfig?.hostUri ??
    Constants.expoConfig?.extra?.hostUri ??
    Constants.debuggerHost ??
    Constants.manifest?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.hostUri;

  console.log('📡 [Config] Debug - Expo connection info:', {
    expoGoConfig_hostUri: Constants.expoGoConfig?.hostUri || 'not available',
    expoGoConfig_debuggerHost: Constants.expoGoConfig?.debuggerHost || 'not available',
    expoConfig_hostUri: Constants.expoConfig?.hostUri || 'not available',
    debuggerHost: Constants.debuggerHost || 'not available',
    manifest_hostUri: Constants.manifest?.hostUri || 'not available',
    final_hostUri: hostUri || 'not available',
  });

  if (hostUri) {
    // Check if it's a tunnel URL (exp.direct or similar)
    if (hostUri.includes('exp.direct') || hostUri.includes('tunnel') || hostUri.includes('anonymous') || hostUri.includes('ngrok')) {
      // When using tunnel, try to extract IP from the connection string or use fallback
      console.log('📡 [Config] ⚠️  Tunnel mode detected:', hostUri);
      
      // Try to extract IP from tunnel URL if possible (some tunnel formats include IP)
      const ipMatch = hostUri.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (ipMatch && ipMatch[1]) {
        const extractedIp = ipMatch[1];
        const url = `http://${extractedIp}:${DEFAULT_PORT}`;
        console.log('📡 [Config] ✅ Extracted IP from tunnel URL:', url);
        return url;
      }
      
      // If tunnel doesn't have IP, use fallback
      const loopbackHost = Platform.select({
        android: "10.0.2.2",  // Android emulator
        ios: "127.0.0.1",     // iOS simulator
        default: "127.0.0.1", // Default fallback
      });
      const fallbackUrl = `http://${loopbackHost}:${DEFAULT_PORT}`;
      console.log('📡 [Config] Using fallback URL:', fallbackUrl);
      console.log('📡 [Config] ⚠️  Tunnel mode - backend may not be reachable. Use LAN mode instead.');
      return fallbackUrl;
    }
    
    // Extract IP address from Expo's host URI
    // Handle different formats: "192.168.x.x:8081", "http://192.168.x.x:8081", "192.168.x.x"
    let host = hostUri;
    
    // Remove protocol if present
    host = host.replace(/^https?:\/\//, '');
    
    // Extract IP (everything before port or path)
    const parts = host.split(/[:/]/);
    host = parts[0];
    
    // Validate IP format
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(host) && host !== 'localhost' && host !== '127.0.0.1') {
      const url = `http://${host}:${DEFAULT_PORT}`;
      console.log('📡 [Config] ✅ Auto-detected API URL from Expo connection:', url);
      console.log('📡 [Config] Using same IP as Metro bundler - works on any WiFi!');
      return url;
    }
    
    // If hostUri exists but doesn't contain valid IP, log for debugging
    console.log('📡 [Config] ⚠️  Host URI found but no valid IP extracted:', hostUri);
  }

  // 3. Fallback for simulators/emulators only
  const loopbackHost = Platform.select({
    android: "10.0.2.2",  // Android emulator
    ios: "127.0.0.1",     // iOS simulator
    default: "127.0.0.1", // Default fallback
  });

  const fallbackUrl = `http://${loopbackHost}:${DEFAULT_PORT}`;
  console.log('📡 [Config] ⚠️  Using fallback (simulator/emulator only):', fallbackUrl);
  console.log('📡 [Config] 💡 On physical device, Expo should auto-detect the IP');
  console.log('📡 [Config] 💡 If this doesn\'t work, make sure you\'re using: npm run start:lan');
  return fallbackUrl;
};

const BASE_URL = resolveBaseUrl();
console.log('🔗 [Config] Final Backend API URL:', BASE_URL);

// Debug function to test connection
export const testBackendConnection = async () => {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log('✅ [Config] Backend connection successful:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ [Config] Backend connection failed:', error.message);
    console.error('🔍 [Config] Attempted URL:', BASE_URL);
    console.error('💡 [Config] Make sure:');
    console.error('   1. Backend server is running (python app.py)');
    console.error('   2. Both devices are on the same WiFi');
    console.error('   3. Firewall allows port 8081');
    return { success: false, error: error.message };
  }
};

const API = {
  BASE_URL,
  LOGIN: `${BASE_URL}/auth/login`,
  DASHBOARD: `${BASE_URL}/auth/dashboard`,
  VERIFY_TOKEN: `${BASE_URL}/auth/verify-token`,
  LOGOUT: `${BASE_URL}/auth/logout`,
  HEALTH: `${BASE_URL}/health`,
  UPLOAD_TIMETABLE: `${BASE_URL}/api/timetable/upload-timetable`,
  DOWNLOAD_TIMETABLE: `${BASE_URL}/api/timetable/download-timetable`,
  VIEW_TIMETABLE: `${BASE_URL}/api/timetable/view-timetable`,
  LIST_TIMETABLES: `${BASE_URL}/api/timetable/list-timetables`,
  GET_EMBEDDINGS: `${BASE_URL}/api/timetable/get-embeddings`,
  DELETE_TIMETABLE: `${BASE_URL}/api/timetable/delete-timetable`,
  DEBUG_FILES: `${BASE_URL}/api/timetable/debug-files`,
  TIMETABLE_HEALTH: `${BASE_URL}/api/timetable/health`,
  UPLOAD_CURRICULUM: `${BASE_URL}/api/curriculum/upload-curriculum-pdf`,
  DOWNLOAD_CURRICULUM: `${BASE_URL}/api/curriculum/download-curriculum-pdf`,
  LIST_CURRICULUM: `${BASE_URL}/api/curriculum/list-curriculum`,
  GET_CURRICULUM_EMBEDDINGS: `${BASE_URL}/api/curriculum/get-curriculum-embeddings`,
  DELETE_CURRICULUM: `${BASE_URL}/api/curriculum/delete-curriculum-pdf`,
  CURRICULUM_HEALTH: `${BASE_URL}/api/curriculum/curriculum-health`,
  SEND_NOTIFICATION_ALL: `${BASE_URL}/api/notifications/send-notification-all`,
  SEND_NOTIFICATION: `${BASE_URL}/api/notifications/send-notification`,
  GET_STUDENT_NOTIFICATIONS: `${BASE_URL}/api/notifications/get-student-notifications`,
  GET_ALL_STUDENTS: `${BASE_URL}/api/notifications/get-all-students`,
  NOTIFICATIONS_HEALTH: `${BASE_URL}/api/notifications/health`,
  REQUEST_OPERATION_OTP: `${BASE_URL}/auth/request-operation-otp`,
  VERIFY_OPERATION_OTP: `${BASE_URL}/auth/verify-operation-otp`,
};

export default API;