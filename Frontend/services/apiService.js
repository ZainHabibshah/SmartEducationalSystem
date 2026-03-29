// apiService.js
import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../config';

class ApiService {
  constructor() {
    this.token = null;
    this.axiosInstance = axios.create({
      baseURL: API.BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Load token from AsyncStorage if not in memory
        if (!this.token) {
          try {
            const storedToken = await AsyncStorage.getItem('access_token');
            if (storedToken) {
              this.token = storedToken;
            }
          } catch (error) {
            console.error('Error loading token from AsyncStorage:', error);
          }
        }
        
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.code === 'ECONNREFUSED' || error.message === 'Network Error') {
          console.error('❌ Network Error: Cannot connect to backend server.');
          console.error('💡 Make sure the backend server is running on port 8081');
          console.error('💡 Check your BASE_URL in config.js matches your setup');
          const networkError = {
            error: 'Cannot connect to server. Please ensure the backend is running on port 8081.',
            message: 'Network Error: Backend server is not reachable',
            code: 'NETWORK_ERROR'
          };
          return Promise.reject(networkError);
        }
        const responseData = error.response?.data || {};
        const apiError = {
          status: error.response?.status,
          code: error.code,
          ...responseData,
        };
        if (!apiError.error && error.message) {
          apiError.error = error.message;
        }
        if (!apiError.message) {
          apiError.message = apiError.error || error.message || 'Request failed';
        }
        console.error('API Error:', apiError);
        return Promise.reject(apiError);
      }
    );
  }

  setToken(token) {
    this.token = token;
  }

  // ==================== AUTHENTICATION METHODS ====================
  async login(role, email, password) {
    try {
      // Login can take longer due to password hashing & DB lookup, so allow more time
      const result = await this.axiosInstance.post(
        '/auth/login',
        {
          role,
          email,
          password,
        },
        {
          timeout: 30000, // 30 seconds timeout for login
        }
      );
      
      if (result.access_token) {
        this.setToken(result.access_token);
      }
      
      return result;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async loginAdminStep1(email, password) {
    // Validate admin credentials and send OTP email
    try {
      const result = await this.axiosInstance.post('/auth/login', {
        role: 'admin',
        email,
        password,
      });
      return result;
    } catch (error) {
      console.error('Admin step1 login error:', error);
      throw error;
    }
  }

  async verifyAdminOtp(email, otp) {
    // Verify admin OTP and receive JWT token
    try {
      const result = await this.axiosInstance.post('/auth/verify-admin-otp', {
        email,
        otp,
      });

      if (result.access_token) {
        this.setToken(result.access_token);
      }

      return result;
    } catch (error) {
      console.error('Admin OTP verification error:', error);
      throw error;
    }
  }

  async getDashboard() {
    try {
      const result = await this.axiosInstance.get('/auth/dashboard');
      return result;
    } catch (error) {
      console.error('Dashboard error:', error);
      throw error;
    }
  }

  async verifyToken() {
    try {
      const result = await this.axiosInstance.get('/auth/verify-token');
      return result;
    } catch (error) {
      console.error('Token verification error:', error);
      throw error;
    }
  }

  async logout() {
    try {
      const result = await this.axiosInstance.post('/auth/logout');
      this.setToken(null);
      return result;
    } catch (error) {
      console.error('Logout error:', error);
      this.setToken(null);
      throw error;
    }
  }

  // ====================  TIMETABLE METHODS ====================
  async uploadTimetable(imageUri, imageName, otp) {
    try {
      const formData = new FormData();
      
      // For web, we need to convert URI to Blob
      if (Platform.OS === 'web') {
        console.log('📱 Web platform detected - converting image to blob');
        const response = await fetch(imageUri);
        const blob = await response.blob();
        // Create a File object from the blob (works better with backend)
        const file = new File([blob], imageName, { type: 'image/jpeg' });
        formData.append('image', file);
        console.log('✅ Image converted to blob/file for web upload');
      } else {
        // For mobile (iOS/Android), use the standard React Native format
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: imageName,
        });
      }
      
      // Add OTP to form data
      if (otp) {
        formData.append('otp', otp);
      }

      console.log('📤 Uploading timetable with FormData');
      const result = await this.axiosInstance.post('/api/timetable/upload-timetable', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('✅ Upload request completed');
      return result;
    } catch (error) {
      console.error('❌ Upload error:', error);
      console.error('Error details:', error?.response?.data);
      throw error;
    }
  }

  async downloadTimetable(filename) {
    try {
      const response = await this.axiosInstance.get(`/api/timetable/download-timetable/${filename}`, {
        responseType: 'blob', 
      });
      return response;
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }

  async listTimetables() {
    try {
      const result = await this.axiosInstance.get('/api/timetable/list-timetables');
      return result;
    } catch (error) {
      console.error('List timetables error:', error);
      throw error;
    }
  }

  async getEmbeddings(embeddingsFilename) {
    try {
      const result = await this.axiosInstance.get(`/api/timetable/get-embeddings/${embeddingsFilename}`);
      return result;
    } catch (error) {
      console.error('Get embeddings error:', error);
      throw error;
    }
  }

  async deleteTimetable(filename, otp) {
    try {
      // For DELETE requests, send OTP in the request body
      const result = await this.axiosInstance.delete(`/api/timetable/delete-timetable/${filename}`, {
        data: { otp },
      });
      return result;
    } catch (error) {
      console.error('Delete timetable error:', error);
      throw error;
    }
  }

  async debugFiles() {
    try {
      const result = await this.axiosInstance.get('/api/timetable/debug-files');
      return result;
    } catch (error) {
      console.error('Debug files error:', error);
      throw error;
    }
  }

  // ==================== HEALTH CHECKS ====================
  async healthCheck() {
    try {
      console.log('🔍 [API] Testing backend connection...');
      console.log('🔍 [API] Base URL:', this.axiosInstance.defaults.baseURL);
      const result = await this.axiosInstance.get('/health');
      console.log('✅ [API] Backend is reachable!', result);
      return result;
    } catch (error) {
      console.error('❌ [API] Health check failed:', error);
      console.error('❌ [API] Error details:', {
        message: error.message,
        code: error.code,
        baseURL: this.axiosInstance.defaults.baseURL,
      });
      throw error;
    }
  }

  async timetableHealthCheck() {
    try {
      const result = await this.axiosInstance.get('/api/timetable/health');
      return result;
    } catch (error) {
      console.error('Timetable health check error:', error);
      throw error;
    }
  }

  // ====================  CURRICULUM METHODS ====================
  async uploadCurriculumPdf(pdfUri, pdfName, curriculum, otp) {
    try {
      const formData = new FormData();
      
      // For web, we need to convert URI to Blob
      if (Platform.OS === 'web') {
        console.log('📱 Web platform detected - converting PDF to blob');
        const response = await fetch(pdfUri);
        const blob = await response.blob();
        // Create a File object from the blob
        const file = new File([blob], pdfName, { type: 'application/pdf' });
        formData.append('pdf', file);
        console.log('✅ PDF converted to blob/file for web upload');
      } else {
        // For mobile (iOS/Android), use the standard React Native format
        formData.append('pdf', {
          uri: pdfUri,
          type: 'application/pdf',
          name: pdfName,
        });
      }
      
      formData.append('curriculum', curriculum);
      
      // Add OTP to form data
      if (otp) {
        formData.append('otp', otp);
      }

      console.log('📤 Uploading curriculum PDF with FormData');
      const result = await this.axiosInstance.post('/api/curriculum/upload-curriculum-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('✅ Curriculum upload request completed');
      return result;
    } catch (error) {
      console.error('Upload curriculum error:', error);
      throw error;
    }
  }

  async downloadCurriculumPdf(curriculum, filename) {
    try {
      const response = await this.axiosInstance.get(`/api/curriculum/download-curriculum-pdf/${curriculum}/${filename}`, {
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      console.error('Download curriculum error:', error);
      throw error;
    }
  }

  async listCurriculum() {
    try {
      const result = await this.axiosInstance.get('/api/curriculum/list-curriculum');
      return result;
    } catch (error) {
      console.error('List curriculum error:', error);
      throw error;
    }
  }

  async getCurriculumEmbeddings(curriculum, embeddingsFilename) {
    try {
      const result = await this.axiosInstance.get(`/api/curriculum/get-curriculum-embeddings/${curriculum}/${embeddingsFilename}`);
      return result;
    } catch (error) {
      console.error('Get curriculum embeddings error:', error);
      throw error;
    }
  }

  async deleteCurriculumPdf(curriculum, filename) {
    try {
      const result = await this.axiosInstance.delete(`/api/curriculum/delete-curriculum-pdf/${curriculum}/${filename}`);
      return result;
    } catch (error) {
      console.error('Delete curriculum error:', error);
      throw error;
    }
  }

  async curriculumHealthCheck() {
    try {
      const result = await this.axiosInstance.get('/api/curriculum/curriculum-health');
      return result;
    } catch (error) {
      console.error('Curriculum health check error:', error);
      throw error;
    }
  }

  // ====================  NOTIFICATION METHODS ====================
  async sendNotificationToAll(title, message, course = 'computerScience') {
    try {
      const result = await this.axiosInstance.post('/api/notifications/send-notification-all', {
        title,
        message,
        course,
      });
      return result;
    } catch (error) {
      console.error('Send notification to all error:', error);
      throw error;
    }
  }

  async sendNotificationToStudents(studentIds, title, message, course = 'computerScience') {
    try {
      const result = await this.axiosInstance.post('/api/notifications/send-notification', {
        student_ids: studentIds,
        title,
        message,
        course,
      });
      return result;
    } catch (error) {
      console.error('Send notification to students error:', error);
      throw error;
    }
  }

  async getAdminNotificationHistory() {
    try {
      const result = await this.axiosInstance.get('/api/notifications/get-admin-notification-history');
      return result;
    } catch (error) {
      console.error('Get admin notification history error:', error);
      throw error;
    }
  }

  async getEducationalNews() {
    try {
      const result = await this.axiosInstance.get('/api/news/educational-news');
      return result;
    } catch (error) {
      console.error('Get educational news error:', error);
      throw error;
    }
  }

  async updateProfile(profileData) {
    try {
      const result = await this.axiosInstance.put('/auth/update-profile', profileData);
      return result;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  async getStudentProfile() {
    try {
      const result = await this.axiosInstance.get('/auth/get-student-profile');
      return result;
    } catch (error) {
      console.error('Get student profile error:', error);
      throw error;
    }
  }

  async getStudentAttendance() {
    try {
      const result = await this.axiosInstance.get('/auth/student-attendance');
      return result;
    } catch (error) {
      console.error('Get student attendance error:', error);
      throw error;
    }
  }

  async getStudentNotifications(studentId, course) {
    try {
      const result = await this.axiosInstance.get(`/api/notifications/get-student-notifications/${studentId}?course=${course}`);
      return result;
    } catch (error) {
      console.error('Get student notifications error:', error);
      throw error;
    }
  }

  async markNotificationRead(notificationId, studentId, course) {
    try {
      const result = await this.axiosInstance.post('/api/notifications/mark-notification-read', {
        notification_id: notificationId,
        student_id: studentId,
        course: course
      });
      return result;
    } catch (error) {
      console.error('Mark notification read error:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId, studentId, course) {
    try {
      const result = await this.axiosInstance.post('/api/notifications/delete-notification', {
        notification_id: notificationId,
        student_id: studentId,
        course: course
      });
      return result;
    } catch (error) {
      console.error('Delete notification error:', error);
      throw error;
    }
  }

  // Admin Quiz Methods
  async getAdminQuizTopics() {
    try {
      const result = await this.axiosInstance.get('/auth/admin-quiz-topics');
      console.log('🔍 getAdminQuizTopics API result:', result);
      // result is already the response data (not wrapped in result.data)
      return { data: result };
    } catch (error) {
      console.error('Get admin quiz topics error:', error);
      throw error;
    }
  }

  async sendQuizToClass(quizData) {
    try {
      console.log('📤 sendQuizToClass API call with:', quizData);
      // Increase timeout for AI quiz generation (can take 30-60 seconds)
      const result = await this.axiosInstance.post('/auth/send-quiz-to-class', quizData, {
        timeout: 60000  // 60 seconds timeout for quiz generation
      });
      console.log('✅ sendQuizToClass API result:', result);
      return result;  // axios interceptor already unwraps response.data
    } catch (error) {
      console.error('❌ Send quiz error:', error);
      console.error('❌ Error response:', error.response?.data);
      throw error;
    }
  }

  async getQuizStatus(quizId, course) {
    try {
      const result = await this.axiosInstance.get(`/auth/get-quiz-status/${quizId}?course=${course}`);
      return result;
    } catch (error) {
      console.error('Get quiz status error:', error);
      throw error;
    }
  }

  async finishQuiz(quizId, course) {
    try {
      const result = await this.axiosInstance.post(`/auth/finish-quiz/${quizId}`, { course });
      return result;
    } catch (error) {
      console.error('Finish quiz error:', error);
      throw error;
    }
  }

  async getAdminQuizHistory(course) {
    try {
      const result = await this.axiosInstance.get('/auth/get-admin-quiz-history', {
        params: { course }
      });
      return result;
    } catch (error) {
      console.error('Get admin quiz history error:', error);
      throw error;
    }
  }

  async submitQuizFromNotification(quizData) {
    try {
      const result = await this.axiosInstance.post('/auth/save-quiz-result', quizData);
      return result;
    } catch (error) {
      console.error('Submit quiz error:', error);
      throw error;
    }
  }

  async getSubmittedQuizIds() {
    try {
      const result = await this.axiosInstance.get('/auth/get-submitted-quiz-ids');
      return result;
    } catch (error) {
      console.error('Get submitted quiz IDs error:', error);
      throw error;
    }
  }

  async getAllStudents(course = 'computerScience') {
    try {
      const result = await this.axiosInstance.get('/api/notifications/get-all-students', {
        params: { course }
      });
      return result;
    } catch (error) {
      console.error('Get all students error:', error);
      throw error;
    }
  }

  async registerStudent(name, email = '') {
    try {
      const result = await this.axiosInstance.post('/api/notifications/register-student', {
        name,
        email,
      });
      return result;
    } catch (error) {
      console.error('Register student error:', error);
      throw error;
    }
  }

  async deleteStudent(studentId, otp) {
    try {
      const result = await this.axiosInstance.delete(`/auth/delete-student/${studentId}`, {
        data: { otp }
      });
      return result;
    } catch (error) {
      console.error('Delete student error:', error);
      throw error;
    }
  }

  async notificationsHealthCheck() {
    try {
      const result = await this.axiosInstance.get('/api/notifications/health');
      return result;
    } catch (error) {
      console.error('Notifications health check error:', error);
      throw error;
    }
  }

  // ====================  STUDENT MANAGEMENT ====================
  async registerStudent(payload) {
    try {
      const result = await this.axiosInstance.post('/auth/register-student', payload);
      return result;
    } catch (error) {
      console.error('Register student error:', error);
      throw error;
    }
  }

  async getStudents() {
    try {
      // Allow more time for potentially large student lists
      const result = await this.axiosInstance.get('/auth/get-students', {
        timeout: 30000,
      });
      return result;
    } catch (error) {
      console.error('Get students error:', error);
      throw error;
    }
  }

  // ====================  ATTENDANCE (ADMIN) ====================
  async getAttendanceStudents() {
    try {
      // Attendance summary may require computing percentages; allow more time
      const result = await this.axiosInstance.get('/auth/get-attendance-students', {
        timeout: 30000,
      });
      return result;
    } catch (error) {
      console.error('Get attendance students error:', error);
      throw error;
    }
  }

  /**
   * Save attendance for students in the admin's course.
   * `attendanceStatus` is an object like { [studentId]: true|false }
   * `topics` is an object containing today's topic info for that course.
   */
  async saveAttendance(attendanceStatus, topics = {}, date = null) {
    try {
      const payload = {
        attendance: attendanceStatus,
        topics,
      };

      if (date) {
        // Expecting an ISO string; backend will parse it
        payload.date = date;
      }

      const result = await this.axiosInstance.post('/auth/save-attendance', payload);
      return result;
    } catch (error) {
      console.error('Save attendance error:', error);
      throw error;
    }
  }

  // ====================  OTP METHODS ====================
  async requestOperationOtp(operationType) {
    try {
      // Use longer timeout for OTP requests since email sending might take time
      const result = await this.axiosInstance.post('/auth/request-operation-otp', {
        operation_type: operationType,
      }, {
        timeout: 30000, // 30 seconds timeout for OTP requests
      });
      return result;
    } catch (error) {
      console.error('Request operation OTP error:', error);
      // Check if it's a timeout error
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        const timeoutError = {
          error: 'Request timeout. The OTP email may still be sending. Please check your email and try again.',
          message: 'The request took too long. Please check your email inbox for the OTP.',
          code: 'TIMEOUT_ERROR'
        };
        throw timeoutError;
      }
      throw error;
    }
  }

  async verifyOperationOtp(otp, operationType) {
    try {
      const result = await this.axiosInstance.post('/auth/verify-operation-otp', {
        otp,
        operation_type: operationType,
      });
      return result;
    } catch (error) {
      console.error('Verify operation OTP error:', error);
      throw error;
    }
  }

  // ====================  SCHEDULE METHODS ====================
  async listSchedules() {
    try {
      const result = await this.axiosInstance.get('/api/schedules/list');
      return result;
    } catch (error) {
      console.error('List schedules error:', error);
      throw error;
    }
  }

  async uploadSchedule(fileUri, fileName, fileType) {
    try {
      const formData = new FormData();
      
      // For web, convert URI to Blob
      if (Platform.OS === 'web') {
        console.log('📱 Web platform detected - converting file to blob');
        const response = await fetch(fileUri);
        const blob = await response.blob();
        const mimeType = fileType === 'image' ? 'image/jpeg' : 'application/pdf';
        const file = new File([blob], fileName, { type: mimeType });
        formData.append('file', file);
        console.log('✅ File converted to blob for web upload');
      } else {
        // For mobile
        const mimeType = fileType === 'image' ? 'image/jpeg' : 'application/pdf';
        formData.append('file', {
          uri: fileUri,
          type: mimeType,
          name: fileName,
        });
      }
      
      formData.append('file_type', fileType);

      console.log('📤 Uploading schedule file');
      const result = await this.axiosInstance.post('/api/schedules/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds for file upload
      });
      console.log('✅ Schedule upload completed');
      return result;
    } catch (error) {
      console.error('❌ Upload schedule error:', error);
      console.error('Error details:', error?.response?.data);
      throw error;
    }
  }

  async deleteSchedule(filename) {
    try {
      const result = await this.axiosInstance.delete(`/api/schedules/delete/${filename}`);
      return result;
    } catch (error) {
      console.error('Delete schedule error:', error);
      throw error;
    }
  }
  // Quiz APIs
  async getQuizTopics() {
    try {
      const result = await this.axiosInstance.get('/auth/student-quiz-topics');
      return result;
    } catch (error) {
      console.error('Get quiz topics error:', error);
      throw error;
    }
  }

  async generateQuiz(topic, difficulty) {
    try {
      const result = await this.axiosInstance.post('/auth/generate-quiz', {
        topic,
        difficulty
      });
      return result;
    } catch (error) {
      console.error('Generate quiz error:', error);
      throw error;
    }
  }

  async saveQuizResult(quizData) {
    try {
      const result = await this.axiosInstance.post('/auth/save-quiz-result', quizData);
      return result;
    } catch (error) {
      console.error('Save quiz result error:', error);
      throw error;
    }
  }

  // Achievement-related methods
  async getStudentAchievements() {
    try {
      const result = await this.axiosInstance.get('/auth/get-student-achievements');
      return result;
    } catch (error) {
      console.error('Get student achievements error:', error);
      throw error;
    }
  }

  async checkAndUpdateAchievements() {
    try {
      const result = await this.axiosInstance.post('/auth/check-achievements');
      return result;
    } catch (error) {
      console.error('Check achievements error:', error);
      throw error;
    }
  }

  async getLeaderboard() {
    try {
      // Use longer timeout for leaderboard (30 seconds)
      const result = await this.axiosInstance.get('/auth/get-leaderboard', {
        timeout: 30000
      });
      return result;
    } catch (error) {
      console.error('Get leaderboard error:', error);
      // Check if it's a timeout error
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        const timeoutError = {
          error: 'Request timeout',
          message: 'The request took too long. Please try again.',
          code: 'TIMEOUT'
        };
        throw timeoutError;
      }
      throw error;
    }
  }

  async getAdminLeaderboard() {
    try {
      // Use longer timeout for leaderboard (30 seconds)
      const result = await this.axiosInstance.get('/auth/get-admin-leaderboard', {
        timeout: 30000
      });
      return result;
    } catch (error) {
      console.error('Get admin leaderboard error:', error);
      // Check if it's a timeout error
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        const timeoutError = {
          error: 'Request timeout',
          message: 'The request took too long. Please try again.',
          code: 'TIMEOUT'
        };
        throw timeoutError;
      }
      throw error;
    }
  }
}

export default new ApiService();