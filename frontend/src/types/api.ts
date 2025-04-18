import { Role } from '@/types/auth';

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: Role;
  };
}

/**
 * Axios 에러 응답 데이터의 기본 형태
 */
export interface ErrorResponse {
  statusCode: number;
  message: string | string[]; // class-validator 에러는 배열일 수 있음
  error?: string; // 예: "Unauthorized", "Bad Request"
  errorCode?: string; // 커스텀 에러 코드 (예: "ACCESS_TOKEN_EXPIRED")
}

export interface RefreshTokenResponse {
  message: string;
} 