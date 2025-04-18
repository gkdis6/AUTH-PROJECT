import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  private logger = new Logger(AuthInterceptor.name);
  constructor() {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    this.logger.debug('AuthInterceptor: Request received');
    return next.handle().pipe(
      tap(() => this.logger.debug('AuthInterceptor: Request successful')),
      catchError((error) => {
        this.logger.error(`AuthInterceptor: Error caught - ${error.message}`, error.stack);
        return throwError(() => error);
      }),
    );
  }
} 