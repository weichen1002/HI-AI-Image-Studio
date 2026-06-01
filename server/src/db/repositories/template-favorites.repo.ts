import { Injectable } from '@nestjs/common';
import { SqliteService } from '../sqlite.service';

function normalizeTemplateIds(value: string[]) {
  return Array.from(
    new Set((value || []).map((id) => String(id || '').trim()).filter(Boolean)),
  ).slice(0, 500);
}

@Injectable()
export class TemplateFavoritesRepo {
  constructor(private readonly sqlite: SqliteService) {}

  listByUser(params: { userId: string }) {
    const rows = this.sqlite.connection
      .prepare(
        `SELECT template_id
         FROM template_favorites
         WHERE user_id = ?
         ORDER BY favorite_at DESC`,
      )
      .all(params.userId) as Array<{ template_id?: string }>;
    return rows.map((row) => String(row.template_id || '')).filter(Boolean);
  }

  setFavorite(params: { userId: string; templateId: string; favorite: boolean }) {
    const templateId = String(params.templateId || '').trim();
    if (!templateId) return 0;
    if (!params.favorite) {
      const result = this.sqlite.connection
        .prepare('DELETE FROM template_favorites WHERE user_id = ? AND template_id = ?')
        .run(params.userId, templateId);
      return Number(result?.changes || 0);
    }

    const result = this.sqlite.connection
      .prepare(
        `INSERT INTO template_favorites(user_id, template_id, favorite_at)
         VALUES(?, ?, ?)
         ON CONFLICT(user_id, template_id) DO UPDATE SET favorite_at = excluded.favorite_at`,
      )
      .run(params.userId, templateId, new Date().toISOString());
    return Number(result?.changes || 0);
  }

  importFavorites(params: { userId: string; templateIds: string[] }) {
    const templateIds = normalizeTemplateIds(params.templateIds);
    if (!templateIds.length) return 0;
    const insert = this.sqlite.connection.prepare(
      `INSERT INTO template_favorites(user_id, template_id, favorite_at)
       VALUES(?, ?, ?)
       ON CONFLICT(user_id, template_id) DO NOTHING`,
    );
    return this.sqlite.transaction(() => {
      let changes = 0;
      for (const templateId of templateIds) {
        const result = insert.run(params.userId, templateId, new Date().toISOString());
        changes += Number(result?.changes || 0);
      }
      return changes;
    });
  }
}
