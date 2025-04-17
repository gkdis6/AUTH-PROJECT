import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// Mock dependencies
const mockUserService = {
  findOneByEmail: jest.fn(),
  findOneById: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'JWT_SECRET') return 'test-secret';
    if (key === 'JWT_EXPIRATION_TIME') return '15m';
    if (key === 'JWT_EXPIRATION_TIME_MS') return 900000;
    if (key === 'REFRESH_TOKEN_SECRET') return 'test-refresh-secret';
    if (key === 'REFRESH_TOKEN_EXPIRATION_TIME') return '7d';
    if (key === 'REFRESH_TOKEN_EXPIRATION_TIME_MS') return 604800000;
    if (key === 'NODE_ENV') return 'test';
    return null;
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
