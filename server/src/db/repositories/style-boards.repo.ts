import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';

export type StyleBoardRefEntity = {
  id: string;
  boardId: string;
  userId: string;
  imageId: string;
  imageUrl: string;
  note: string;
  createdAt: string;
};

export type StyleBoardEntity = {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  refs: StyleBoardRefEntity[];
};

function toRef(row: any): StyleBoardRefEntity | null {
  if (!row) return null;
  return {
    id: String(row.id),
    boardId: String(row.board_id),
    userId: String(row.user_id),
    imageId: row.image_id ? String(row.image_id) : '',
    imageUrl: String(row.image_url || ''),
    note: String(row.note || ''),
    createdAt: String(row.created_at || ''),
  };
}

function toBoard(row: any, refs: StyleBoardRefEntity[] = []): StyleBoardEntity | null {
  if (!row) return null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name || ''),
    description: String(row.description || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    refs,
  };
}

@Injectable()
export class StyleBoardsRepo {
  constructor(private readonly sqlite: SqliteService) {}

  listByUser(params: { userId: string }) {
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM style_boards WHERE user_id = ? ORDER BY updated_at DESC`,
      )
      .all(params.userId);
    const boards = rows.map((row: any) => toBoard(row, [])).filter(Boolean) as StyleBoardEntity[];
    const refs = this.listRefsForBoards({
      userId: params.userId,
      boardIds: boards.map((board) => board.id),
    });
    const refsByBoard = new Map<string, StyleBoardRefEntity[]>();
    for (const ref of refs) {
      refsByBoard.set(ref.boardId, [...(refsByBoard.get(ref.boardId) || []), ref]);
    }
    return boards.map((board) => ({
      ...board,
      refs: refsByBoard.get(board.id) || [],
    }));
  }

  findById(params: { id: string; userId: string }) {
    const row = this.sqlite.connection
      .prepare(`SELECT * FROM style_boards WHERE id = ? AND user_id = ?`)
      .get(params.id, params.userId);
    const board = toBoard(row, []);
    if (!board) return null;
    return {
      ...board,
      refs: this.listRefs({ boardId: board.id, userId: params.userId }),
    };
  }

  create(params: { userId: string; name: string; description?: string }) {
    const now = new Date().toISOString();
    const board = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      name: params.name,
      description: params.description || '',
      created_at: now,
      updated_at: now,
    };
    this.sqlite.connection
      .prepare(
        `INSERT INTO style_boards(id, user_id, name, description, created_at, updated_at)
         VALUES(@id, @user_id, @name, @description, @created_at, @updated_at)`,
      )
      .run(board);
    return toBoard(board, []) as StyleBoardEntity;
  }

  update(params: { id: string; userId: string; name: string; description: string }) {
    const updatedAt = new Date().toISOString();
    const result = this.sqlite.connection
      .prepare(
        `UPDATE style_boards SET name = ?, description = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(params.name, params.description, updatedAt, params.id, params.userId);
    if (Number(result?.changes || 0) <= 0) return null;
    return this.findById({ id: params.id, userId: params.userId });
  }

  delete(params: { id: string; userId: string }) {
    return this.sqlite.transaction(() => {
      this.sqlite.connection
        .prepare(`DELETE FROM style_board_refs WHERE board_id = ? AND user_id = ?`)
        .run(params.id, params.userId);
      const result = this.sqlite.connection
        .prepare(`DELETE FROM style_boards WHERE id = ? AND user_id = ?`)
        .run(params.id, params.userId);
      return Number(result?.changes || 0);
    });
  }

  addRef(params: {
    boardId: string;
    userId: string;
    imageUrl: string;
    imageId?: string;
    note?: string;
  }) {
    const now = new Date().toISOString();
    const ref = {
      id: crypto.randomUUID(),
      board_id: params.boardId,
      user_id: params.userId,
      image_id: params.imageId || null,
      image_url: params.imageUrl,
      note: params.note || '',
      created_at: now,
    };
    this.sqlite.connection
      .prepare(
        `INSERT INTO style_board_refs(id, board_id, user_id, image_id, image_url, note, created_at)
         VALUES(@id, @board_id, @user_id, @image_id, @image_url, @note, @created_at)`,
      )
      .run(ref);
    this.touch({ id: params.boardId, userId: params.userId });
    return toRef(ref) as StyleBoardRefEntity;
  }

  deleteRef(params: { id: string; boardId: string; userId: string }) {
    const result = this.sqlite.connection
      .prepare(
        `DELETE FROM style_board_refs WHERE id = ? AND board_id = ? AND user_id = ?`,
      )
      .run(params.id, params.boardId, params.userId);
    if (Number(result?.changes || 0) > 0) {
      this.touch({ id: params.boardId, userId: params.userId });
    }
    return Number(result?.changes || 0);
  }

  private listRefs(params: { boardId: string; userId: string }) {
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM style_board_refs
         WHERE board_id = ? AND user_id = ?
         ORDER BY created_at DESC`,
      )
      .all(params.boardId, params.userId);
    return rows.map(toRef).filter(Boolean) as StyleBoardRefEntity[];
  }

  private listRefsForBoards(params: { userId: string; boardIds: string[] }) {
    const boardIds = Array.from(new Set(params.boardIds.filter(Boolean)));
    if (!boardIds.length) return [];
    const placeholders = boardIds.map(() => '?').join(',');
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM style_board_refs
         WHERE user_id = ? AND board_id IN (${placeholders})
         ORDER BY created_at DESC`,
      )
      .all(params.userId, ...boardIds);
    return rows.map(toRef).filter(Boolean) as StyleBoardRefEntity[];
  }

  private touch(params: { id: string; userId: string }) {
    this.sqlite.connection
      .prepare(`UPDATE style_boards SET updated_at = ? WHERE id = ? AND user_id = ?`)
      .run(new Date().toISOString(), params.id, params.userId);
  }
}
