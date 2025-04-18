import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status?: any): any {
    if (info instanceof TokenExpiredError) {
      console.log('JwtAuthGuard: Access token expired');
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Access token has expired',
        error: 'Unauthorized',
        errorCode: 'ACCESS_TOKEN_EXPIRED',
      });
    }

    if (info instanceof JsonWebTokenError) {
        console.log('JwtAuthGuard: Invalid token', info.message);
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Invalid access token',
          error: 'Unauthorized',
          errorCode: 'INVALID_ACCESS_TOKEN',
        });
    }

    if (err || !user) {
      console.log('JwtAuthGuard: Unauthorized (could be missing token, user not found, etc.)', err || info?.message);
      throw err || new UnauthorizedException({
        statusCode: 401,
        message: info?.message || 'Unauthorized',
        error: 'Unauthorized',
        errorCode: 'UNAUTHORIZED',
      });
    }

    return user;
  }
} 