import { ConflictException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Prisma, Session } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../users/prisma.service';
import { PasswordPolicy } from '../security/password-policy';
import { AuditService } from '../security/audit.service';
import { RateLimitService } from '../security/rate-limit.service';
import { SessionService, tokenHash } from './session.service';
import { CredentialsDto, ChangePasswordDto } from './dto';
import { configuration } from '../config';
export const PUBLIC_USER = { id: true, email: true, createdAt: true } as const;
@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordPolicy,
    private readonly audit: AuditService,
    private readonly rates: RateLimitService,
    private readonly sessions: SessionService,
  ) {}
  async onModuleInit() { this.dummyHash = await this.passwords.hash(randomBytes(32).toString('hex')); }
  async register(dto: CredentialsDto) {
    this.passwords.validate(dto.password);
    const hash = await this.passwords.hash(dto.password);
    try {
      const user = await this.prisma.user.create({ data: { email: dto.email, passwordHash: hash }, select: PUBLIC_USER });
      this.audit.event('register_success', user.id);
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Inscription impossible avec ces informations.');
      throw error;
    }
  }
  async login(dto: CredentialsDto, ip: string) {
    const ticket = await this.rates.reserve('loginPair', JSON.stringify([ip, dto.email]));
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = await this.passwords.verify(user?.passwordHash ?? this.dummyHash, dto.password);
    if (!user || !valid) {
      this.audit.event('login_failure', dto.email);
      throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
    }
    await this.rates.release(ticket);
    const token = this.sessions.token();
    // Serialize session creation with changes to this user's password.
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (current.passwordHash !== user.passwordHash) throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
      await tx.session.create({ data: {
        userId: user.id, tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + configuration().sessionMs),
      } });
    });
    this.audit.event('login_success', user.id);
    return token;
  }
  me(session: Session) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: session.userId }, select: PUBLIC_USER });
  }
  async change(dto: ChangePasswordDto, session: Session) {
    await this.rates.reserve('change', session.userId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
    if (!await this.passwords.verify(user.passwordHash, dto.currentPassword))
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    this.passwords.validate(dto.newPassword);
    const hash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      const liveSession = await tx.session.findUnique({ where: { id: session.id } });
      if (current.passwordHash !== user.passwordHash || !liveSession || liveSession.revokedAt || liveSession.expiresAt <= new Date())
        throw new UnauthorizedException();
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: hash, passwordChangedAt: new Date() } });
      await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    this.audit.event('password_changed', user.id);
  }
  async logout(session: Session) {
    await this.prisma.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } });
    this.audit.event('logout', session.userId);
  }
}
