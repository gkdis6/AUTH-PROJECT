import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { Response } from 'express';

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  constructor(private authService: AuthService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    return next.handle().pipe(
      catchError((error) => {
        if (error instanceof HttpException && error.getStatus() === HttpStatus.UNAUTHORIZED) {
          const request = context.switchToHttp().getRequest();
          const response = context.switchToHttp().getResponse<Response>();
          const refreshToken = request.cookies?.refreshToken;

          if (!refreshToken) {
            return throwError(() => error);
          }

          // Promise를 Observable로 변환하고 pipe 연산자 사용
          return from(this.authService.refreshTokensFromInterceptor(refreshToken, response)).pipe(
            switchMap(() => {
              // 원래 요청 재시도
              return next.handle();
            }),
            catchError(() => {
              // Refresh Token도 만료된 경우
              return throwError(() => error);
            }),
          );
        }
        return throwError(() => error);
      }),
    );
  }
} 