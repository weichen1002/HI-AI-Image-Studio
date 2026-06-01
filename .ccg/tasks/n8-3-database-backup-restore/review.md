# N8.3 Review

## 结果

- 新增 `scripts/backup-data.mjs`：
  - 使用 `better-sqlite3` 在线备份 SQLite。
  - 同步复制 uploads 目录。
  - 输出 `manifest.json`、`app.db`、`uploads/`。
  - 支持 `--dry-run`、`--sqlite-file`、`--uploads-dir`、`--out`。
- 新增 `scripts/restore-data.mjs`：
  - 默认 dry-run，只打印恢复计划。
  - 只有 `--force` 才写入目标。
  - 目标数据库或 uploads 已存在时先重命名为 `.before-restore-<timestamp>`。
- `package.json` 新增 `backup:data` 和 `restore:data`。
- README 补充备份和恢复说明。

## 验证

- `npm run backup:data -- --dry-run --sqlite-file /private/tmp/hi-image-backup-smoke/src/app.db --uploads-dir /private/tmp/hi-image-backup-smoke/src/uploads --out /private/tmp/hi-image-backup-smoke/backup`：通过。
- `npm run backup:data -- --sqlite-file /private/tmp/hi-image-backup-smoke/src/app.db --uploads-dir /private/tmp/hi-image-backup-smoke/src/uploads --out /private/tmp/hi-image-backup-smoke/backup`：通过。
- `npm run restore:data -- --from /private/tmp/hi-image-backup-smoke/backup --sqlite-file /private/tmp/hi-image-backup-smoke/restored/app.db --uploads-dir /private/tmp/hi-image-backup-smoke/restored/uploads`：通过，未写入。
- `npm run restore:data -- --from /private/tmp/hi-image-backup-smoke/backup --sqlite-file /private/tmp/hi-image-backup-smoke/restored/app.db --uploads-dir /private/tmp/hi-image-backup-smoke/restored/uploads --force`：通过。
- 恢复后读取 SQLite `smoke` 表和 uploads `sample.txt`：通过。
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"`：通过。
- `git diff --check`：通过。

## 风险

- 恢复脚本默认不破坏现有数据。
- `--force` 恢复也会先移动现有目标，避免直接覆盖丢失。
- 当前任务按用户要求未归档、未提交。
