import { Module } from '@nestjs/common';
import { SqliteService } from './sqlite.service';
import { UsersRepo } from './repositories/users.repo';
import { ImagesRepo } from './repositories/images.repo';
import { AnnouncementsRepo } from './repositories/announcements.repo';
import { RedeemCodesRepo } from './repositories/redeem-codes.repo';
import { SystemSettingsRepo } from './repositories/system-settings.repo';
import { DialogueRepo } from './repositories/dialogue.repo';
import { AuditLogsRepo } from './repositories/audit-logs.repo';
import { EmailVerificationRepo } from './repositories/email-verification.repo';
import { ImageJobsRepo } from './repositories/image-jobs.repo';
import { TemplateFavoritesRepo } from './repositories/template-favorites.repo';
import { UserPromptTemplatesRepo } from './repositories/user-prompt-templates.repo';
import { StyleBoardsRepo } from './repositories/style-boards.repo';
import { ImageFeedbackRepo } from './repositories/image-feedback.repo';
import { CreditsRepo } from '../credits/credits.repo';

@Module({
  providers: [
    SqliteService,
    UsersRepo,
    ImagesRepo,
    AnnouncementsRepo,
    RedeemCodesRepo,
    SystemSettingsRepo,
    DialogueRepo,
    AuditLogsRepo,
    EmailVerificationRepo,
    ImageJobsRepo,
    TemplateFavoritesRepo,
    UserPromptTemplatesRepo,
    StyleBoardsRepo,
    ImageFeedbackRepo,
    CreditsRepo,
  ],
  exports: [
    SqliteService,
    UsersRepo,
    ImagesRepo,
    AnnouncementsRepo,
    RedeemCodesRepo,
    SystemSettingsRepo,
    DialogueRepo,
    AuditLogsRepo,
    EmailVerificationRepo,
    ImageJobsRepo,
    TemplateFavoritesRepo,
    UserPromptTemplatesRepo,
    StyleBoardsRepo,
    ImageFeedbackRepo,
    CreditsRepo,
  ],
})
export class DbModule {}
