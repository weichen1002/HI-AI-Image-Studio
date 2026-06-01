import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import * as path from 'path';
import { config } from './config';
import { assertStartupConfig } from './config';
import { ApiExceptionFilter } from './filters/api-exception.filter';
import { ApiResponseInterceptor } from './interceptors/api-response.interceptor';
import { requestLoggingMiddleware } from './logging/request-logging.middleware';
import { logError, logInfo } from './logging/logger';

async function bootstrap() {
  const startupConfig = assertStartupConfig();
  const app = await NestFactory.create(AppModule);

  app.use(express.json({ limit: config.BODY_LIMIT }));
  app.use(express.urlencoded({ limit: config.BODY_LIMIT, extended: true }));
  app.use(cookieParser());
  app.enableCors();
  app.use(requestLoggingMiddleware);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.use(
    '/uploads',
    express.static(path.join(config.DATA_DIR, 'uploads'), {
      fallthrough: false,
    }),
  );

  await app.listen(config.PORT, config.HOST);
  logInfo('Bootstrap', 'Server started', {
    url: `http://${config.HOST}:${config.PORT}`,
    bodyLimit: config.BODY_LIMIT,
    dataDir: config.DATA_DIR,
    hiapiKey: config.HIAPI_API_KEY ? 'configured' : 'missing',
    configWarnings: startupConfig.warnings,
  });
}

bootstrap().catch((error) => {
  logError('Bootstrap', 'Server failed to start', error);
  process.exit(1);
});
