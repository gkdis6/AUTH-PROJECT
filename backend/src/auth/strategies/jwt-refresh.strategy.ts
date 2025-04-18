import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

// 쿠키에서 Refresh Token 추출하는 함수
const refreshCookieExtractor = (req: Request): string | null => {
    let token = null;
    if (req && req.cookies) {
        token = req.cookies['refreshToken'];
    }
    return token;
};

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(
        private configService: ConfigService,
    ) {
        super({
            jwtFromRequest: refreshCookieExtractor,
            secretOrKey: configService.get<string>('REFRESH_TOKEN_SECRET'),
            ignoreExpiration: false,
            passReqToCallback: true,
        });
    }

    async validate(req: Request, payload: JwtPayload): Promise<{ payload: JwtPayload; refreshToken: string }> {
        const refreshToken = req.cookies?.refreshToken;
        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token not found in cookies');
        }
        return { payload, refreshToken };
    }
} 