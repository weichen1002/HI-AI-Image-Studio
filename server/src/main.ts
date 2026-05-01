import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import * as path from 'path';
import { config } from './config';
import { ApiExceptionFilter } from './filters/api-exception.filter';
import { ApiResponseInterceptor } from './interceptors/api-response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(express.json({ limit: config.BODY_LIMIT }));
  app.use(express.urlencoded({ limit: config.BODY_LIMIT, extended: true }));
  app.use(cookieParser());
  app.enableCors();
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.use(
    '/uploads',
    express.static(path.join(config.DATA_DIR, 'uploads'), {
      fallthrough: false,
    }),
  );

  await app.listen(config.PORT, config.HOST);
  console.log(
    `NestJS Image2 Create API running at http://${config.HOST}:${config.PORT}`,
  );
  console.log(`HiAPI key: ${config.HIAPI_API_KEY ? 'configured' : 'missing'}`);
}
bootstrap();
