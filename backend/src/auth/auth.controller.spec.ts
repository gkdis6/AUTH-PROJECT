import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../user/entities/user.entity';
import { Role } from './enums/role.enum';
import { Response, Request } from 'express';
import { Observable, of } from 'rxjs';
import { RefreshRequest, AuthenticatedRequest, AuthenticatedUser } from './interfaces/auth-request.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController (인증 컨트롤러)', () => {
  let controller: AuthController;
  let authService: AuthService;
  let userService: UserService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUser: Partial<User> = {
    id: '1',
    email: 'test@example.com',
    username: 'testuser',
    role: Role.USER,
  };

  const mockAuthenticatedUser: AuthenticatedUser = {
    id: '1',
    email: 'test@example.com',
    username: 'testuser',
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockResponse = {
    cookie: jest.fn(),
    json: jest.fn(),
    getHeaders: jest.fn().mockReturnValue({}),
  } as unknown as Response;

  const mockRequest = {
    get: jest.fn(),
    header: jest.fn(),
    accepts: jest.fn(),
    acceptsCharsets: jest.fn(),
    cookies: {},
    user: null,
  } as unknown as Request;

  const mockAuthenticatedRequest: AuthenticatedRequest = {
    ...mockRequest,
    user: mockAuthenticatedUser,
    cookies: {},
  } as AuthenticatedRequest;

  const mockRefreshRequest: RefreshRequest = {
    ...mockRequest,
    user: {
      payload: { sub: '1', email: 'test@example.com', role: Role.USER },
      refreshToken: 'mock.refresh.token',
    },
    cookies: { refreshToken: 'mock.refresh.token' },
  } as RefreshRequest;

  beforeEach(async () => {
    // 각 테스트 전에 테스트 모듈 생성
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signUp: jest.fn().mockResolvedValue(mockUser),
            signIn: jest.fn().mockResolvedValue({ user: mockAuthenticatedUser }),
            refreshTokens: jest.fn().mockImplementation(async (userId, refreshToken, response) => {
              response.cookie('accessToken', 'new.access.token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 10000,
              });
              return undefined;
            }),
            logout: jest.fn().mockResolvedValue(undefined),
            refreshTokensFromInterceptor: jest.fn().mockReturnValue(of(true)),
          },
        },
        {
          provide: UserService,
          useValue: {
            createUser: jest.fn().mockResolvedValue(mockUser),
            findOneByEmail: jest.fn().mockResolvedValue(mockUser),
            findOneById: jest.fn().mockResolvedValue(mockUser),
            updateUser: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock.jwt.token'),
            verify: jest.fn().mockReturnValue({ sub: '1' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'JWT_SECRET':
                  return 'test-secret';
                case 'JWT_EXPIRATION_TIME':
                  return '10s';
                case 'REFRESH_TOKEN_SECRET':
                  return 'test-refresh-secret';
                case 'REFRESH_TOKEN_EXPIRATION_TIME':
                  return '604800s';
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    // 컨트롤러와 서비스 인스턴스 가져오기
    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    // 각 테스트 전에 모든 모의 객체 초기화
    jest.clearAllMocks();
  });

  // 가짜 타이머 설정 (토큰 만료 테스트용)
  beforeAll(() => {
    jest.useFakeTimers();
  });

  // 테스트 완료 후 실제 타이머로 복원
  afterAll(() => {
    jest.useRealTimers();
  });

  it('컨트롤러가 정의되어 있어야 함', () => {
    expect(controller).toBeDefined();
  });

  describe('회원가입 (signUp)', () => {
    it('새로운 사용자를 생성하고 비밀번호를 제외한 정보를 반환해야 함', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
      };

      await controller.signUp(createUserDto, mockResponse);

      // AuthService의 signUp 메서드가 올바른 데이터와 함께 호출되었는지 확인
      expect(authService.signUp).toHaveBeenCalledWith(createUserDto);
      // 응답에 민감한 정보(비밀번호 등)가 제외되었는지 확인
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        email: createUserDto.email,
        username: createUserDto.username,
      }));
    });
  });

  describe('로그인 (signIn)', () => {
    it('로그인 성공 시 사용자 정보를 반환하고 토큰을 쿠키에 설정해야 함', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await controller.signIn(loginDto, mockResponse);

      // AuthService의 signIn 메서드가 올바른 데이터와 함께 호출되었는지 확인
      expect(authService.signIn).toHaveBeenCalledWith(loginDto, mockResponse);
      // 응답이 올바른 형식을 가지는지 확인
      expect(result).toEqual({
        message: 'Login successful',
        user: mockAuthenticatedUser,
      });
    });
  });

  describe('토큰 갱신 (refreshTokens)', () => {
    it('리프레시 토큰으로 새로운 액세스 토큰을 발급해야 함', async () => {
      const mockRefreshRequest: RefreshRequest = {
        ...mockRequest,
        user: {
          payload: { sub: '1', email: 'test@example.com', role: Role.USER },
          refreshToken: 'mock.refresh.token',
        },
        cookies: { refreshToken: 'mock.refresh.token' },
      } as RefreshRequest;

      const result = await controller.refreshTokens(mockRefreshRequest, mockResponse);

      // AuthService의 refreshTokens 메서드가 올바른 매개변수와 함께 호출되었는지 확인
      expect(authService.refreshTokens).toHaveBeenCalledWith(
        '1',
        'mock.refresh.token',
        mockResponse
      );
      // 토큰 갱신 성공 메시지를 반환하는지 확인
      expect(result).toEqual({ message: 'Tokens refreshed successfully' });
    });
  });

  describe('로그아웃 (logout)', () => {
    it('사용자를 로그아웃하고 토큰 쿠키를 제거해야 함', async () => {
      const mockAuthRequest: AuthenticatedRequest = {
        ...mockRequest,
        user: mockAuthenticatedUser,
      } as AuthenticatedRequest;

      const result = await controller.logout(mockAuthRequest, mockResponse);

      // AuthService의 logout 메서드가 올바른 사용자 ID와 함께 호출되었는지 확인
      expect(authService.logout).toHaveBeenCalledWith('1', mockResponse);
      // 로그아웃 성공 메시지를 반환하는지 확인
      expect(result).toEqual({ message: 'Logout successful' });
    });
  });

  describe('프로필 조회 (getProfile)', () => {
    it('인증된 사용자의 프로필 정보를 반환해야 함', () => {
      const mockAuthRequest: AuthenticatedRequest = {
        ...mockRequest,
        user: mockAuthenticatedUser,
      } as AuthenticatedRequest;

      const result = controller.getProfile(mockAuthRequest);

      // 올바른 사용자 정보를 반환하는지 확인
      expect(result).toEqual(mockAuthenticatedUser);
    });
  });

  describe('토큰 만료 및 갱신 프로세스', () => {
    it('액세스 토큰 만료 시 401 에러가 발생하고, 리프레시 토큰으로 갱신 후 재요청이 성공해야 함', async () => {
      // 1. 먼저 로그인 수행
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      await controller.signIn(loginDto, mockResponse);

      // 2. 액세스 토큰 만료 대기 (11초)
      jest.advanceTimersByTime(11000);

      // 3. 만료된 액세스 토큰으로 프로필 요청 시도
      const mockExpiredRequest: AuthenticatedRequest = {
        ...mockRequest,
        user: mockAuthenticatedUser,
        cookies: { refreshToken: 'mock.refresh.token' },
      } as AuthenticatedRequest;

      // 4. 만료된 토큰으로 요청 시 401 에러 발생
      const mockError = new UnauthorizedException('Token expired');
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw mockError;
      });

      // 5. AuthInterceptor가 401 에러를 감지하고 토큰 갱신 시도
      await controller.refreshTokens(mockRefreshRequest, mockResponse);

      // 6. 새로운 액세스 토큰으로 프로필 접근
      jest.spyOn(jwtService, 'verify').mockImplementation(() => ({
        sub: '1',
        email: 'test@example.com',
        role: Role.USER,
      }));

      const result = controller.getProfile(mockAuthenticatedRequest);

      // 7. 검증
      // - 토큰 갱신이 성공적으로 이루어졌는지 확인
      expect(authService.refreshTokens).toHaveBeenCalledWith(
        '1',
        'mock.refresh.token',
        mockResponse
      );
      // - 새로운 토큰으로 프로필 조회가 성공하는지 확인
      expect(result).toEqual(mockAuthenticatedUser);
      // - 토큰 갱신 후 쿠키가 올바르게 설정되었는지 확인
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'accessToken',
        'new.access.token',
        expect.objectContaining({
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 10000,
        })
      );
    });

    it('리프레시 토큰도 만료된 경우 401 에러를 반환해야 함', async () => {
      // 1. 만료된 리프레시 토큰으로 갱신 시도
      const mockExpiredRefreshRequest: RefreshRequest = {
        ...mockRequest,
        user: {
          payload: { sub: '1', email: 'test@example.com', role: Role.USER },
          refreshToken: 'expired.refresh.token',
        },
        cookies: { refreshToken: 'expired.refresh.token' },
      } as RefreshRequest;

      // 2. 리프레시 토큰 검증 실패 시뮬레이션
      jest.spyOn(authService, 'refreshTokens').mockRejectedValue(
        new UnauthorizedException('Refresh token expired')
      );

      // 3. 토큰 갱신 시도 및 401 에러 발생 확인
      await expect(
        controller.refreshTokens(mockExpiredRefreshRequest, mockResponse)
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
