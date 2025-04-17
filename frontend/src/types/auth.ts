export enum Role {
  USER = 'user',
  ADMIN = 'admin',
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends LoginCredentials {
  // 필요한 경우 추가 필드
}

export interface AuthState {
  user: {
    id: string;
    email: string;
    role: Role;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
} 