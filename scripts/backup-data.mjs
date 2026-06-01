import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const Database = require('../server/node_modules/better-sqlite3');

const rootDir = process.cwd();

function parseArgs(argv) {
  const args = {
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    const [key, inlineValue] = arg.split('=', 2);
    if (!key.startsWith('--')) continue;
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue == null) index += 1;
    args[key.slice(2)] = value;
  }
  return args;
}

function resolveFromRoot(value, fallback) {
  const next = String(value || fallback || '').trim();
  if (!next) return '';
  return path.isAbsolute(next) ? next : path.join(rootDir, next);
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

async function copyDirectory(source, target) {
  if (!existsSync(source)) {
    await fs.mkdir(target, { recursive: true });
    return { copied: 0, bytes: 0 };
  }

  let copied = 0;
  let bytes = 0;
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      const child = await copyDirectory(sourcePath, targetPath);
      copied += child.copied;
      bytes += child.bytes;
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = await fs.stat(sourcePath);
    await fs.copyFile(sourcePath, targetPath);
    copied += 1;
    bytes += stat.size;
  }
  return { copied, bytes };
}

async function backupSqlite(source, target) {
  const db = new Database(source, { readonly: true, fileMustExist: true });
  try {
    await db.backup(target);
  } finally {
    db.close();
  }
  const stat = await fs.stat(target);
  return { bytes: stat.size };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sqliteFile = resolveFromRoot(args['sqlite-file'], process.env.SQLITE_FILE || 'data/app.db');
  const dataDir = resolveFromRoot(args['data-dir'], path.dirname(sqliteFile));
  const uploadsDir = resolveFromRoot(args['uploads-dir'], path.join(dataDir, 'uploads'));
  const outDir = resolveFromRoot(args.out, path.join(rootDir, 'backups', timestampSlug()));
  const backupDbFile = path.join(outDir, 'app.db');
  const backupUploadsDir = path.join(outDir, 'uploads');
  const manifestFile = path.join(outDir, 'manifest.json');

  const plan = {
    sqliteFile,
    uploadsDir,
    outDir,
    backupDbFile,
    backupUploadsDir,
    manifestFile,
    dryRun: args.dryRun,
  };

  if (!existsSync(sqliteFile)) {
    throw new Error(`SQLite file does not exist: ${sqliteFile}`);
  }
  if (existsSync(outDir)) {
    throw new Error(`Backup output already exists: ${outDir}`);
  }

  if (args.dryRun) {
    console.log(JSON.stringify({ ok: true, action: 'backup:dry-run', plan }, null, 2));
    return;
  }

  await fs.mkdir(outDir, { recursive: true });
  const db = await backupSqlite(sqliteFile, backupDbFile);
  const uploads = await copyDirectory(uploadsDir, backupUploadsDir);
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    source: {
      sqliteFile,
      uploadsDir,
    },
    files: {
      sqlite: {
        path: 'app.db',
        bytes: db.bytes,
      },
      uploads: {
        path: 'uploads',
        files: uploads.copied,
        bytes: uploads.bytes,
      },
    },
  };
  await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, action: 'backup', outDir, manifest }, null, 2));
}

main().catch((error) => {
  console.error(`[backup-data] ${error?.stack || error?.message || error}`);
  process.exit(1);
});
