import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Security');
  event(event: string, identity?: string) {
    this.logger.log(JSON.stringify({
      at: new Date().toISOString(), event,
      subject: identity ? createHmac('sha256', process.env.RATE_LIMIT_SECRET!).update(identity).digest('hex') : undefined,
    }));
  }
}
