import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './schemas/refresh-token.schema';

// Mock bcrypt entirely — we don't want real hashing (slow) in unit tests,
// we want to control exactly what it returns to test our logic branches
jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  // A fake user document shape — matches what Mongoose would return,
  // without needing an actual database
  const mockUser = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedPasswordValue',
    role: 'user',
    isActive: true,
    bio: '',
    avatarUrl: '',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          // Fake UsersService — we control exactly what each method returns
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
            findByIdRaw: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('fake.jwt.token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'jwt.secret': 'test-secret',
                'jwt.expiresIn': '15m',
                'jwt.refreshSecret': 'test-refresh-secret',
                'jwt.refreshExpiresIn': '30d',
              };
              return config[key];
            }),
          },
        },
        {
          // Mock the Mongoose model directly — no real DB connection
          provide: getModelToken(RefreshToken.name),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            deleteOne: jest.fn(),
            deleteMany: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should throw UnauthorizedException when user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'anything' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when account is deactivated', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      usersService.findByEmail.mockResolvedValue(inactiveUser as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'correctpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return access token and user on successful login', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'correctpassword',
      });

      expect(result.accessToken).toBe('fake.jwt.token');
      expect(result.user.email).toBe('test@example.com');
      // Critical security check — password must NEVER appear in the response
      expect(result.user).not.toHaveProperty('password');
    });

    it('should sign the JWT with correct payload structure', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as never);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({
        email: 'test@example.com',
        password: 'correctpassword',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser._id.toString(),
          email: mockUser.email,
          type: 'access',
        }),
        expect.any(Object),
      );
    });
  });

  describe('register', () => {
    it('should call usersService.create with the register input', async () => {
      usersService.create.mockResolvedValue(mockUser as never);

      await service.register({
        email: 'new@example.com',
        name: 'New User',
        password: 'securepassword123',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com' }),
      );
    });

    it('should return tokens immediately after registration (auto-login)', async () => {
      usersService.create.mockResolvedValue(mockUser as never);

      const result = await service.register({
        email: 'new@example.com',
        name: 'New User',
        password: 'securepassword123',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe(mockUser.email);
    });
  });
});
