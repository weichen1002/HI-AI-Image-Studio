# SQLite（better-sqlite3）迁移与并发一致性设计

## 背景

当前服务端使用本地 JSON 文件 `data/db.json` 作为存储（读整文件→改内存→写整文件），在多用户并发上线、引入 credits/ledger 与付费逻辑后，缺少事务与并发一致性保障，存在错账与数据覆盖风险。

本方案将存储迁移为文件型 SQLite（`data/app.db`），使用 `better-sqlite3`，并支持启动时自动从 `data/db.json` 一次性导入。

## 目标

- 使用文件型 SQLite 替代 JSON 存储，支持事务（transaction）
- 启动时自动迁移：数据库为空时从 `data/db.json` 导入，并将原文件保留为备份
- 为 credits/ledger、管理中心、prompt 润色等写操作提供原子性保障
- 保持现有 API 行为与数据字段对外兼容（必要字段保持一致）

## 非目标

- 支付接入与订单系统
- PostgreSQL 多实例部署（后续可在 repository 层抽象后迁移）
- 跨进程分布式锁

## 配置

- 新增环境变量：
  - `SQLITE_FILE`：默认 `data/app.db`
- 目录 `data/` 保持不进 git（现已在 `.gitignore` 中）

## 数据表设计

### users

- `id TEXT PRIMARY KEY`
- `username TEXT UNIQUE NOT NULL`
- `password_hash TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `plan TEXT NOT NULL`（`free|pro`）
- `role TEXT NOT NULL`（`user|admin|superadmin`）
- `credit_balance INTEGER NOT NULL`

索引：

- `CREATE UNIQUE INDEX idx_users_username ON users(username);`

### images

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `mode TEXT NOT NULL`（`text|image`）
- `prompt TEXT NOT NULL`
- `aspect_ratio TEXT NOT NULL`
- `content TEXT NOT NULL`
- `image_urls TEXT NOT NULL`（JSON string）
- `input_image_urls TEXT`（JSON string，可空）
- `created_at TEXT NOT NULL`

索引：

- `CREATE INDEX idx_images_user_created ON images(user_id, created_at DESC);`

### credit_ledgers

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `amount INTEGER NOT NULL`（正负）
- `type TEXT NOT NULL`（`grant|charge|refund|adjust`）
- `reason TEXT NOT NULL`
- `ref_type TEXT`
- `ref_id TEXT`
- `created_at TEXT NOT NULL`

索引：

- `CREATE INDEX idx_ledgers_user_created ON credit_ledgers(user_id, created_at DESC);`

### schema_migrations

- `version INTEGER PRIMARY KEY`
- `applied_at TEXT NOT NULL`

## 启动自动迁移策略（选择 A）

启动流程：

1. 若 `SQLITE_FILE` 不存在：创建文件与表结构（并写入 `schema_migrations` version=1）
2. 若存在 `data/db.json` 且 SQLite 的 `users/images` 表为空：
   - 读取并校验 JSON 结构
   - 以事务导入：
     - 导入 `users`
     - 导入 `images`
   - 导入完成后，将 `data/db.json` 重命名为 `data/db.json.bak`（避免重复导入）
3. 若 SQLite 已有数据：不导入

失败策略：

- 导入失败：事务回滚，不生成半成品数据；保留 `db.json` 不改名，便于修复后重试

## 事务边界（并发一致性）

所有“涉及余额与流水”的写操作必须使用 SQLite 事务，确保原子性：

- 生图成功（文生图/图文生图）
  - insert `images`
  - insert `credit_ledgers`（扣费）
  - update `users.credit_balance`
- prompt 润色成功
  - insert `credit_ledgers`（扣费）
  - update `users.credit_balance`
- 管理中心调账（正负）
  - insert `credit_ledgers`
  - update `users.credit_balance`
- 修改用户 plan/role（管理中心）
  - update `users.plan/role`

## 代码组织建议

新增服务层与 repository，避免 controller 内拼 SQL：

- `server/src/db/sqlite.service.ts`
  - 打开连接
  - 初始化建表
  - `transaction(fn)` 包装
- `server/src/db/repositories/`
  - `users.repo.ts`
  - `images.repo.ts`
  - `credits.repo.ts`

渐进替换：

- 先将 `AuthGuard/AuthController/ImageController` 的读写从 `DbService` 切到 repos
- 删除或保留 `DbService` 仅用于读取旧 JSON（迁移期）

## 兼容性

- 图片记录字段保持与现有 API 一致：
  - `imageUrls` 与 `inputImageUrls` 在 DB 内以 JSON 存储，API 返回数组
- 旧数据没有 `mode/inputImageUrls/plan/role/credit_balance` 时：
  - 迁移时补默认值：
    - `mode='text'`（无 input）
    - `plan='free'`
    - `role='user'`
    - `credit_balance=0`（后续可通过管理中心调账/赠送）

## 部署注意事项

- `better-sqlite3` 为 native 依赖：
  - CI/镜像需要具备编译或可用预编译二进制
  - Node 版本与平台需要匹配
- SQLite 文件需持久化挂载（容器部署时挂载 volume）

## 回滚策略

- 迁移后保留 `db.json.bak`
- 若发生严重问题，可暂时切回旧版本并恢复 `db.json`（后续再二次迁移）

## 验收标准

- 启动时无 `app.db`：自动创建并可正常注册/登录/生图
- 存在 `db.json` 且 `app.db` 为空：自动导入，历史记录可查
- 并发请求下：
  - credits 扣费与 ledger 写入保持一致
  - 不出现负余额穿透（余额不足应拒绝或按规则处理）

