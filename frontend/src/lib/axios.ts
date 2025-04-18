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

    console.error('Response Error:', {
      status: status,
      url: originalRequest?.url,
      isRetry: originalRequest?._retry,
      errorMessage: error.message,
      // responseData: error.response?.data, // 필요시 활성화
    });

    // 401 에러 처리 (토큰 갱신 시도)
    if (originalRequest && status === 401) {
      // 로그아웃 요청 또는 이미 재시도한 요청은 처리 안 함
      if (originalRequest.url === '/auth/logout' || originalRequest._retry) {
        console.warn(`Auth: Skipping refresh for ${originalRequest.url} (logout or already retried).`);
        // 이미 재시도한 경우 로그아웃 처리 (기존 로직 유지 가능)
        if (originalRequest._retry) {
           console.error(`Auth: Received 401 again for ${originalRequest.url} (original request had _retry=true). Performing logout.`);
           // 로그아웃 로직... (기존 코드 활용)
           const authStore = useAuthStore.getState();
           if (authStore.isAuthenticated) {
             try { await authStore.logout(); }
             catch (logoutError) { console.error('Auth: Error during automatic logout:', logoutError); }
             // 리디렉션 로직 다시 활성화
             if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
               window.location.href = '/login';
             }
           }
        }
        return Promise.reject(error);
      }

      // 토큰 갱신이 이미 진행 중인 경우
      if (isRefreshing) {
        console.log('Auth: Token refresh already in progress. Adding request to queue.');
        // 현재 요청을 큐에 추가하고, 갱신 완료 후 처리될 Promise 반환
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
            // 토큰 갱신 성공 후, 원래 요청 재시도
            originalRequest._retry = true; // 재시도 플래그 설정
            console.log(`Auth: Retrying request from queue: ${originalRequest.url}`);
            return apiClient(originalRequest);
          })
          .catch((err) => {
            // 토큰 갱신 실패 시 에러 반환
            console.error(`Auth: Failed to retry request from queue: ${originalRequest.url}`, err);
            return Promise.reject(err);
          });
      }

      // 첫 401 에러, 갱신 시도 시작
      console.log(`Auth: Received 401 for ${originalRequest.url}. Attempting token refresh.`);
      originalRequest._retry = true; // 재시도 플래그는 여기서도 설정 (갱신 실패 시 바로 reject하기 위함)
      isRefreshing = true;

      try {
        // 토큰 갱신 API 호출
        console.log('Auth: Calling POST /auth/refresh');
        const refreshResponse = await apiClient.post('/auth/refresh');

        if (refreshResponse.status === 200) {
          console.log('Auth: Token refresh successful (received 200 from /auth/refresh).');
          // 갱신 성공. 큐에 쌓인 요청들 처리 (resolve)
          processQueue(null, 'new_token_placeholder'); // 토큰 값은 실제론 필요없음

          // 원래 실패했던 요청 재시도
          console.log(`Auth: Retrying original request: ${originalRequest.url}`);
          return apiClient(originalRequest);
        }
        // 200이 아닌 경우 (이론상 발생하기 어려움)
        throw new Error('Unexpected status code from /auth/refresh');

      } catch (refreshError: any) {
        // 토큰 갱신 실패 (/auth/refresh 호출 실패)
        console.error('Auth: Token refresh failed.', {
          refreshErrorStatus: refreshError.response?.status,
          refreshErrorMessage: refreshError.message,
        });
        // 갱신 실패. 큐에 쌓인 요청들 처리 (reject)
        processQueue(refreshError, null);

        // 로그아웃 처리
        console.error('Auth: Performing logout due to refresh failure.');
        const authStore = useAuthStore.getState();
        if (authStore.isAuthenticated) {
          try { await authStore.logout(); }
          catch (logoutError) { console.error('Auth: Error during automatic logout:', logoutError); }
          // 리디렉션 로직 다시 활성화
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        // 갱신 실패 에러 반환
        return Promise.reject(refreshError);
      } finally {
        // 갱신 작업 완료 후 플래그 리셋
        isRefreshing = false;
      }
    }

    // 401 이외의 에러는 그대로 전파
    return Promise.reject(error);
  }
);

export default apiClient; 