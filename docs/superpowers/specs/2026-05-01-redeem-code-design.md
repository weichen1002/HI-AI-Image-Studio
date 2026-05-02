# 兑换码（余额兑换）第一版设计

## 背景

当前系统已经具备：

- 用户余额体系与余额流水 `credit_ledgers`
- 注册赠送余额与系统设置
- 管理中心列表页、筛选、分页等基础 UI 模式

现在需要补上一套“兑换码”能力，满足运营发码、用户自助兑换余额的场景。

## 已确认范围

第一版只做以下范围：

- 兑换内容只支持余额，不支持套餐、会员天数、模型权限等其他权益
- 同时支持单次码与活动码
- 只支持结束时间，不做开始时间
- 活动码允许多人使用
- 同一个用户不允许重复兑换同一个码
- 注册页允许可选填写兑换码
- 注册时如果兑换码无效，不阻止注册成功

## 目标

- 管理端可创建、查看、启停兑换码
- 用户端可输入兑换码并立即到账
- 成功兑换后写入余额流水，便于审计
- 兑换校验明确，错误提示可直接给用户使用
- 结构可扩展，后续能继续加批量生成、导出、套餐兑换等能力

## 非目标

- 不做批量导入/批量生成
- 不做开始时间、生效时间段
- 不做兑换码分享海报、渠道追踪、邀请返利
- 不做未登录兑换
- 不做独立“充值中心”页面
- 不做删除后不可追溯的物理清理流程，第一版以“停用”为主

## 方案对比

### 方案 A：直接复用系统设置，配置少量兑换码 JSON

- 优点：开发快，改动少
- 缺点：不适合查询、分页、审计，也不方便做同用户去重与总次数控制

### 方案 B：独立兑换码表 + 兑换记录表 + 复用现有余额流水

- 优点：边界清晰，和现有 `credit_ledgers` 天然衔接，校验、审计、后台管理都更稳
- 缺点：需要新增表、接口、后台页面

### 方案 C：把兑换码当作“管理员调账入口”的包装层

- 优点：余额发放逻辑最少
- 缺点：用户无法自助兑换，也难以表达活动码、次数、过期、去重等规则

### 结论

采用方案 B。

原因：

- 现有余额体系已经成熟，最适合让兑换码只负责“校验 + 领取记录”，实际发放继续复用 `CreditsRepo.grant`
- 后续如果要扩展为批量码、渠道码、礼包码，也能沿当前表结构演进

## 信息架构

### 管理端

管理中心新增一个页面：

- 路由：`/studio/admin/redeem-codes`
- 菜单名称：`兑换码`

页面内容：

- 顶部筛选区：搜索、类型、状态
- 列表区：兑换码基础信息、使用进度、过期时间、启用状态
- 行操作：查看兑换记录、编辑、停用/启用
- 创建按钮：新增兑换码

### 用户端

第一版不单独新增路由，采用两个轻量入口：

- 注册页增加“兑换码（选填）”输入框
- 在 `StudioView` 顶栏余额区域附近增加 `兑换码` 按钮
- 点击后打开兑换弹窗
- 输入兑换码并提交，成功后刷新当前用户余额

这样可以兼顾两个场景：

- 新用户在注册时直接输入兑换码
- 老用户或注册时未填写的用户，后续仍可在 Studio 内补兑

同时避免为了一个简单动作新增独立页面。

## 数据模型（SQLite）

### 1）`redeem_codes`

- `id` TEXT PRIMARY KEY
- `title` TEXT NOT NULL
- `code_hash` TEXT NOT NULL UNIQUE
- `code_mask` TEXT NOT NULL
- `type` TEXT NOT NULL (`single` | `campaign`)
- `credits_amount` INTEGER NOT NULL
- `total_limit` INTEGER NOT NULL
- `redeemed_count` INTEGER NOT NULL DEFAULT 0
- `expires_at` TEXT NULL
- `enabled` INTEGER NOT NULL DEFAULT 1
- `created_by` TEXT NOT NULL
- `updated_by` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `updated_at` TEXT NOT NULL

字段约定：

- `single` 固定 `total_limit = 1`
- `campaign` 的 `total_limit` 必填，且必须大于等于 `2`
- `code_hash` 用于精确匹配，避免在数据库中直接暴露完整兑换码
- `code_mask` 用于后台列表展示，例如 `SPRING****2026`

### 2）`redeem_code_claims`

- `id` TEXT PRIMARY KEY
- `code_id` TEXT NOT NULL
- `user_id` TEXT NOT NULL
- `credits_amount` INTEGER NOT NULL
- `claimed_at` TEXT NOT NULL
- `ledger_entry_id` TEXT NULL

约束与索引：

- UNIQUE (`code_id`, `user_id`)
- INDEX `idx_redeem_claims_user_time` (`user_id`, `claimed_at` DESC)
- INDEX `idx_redeem_claims_code_time` (`code_id`, `claimed_at` DESC)

设计说明：

- `UNIQUE (code_id, user_id)` 直接从数据库层保证“同一个用户不可重复兑换同一个码”
- `ledger_entry_id` 用于把兑换记录和余额流水关联起来，便于后台追查

## 兑换码格式与归一化

为了减少用户输入误差，服务端在校验前统一做归一化：

- 去掉首尾空格
- 转为大写
- 移除中间空格

第一版允许字符集：

- `A-Z`
- `0-9`
- `-`
- `_`

长度建议限制在 `4-32` 位。

后台创建时也走同一套归一化，保证存储和校验一致。

## 业务规则

### 创建规则

- `title` 必填，用于后台识别
- `creditsAmount` 必须为正整数
- `type=single` 时不允许自定义总次数，系统固定为 `1`
- `type=campaign` 时必须填写 `totalLimit`，且值大于等于 `2`
- `expiresAt` 可为空；如果填写，必须是未来时间
- `code` 在归一化后必须全局唯一

### 兑换校验规则

用户提交兑换请求时，按以下顺序校验：

1. 兑换码格式是否合法
2. 兑换码是否存在
3. 是否已停用
4. 是否已过期
5. 当前用户是否已经兑换过该码
6. 是否还有剩余可用次数

失败提示建议：

- 不存在：`兑换码不存在`
- 停用：`该兑换码已停用`
- 过期：`该兑换码已过期`
- 重复兑换：`你已经兑换过这个兑换码了`
- 次数用尽：`该兑换码已被领完`

### 成功兑换规则

- 给当前登录用户增加对应余额
- 写入一条 `redeem_code_claims`
- 写入一条 `credit_ledgers`
- 返回最新余额与本次到账信息

### 注册时填写兑换码的规则

注册接口增加可选字段：

- `redeemCode?: string`

处理策略：

1. 用户注册主流程照常完成
2. 注册赠送余额仍按现有系统设置执行
3. 如果本次提交携带了 `redeemCode`，则在注册成功后继续尝试兑换
4. 兑换成功：把兑换余额叠加到账户，并在注册响应中返回成功结果
5. 兑换失败：注册仍然成功，只在响应中返回失败原因，前端提示用户即可

明确约定：

- 注册赠送余额与兑换码余额可以叠加
- 兑换码失败不会回滚注册
- 即使用户在注册时没填或填错，后续仍可在 Studio 内重新兑换

## 并发与一致性

兑换成功必须是一个原子事务，不能出现“次数扣了但余额没到账”或“余额到账了但记录没写”的情况。

建议事务流程：

1. 根据 `code_hash` 查询兑换码
2. 校验启用状态、过期时间
3. 检查 `redeem_code_claims` 中是否已存在 (`code_id`, `user_id`)
4. 条件更新 `redeem_codes.redeemed_count = redeemed_count + 1`
5. 调用 `CreditsRepo.grantInTx(...)`
6. 写入 `redeem_code_claims`
7. 提交事务

关键点：

- 第 4 步必须带条件 `redeemed_count < total_limit`
- 如果第 4 步影响行数不是 `1`，说明次数已耗尽
- 整个流程放在同一个 `sqlite.transaction()` 内

这样可以覆盖两个高风险场景：

- 多个用户同时抢同一个活动码时不会超发
- 同一个用户重复点击提交时不会重复到账

## 后端接口设计

### 用户侧

#### `POST /api/redeem-codes/claim`

Body：

```json
{
  "code": "SPRING2026"
}
```

返回：

```json
{
  "amount": 10,
  "balance": 28,
  "code": {
    "id": "xxx",
    "title": "五一活动码",
    "type": "campaign"
  }
}
```

逻辑：

- 需要登录
- 服务端完成归一化、校验、发放、记账
- 成功后把最新余额返回前端，前端同步更新 `authStore.user.creditBalance`

#### `POST /api/auth/register`

在现有注册接口基础上扩展一个可选字段：

```json
{
  "username": "demo",
  "password": "******",
  "redeemCode": "SPRING2026"
}
```

返回新增字段建议：

```json
{
  "token": "xxx",
  "user": {},
  "redeemCodeResult": {
    "attempted": true,
    "success": false,
    "message": "该兑换码已过期"
  }
}
```

返回规则：

- 没填兑换码：`attempted=false`
- 填了且兑换成功：`success=true`，并返回到账金额
- 填了但兑换失败：`success=false`，但整个注册请求仍然返回成功

实现建议：

- 先完成“创建用户 + 注册赠送余额”
- 再尝试兑换码
- 如果兑换成功，重新读取最新用户信息后返回，确保 `user.creditBalance` 是最终值

### 管理端

#### `GET /api/admin/redeem-codes`

查询参数：

- `q`：标题或遮罩码搜索
- `type`：`single | campaign`
- `status`：`active | disabled | expired | exhausted`
- `page`
- `limit`

返回列表字段：

- `id`
- `title`
- `codeMask`
- `type`
- `creditsAmount`
- `totalLimit`
- `redeemedCount`
- `enabled`
- `expiresAt`
- `createdAt`

#### `POST /api/admin/redeem-codes`

Body：

```json
{
  "title": "五一活动码",
  "code": "MAYDAY2026",
  "type": "campaign",
  "creditsAmount": 10,
  "totalLimit": 500,
  "expiresAt": "2026-05-07T23:59:59.000Z",
  "enabled": true
}
```

规则：

- `single` 创建时自动落为 `totalLimit=1`
- 返回时只回传 `codeMask`，不再回完整明文码

#### `PUT /api/admin/redeem-codes/:id`

允许修改：

- `title`
- `creditsAmount`
- `totalLimit`（仅 `campaign` 且不能小于 `redeemedCount`）
- `expiresAt`
- `enabled`

不允许修改：

- `code`
- `type`

这样可以避免兑换记录和码值含义在运营过程中发生漂移。

#### `GET /api/admin/redeem-codes/:id/claims`

用于后台查看兑换记录：

- 支持 `page`、`limit`
- 返回 `username`、`claimedAt`、`creditsAmount`、`ledgerEntryId`

#### `POST /api/admin/redeem-codes/:id/enable`

- 启用兑换码

#### `POST /api/admin/redeem-codes/:id/disable`

- 停用兑换码

第一版不做删除接口，避免误删后失去审计链路。

## 服务端结构建议

建议拆成独立模块，而不是继续把逻辑堆到现有 `AdminController`：

- `server/src/redeem-codes/redeem-codes.controller.ts`
- `server/src/redeem-codes/redeem-codes.admin.controller.ts`
- `server/src/redeem-codes/redeem-codes.repo.ts`
- `server/src/redeem-codes/redeem-codes.module.ts`

原因：

- `AdminController` 现在已经同时承担用户、余额、系统设置等职责，再继续追加兑换码会变得更重
- 兑换码本身既有用户侧接口，也有管理侧接口，拆模块更清晰

## 余额流水策略

成功兑换后，继续复用现有 `CreditsRepo.grantInTx(...)`。

建议写法：

- `type = grant`
- `reason = redeem_code`
- `refType = redeem_code`
- `refId = redeem_code.id`

这样做的好处：

- 不需要为兑换码额外发明一套“余额到账记录”
- 账务流水页天然能看到兑换码发放记录
- 后续如果要对兑换码做统计，可以通过 `reason/refType` 快速筛选

## 前端页面设计

### 1）管理端列表页

页面：`AdminRedeemCodesView.vue`

布局延续当前管理页模式：

- 顶部筛选：搜索、类型、状态
- 右侧按钮：`创建兑换码`
- 表格列：
  - 标题
  - 兑换码
  - 类型
  - 余额
  - 使用进度
  - 结束时间
  - 状态
  - 操作

操作建议：

- 查看记录
- 编辑
- 启用/停用

### 2）创建/编辑弹窗

字段：

- 标题
- 兑换码
- 类型（单次码 / 活动码）
- 兑换余额
- 总次数（仅活动码展示）
- 结束时间
- 是否启用

交互规则：

- 选择 `single` 时隐藏“总次数”，界面提示“单次码固定只可兑换 1 次”
- 编辑时兑换码输入框禁用，不允许修改明文码

### 3）兑换记录弹窗

从管理列表行操作进入：

- 展示最近兑换用户
- 字段：用户名、到账余额、兑换时间
- 支持分页

### 4）用户端兑换弹窗

入口放在两个地方：

- 注册页：表单底部新增 `兑换码（选填）`
- `StudioView` 顶栏余额附近：`兑换码` 按钮

弹窗字段很轻量：

- 输入框：兑换码
- 确认按钮：立即兑换

成功反馈：

- toast：`兑换成功，已到账 X 余额`
- 顶栏余额即时更新

失败反馈：

- 直接展示服务端返回的明确错误文案

注册页反馈：

- 如果注册成功且兑换成功：登录后显示成功提示
- 如果注册成功但兑换失败：登录仍成功，仅提示兑换码未生效及原因

## 状态定义

后台列表中的“状态”按派生规则展示：

- `active`：已启用、未过期、未领完
- `disabled`：已停用
- `expired`：已过期
- `exhausted`：次数已用尽

状态是查询层面的派生值，不需要额外持久化字段。

## 验收标准

- admin/superadmin 可以在后台创建活动码和单次码
- 新用户可以在注册时可选填写兑换码
- 注册时兑换码无效不会阻止注册成功
- 普通登录用户可以在 Studio 内输入兑换码并完成余额兑换
- 同一个用户不能重复兑换同一个活动码
- 单次码被任意一个用户成功兑换后立即失效
- 过期码、停用码、次数耗尽的码都不能继续兑换
- 成功兑换后用户余额增加，并写入 `credit_ledgers`
- 后台可查看每个兑换码的兑换记录
- 整个兑换流程在事务中完成，不出现重复到账或超发

## 后续可扩展方向

不进入第一版，但当前设计需要为这些能力留出口：

- 批量生成单次码
- 导出兑换码 CSV
- 渠道码、来源统计
- 兑换套餐、会员天数、模型权限
- 用户侧兑换历史
