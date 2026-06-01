import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { RequestWithUser } from '../auth/auth.guard';
import { ImagesRepo } from '../db/repositories/images.repo';
import { StyleBoardsRepo } from '../db/repositories/style-boards.repo';

function normalizeName(value: any) {
  const name = String(value || '').trim();
  if (!name) {
    throw new HttpException('请输入风格板名称', HttpStatus.BAD_REQUEST);
  }
  if (name.length > 60) {
    throw new HttpException('风格板名称不能超过 60 字符', HttpStatus.BAD_REQUEST);
  }
  return name;
}

function normalizeDescription(value: any) {
  const description = String(value || '').trim();
  if (description.length > 1000) {
    throw new HttpException('风格描述不能超过 1000 字符', HttpStatus.BAD_REQUEST);
  }
  return description;
}

function normalizeNote(value: any) {
  const note = String(value || '').trim();
  if (note.length > 200) {
    throw new HttpException('参考图备注不能超过 200 字符', HttpStatus.BAD_REQUEST);
  }
  return note;
}

function normalizeImageUrl(value: any) {
  const imageUrl = String(value || '').trim();
  if (!imageUrl) {
    throw new HttpException('请提供参考图', HttpStatus.BAD_REQUEST);
  }
  if (imageUrl.length > 2_000_000) {
    throw new HttpException('参考图地址过长', HttpStatus.BAD_REQUEST);
  }
  if (
    !imageUrl.startsWith('/uploads/') &&
    !/^https?:\/\//i.test(imageUrl) &&
    !/^data:image\//i.test(imageUrl)
  ) {
    throw new HttpException(
      '仅支持站内图片、在线图片地址或 data:image 图片',
      HttpStatus.BAD_REQUEST,
    );
  }
  return imageUrl;
}

function toPublicBoard(board: any) {
  return {
    id: String(board?.id || ''),
    name: String(board?.name || ''),
    description: String(board?.description || ''),
    refs: Array.isArray(board?.refs)
      ? board.refs.map((ref: any) => ({
          id: String(ref?.id || ''),
          boardId: String(ref?.boardId || ''),
          imageId: String(ref?.imageId || ''),
          imageUrl: String(ref?.imageUrl || ''),
          note: String(ref?.note || ''),
          createdAt: String(ref?.createdAt || ''),
        }))
      : [],
    createdAt: String(board?.createdAt || ''),
    updatedAt: String(board?.updatedAt || ''),
  };
}

@Controller('api/style-boards')
@UseGuards(AuthGuard)
export class StyleBoardsController {
  constructor(
    private readonly styleBoardsRepo: StyleBoardsRepo,
    private readonly imagesRepo: ImagesRepo,
  ) {}

  @Get()
  list(@Req() req: RequestWithUser) {
    return {
      boards: this.styleBoardsRepo
        .listByUser({ userId: req.user.id })
        .map(toPublicBoard),
    };
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() body: any) {
    const board = this.styleBoardsRepo.create({
      userId: req.user.id,
      name: normalizeName(body?.name),
      description: normalizeDescription(body?.description),
    });
    return { board: toPublicBoard(board) };
  }

  @Put(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const board = this.styleBoardsRepo.update({
      id: String(id || '').trim(),
      userId: req.user.id,
      name: normalizeName(body?.name),
      description: normalizeDescription(body?.description),
    });
    if (!board) {
      throw new HttpException('风格板不存在', HttpStatus.NOT_FOUND);
    }
    return { board: toPublicBoard(board) };
  }

  @Delete(':id')
  delete(@Req() req: RequestWithUser, @Param('id') id: string) {
    const deleted = this.styleBoardsRepo.delete({
      id: String(id || '').trim(),
      userId: req.user.id,
    });
    if (deleted <= 0) {
      throw new HttpException('风格板不存在', HttpStatus.NOT_FOUND);
    }
    return { ok: true };
  }

  @Post(':id/refs')
  addRef(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const boardId = String(id || '').trim();
    const board = this.styleBoardsRepo.findById({
      id: boardId,
      userId: req.user.id,
    });
    if (!board) {
      throw new HttpException('风格板不存在', HttpStatus.NOT_FOUND);
    }

    const ref = this.styleBoardsRepo.addRef({
      boardId,
      userId: req.user.id,
      imageUrl: normalizeImageUrl(body?.imageUrl),
      imageId: String(body?.imageId || '').trim(),
      note: normalizeNote(body?.note),
    });
    return {
      board: toPublicBoard(
        this.styleBoardsRepo.findById({ id: boardId, userId: req.user.id }),
      ),
      ref,
    };
  }

  @Post(':id/refs/from-image')
  addRefFromImage(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const boardId = String(id || '').trim();
    const board = this.styleBoardsRepo.findById({
      id: boardId,
      userId: req.user.id,
    });
    if (!board) {
      throw new HttpException('风格板不存在', HttpStatus.NOT_FOUND);
    }

    const imageId = String(body?.imageId || '').trim();
    const image = this.imagesRepo.findById({ id: imageId, userId: req.user.id });
    if (!image) {
      throw new HttpException('记录不存在', HttpStatus.NOT_FOUND);
    }
    const imageUrl = image.imageUrls?.[0] || image.previewImageUrls?.[0] || '';
    if (!imageUrl) {
      throw new HttpException('这条记录没有可用图片', HttpStatus.BAD_REQUEST);
    }

    const ref = this.styleBoardsRepo.addRef({
      boardId,
      userId: req.user.id,
      imageId: image.id,
      imageUrl,
      note: normalizeNote(body?.note || image.prompt),
    });
    return {
      board: toPublicBoard(
        this.styleBoardsRepo.findById({ id: boardId, userId: req.user.id }),
      ),
      ref,
    };
  }

  @Delete(':id/refs/:refId')
  deleteRef(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('refId') refId: string,
  ) {
    const deleted = this.styleBoardsRepo.deleteRef({
      id: String(refId || '').trim(),
      boardId: String(id || '').trim(),
      userId: req.user.id,
    });
    if (deleted <= 0) {
      throw new HttpException('参考图不存在', HttpStatus.NOT_FOUND);
    }
    return {
      board: toPublicBoard(
        this.styleBoardsRepo.findById({
          id: String(id || '').trim(),
          userId: req.user.id,
        }),
      ),
    };
  }
}
