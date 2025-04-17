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
import { UnauthorizedException, ConflictException, HttpStatus, HttpException } from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthController (인증 컨트롤러)', () => {
  let controller: AuthController;
  let authService: AuthService;
  let userService: UserService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUser: User = {
    id: 'mock-user-id',
    email: 'test@example.com',
    username: 'testuser',
    password_hash: 'hashedpassword',
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    currentHashedRefreshToken: 'hashedrefreshtoken',
  };

  const mockAuthenticatedUserResponse: Omit<User, 'password_hash' | 'currentHashedRefreshToken'> = {
    id: mockUser.id,
    email: mockUser.email,
    username: mockUser.username,
    role: mockUser.role,
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
  };

  const mockAuthServiceImplementation = {
    signUp: jest.fn(),
    signIn: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
  };

  const mockResponse = {
    cookie: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    getHeaders: jest.fn().mockReturnValue({}),
  } as unknown as Response;

  const mockRequest = {} as Request;

  const mockAuthenticatedRequest: AuthenticatedRequest = {
    ...mockRequest,
    user: mockAuthenticatedUserResponse,
  } as AuthenticatedRequest;

  const mockRefreshRequest: RefreshRequest = {
    ...mockRequest,
    user: {
      payload: { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
      refreshToken: 'mock-refresh-token',
    },
    cookies: { refreshToken: 'mock-refresh-token' },
  } as RefreshRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthServiceImplementation,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('컨트롤러가 정의되어 있어야 함', () => {
    expect(controller).toBeDefined();
  });

  describe('회원가입 (signUp)', () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      password: 'password123',
      username: 'testuser',
    };

    it('성공: 새로운 사용자를 생성하고 민감 정보를 제외한 정보를 반환해야 함', async () => {
      (authService.signUp as jest.Mock).mockResolvedValue(mockUser);

      await controller.signUp(createUserDto, mockResponse);

      expect(authService.signUp).toHaveBeenCalledWith(createUserDto);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'User successfully registered',
        user: expect.objectContaining(mockAuthenticatedUserResponse),
      });

      const responseJsonArg = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseJsonArg.user).not.toHaveProperty('password_hash');
      expect(responseJsonArg.user).not.toHaveProperty('currentHashedRefreshToken');
    });

    it('실패: 이메일 중복 등으로 서비스에서 ConflictException 발생 시 예외를 전파해야 함', async () => {
      const conflictError = new ConflictException('Email already exists');
      (authService.signUp as jest.Mock).mockRejectedValue(conflictError);

      await expect(controller.signUp(createUserDto, mockResponse)).rejects.toThrow(ConflictException);
      expect(authService.signUp).toHaveBeenCalledWith(createUserDto);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('로그인 (signIn)', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('성공: 사용자 정보를 반환하고 AuthService가 쿠키를 설정해야 함', async () => {
      (authService.signIn as jest.Mock).mockResolvedValue({ user: mockAuthenticatedUserResponse });

      const result = await controller.signIn(loginDto, mockResponse);

      expect(authService.signIn).toHaveBeenCalledWith(loginDto, mockResponse);
      expect(result).toEqual({
        message: 'Login successful',
        user: mockAuthenticatedUserResponse,
      });
    });

    it('실패: 잘못된 자격 증명으로 서비스에서 UnauthorizedException 발생 시 예외를 전파해야 함', async () => {
      const unauthorizedError = new UnauthorizedException('Invalid email or password');
      (authService.signIn as jest.Mock).mockRejectedValue(unauthorizedError);

      await expect(controller.signIn(loginDto, mockResponse)).rejects.toThrow(UnauthorizedException);
      expect(authService.signIn).toHaveBeenCalledWith(loginDto, mockResponse);
    });
  });

  describe('토큰 갱신 (refreshTokens)', () => {
    it('성공: AuthService.refreshTokens를 호출하고 성공 메시지를 반환해야 함', async () => {
      (authService.refreshTokens as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.refreshTokens(mockRefreshRequest, mockResponse);

      expect(authService.refreshTokens).toHaveBeenCalledWith(
        mockRefreshRequest.user.payload.sub,
        mockRefreshRequest.user.refreshToken,
        mockResponse
      );
      expect(result).toEqual({ message: 'Tokens refreshed successfully' });
    });

    it('실패: 유효하지 않은 리프레시 토큰으로 서비스에서 UnauthorizedException 발생 시 예외를 전파해야 함', async () => {
      const unauthorizedError = new UnauthorizedException('Invalid refresh token');
      (authService.refreshTokens as jest.Mock).mockRejectedValue(unauthorizedError);

      await expect(controller.refreshTokens(mockRefreshRequest, mockResponse)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('로그아웃 (logout)', () => {
    it('성공: AuthService.logout을 호출하고 성공 메시지를 반환해야 함', async () => {
      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.logout(mockAuthenticatedRequest, mockResponse);

      expect(authService.logout).toHaveBeenCalledWith(
        mockAuthenticatedRequest.user.id,
        mockResponse
      );
      expect(result).toEqual({ message: 'Logout successful' });
    });
  });

  describe('프로필 조회 (getProfile)', () => {
    it('성공: 인증된 사용자의 프로필 정보를 반환해야 함', () => {
      const result = controller.getProfile(mockAuthenticatedRequest);

      expect(result).toEqual(mockAuthenticatedUserResponse);
    });
  });

  describe('토큰 만료 및 갱신 프로세스 (흐름 검증)', () => {
    beforeAll(() => jest.useFakeTimers());
    afterAll(() => jest.useRealTimers());

    const mockSignInAndSetCookies = async () => {
      const loginDto: LoginDto = { email: 'test@example.com', password: 'password123' };
      (authService.signIn as jest.Mock).mockResolvedValue({ user: mockAuthenticatedUserResponse });
      await controller.signIn(loginDto, mockResponse);
      mockAuthenticatedRequest.cookies = { accessToken: 'expired.access.token', refreshToken: 'mock-refresh-token' };
      mockRefreshRequest.cookies = { refreshToken: 'mock-refresh-token' };
    };

    it('성공: 액세스 토큰 만료 -> 리프레시 -> 프로필 재요청 성공 흐름', async () => {
      await mockSignInAndSetCookies();

      (authService.refreshTokens as jest.Mock).mockImplementation(async (userId, rt, res) => {
        res.cookie('accessToken', 'new.access.token', { httpOnly: true, path: '/' });
      });
      await controller.refreshTokens(mockRefreshRequest, mockResponse);

      mockAuthenticatedRequest.cookies['accessToken'] = 'new.access.token';
      const result = controller.getProfile(mockAuthenticatedRequest);

      expect(authService.refreshTokens).toHaveBeenCalledWith(
        mockRefreshRequest.user.payload.sub,
        'mock-refresh-token',
        mockResponse
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith('accessToken', 'new.access.token', expect.any(Object));
      expect(result).toEqual(mockAuthenticatedUserResponse);
    });

    it('실패: 리프레시 토큰 만료 시 토큰 갱신 실패', async () => {
      await mockSignInAndSetCookies();

      const expiredTokenError = new UnauthorizedException('Refresh token expired or invalid');
      (authService.refreshTokens as jest.Mock).mockRejectedValue(expiredTokenError);

      await expect(controller.refreshTokens(mockRefreshRequest, mockResponse)).rejects.toThrow(UnauthorizedException);
    });
  });
});
