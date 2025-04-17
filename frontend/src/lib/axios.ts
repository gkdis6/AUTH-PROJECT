import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ErrorResponse } from '../types/api';
import useAuthStore from '@/stores/auth';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', // 환경 변수 사용
  withCredentials: true, // **쿠키 전송을 위해 필수!**
});

// 요청 인터셉터: 로깅 추가
apiClient.interceptors.request.use(
  (config) => {
    console.log('Request:', {
      method: config.method,
      url: config.url,
      data: config.data,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// --- 응답 인터셉터 구현 ---
apiClient.interceptors.response.use(
  (response) => {
    console.log('Response:', {
      status: response.status,
      data: response.data,
      headers: response.headers,
    });
    return response;
  },
  async (error: AxiosError<ErrorResponse>) => {
    console.error('Response Error:', {
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers,
    });

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 토큰 갱신이 필요한 경우
    if (originalRequest && error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // 백엔드의 AuthInterceptor가 자동으로 토큰을 갱신하므로
        // 여기서는 단순히 원래 요청을 재시도
        return apiClient(originalRequest);
      } catch (refreshError) {
        // 토큰 갱신 실패 시 로그아웃 처리
        const authStore = useAuthStore.getState();
        authStore.logout();
        
        // 로그인 페이지로 리다이렉트
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }

    // 다른 에러는 그대로 전파
    return Promise.reject(error);
  }
);

export default apiClient; 