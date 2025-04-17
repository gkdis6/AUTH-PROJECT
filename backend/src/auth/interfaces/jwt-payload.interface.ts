import { Role } from '../enums/role.enum'; // Role enum 경로 확인 필요

export interface JwtPayload {
  /**
   * User ID (Subject)
   */
  sub: string; // 표준 클레임 'sub' 사용 (사용자 ID)

  /**
   * User Email
   */
  email: string;

  /**
   * User Role
   */
  role: Role; // 사용자의 역할을 포함하여 인가(Authorization)에 활용

  // 필요에 따라 다른 정보 추가 가능 (e.g., username)
  // username?: string;
} 