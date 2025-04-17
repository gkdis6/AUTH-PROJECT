// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import { User } from 'src/user/entities/user.entity'; // User 엔티티 임포트

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 핸들러에 설정된 필요한 역할( @Roles(...) ) 가져오기
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // @Roles() 데코레이터가 없으면 누구나 접근 가능 (혹은 기본 정책에 따름)
    if (!requiredRoles) {
      return true;
    }

    // request 객체에서 user 정보 가져오기 (JwtAuthGuard 이후 실행되어야 함)
    const request = context.switchToHttp().getRequest();
    const user: User = request.user; // JwtStrategy의 validate에서 반환된 user 객체

    // 사용자가 없거나 역할 정보가 없으면 접근 불가
    if (!user || !user.role) {
        return false;
    }

    // 사용자의 역할이 필요한 역할 중 하나라도 포함되는지 확인
    return requiredRoles.some((role) => user.role === role);
  }
}