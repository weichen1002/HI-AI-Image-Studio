import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from './auth/auth.module';
import { ImageModule } from './image/image.module';
import { config } from './config';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: config.PUBLIC_DIR,
      exclude: ['/api/(.*)'],
    }),
    AuthModule,
    ImageModule,
  ],
})
export class AppModule {}
