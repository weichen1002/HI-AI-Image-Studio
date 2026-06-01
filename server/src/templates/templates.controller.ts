import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Put,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { TemplateFavoritesRepo } from '../db/repositories/template-favorites.repo';
import {
  PromptTemplateArgument,
  UserPromptTemplatesRepo,
} from '../db/repositories/user-prompt-templates.repo';

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

@Controller('api/templates')
@UseGuards(AuthGuard)
export class TemplatesController {
  constructor(
    private readonly templateFavoritesRepo: TemplateFavoritesRepo,
    private readonly userPromptTemplatesRepo: UserPromptTemplatesRepo,
  ) {}

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
