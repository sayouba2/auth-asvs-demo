import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { Session } from '@prisma/client';
import { SessionService } from './session.service';
export type AuthRequest = Request & { authSession: Session };
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    request.authSession = await this.sessions.find(request);
    return true;
  }
}
