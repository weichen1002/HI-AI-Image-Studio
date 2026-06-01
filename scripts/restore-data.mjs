import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function parseArgs(argv) {
  const args = {
    force: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--force') {
      args.force = true;
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

async function readManifest(backupDir) {
  const manifestFile = path.join(backupDir, 'manifest.json');
  if (!existsSync(manifestFile)) {
    throw new Error(`Backup manifest is missing: ${manifestFile}`);
  }
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  if (manifest?.version !== 1) {
    throw new Error('Unsupported backup manifest version');
  }
  return manifest;
}

async function copyDirectory(source, target) {
  if (!existsSync(source)) return { copied: 0, bytes: 0 };

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

async function moveAsideIfExists(targetPath, restoreId) {
  if (!existsSync(targetPath)) return '';
  const backupPath = `${targetPath}.before-restore-${restoreId}`;
  await fs.rename(targetPath, backupPath);
  return backupPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backupDir = resolveFromRoot(args.from, '');
  if (!backupDir) {
    throw new Error('Missing required --from <backup-dir>');
  }
  const manifest = await readManifest(backupDir);
  const backupDbFile = path.join(backupDir, manifest.files.sqlite.path || 'app.db');
  const backupUploadsDir = path.join(backupDir, manifest.files.uploads.path || 'uploads');
  const sqliteFile = resolveFromRoot(args['sqlite-file'], process.env.SQLITE_FILE || 'data/app.db');
  const dataDir = resolveFromRoot(args['data-dir'], path.dirname(sqliteFile));
  const uploadsDir = resolveFromRoot(args['uploads-dir'], path.join(dataDir, 'uploads'));
  const restoreId = timestampSlug();
  const plan = {
    backupDir,
    backupDbFile,
    backupUploadsDir,
    sqliteFile,
    uploadsDir,
    force: args.force,
    willMoveAside: {
      sqliteFile: existsSync(sqliteFile),
      uploadsDir: existsSync(uploadsDir),
    },
  };

  if (!existsSync(backupDbFile)) {
    throw new Error(`Backup SQLite file is missing: ${backupDbFile}`);
  }

  if (!args.force) {
    console.log(JSON.stringify({ ok: true, action: 'restore:dry-run', plan }, null, 2));
    return;
  }

  await fs.mkdir(path.dirname(sqliteFile), { recursive: true });
  await fs.mkdir(path.dirname(uploadsDir), { recursive: true });
  const movedSqlite = await moveAsideIfExists(sqliteFile, restoreId);
  const movedUploads = await moveAsideIfExists(uploadsDir, restoreId);
  await fs.copyFile(backupDbFile, sqliteFile);
  const uploads = await copyDirectory(backupUploadsDir, uploadsDir);

  console.log(JSON.stringify({
    ok: true,
    action: 'restore',
    sqliteFile,
    uploadsDir,
    preserved: {
      sqliteFile: movedSqlite,
      uploadsDir: movedUploads,
    },
    restored: {
      uploadsFiles: uploads.copied,
      uploadsBytes: uploads.bytes,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(`[restore-data] ${error?.stack || error?.message || error}`);
  process.exit(1);
});
