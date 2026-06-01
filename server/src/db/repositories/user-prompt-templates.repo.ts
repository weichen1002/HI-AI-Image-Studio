import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { SqliteService } from '../sqlite.service';

export type PromptTemplateArgument = {
  key: string;
  label: string;
  defaultValue: string;
  example: string;
};

export type UserPromptTemplateEntity = {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  prompt: string;
  arguments: PromptTemplateArgument[];
  aspectRatio: string;
  createdAt: string;
  updatedAt: string;
};

export type UpsertUserPromptTemplateParams = {
  userId: string;
  title: string;
  description?: string;
  category?: string;
  prompt: string;
  arguments?: PromptTemplateArgument[];
  aspectRatio?: string;
};

function parseArgumentsJson(value: any) {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed)
      ? parsed
          .map((item) => ({
            key: String(item?.key || '').trim(),
            label: String(item?.label || item?.key || '').trim(),
            defaultValue: String(item?.defaultValue || ''),
            example: String(item?.example || ''),
          }))
          .filter((item) => item.key)
      : [];
  } catch {
    return [];
  }
}

function toTemplate(row: any): UserPromptTemplateEntity | null {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    category: String(row.category || ''),
    prompt: String(row.prompt || ''),
    arguments: parseArgumentsJson(row.arguments_json),
    aspectRatio: String(row.aspect_ratio || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function serializeArguments(args: PromptTemplateArgument[] = []) {
  const seen = new Set<string>();
  return JSON.stringify(
    args
      .map((item) => ({
        key: String(item?.key || '').trim(),
        label: String(item?.label || item?.key || '').trim(),
        defaultValue: String(item?.defaultValue || ''),
        example: String(item?.example || ''),
      }))
      .filter((item) => {
        if (!item.key || seen.has(item.key)) return false;
        seen.add(item.key);
        return true;
      })
      .slice(0, 30),
  );
}

@Injectable()
export class UserPromptTemplatesRepo {
  constructor(private readonly sqlite: SqliteService) {}

  listByUser(params: { userId: string }) {
    const rows = this.sqlite.connection
      .prepare(
        `SELECT * FROM user_prompt_templates
         WHERE user_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(params.userId);
    return rows.map(toTemplate).filter(Boolean) as UserPromptTemplateEntity[];
  }

  findById(params: { id: string; userId: string }) {
    const row = this.sqlite.connection
      .prepare(
        `SELECT * FROM user_prompt_templates WHERE id = ? AND user_id = ?`,
      )
      .get(params.id, params.userId);
    return toTemplate(row);
  }

  create(params: UpsertUserPromptTemplateParams) {
    const now = new Date().toISOString();
    const row = {
      id: crypto.randomUUID(),
      user_id: params.userId,
      title: params.title,
      description: params.description || '',
      category: params.category || '',
      prompt: params.prompt,
      arguments_json: serializeArguments(params.arguments),
      aspect_ratio: params.aspectRatio || '',
      created_at: now,
      updated_at: now,
    };
    this.sqlite.connection
      .prepare(
        `INSERT INTO user_prompt_templates(
          id, user_id, title, description, category, prompt, arguments_json, aspect_ratio, created_at, updated_at
        )
        VALUES(
          @id, @user_id, @title, @description, @category, @prompt, @arguments_json, @aspect_ratio, @created_at, @updated_at
        )`,
      )
      .run(row);
    return toTemplate(row) as UserPromptTemplateEntity;
  }

  update(params: UpsertUserPromptTemplateParams & { id: string }) {
    const updatedAt = new Date().toISOString();
    const result = this.sqlite.connection
      .prepare(
        `UPDATE user_prompt_templates
         SET title = ?, description = ?, category = ?, prompt = ?, arguments_json = ?, aspect_ratio = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(
        params.title,
        params.description || '',
        params.category || '',
        params.prompt,
        serializeArguments(params.arguments),
        params.aspectRatio || '',
        updatedAt,
        params.id,
        params.userId,
      );
    if (Number(result?.changes || 0) <= 0) return null;
    return this.findById({ id: params.id, userId: params.userId });
  }

  delete(params: { id: string; userId: string }) {
    const result = this.sqlite.connection
      .prepare(`DELETE FROM user_prompt_templates WHERE id = ? AND user_id = ?`)
      .run(params.id, params.userId);
    return Number(result?.changes || 0);
  }
}
