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

export interface ErrorResponse {
  message: string;
  statusCode: number;
}

export interface RefreshTokenResponse {
  message: string;
} 