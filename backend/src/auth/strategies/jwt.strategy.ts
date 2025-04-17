// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UserService } from 'src/user/user.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '../../user/entities/user.entity';
import * as bcrypt from 'bcrypt';

// 쿠키에서 Access Token 추출하는 함수
const cookieExtractor = (req: Request): string | null => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies['accessToken']; // 'accessToken' 쿠키 이름
  }
  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {
    super({
      jwtFromRequest: cookieExtractor, // 쿠키 추출 함수 사용
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<Omit<User, 'password_hash' | 'currentHashedRefreshToken'>> {
    const { sub: userId } = payload;
    const user = await this.userService.findOneById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // 민감 정보 제외 후 req.user에 저장될 객체 반환
    const { password_hash, currentHashedRefreshToken, ...result } = user;
    return result;
  }
}