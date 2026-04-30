# 管理后台分页改造设计

## 背景与目标

管理后台当前列表类页面以一次性拉取 + 本地筛选为主，数据量变大后可用性与性能都会下降。目标是为管理后台“该加分页的地方”补齐分页能力，并沉淀统一风格的分页组件。

本次范围（当前仓库内的管理后台页）：
- 用户管理：`AdminUsersView`
- 账务流水：`AdminLedgerView`

## 交互规格

### 通用
- 分页为真分页：翻页触发后端请求。
- 默认每页 `20` 条。
- 分页组件放在表格底部。
- 当筛选条件变化时：重置到第 1 页并重新请求，确保 `total` 与页码正确。

### 用户管理（AdminUsersView）
- 搜索/筛选项（搜索词、plan、role、余额范围、仅余额不足）与分页一起生效。
- 顶部工具条仍负责筛选输入；表格下方显示分页。

### 账务流水（AdminLedgerView）
- 查询条件：
  - `userId`：回车/按钮触发请求。
  - `type`：作为后端筛选参数，变化后重置到第 1 页并重新请求。
- 表格下方显示分页。

## 前端组件：Pagination

### 放置与风格
- 组件位置：表格底部，与现有 `Button / SelectMenu` 风格统一。
- 布局建议：
  - 左：`第 X–Y 条 / 共 N 条`
  - 右：上一页 / 页码（含省略号）/ 下一页 / 每页条数

### Props / Events
- Props
  - `page: number`（从 1 开始）
  - `pageSize: number`
  - `total: number`
  - `pageSizeOptions?: number[]`（默认 `[20, 50, 100]`）
- Events
  - `update:page`
  - `update:pageSize`（变更时外层应将 page 重置为 1）

### 页码展示规则
- `totalPages <= 7`：全部展示。
- `totalPages > 7`：展示 `1 ... (page-1) page (page+1) ... totalPages` 的紧凑形式（边界条件自动收敛）。

## 后端 API 改造

### GET /api/admin/users
- Query
  - `search?: string`
  - `plan?: 'free' | 'pro'`
  - `role?: 'user' | 'admin' | 'superadmin'`
  - `minBalance?: number`
  - `maxBalance?: number`
  - `lowBalanceOnly?: boolean`
  - `page?: number`（默认 1）
  - `limit?: number`（默认 20，最大 100）
- Response
  - `users: Array<...>`
  - `total: number`

### GET /api/admin/users/:id/credits/ledger
- Query
  - `type?: 'grant' | 'charge' | 'refund' | 'adjust'`
  - `page?: number`（默认 1）
  - `limit?: number`（默认 20，最大 200）
- Response
  - `entries: Array<...>`
  - `total: number`

## Repo 层改造

### UsersRepo
- 新增：带筛选 + 分页的查询方法（`LIMIT/OFFSET`），并提供对应 `COUNT(*)` 用于 `total`。

### CreditsRepo
- 新增：按 `userId (+ type)` 的分页查询（`LIMIT/OFFSET`），并提供对应 `COUNT(*)` 用于 `total`。

## 错误与边界处理
- page 越界时：后端仍返回空数组与正确 total，前端收到后自动将 page clamp 到合法范围并重新请求（或直接在前端请求前 clamp）。
- 输入非法参数：后端做 normalize（`limit/page`），避免 SQL 注入与异常。

## 验证方式
- 构建：`npm run build`
- 手动路径：
  - 用户管理：筛选 + 翻页 + pageSize 切换
  - 账务流水：输入 userId 查询 + 类型筛选 + 翻页
