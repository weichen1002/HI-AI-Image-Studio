import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Put,
  Query,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { AdminRoleGuard } from '../admin/role.guard';
import { TemplateFavoritesRepo } from '../db/repositories/template-favorites.repo';
import {
  PromptTemplateArgument,
  UserPromptTemplatesRepo,
} from '../db/repositories/user-prompt-templates.repo';
import { CommunitySubmissionsRepo } from '../db/repositories/community-submissions.repo';

function normalizeTemplateIds(value: any) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)))
    : [];
}

function normalizeText(value: any, label: string, maxLength: number, required = false) {
  const text = String(value || '').trim();
  if (required && !text) {
    throw new HttpException(`请输入${label}`, HttpStatus.BAD_REQUEST);
  }
  if (text.length > maxLength) {
    throw new HttpException(`${label}不能超过 ${maxLength} 字符`, HttpStatus.BAD_REQUEST);
  }
  return text;
}

function normalizeAspectRatio(value: any) {
  const ratio = String(value || '').trim();
  if (!ratio) return '';
  if (!['1:1', '16:9', '9:16', '4:3', '3:4'].includes(ratio)) {
    throw new HttpException('模板比例不支持', HttpStatus.BAD_REQUEST);
  }
  return ratio;
}

function normalizeImageUrl(value: any) {
  const imageUrl = String(value || '').trim();
  if (!imageUrl) return '';
  if (imageUrl.length > 2_000_000) {
    throw new HttpException('封面图地址过长', HttpStatus.BAD_REQUEST);
  }
  if (
    !imageUrl.startsWith('/uploads/') &&
    !/^https?:\/\//i.test(imageUrl) &&
    !/^data:image\//i.test(imageUrl)
  ) {
    throw new HttpException('封面仅支持站内图片、在线图片地址或 data:image 图片', HttpStatus.BAD_REQUEST);
  }
  return imageUrl;
}

function normalizeArguments(value: any): PromptTemplateArgument[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((item) => {
      const key = String(item?.key || item?.name || '').trim();
      return {
        key,
        label: String(item?.label || key).trim(),
        defaultValue: String(item?.defaultValue || item?.default || ''),
        example: String(item?.example || ''),
      };
    })
    .filter((item) => {
      if (!item.key || seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    })
    .slice(0, 30);
}

function normalizeTemplateBody(body: any) {
  return {
    title: normalizeText(body?.title, '模板名称', 80, true),
    description: normalizeText(body?.description || body?.desc, '模板描述', 600),
    category: normalizeText(body?.category || '我的模板', '模板分类', 40),
    prompt: normalizeText(body?.prompt, '提示词内容', 8000, true),
    arguments: normalizeArguments(body?.arguments),
    aspectRatio: normalizeAspectRatio(body?.aspectRatio),
  };
}

function normalizeSubmissionBody(body: any) {
  const sourceType = normalizeText(body?.sourceType, '来源类型', 40);
  if (sourceType && !['template', 'history'].includes(sourceType)) {
    throw new HttpException('投稿来源不支持', HttpStatus.BAD_REQUEST);
  }
  return {
    title: normalizeText(body?.title, '投稿标题', 80, true),
    description: normalizeText(body?.description || body?.desc, '投稿说明', 800),
    category: normalizeText(body?.category || '灵感投稿', '分类', 40),
    prompt: normalizeText(body?.prompt, '提示词内容', 8000, true),
    coverImageUrl: normalizeImageUrl(body?.coverImageUrl || body?.coverImage || body?.imageUrl),
    aspectRatio: normalizeAspectRatio(body?.aspectRatio),
    sourceType,
    sourceId: normalizeText(body?.sourceId, '来源 ID', 160),
  };
}

function toPublicTemplate(template: any) {
  return {
    id: String(template?.id || ''),
    title: String(template?.title || ''),
    desc: String(template?.description || ''),
    category: String(template?.category || ''),
    prompt: String(template?.prompt || ''),
    arguments: Array.isArray(template?.arguments) ? template.arguments : [],
    aspectRatio: String(template?.aspectRatio || ''),
    createdAt: String(template?.createdAt || ''),
    updatedAt: String(template?.updatedAt || ''),
    sourceType: 'user',
  };
}

function toPublicSubmission(submission: any) {
  return {
    id: String(submission?.id || ''),
    title: String(submission?.title || ''),
    desc: String(submission?.description || ''),
    category: String(submission?.category || ''),
    prompt: String(submission?.prompt || ''),
    coverImage: String(submission?.coverImageUrl || ''),
    aspectRatio: String(submission?.aspectRatio || ''),
    sourceType: String(submission?.sourceType || 'community'),
    sourceId: String(submission?.sourceId || ''),
    status: String(submission?.status || ''),
    reviewNote: String(submission?.reviewNote || ''),
    createdAt: String(submission?.createdAt || ''),
    updatedAt: String(submission?.updatedAt || ''),
    reviewedAt: String(submission?.reviewedAt || ''),
  };
}

@Controller('api/templates')
@UseGuards(AuthGuard)
export class TemplatesController {
  constructor(
    private readonly templateFavoritesRepo: TemplateFavoritesRepo,
    private readonly userPromptTemplatesRepo: UserPromptTemplatesRepo,
    private readonly communitySubmissionsRepo: CommunitySubmissionsRepo,
  ) {}

  @Get('community/public')
  listPublicCommunityTemplates(@Query('limit') limit?: string) {
    return {
      templates: this.communitySubmissionsRepo
        .listPublic({ limit: Number(limit || 80) })
        .map(toPublicSubmission),
    };
  }

  @Get('community/mine')
  listMyCommunitySubmissions(@Req() req: RequestWithUser) {
    return {
      submissions: this.communitySubmissionsRepo
        .listByUser({ userId: req.user.id })
        .map(toPublicSubmission),
    };
  }

  @Post('community')
  createCommunitySubmission(@Req() req: RequestWithUser, @Body() body: any) {
    const submission = this.communitySubmissionsRepo.create({
      userId: req.user.id,
      ...normalizeSubmissionBody(body),
    });
    return {
      submission: toPublicSubmission(submission),
    };
  }

  @Get('community/admin')
  @UseGuards(AdminRoleGuard)
  listCommunitySubmissionsAdmin(@Query('status') status?: string) {
    return {
      submissions: this.communitySubmissionsRepo
        .listAdmin({ status: String(status || '').trim() })
        .map(toPublicSubmission),
    };
  }

  @Put('community/admin/:id/review')
  @UseGuards(AdminRoleGuard)
  reviewCommunitySubmission(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const status = String(body?.status || '').trim();
    if (!['approved', 'rejected'].includes(status)) {
      throw new HttpException('审核状态不支持', HttpStatus.BAD_REQUEST);
    }
    const submission = this.communitySubmissionsRepo.review({
      id: String(id || '').trim(),
      reviewerId: req.user.id,
      status: status as 'approved' | 'rejected',
      reviewNote: normalizeText(body?.reviewNote, '审核备注', 500),
    });
    if (!submission) {
      throw new HttpException('投稿不存在', HttpStatus.NOT_FOUND);
    }
    return {
      submission: toPublicSubmission(submission),
    };
  }

  @Get('user')
  listUserTemplates(@Req() req: RequestWithUser) {
    return {
      templates: this.userPromptTemplatesRepo
        .listByUser({ userId: req.user.id })
        .map(toPublicTemplate),
    };
  }

  @Post('user')
  createUserTemplate(@Req() req: RequestWithUser, @Body() body: any) {
    const template = this.userPromptTemplatesRepo.create({
      userId: req.user.id,
      ...normalizeTemplateBody(body),
    });
    return {
      template: toPublicTemplate(template),
    };
  }

  @Put('user/:id')
  updateUserTemplate(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const template = this.userPromptTemplatesRepo.update({
      id: String(id || '').trim(),
      userId: req.user.id,
      ...normalizeTemplateBody(body),
    });
    if (!template) {
      throw new HttpException('模板不存在', HttpStatus.NOT_FOUND);
    }
    return {
      template: toPublicTemplate(template),
    };
  }

  @Delete('user/:id')
  deleteUserTemplate(@Req() req: RequestWithUser, @Param('id') id: string) {
    const deleted = this.userPromptTemplatesRepo.delete({
      id: String(id || '').trim(),
      userId: req.user.id,
    });
    if (deleted <= 0) {
      throw new HttpException('模板不存在', HttpStatus.NOT_FOUND);
    }
    return { ok: true };
  }

  @Get('favorites')
  getFavorites(@Req() req: RequestWithUser) {
    return {
      templateIds: this.templateFavoritesRepo.listByUser({ userId: req.user.id }),
    };
  }

  @Put('favorites')
  updateFavorite(@Req() req: RequestWithUser, @Body() body: any) {
    const templateId = String(body?.templateId || '').trim();
    const favorite = Boolean(body?.favorite);
    this.templateFavoritesRepo.setFavorite({
      userId: req.user.id,
      templateId,
      favorite,
    });
    return {
      templateIds: this.templateFavoritesRepo.listByUser({ userId: req.user.id }),
    };
  }

  @Post('favorites/import')
  importFavorites(@Req() req: RequestWithUser, @Body() body: any) {
    const templateIds = normalizeTemplateIds(body?.templateIds || body?.ids);
    const imported = this.templateFavoritesRepo.importFavorites({
      userId: req.user.id,
      templateIds,
    });
    return {
      imported,
      templateIds: this.templateFavoritesRepo.listByUser({ userId: req.user.id }),
    };
  }
}
