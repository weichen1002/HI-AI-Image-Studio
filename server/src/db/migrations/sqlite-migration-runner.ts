function isoNow() {
  return new Date().toISOString();
}

function hasMigration(db: any, version: number) {
  return db
    .prepare('SELECT 1 FROM schema_migrations WHERE version = ?')
    .get(version);
}

function markMigration(db: any, version: number) {
  if (hasMigration(db, version)) return;
  db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)').run(
    version,
    isoNow(),
  );
}

function columnNames(db: any, tableName: string) {
  return new Set(
    (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map(
      (column) => column.name,
    ),
  );
}

export function runSqliteMigrations(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      plan TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      credit_balance INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      operation_type TEXT NOT NULL DEFAULT 'generate',
      prompt TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL,
      generation_params TEXT NOT NULL DEFAULT '{}',
      content TEXT NOT NULL,
      image_urls TEXT NOT NULL,
      input_image_urls TEXT,
      preview_image_urls TEXT,
      folder TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      favorite_at TEXT,
      source_image_id TEXT,
      continuation_chain_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_images_user_created ON images(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS image_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      status TEXT NOT NULL,
      prompt TEXT NOT NULL,
      image_id TEXT,
      error_message TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_image_jobs_user_updated ON image_jobs(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_image_jobs_status_updated ON image_jobs(status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS dialogue_messages (
      id TEXT PRIMARY KEY,
      chain_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      image_id TEXT NOT NULL,
      parent_image_id TEXT,
      response_id TEXT,
      previous_response_id TEXT,
      input_image_urls_json TEXT,
      output_items_json TEXT,
      prompt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dialogue_chain_created ON dialogue_messages(chain_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_dialogue_user_created ON dialogue_messages(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS credit_ledgers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      reason TEXT NOT NULL,
      ref_type TEXT,
      ref_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ledgers_user_created ON credit_ledgers(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content_md TEXT NOT NULL,
      status TEXT NOT NULL,
      notify_mode TEXT NOT NULL,
      repeat_mode TEXT NOT NULL,
      audience_json TEXT NOT NULL DEFAULT '{}',
      start_at TEXT,
      end_at TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_announcements_status_created ON announcements(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_announcements_status_time ON announcements(status, start_at, end_at);

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      target_user_id TEXT,
      category TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      detail_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_target_created ON audit_logs(target_user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS redeem_codes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      code_hash TEXT NOT NULL UNIQUE,
      code_mask TEXT NOT NULL,
      code_ciphertext TEXT,
      type TEXT NOT NULL,
      credits_amount INTEGER NOT NULL,
      total_limit INTEGER NOT NULL,
      redeemed_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_redeem_codes_created ON redeem_codes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_redeem_codes_type ON redeem_codes(type, created_at DESC);

    CREATE TABLE IF NOT EXISTS redeem_code_claims (
      id TEXT PRIMARY KEY,
      code_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      credits_amount INTEGER NOT NULL,
      claimed_at TEXT NOT NULL,
      ledger_entry_id TEXT,
      UNIQUE(code_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_redeem_claims_user_time ON redeem_code_claims(user_id, claimed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_redeem_claims_code_time ON redeem_code_claims(code_id, claimed_at DESC);

    CREATE TABLE IF NOT EXISTS announcement_reads (
      announcement_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      read_at TEXT NOT NULL,
      PRIMARY KEY (announcement_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id, read_at DESC);

    CREATE TABLE IF NOT EXISTS template_favorites (
      user_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      favorite_at TEXT NOT NULL,
      PRIMARY KEY (user_id, template_id)
    );
    CREATE INDEX IF NOT EXISTS idx_template_favorites_user_time ON template_favorites(user_id, favorite_at DESC);

    CREATE TABLE IF NOT EXISTS user_prompt_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL,
      arguments_json TEXT NOT NULL DEFAULT '[]',
      aspect_ratio TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_prompt_templates_user_updated ON user_prompt_templates(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_verification_user_created ON email_verification_tokens(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS billing_packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      credits_amount INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CNY',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_billing_packages_active_sort ON billing_packages(active, sort_order, price_cents);

    CREATE TABLE IF NOT EXISTS billing_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      package_name TEXT NOT NULL,
      credits_amount INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      payment_channel TEXT,
      payment_ref TEXT,
      ledger_entry_id TEXT,
      refund_ledger_entry_id TEXT,
      refund_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      paid_at TEXT,
      refunded_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_billing_orders_user_created ON billing_orders(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_billing_orders_status_created ON billing_orders(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS style_boards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_style_boards_user_updated ON style_boards(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS style_board_refs (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      image_id TEXT,
      image_url TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_style_board_refs_board_created ON style_board_refs(board_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS image_feedbacks (
      image_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rating TEXT NOT NULL DEFAULT 'none',
      issue_type TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (image_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_image_feedbacks_rating_updated ON image_feedbacks(rating, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_image_feedbacks_issue_updated ON image_feedbacks(issue_type, updated_at DESC);
  `);

  markMigration(db, 1);
  markMigration(db, 2);
  markMigration(db, 3);

  const redeemCodeColumns = columnNames(db, 'redeem_codes');
  if (!redeemCodeColumns.has('code_ciphertext')) {
    db.prepare('ALTER TABLE redeem_codes ADD COLUMN code_ciphertext TEXT').run();
  }

  markMigration(db, 4);

  const imageColumns = columnNames(db, 'images');
  if (!imageColumns.has('operation_type')) {
    db.prepare(
      `ALTER TABLE images ADD COLUMN operation_type TEXT NOT NULL DEFAULT 'generate'`,
    ).run();
    db.prepare(
      `UPDATE images SET operation_type = CASE WHEN mode = 'image' THEN 'image_to_image' ELSE 'generate' END WHERE operation_type IS NULL OR operation_type = ''`,
    ).run();
  }
  if (!imageColumns.has('source_image_id')) {
    db.prepare('ALTER TABLE images ADD COLUMN source_image_id TEXT').run();
  }
  if (!imageColumns.has('continuation_chain_id')) {
    db.prepare('ALTER TABLE images ADD COLUMN continuation_chain_id TEXT').run();
  }
  if (!imageColumns.has('folder')) {
    db.prepare(`ALTER TABLE images ADD COLUMN folder TEXT NOT NULL DEFAULT ''`).run();
  }
  if (!imageColumns.has('tags')) {
    db.prepare(`ALTER TABLE images ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`).run();
  }
  if (!imageColumns.has('generation_params')) {
    db.prepare(
      `ALTER TABLE images ADD COLUMN generation_params TEXT NOT NULL DEFAULT '{}'`,
    ).run();
  }
  if (!imageColumns.has('favorite_at')) {
    db.prepare('ALTER TABLE images ADD COLUMN favorite_at TEXT').run();
  }
  if (!imageColumns.has('preview_image_urls')) {
    db.prepare('ALTER TABLE images ADD COLUMN preview_image_urls TEXT').run();
  }
  db.prepare(
    'CREATE INDEX IF NOT EXISTS idx_images_user_favorite ON images(user_id, favorite_at DESC)',
  ).run();

  markMigration(db, 5);
  markMigration(db, 6);

  const dialogueColumns = columnNames(db, 'dialogue_messages');
  if (!dialogueColumns.has('response_id')) {
    db.prepare('ALTER TABLE dialogue_messages ADD COLUMN response_id TEXT').run();
  }
  if (!dialogueColumns.has('previous_response_id')) {
    db.prepare('ALTER TABLE dialogue_messages ADD COLUMN previous_response_id TEXT').run();
  }
  if (!dialogueColumns.has('input_image_urls_json')) {
    db.prepare('ALTER TABLE dialogue_messages ADD COLUMN input_image_urls_json TEXT').run();
  }
  if (!dialogueColumns.has('output_items_json')) {
    db.prepare('ALTER TABLE dialogue_messages ADD COLUMN output_items_json TEXT').run();
  }

  markMigration(db, 7);

  const userColumns = columnNames(db, 'users');
  if (!userColumns.has('last_used_at')) {
    db.prepare('ALTER TABLE users ADD COLUMN last_used_at TEXT').run();
  }
  if (!userColumns.has('status')) {
    db.prepare(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`).run();
  }
  db.prepare(`UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''`).run();

  markMigration(db, 8);
  markMigration(db, 9);
  markMigration(db, 10);
  markMigration(db, 11);
  markMigration(db, 12);
  markMigration(db, 13);
  markMigration(db, 14);

  const now = isoNow();
  const defaultPackages = [
    {
      id: 'starter-credits',
      name: '入门包',
      description: '适合临时补充少量生成额度。',
      credits_amount: 100,
      price_cents: 990,
      sort_order: 10,
    },
    {
      id: 'creator-credits',
      name: '创作者包',
      description: '适合持续创作和批量尝试。',
      credits_amount: 600,
      price_cents: 4990,
      sort_order: 20,
    },
    {
      id: 'studio-credits',
      name: '工作室包',
      description: '适合团队素材生产和高频出图。',
      credits_amount: 1500,
      price_cents: 9990,
      sort_order: 30,
    },
  ];
  for (const item of defaultPackages) {
    db.prepare(
      `INSERT INTO billing_packages(
        id, name, description, credits_amount, price_cents, currency, active, sort_order, created_at, updated_at
      ) VALUES(
        @id, @name, @description, @credits_amount, @price_cents, 'CNY', 1, @sort_order, @now, @now
      )
      ON CONFLICT(id) DO NOTHING`,
    ).run({ ...item, now });
  }

  markMigration(db, 15);

  const imageJobColumns = columnNames(db, 'image_jobs');
  if (!imageJobColumns.has('payload_json')) {
    db.prepare(`ALTER TABLE image_jobs ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}'`).run();
  }
  if (!imageJobColumns.has('attempts')) {
    db.prepare(`ALTER TABLE image_jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0`).run();
  }

  markMigration(db, 16);
  markMigration(db, 17);

  const billingOrderColumns = columnNames(db, 'billing_orders');
  if (!billingOrderColumns.has('refund_ledger_entry_id')) {
    db.prepare('ALTER TABLE billing_orders ADD COLUMN refund_ledger_entry_id TEXT').run();
  }
  if (!billingOrderColumns.has('refund_reason')) {
    db.prepare('ALTER TABLE billing_orders ADD COLUMN refund_reason TEXT').run();
  }
  if (!billingOrderColumns.has('refunded_at')) {
    db.prepare('ALTER TABLE billing_orders ADD COLUMN refunded_at TEXT').run();
  }

  markMigration(db, 18);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_prompt_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL,
      arguments_json TEXT NOT NULL DEFAULT '[]',
      aspect_ratio TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_prompt_templates_user_updated ON user_prompt_templates(user_id, updated_at DESC);
  `);

  markMigration(db, 19);

  db.exec(`
    CREATE TABLE IF NOT EXISTS image_feedbacks (
      image_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      rating TEXT NOT NULL DEFAULT 'none',
      issue_type TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (image_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_image_feedbacks_rating_updated ON image_feedbacks(rating, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_image_feedbacks_issue_updated ON image_feedbacks(issue_type, updated_at DESC);
  `);

  markMigration(db, 20);

  const announcementColumns = columnNames(db, 'announcements');
  if (!announcementColumns.has('audience_json')) {
    db.prepare(`ALTER TABLE announcements ADD COLUMN audience_json TEXT NOT NULL DEFAULT '{}'`).run();
  }

  markMigration(db, 21);
}
