import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

// مبالغ bigint در JSON به‌صورت رشته ارسال می‌شوند (واحد: ریال).
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

@Catch()
class AllExceptions implements ExceptionFilter {
  private readonly log = new Logger('Exceptions');
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (e instanceof HttpException) { return res.status(e.getStatus()).json(typeof e.getResponse() === 'string' ? { message: e.getResponse() } : e.getResponse()); }
    this.log.error((e as Error)?.stack ?? String(e)); // جزئیات داخلی هرگز به کلاینت نمی‌رود
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'خطای داخلی سرور' });
  }
}

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { rawBody: false });
  app.use(helmet());
  app.set('trust proxy', 1);
  app.enableCors({ origin: env.corsOrigins, credentials: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }));
  app.useGlobalFilters(new AllExceptions());
  app.enableShutdownHooks();
  await app.listen(env.port);
  new Logger('Bootstrap').log(`BotShop API on :${env.port} (bale=${env.baleMode})`);
}
bootstrap();
