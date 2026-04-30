import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from './auth/auth.module';
import { ImageModule } from './image/image.module';
import { config } from './config';
import { DbModule } from './db/db.module';
import { CreditsModule } from './credits/credits.module';
import { AdminModule } from './admin/admin.module';
import { PromptsModule } from './prompts/prompts.module';
import { AnnouncementsModule } from './announcements/announcements.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: config.PUBLIC_DIR,
      exclude: ['/api/(.*)'],
    }),
    DbModule,
    AuthModule,
    ImageModule,
    CreditsModule,
    AdminModule,
    PromptsModule,
    AnnouncementsModule,
  ],
})
export class AppModule {}
