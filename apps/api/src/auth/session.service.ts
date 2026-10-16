import { Injectable, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Request } from 'express';
import { PrismaService } from '../users/prisma.service';
import { configuration } from '../config';
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private readonly prisma: PrismaService) {}
  token() { return randomBytes(32).toString('base64url'); }
  async find(request: Request) {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[configuration().cookieName];
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new UnauthorizedException();
    const session = await this.prisma.session.findUnique({ where: { tokenHash: tokenHash(token) } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException();
    return session;
  }
  async cleanup() {
    await this.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
  onModuleInit() {
    this.timer = setInterval(() => { void this.cleanup().catch(() => undefined); }, 60 * 60 * 1000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
