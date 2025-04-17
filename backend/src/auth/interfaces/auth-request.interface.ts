import { Request } from 'express';
import { User } from '../../user/entities/user.entity';
import { JwtPayload } from './jwt-payload.interface';

// RefreshTokenStrategy의 validate에서 반환하는 객체 타입 정의
export interface RefreshRequest extends Request {
  user: {
    payload: JwtPayload;
    refreshToken: string;
  }
}

// JwtStrategy의 validate에서 반환하는 객체 타입 정의
export type AuthenticatedUser = Omit<User, 'password_hash' | 'currentHashedRefreshToken'>;
export interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
} 