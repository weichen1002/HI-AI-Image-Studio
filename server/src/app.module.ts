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
import { RedeemCodesModule } from './redeem-codes/redeem-codes.module';
import { TemplatesModule } from './templates/templates.module';
import { BillingModule } from './billing/billing.module';
import { StyleBoardsModule } from './style-boards/style-boards.module';
import { HealthModule } from './health/health.module';
import { HiapiModule } from './hiapi/hiapi.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: config.PUBLIC_DIR,
      exclude: ['/api{/*path}'],
    }),
    DbModule,
    AuthModule,
    ImageModule,
    CreditsModule,
    AdminModule,
    PromptsModule,
    AnnouncementsModule,
    RedeemCodesModule,
    TemplatesModule,
    BillingModule,
    StyleBoardsModule,
    HealthModule,
    HiapiModule,
  ],
})
export class AppModule {}
