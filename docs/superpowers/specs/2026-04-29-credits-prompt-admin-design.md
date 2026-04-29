# Credits + Prompt 润色 + 管理中心（Admin UI）设计

## 背景

系统已具备注册/登录与创作工作台能力，需要新增：

- Prompt 自动润色（后端调用文本模型）
- 积分/算力系统（Credits / Tokens），按套餐扣费（成功才扣）
- 管理中心（内置在 Studio），用于用户管理、套餐管理、credits 调账、管理员管理

## 目标

- Prompt 润色接口可用，按规则扣 credits
- 生图成功后按规则扣 credits（文生图/图文生图）
- 引入最小权限模型：`user | admin | superadmin`
- 管理中心 UI 支持日常运营操作，且按权限控制可见与可访问
- 提供“第一个 superadmin”自举机制（bootstrap）

## 非目标（本期不做）

- 独立部署的后台管理系统（单独域名/单独登录）
- 支付接入（Stripe/微信/支付宝）
- 兑换码系统（方案 2，后续再做）
- 复杂 RBAC（角色-权限点矩阵）

## 信息架构（IA）

### Studio 左侧菜单

- 创作工作台
- 灵感记录
- 灵感库
- 管理中心（仅 `admin/superadmin` 可见）
  - 用户管理
  - 账务与流水
  - 管理员管理（仅 `superadmin` 可见）
- 偏好设置

### 路由建议

- `/studio/admin/users`
- `/studio/admin/ledger`
- `/studio/admin/roles`

## 权限模型

### User.role

- `user`: 普通用户
- `admin`: 运营管理员（不可管理管理员）
- `superadmin`: 超级管理员（可管理管理员）

默认注册：`role = user`

### 权限边界

`admin` 可做：

- 搜索/查看用户列表
- 修改用户套餐 plan（free/pro）
- 调整用户 credits（正负数都支持）并写 ledger
- 查看用户 ledger

`superadmin` 额外可做：

- 将用户提升为 admin
- 将 admin 降级为 user
- 管理管理员列表（含新增/移除）

## Credits 设计

### 数据结构

在 `db.json` 中新增/扩展：

- `User` 增加：
  - `plan: 'free' | 'pro'`
  - `role: 'user' | 'admin' | 'superadmin'`
  - `creditBalance: number`
- `Database` 增加：
  - `creditLedgers: CreditLedgerEntry[]`

`CreditLedgerEntry` 建议字段：

- `id: string`
- `userId: string`
- `amount: number`（正数增加、负数扣减）
- `type: 'grant' | 'charge' | 'refund' | 'adjust'`
- `reason: string`（如 `manual_adjust`, `prompt_enhance`, `text_to_image`, `image_to_image`）
- `refType?: 'image' | 'prompt' | 'admin'`
- `refId?: string`
- `createdAt: string`

### 扣费时机（成功才扣）

- Prompt 润色：润色成功返回后扣费
- 生图：上游成功 + 写入 image 历史成功后扣费

### 计价表（整数扣费，按 plan 区分）

Free：

- Prompt 润色：1
- 文生图：2
- 图文生图：3

Pro：

- Prompt 润色：1
- 文生图：1
- 图文生图：2

计价表只保存在服务端，前端仅展示余额，不参与计价计算。

### 并发一致性（重要）

当前 DB 写入模式是“读整文件 → 改内存对象 → 写整文件”，需要将 credits 写入串行化，避免并发错账：

- 建议在 DbService 增加进程内锁（mutex），提供 `withLock(fn)`，所有写入 ledger/balance 的路径都使用该锁。

## API 设计

### Prompt 润色（登录态）

- `POST /api/prompts/enhance`
  - Body：`{ prompt: string }`
  - 返回：`{ prompt: string }`
  - 逻辑：调用文本模型润色 → 成功后扣 credits → 返回润色结果

### 用户侧余额查询（登录态）

- `GET /api/credits/me`
  - 返回：`{ balance: number, plan: string, role: string }`

### 管理接口（登录态 + role）

所有 `/api/admin/*` 接口：

- 需要登录态
- 需要 `role in ['admin','superadmin']`
- 其中“管理员管理”需要 `role === 'superadmin'`

接口建议：

- `GET /api/admin/users?search=&limit=`
- `POST /api/admin/users/:id/plan`：`{ plan }`
- `POST /api/admin/users/:id/credits/adjust`：`{ amount, reason? }`（正负都支持）
- `GET /api/admin/users/:id/credits/ledger?limit=`
- `POST /api/admin/users/:id/role`（仅 superadmin）：`{ role: 'user' | 'admin' }`

### 自举（仅第一次/救场）

- `.env` 配置 `ADMIN_TOKEN`
- `POST /api/admin/bootstrap-superadmin`
  - Header：`x-admin-token: <ADMIN_TOKEN>`
  - Body：`{ userId: string }`
  - 作用：将指定用户提升为 `superadmin`

## 管理中心 UI（前端）

### 用户管理

- 搜索/分页（简单 limit）
- 列表字段：username / role / plan / creditBalance / createdAt
- 行操作：
  - 修改 plan（free/pro）
  - 调整 credits（正负数输入）
  - 查看 ledger（跳转）
  - 仅 superadmin：修改 role（user/admin）

### 账务与流水

- 支持查看某用户 ledger
- 优先提供：最近 N 条 + 过滤（type）

### 管理员管理（仅 superadmin）

- 展示当前管理员列表（admin）
- 支持对 user 授权为 admin、对 admin 撤权为 user

## 验收标准

- 注册用户默认 role=user，plan=free，可正常创作
- 管理中心菜单对 user 不可见；对 admin/superadmin 可见
- superadmin 可通过 UI 管理管理员；admin 不可
- Prompt 润色成功后扣费 1，并写入 ledger
- 文生图/图文生图成功后按 plan 扣费并写入 ledger
- 管理中心可对任意用户做 credits 调账（正负）并可追溯

