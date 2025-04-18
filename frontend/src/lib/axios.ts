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

// --- 응답 인터셉터 (토큰 갱신 로직 변경) ---

let isRefreshing = false; // 토큰 갱신 중인지 여부 플래그
let failedQueue: { resolve: (value: unknown) => void; reject: (reason?: any) => void }[] = []; // 갱신 중 실패한 요청 큐

// 실패한 요청 처리 함수
const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error); // 갱신 실패 시 큐의 모든 요청 reject
    } else {
      prom.resolve(token); // 갱신 성공 시 resolve (이후 재시도에서 사용될 수 있음)
    }
  });
  failedQueue = []; // 큐 비우기
};

apiClient.interceptors.response.use(
  (response) => {
    // 기존 성공 로깅 또는 로직
    console.log('Response OK:', {
      status: response.status,
      url: response.config.url,
      // data: response.data, // 데이터 로깅은 필요시 활성화
    });
    return response;
  },
  async (error: AxiosError<ErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const errorCode = error.response?.data?.errorCode; // 백엔드에서 보낸 errorCode 확인

    console.error('Response Error:', {
      status: status,
      url: originalRequest?.url,
      isRetry: originalRequest?._retry,
      errorCode: errorCode, // errorCode 로깅 추가
      errorMessage: error.message,
      responseData: error.response?.data,
    });

    // 401 에러 처리
    if (originalRequest && status === 401) {

      // !--- 토큰 갱신 조건 변경 ---!
      // errorCode가 'ACCESS_TOKEN_EXPIRED'일 때만 갱신 시도
      if (errorCode !== 'ACCESS_TOKEN_EXPIRED') {
        console.warn(`Auth: Received 401 but errorCode is not ACCESS_TOKEN_EXPIRED (errorCode: ${errorCode}). Skipping refresh.`);
        // 로그아웃 및 리디렉션 로직 추가 (필요시)
        const authStore = useAuthStore.getState();
        if (authStore.isAuthenticated) {
          try { await authStore.logout(); }
          catch (logoutError) { console.error('Auth: Error during automatic logout:', logoutError); }
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
            console.log('Auth: Redirecting to /login');
          }
        }
        return Promise.reject(error); // 갱신 시도 없이 에러 반환
      }

      // --- 이하 토큰 갱신 로직 (ACCESS_TOKEN_EXPIRED 경우) ---
      console.log(`Auth: Received 401 with ACCESS_TOKEN_EXPIRED for ${originalRequest.url}. Attempting token refresh.`);

      // 로그아웃 요청 또는 이미 재시도한 요청은 처리 안 함
      if (originalRequest.url === '/auth/logout' || originalRequest._retry) {
        console.warn(`Auth: Skipping refresh for ${originalRequest.url} (logout or already retried).`);
        // 이미 재시도했는데 또 만료 에러? -> 로그아웃
        if (originalRequest._retry) {
           console.error(`Auth: Received 401 ACCESS_TOKEN_EXPIRED again for ${originalRequest.url} (after retry). Performing logout.`);
           const authStore = useAuthStore.getState();
           if (authStore.isAuthenticated) {
             try { await authStore.logout(); }
             catch (logoutError) { console.error('Auth: Error during automatic logout:', logoutError); }
             if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
               window.location.href = '/login';
              console.log('Auth 2 : Redirecting to /login');
             }
           }
        }
        return Promise.reject(error);
      }

      // 토큰 갱신이 이미 진행 중인 경우
      if (isRefreshing) {
        console.log('Auth: Token refresh already in progress. Adding request to queue.');
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
            originalRequest._retry = true;
            console.log(`Auth: Retrying request from queue: ${originalRequest.url}`);
            return apiClient(originalRequest);
          })
          .catch((err) => {
            console.error(`Auth: Failed to retry request from queue: ${originalRequest.url}`, err);
            return Promise.reject(err);
          });
      }

      // 첫 401 만료 에러, 갱신 시도 시작
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log('Auth: Calling POST /auth/refresh');
        const refreshResponse = await apiClient.post('/auth/refresh');

        if (refreshResponse.status === 200) {
          console.log('Auth: Token refresh successful.');
          processQueue(null, 'new_token_placeholder');
          console.log(`Auth: Retrying original request: ${originalRequest.url}`);
          return apiClient(originalRequest);
        }
        throw new Error('Unexpected status code from /auth/refresh');

      } catch (refreshError: any) {
        console.error('Auth: Token refresh failed.', {
          refreshErrorStatus: refreshError.response?.status,
          refreshErrorMessage: refreshError.message,
        });
        processQueue(refreshError, null);

        console.error('Auth: Performing logout due to refresh failure.');
        const authStore = useAuthStore.getState();
        if (authStore.isAuthenticated) {
          try { await authStore.logout(); }
          catch (logoutError) { console.error('Auth: Error during automatic logout:', logoutError); }
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
            console.log('Auth 3 : Redirecting to /login');
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 401 이외의 에러는 그대로 전파
    return Promise.reject(error);
  }
);

export default apiClient; 