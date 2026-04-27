import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.enableCors();

  await app.listen(config.PORT, config.HOST);
  console.log(`NestJS Image2 Create API running at http://${config.HOST}:${config.PORT}`);
  console.log(`HiAPI key: ${config.HIAPI_API_KEY ? 'configured' : 'missing'}`);
}
bootstrap();
