// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { User } from '../user/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Observable, of, throwError } from 'rxjs';
import { Role } from './enums/role.enum';
// User 엔티티에 role 필드가 정의되어 있고, Role enum 타입과 호환되어야 합니다.
// 예: import { Role } from '../user/enums/role.enum';

@Injectable()
export class AuthService {
  private logger = new Logger('AuthService');

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // 회원가입 (UserService의 createUser 호출)
  async signUp(createUserDto: CreateUserDto): Promise<User> {
    console.log('Signup service:', createUserDto);
    const user = await this.userService.createUser({
      ...createUserDto,
      role: Role.USER,
    });
    console.log('User created:', { id: user.id, email: user.email });
    return user;
  }

  // --- Helper: 토큰 쿠키 설정 ---
  private setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const accessMaxAge = parseInt(this.configService.get<string>('JWT_EXPIRATION_TIME_MS') || '900000');
    const refreshMaxAge = parseInt(this.configService.get<string>('JWT_REFRESH_EXPIRATION_TIME_MS') || '604800000');

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: accessMaxAge,
      path: '/',
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: refreshMaxAge,
      path: '/', // Refresh Token은 갱신 엔드포인트에서만 사용
    });
  }

  // --- Helper: 토큰 쿠키 제거 ---
  private clearTokenCookies(res: Response) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('accessToken', '', {
      httpOnly: true, secure: isProduction, sameSite: 'lax',
      expires: new Date(0), path: '/',
    });
    res.cookie('refreshToken', '', {
      httpOnly: true, secure: isProduction, sameSite: 'lax',
      expires: new Date(0), path: '/', // 설정 시 path와 동일하게 유지
    });
  }

  // 로그인: 쿠키 설정
  async signIn(loginDto: LoginDto, res: Response): Promise<{ user: Omit<User, 'password_hash' | 'currentHashedRefreshToken'> }> {
    console.log('Login service:', { email: loginDto.email });
    const { email, password } = loginDto;
    const user = await this.userService.findOneByEmail(email);

    if (user && (await bcrypt.compare(password, user.password_hash))) {
      const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
      const accessToken = await this.generateAccessToken(payload);
      const refreshToken = await this.generateRefreshToken({ sub: user.id });

      await this.setCurrentRefreshToken(refreshToken, user.id);
      this.setTokenCookies(res, accessToken, refreshToken);

      this.logger.debug(`User ${email} logged in successfully`);
      const { password_hash, currentHashedRefreshToken, ...result } = user;
      return { user: result };
    } else {
      console.log('User not found or invalid password');
      throw new UnauthorizedException('Invalid email or password');
    }
  }

  // 토큰 재발급: 새 Access Token 쿠키 설정
  async refreshTokens(userId: string, refreshTokenFromCookie: string, res: Response): Promise<void> {
    console.log('Refresh tokens service:', { userId: userId });
    const user = await this.userService.findOneById(userId);

    if (!user || !user.currentHashedRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isRefreshTokenMatching = await bcrypt.compare(
      refreshTokenFromCookie,
      user.currentHashedRefreshToken
    );

    if (!isRefreshTokenMatching) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const newAccessToken = await this.generateAccessToken(payload);
    const newRefreshToken = await this.generateRefreshToken({ sub: user.id });

    await this.setCurrentRefreshToken(newRefreshToken, user.id);
    this.setTokenCookies(res, newAccessToken, newRefreshToken);

    this.logger.debug(`Tokens refreshed for user ${user.email}`);
  }

  // 로그아웃: 쿠키 제거
  async logout(userId: string, res: Response): Promise<void> {
    console.log('Logout service');
    await this.userService.updateUser(userId, { currentHashedRefreshToken: null });
    this.clearTokenCookies(res);
    this.logger.debug(`User ${userId} logged out successfully`);
  }

  // Access Token 생성
  private async generateAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRATION_TIME'),
    });
  }

  // Refresh Token 생성
  private async generateRefreshToken(payload: { sub: string }): Promise<string> {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('REFRESH_TOKEN_EXPIRATION_TIME'),
    });
  }

  // Refresh Token DB 저장 (해싱)
  async setCurrentRefreshToken(refreshToken: string, userId: string) {
    const saltRounds = 10;
    const currentHashedRefreshToken = await bcrypt.hash(refreshToken, saltRounds);
    await this.userService.updateUser(userId, { currentHashedRefreshToken });
  }

  // JWT 검증 (JwtStrategy에서 사용)
  async validateUser(payload: JwtPayload): Promise<User> {
    const { sub: userId } = payload;
    const user = await this.userService.findOneById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid token: User not found');
    }
    return user;
  }

  // Interceptor에서 사용할 토큰 갱신 메서드
  async refreshTokensFromInterceptor(refreshToken: string, res: Response): Promise<Observable<any>> {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });

      const user = await this.userService.findOneById(decoded.sub);
      if (!user || !user.currentHashedRefreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isRefreshTokenMatching = await bcrypt.compare(
        refreshToken,
        user.currentHashedRefreshToken
      );

      if (!isRefreshTokenMatching) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
      const newAccessToken = await this.generateAccessToken(payload);
      const newRefreshToken = await this.generateRefreshToken({ sub: user.id });

      await this.setCurrentRefreshToken(newRefreshToken, user.id);
      this.setTokenCookies(res, newAccessToken, newRefreshToken);

      return of(true);
    } catch (error) {
      return throwError(() => new UnauthorizedException('Token refresh failed'));
    }
  }
}