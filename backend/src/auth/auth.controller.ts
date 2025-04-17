// src/auth/auth.controller.ts
import { Controller, Post, Body, UseGuards, Req, Res, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { User } from '../user/entities/user.entity';
import { Role } from './enums/role.enum';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { RefreshRequest, AuthenticatedRequest, AuthenticatedUser } from './interfaces/auth-request.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(
    @Body() createUserDto: CreateUserDto,
    @Res() res: Response
  ): Promise<void> {
    console.log('Signup request:', createUserDto);
    const user = await this.authService.signUp(createUserDto);
    const { password_hash, currentHashedRefreshToken, ...result } = user;
    console.log('Signup result:', result);
    res.json(result);
  }

  @Post('/login')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ message: string; user: AuthenticatedUser }> {
    console.log('Login request:', { email: loginDto.email });
    const { user } = await this.authService.signIn(loginDto, res);
    console.log('Login result:', { 
      user,
      cookies: res.getHeaders()['set-cookie']
    });
    return { message: 'Login successful', user };
  }

  @Post('/refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Req() req: RefreshRequest,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ message: string }> {
    console.log('Refresh tokens request:', { user: req.user });
    const userId = req.user.payload.sub;
    const refreshToken = req.cookies.refreshToken;
    await this.authService.refreshTokens(userId, refreshToken, res);
    return { message: 'Tokens refreshed successfully' };
  }

  @Post('/logout')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ message: string }> {
    console.log('Logout request');
    const user = req.user;
    await this.authService.logout(user.id, res);
    return { message: 'Logout successful' };
  }

  @Get('/me')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  getProfile(@Req() req: AuthenticatedRequest): AuthenticatedUser {
    console.log('Get profile request:', { user: req.user });
    return req.user;
  }

  @Get('/admin-only')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  getAdminData(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    return { message: `Welcome Admin ${user.email}!` };
  }

  @Get('/user-only')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.USER)
  getUserData(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    return { message: `Welcome User ${user.email}!` };
  }

  @Get('/any-role')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.USER)
  getAnyRoleData(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    return { message: `Welcome ${user.role} ${user.email}!` };
  }
}