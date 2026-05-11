import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';

export type DialogueMessageEntity = {
  id: string;
  chainId: string;
  userId: string;
  imageId: string;
  parentImageId: string;
  responseId: string;
  previousResponseId: string;
  inputImageUrls: string[];
  outputItems: any[];
  prompt: string;
  createdAt: string;
};

function parseJsonArray(value: any) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toDialogueMessage(row: any): DialogueMessageEntity | null {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    chainId: String(row.chain_id || ''),
    userId: String(row.user_id || ''),
    imageId: String(row.image_id || ''),
    parentImageId: String(row.parent_image_id || ''),
    responseId: String(row.response_id || ''),
    previousResponseId: String(row.previous_response_id || ''),
    inputImageUrls: parseJsonArray(row.input_image_urls_json).map((item) =>
      String(item || ''),
    ),
    outputItems: parseJsonArray(row.output_items_json),
    prompt: String(row.prompt || ''),
    createdAt: String(row.created_at || ''),
  };
}

@Injectable()
export class DialogueRepo {
  constructor(private readonly sqlite: SqliteService) {}

  createChainId() {
    return crypto.randomUUID();
  }

  createMessage(params: {
    chainId: string;
    userId: string;
    imageId: string;
    parentImageId?: string;
    responseId?: string;
    previousResponseId?: string;
    inputImageUrls?: string[];
    outputItems?: any[];
    prompt: string;
  }) {
    const message: DialogueMessageEntity = {
      id: crypto.randomUUID(),
      chainId: params.chainId,
      userId: params.userId,
      imageId: params.imageId,
      parentImageId: params.parentImageId || '',
      responseId: params.responseId || '',
      previousResponseId: params.previousResponseId || '',
      inputImageUrls: Array.isArray(params.inputImageUrls)
        ? params.inputImageUrls.map((item) => String(item || '')).filter(Boolean)
        : [],
      outputItems: Array.isArray(params.outputItems) ? params.outputItems : [],
      prompt: params.prompt,
      createdAt: new Date().toISOString(),
    };

    this.sqlite.connection
      .prepare(
        `INSERT INTO dialogue_messages(id, chain_id, user_id, image_id, parent_image_id, response_id, previous_response_id, input_image_urls_json, output_items_json, prompt, created_at)
         VALUES(@id, @chain_id, @user_id, @image_id, @parent_image_id, @response_id, @previous_response_id, @input_image_urls_json, @output_items_json, @prompt, @created_at)`,
      )
      .run({
        id: message.id,
        chain_id: message.chainId,
        user_id: message.userId,
        image_id: message.imageId,
        parent_image_id: message.parentImageId || null,
        response_id: message.responseId || null,
        previous_response_id: message.previousResponseId || null,
        input_image_urls_json: message.inputImageUrls.length
          ? JSON.stringify(message.inputImageUrls)
          : null,
        output_items_json: message.outputItems.length
          ? JSON.stringify(message.outputItems)
          : null,
        prompt: message.prompt,
        created_at: message.createdAt,
      });

    return message;
  }

  listRecentByChain(params: { chainId: string; userId: string; limit?: number }) {
    const limit = Math.max(1, Math.min(10, Math.floor(params.limit || 5)));
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM dialogue_messages
         WHERE chain_id = ? AND user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(params.chainId, params.userId, limit);
    return rows.map(toDialogueMessage).filter(Boolean) as DialogueMessageEntity[];
  }

  findLatestByChain(params: { chainId: string; userId: string }) {
    const row = this.sqlite.connection
      .prepare(
        `SELECT * FROM dialogue_messages
         WHERE chain_id = ? AND user_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(params.chainId, params.userId);
    return toDialogueMessage(row);
  }

  listByChainAsc(params: { chainId: string; userId: string; limit?: number }) {
    const limit = Math.max(1, Math.min(30, Math.floor(params.limit || 20)));
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM dialogue_messages
         WHERE chain_id = ? AND user_id = ?
         ORDER BY created_at ASC
         LIMIT ?`,
      )
      .all(params.chainId, params.userId, limit);
    return rows.map(toDialogueMessage).filter(Boolean) as DialogueMessageEntity[];
  }

  deleteByChain(params: { chainId: string; userId: string }) {
    const result = this.sqlite.connection
      .prepare('DELETE FROM dialogue_messages WHERE chain_id = ? AND user_id = ?')
      .run(params.chainId, params.userId);
    return Number(result?.changes || 0);
  }

  deleteAllByUser(params: { userId: string }) {
    const result = this.sqlite.connection
      .prepare('DELETE FROM dialogue_messages WHERE user_id = ?')
      .run(params.userId);
    return Number(result?.changes || 0);
  }
}
