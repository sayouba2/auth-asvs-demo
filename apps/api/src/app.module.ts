import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { SessionService } from './auth/session.service';
import { SessionGuard } from './auth/session.guard';
import { PrismaService } from './users/prisma.service';
import { PasswordPolicy } from './security/password-policy';
import { AuditService } from './security/audit.service';
import { RateLimitService } from './security/rate-limit.service';
import { OriginGuard, PublicRateGuard } from './security/guards';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AdminGuard } from './admin/admin.guard';
@Module({
  controllers: [AuthController, AdminController],
  providers: [AuthService, SessionService, SessionGuard, PrismaService, PasswordPolicy,
    AuditService, RateLimitService, OriginGuard, PublicRateGuard, AdminService, AdminGuard],
})
export class AppModule {}
