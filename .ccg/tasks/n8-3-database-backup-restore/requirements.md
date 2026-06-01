# N8.3 数据库备份和恢复脚本

## 目标

按 `docs/goal-mode-roadmap-next.md` 的 N8.3 执行：提供 SQLite 在线备份脚本、上传目录打包脚本、恢复说明和 dry-run 模式。

## 范围

- 新增备份脚本，默认读取 `SQLITE_FILE` 或 `data/app.db`，并包含同级/默认 `uploads` 目录。
- 新增恢复脚本，默认 dry-run，不覆盖现有数据。
- 只有显式传 `--force` 时才写入目标数据库和 uploads。
- 更新 `package.json` 和 README。

## 验收

- 备份产物包含数据库文件和 uploads 文件。
- 恢复步骤清晰。
- 恢复脚本默认不破坏现有数据。
- 用临时目录完成 dry-run、备份、恢复 smoke 验证。
