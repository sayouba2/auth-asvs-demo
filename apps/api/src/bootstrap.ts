import 'reflect-metadata';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, Request, Response, NextFunction } from 'express';
import { isIP } from 'node:net';
import { timingSafeEqual } from 'node:crypto';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { configuration } from './config';
import { RateLimitException } from './security/rate-limit.service';
import { AuditService } from './security/audit.service';
@Catch()
class SafeErrors implements ExceptionFilter {
  constructor(private readonly audit: AuditService) {}
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof RateLimitException) response.setHeader('Retry-After', error.retryAfter);
    if (error instanceof HttpException) {
      response.status(error.getStatus()).json({ statusCode: error.getStatus(),
        message: error.message === 'Bad Request Exception'
          ? 'Données invalides. Vérifiez les champs et la politique de mot de passe.' : error.message });
    } else {
      // Do not log exception objects: database/validation errors can contain input.
      this.audit.event('internal_error');
      response.status(500).json({ message: 'Service temporairement indisponible.' });
    }
  }
}
export function configureApp(app: INestApplication) {
  const config = configuration();
  app.setGlobalPrefix('api');
  app.getHttpAdapter().getInstance().set('trust proxy', false);
  app.use(helmet());
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    const secret = request.get('x-demo-proxy-secret') ?? '';
    const ip = request.get('x-demo-client-ip') ?? '';
    if (Buffer.byteLength(secret) === Buffer.byteLength(config.proxySecret) &&
      timingSafeEqual(Buffer.from(secret), Buffer.from(config.proxySecret)) && isIP(ip))
      Object.defineProperty(request, 'ip', { value: ip, configurable: true });
    next();
  });
  app.use(json({ limit: '8kb' }));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true,
    validationError: { target: false, value: false },
  }));
  app.useGlobalFilters(new SafeErrors(app.get(AuditService)));
}
export async function createApp() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  app.enableShutdownHooks();
  await app.init();
  return app;
}
