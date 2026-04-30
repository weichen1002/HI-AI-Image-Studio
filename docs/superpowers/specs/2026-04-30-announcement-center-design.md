# 公告中心（管理端发布 + 全站展示 + 自动弹窗）

## 背景

需要参考 sub2api 的交互形态，新增公告中心模块：

- 管理中心新增“公告中心”，admin/superadmin 可创建/编辑/发布/下线公告
- 全站右上角常驻入口（Popover）可快速查看最近公告列表
- 支持“自动弹窗公告”：进入 Studio 时自动弹窗展示
- 支持配置“每次必读”或“读过不再弹”

## 目标

- 完整打通公告的 CRUD + 发布/下线 + 列表查询（管理端）
- 全站可见（登录用户），右上角入口 + 公告中心列表（用户侧）
- 自动弹窗：按公告配置触发，且“每条每用户一次”按账号维度记录已读
- 保持可扩展：后续可加展示条件/按用户分组/多语言/Markdown 渲染等

## 非目标

- 不实现复杂的“按条件展示（人群圈选）”与细粒度权限配置（后续迭代）
- 不实现富文本编辑器（先存 Markdown 文本）

## 权限与路由

### 权限

- 管理端（创建/编辑/发布/下线/删除）：`admin` + `superadmin`
- 用户侧查看（右上角列表、公告中心列表、自动弹窗）：任意登录用户

### 前端路由建议

- 管理中心新增：`/studio/admin/announcements`
- 用户侧公告中心（可选，后续也可复用同一页面只读模式）：`/studio/announcements`

第一阶段可先只做管理端路由，同时右上角 Popover 的“查看全部”指向管理端（对普通用户隐藏入口）；若需要用户侧入口，再新增只读路由。

## 数据模型（SQLite）

### announcements

- `id` TEXT PK
- `title` TEXT NOT NULL
- `content_md` TEXT NOT NULL
- `status` TEXT NOT NULL  (`draft` | `published` | `archived`)
- `notify_mode` TEXT NOT NULL (`silent` | `modal`)
- `repeat_mode` TEXT NOT NULL (`once` | `always`)
- `start_at` TEXT NULL（ISO）
- `end_at` TEXT NULL（ISO）
- `created_by` TEXT NOT NULL（user id）
- `updated_by` TEXT NOT NULL（user id）
- `created_at` TEXT NOT NULL（ISO）
- `updated_at` TEXT NOT NULL（ISO）

### announcement_reads

账号维度已读记录（用于 repeat_mode=once 的自动弹窗去重）：

- `announcement_id` TEXT NOT NULL
- `user_id` TEXT NOT NULL
- `read_at` TEXT NOT NULL（ISO）
- PRIMARY KEY (`announcement_id`, `user_id`)

## 触发规则（自动弹窗）

当用户进入 Studio（或刷新 Studio）时：

1. 拉取“当前需要弹窗的公告列表”（notify_mode=modal，status=published，且在有效期内）
2. 对每条公告按 repeat_mode 处理：
   - `once`：若该用户在 announcement_reads 有记录，则跳过；否则弹窗展示，并在用户点击“我已知晓/关闭”后写入已读
   - `always`：每次进入都弹（无需写入已读；也可写入仅用于统计，但不影响弹出）
3. 弹窗顺序：按 created_at DESC 或 start_at DESC（实现时固定一个规则即可）
4. 一次只弹一条：关闭后继续检查下一条（避免连环弹窗）

## 后端接口（Nest）

前缀建议：`/api/announcements`

### 用户侧

- `GET /api/announcements/active`
  - 返回当前用户可见的公告（用于右上角列表与弹窗队列）
  - 默认分页：返回最近 N 条（例如 20）

- `POST /api/announcements/:id/read`
  - 标记已读（仅 repeat_mode=once 的公告需要）

### 管理端（admin/superadmin）

- `GET /api/admin/announcements`
  - 支持查询：q（标题模糊）、status、notify_mode

- `POST /api/admin/announcements`
  - 创建（默认 draft）

- `PUT /api/admin/announcements/:id`
  - 更新（标题、内容、通知方式、repeat_mode、有效期等）

- `POST /api/admin/announcements/:id/publish`
  - 发布（status=published）

- `POST /api/admin/announcements/:id/archive`
  - 下线（status=archived）

- `DELETE /api/admin/announcements/:id`
  - 删除（允许仅 draft/archived 可删；published 先 archive 再删）

## 前端页面设计

### 1) 管理中心：公告中心列表

- 顶部工具条
  - 搜索（Input size=sm）
  - 状态筛选（SelectMenu size=sm）
  - 通知方式筛选（SelectMenu size=sm）
  - 创建公告（Button size=sm）
- 表格（DataTable）
  - 标题、状态、通知方式、有效期、创建时间、操作
  - 操作：查看/编辑（打开 Modal）、发布/下线、删除

### 2) 创建/编辑公告（Modal）

字段（对应你截图）：

- 标题（Input）
- 内容（textarea，支持 Markdown 文本）
- 状态（草稿/发布；或单独“发布”按钮）
- 通知方式（silent/modal）
- repeatMode（读过不再弹/每次必读）
- 开始时间、结束时间（可选）

按钮：
- 取消
- 保存（草稿）
- 发布（如果是草稿或更新后再次发布）

### 3) 右上角公告入口（Popover）

- 图标按钮 + badge（未读数：可先用“当前 active 且未读（once）”数量）
- Popover 内容：最近 N 条公告
  - 标题 + 时间
  - 点击：打开详情（Modal 或 Drawer 二选一，第一阶段用 Modal）
  - “查看全部”：跳公告中心

### 4) 自动弹窗

- 在 StudioView（顶栏处）挂一个公告弹窗队列控制器（不侵入各子页面）
- 用 Modal 展示公告详情
- 按 repeat_mode 决定是否记录已读与是否每次弹出

## 验收标准

- admin/superadmin 可创建/编辑/发布/下线/删除公告
- 普通用户能在右上角看到公告入口与列表
- notify_mode=modal 的公告能自动弹窗
- repeat_mode=once：同一公告同一用户只弹一次（账号维度）
- repeat_mode=always：每次进入 Studio 都会弹（直到下线）
- `npm run build` 通过

