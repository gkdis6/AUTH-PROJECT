import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  private logger = new Logger(RefreshTokenGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const refreshToken = request.cookies?.refreshToken;

    this.logger.debug(`Checking for refreshToken cookie... Found: ${!!refreshToken}`);

    if (!refreshToken) {
      this.logger.warn('Refresh token cookie not found.');
      throw new UnauthorizedException('Refresh token not found');
    }
    // 실제 토큰 유효성 검증은 서비스/컨트롤러에서 수행
    return true;
  }
} 