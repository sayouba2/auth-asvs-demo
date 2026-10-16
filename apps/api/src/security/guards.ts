import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { configuration } from '../config';
import { RateLimitService } from './rate-limit.service';
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method === 'GET') return true;
    const expected = configuration().origin;
    const origin = request.get('origin');
    if (origin !== undefined) {
      if (origin === expected) return true;
      throw new ForbiddenException('Origine refusée.');
    }
    try {
      if (new URL(request.get('referer') ?? '').origin === expected) return true;
    } catch { /* Missing and malformed referrers fail closed. */ }
    throw new ForbiddenException('Origine requise.');
  }
}
@Injectable()
export class PublicRateGuard implements CanActivate {
  constructor(private readonly rates: RateLimitService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const bucket = request.path.endsWith('/login') ? 'loginIp' : 'register';
    await this.rates.reserve(bucket, request.ip ?? 'unknown');
    return true;
  }
}
