import { HttpException, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { AuditService } from './audit.service';
export const LIMITS = {
  loginIp: { max: 30, seconds: 900 },
  loginPair: { max: 5, seconds: 300 },
  register: { max: 10, seconds: 900 },
  change: { max: 5, seconds: 900 },
} as const;
// A set of reservations makes successful releases safe across expiration windows.
const RESERVE = `
local count = redis.call('SCARD', KEYS[1])
if count >= tonumber(ARGV[1]) then
  return {0, math.max(1, redis.call('TTL', KEYS[1]))}
end
redis.call('SADD', KEYS[1], ARGV[3])
if count == 0 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
return {1, redis.call('TTL', KEYS[1])}
`;
export class RateLimitException extends HttpException {
  constructor(readonly retryAfter: number) { super('Trop de tentatives. Réessayez plus tard.', 429); }
}
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  readonly redis = new Redis(process.env.REDIS_URL!, {
    lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 1000,
    commandTimeout: 1000, enableOfflineQueue: false,
    retryStrategy: times => Math.min(times * 200, 2000),
  });
  constructor(private readonly audit: AuditService) {
    this.redis.on('error', () => { /* Request path emits sanitized failures. */ });
    void this.redis.connect().catch(() => undefined);
  }
  key(bucket: keyof typeof LIMITS, identity: string) {
    return (process.env.RATE_LIMIT_NAMESPACE ?? 'auth') + ':' + bucket + ':' + createHmac('sha256', process.env.RATE_LIMIT_SECRET!).update(identity).digest('hex');
  }
  async reserve(bucket: keyof typeof LIMITS, identity: string) {
    const key = this.key(bucket, identity), reservation = randomUUID(), policy = LIMITS[bucket];
    let result: [number, number];
    try {
      result = await this.redis.eval(RESERVE, 1, key, policy.max, policy.seconds, reservation) as [number, number];
    } catch {
      this.audit.event('redis_unavailable');
      throw new ServiceUnavailableException('Service temporairement indisponible.');
    }
    if (result[0] === 0) {
      this.audit.event('rate_limited', identity);
      throw new RateLimitException(result[1]);
    }
    return { key, reservation };
  }
  async release(ticket: { key: string; reservation: string }) {
    try { await this.redis.srem(ticket.key, ticket.reservation); }
    catch {
      this.audit.event('redis_unavailable');
      throw new ServiceUnavailableException('Service temporairement indisponible.');
    }
  }
  onModuleDestroy() { this.redis.disconnect(); }
}
