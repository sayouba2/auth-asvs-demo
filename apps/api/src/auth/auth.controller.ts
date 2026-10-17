import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto, CredentialsDto, EmailDto } from './dto';
import { AuthRequest, SessionGuard } from './session.guard';
import { OriginGuard, PublicRateGuard } from '../security/guards';
import { configuration } from '../config';
export function cookieOptions() {
  return { httpOnly: true, secure: configuration().secure, sameSite: 'lax' as const, path: '/' };
}
@Controller('auth')
@UseGuards(OriginGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register')
  @HttpCode(202)
  @UseGuards(PublicRateGuard)
  async register(@Body() dto: EmailDto) {
    await this.auth.register(dto);
    return { message: 'Demande enregistrée. Un administrateur vous enverra vos identifiants par e-mail.' };
  }
  @Post('login')
  @HttpCode(200)
  @UseGuards(PublicRateGuard)
  async login(@Body() dto: CredentialsDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const { token, mustChangePassword } = await this.auth.login(dto, request.ip ?? 'unknown');
    response.cookie(configuration().cookieName, token, { ...cookieOptions(), maxAge: configuration().sessionMs });
    return { message: 'Connexion réussie.', mustChangePassword };
  }
  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: AuthRequest) { return this.auth.me(request.authSession); }
  @Post('change-password')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async change(@Body() dto: ChangePasswordDto, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    await this.auth.change(dto, request.authSession);
    response.clearCookie(configuration().cookieName, cookieOptions());
    return { message: 'Mot de passe modifié. Veuillez vous reconnecter.' };
  }
  @Post('logout')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(request.authSession);
    response.clearCookie(configuration().cookieName, cookieOptions());
    return { message: 'Déconnexion réussie.' };
  }
}
