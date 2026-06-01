# Codex 目标模式执行路线图

日期：2026-05-27

目标：把 HI-Image-Studio 后续工程优化和新功能拆成可直接交给 Codex 目标模式执行的独立目标。每个目标都应能单独启动、验证和归档，避免一次性跨太多模块。

## 执行原则

- 优先稳定生成链路，再扩展商业和平台能力。
- 后端高风险改动先补测试，再重构，再做新功能。
- 每次目标模式只改一个清晰纵向切片。
- 不再维护全局风格偏好、常用风格模板或参考图组入口；风格诉求留在当前 prompt、参考图和具体创作链路中。
- 涉及数据库 schema、扣费、退款、订单、权限的目标都按高风险处理，必须补测试。
- 前端大文件拆分要逐步做，每次只抽一个 panel 或 composable。

## 当前基线

- 后端：NestJS + SQLite，入口在 `server/src`。
- 前端：Vue 3 + Vite + Pinia，入口在 `src`。
- 已有用户、登录、积分、兑换码、公告、后台、历史、对话创作、局部编辑、抠图、高清增强。
- 历史记录已支持服务端分页、搜索、folder/tag 和 `generationParams`。
- `server/src/image/image.controller.ts` 约 1524 行。
- `src/views/studio/CreateView.vue` 约 3243 行。
- `server/src/db/sqlite.service.ts` 约 506 行，schema 和 migration 仍在同一 service 中。
- 后端已有基础测试：pricing、utils、logger、images repo、image job lifecycle。

## Phase 0：执行基线和测试护栏

### G0.1 修正目标模式执行入口文档

- 类型：工程效率
- 复杂度：S
- 风险：低
- 依赖：无
- 涉及文件：`README.md`、`docs/goal-mode-roadmap.md`
- 目标：在 README 增加“下一步开发按 `docs/goal-mode-roadmap.md` 执行”的说明，减少后续上下文丢失。
- 验收标准：README 能指向目标模式路线图；不重复维护长列表。
- 推荐验证：`git diff --check`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G0.1 执行：在 README 增加简短的后续开发入口说明，只指向目标模式路线图，不复制完整 backlog。完成后运行 git diff --check。
```

### G0.2 建立后端生图路径 mock 测试基线

- 类型：测试
- 复杂度：M
- 风险：中
- 依赖：无
- 涉及文件：`server/src/image/image.controller.ts`、`server/src/image/*.spec.ts`、相关 repo/service mock
- 目标：先覆盖现有 text-to-image、image-to-image、dialogue、edit/tool 的成功、HiAPI 失败、扣费后退款、文件清理行为。
- 验收标准：不大改实现也能证明主生成路径的扣费/退款/持久化行为；失败路径不吞异常、不漏退款。
- 推荐验证：`npm test --prefix server -- --runInBand`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G0.2 执行：为现有后端图片生成主路径补 mock 测试基线。先读 image.controller.ts、image-job-lifecycle.ts、pricing 和 repo 测试模式；优先覆盖扣费、失败退款、生成记录写入和失败清理，不做业务重构。完成后运行 npm test --prefix server -- --runInBand。
```

### G0.3 建立前端冒烟测试方案

- 类型：测试 / 工具链
- 复杂度：M
- 风险：中
- 依赖：无
- 涉及文件：`package.json`、`src/views/*`、测试配置文件
- 目标：选定并落地最小前端冒烟测试方式，覆盖登录页可渲染、工作台表单可切换、历史页可加载空态。
- 验收标准：本地一条命令能跑前端 smoke；不依赖真实 HiAPI。
- 推荐验证：新增的 smoke 命令、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G0.3 执行：为前端建立最小冒烟测试方案，覆盖登录页、工作台模式切换和历史页空态。不得接真实外部 API。完成后运行新增 smoke 命令和 npm run build。
```

## Phase 1：生成链路稳定化

### G1.1 生成任务状态落库基础版

- 类型：后端功能 / 架构基础
- 复杂度：M
- 风险：高
- 依赖：G0.2
- 涉及文件：`server/src/db/sqlite.service.ts`、`server/src/db/repositories/*`、`server/src/image/*`
- 目标：新增生成任务表和 repository，记录每次生成任务的用户、模式、状态、错误信息、关联图片、创建/更新时间。
- 范围：先只记录状态，不改前端同步体验，不做 worker、重试、取消、并发控制。
- 验收标准：任务能从 `queued/running` 进入 `succeeded/failed`；失败时记录错误摘要；成功时关联生成图片 id。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build --prefix server`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G1.1 执行：为图片生成新增服务端任务状态落库基础版。只做 schema/repository/service 和现有生成入口状态记录，不改前端体验，不做 worker。先补 repository 和状态流转测试，再接入 image.controller.ts。完成后运行 npm test --prefix server -- --runInBand 和 npm run build --prefix server。
```

### G1.2 拆分图片生成 workflow 第一刀：文生图

- 类型：后端重构
- 复杂度：M
- 风险：高
- 依赖：G0.2、G1.1
- 涉及文件：`server/src/image/image.controller.ts`、`server/src/image/*workflow*.ts`
- 目标：把 text-to-image 的参数校验、扣费、HiAPI 调用、图片落地、记录写入、任务状态更新从 controller 抽到独立 workflow。
- 验收标准：controller 对文生图路径只负责认证上下文、请求解析和调用 workflow；行为与原来一致。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build --prefix server`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G1.2 执行：只拆 text-to-image workflow，不触碰 image-to-image/dialogue/edit 行为。保持 API 返回不变，把 controller 中对应业务搬到独立 workflow service，并复用 image-job-lifecycle 和任务状态。完成后运行后端测试和构建。
```

### G1.3 拆分图片生成 workflow 第二刀：图生图和工具

- 类型：后端重构
- 复杂度：M
- 风险：高
- 依赖：G1.2
- 涉及文件：`server/src/image/image.controller.ts`、`server/src/image/*workflow*.ts`
- 目标：拆出 image-to-image、edit/tool/upscale 的共享输入图处理和输出持久化流程。
- 验收标准：图生图、局部编辑、抠图、高清增强 API 返回不变；临时文件和源图保留规则有测试。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build --prefix server`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G1.3 执行：在 G1.2 基础上拆 image-to-image 和 edit/tool/upscale workflow。重点保证临时文件清理、源图保留、失败退款和历史写入行为不变。完成后运行后端测试和构建。
```

### G1.4 拆分对话创作 workflow

- 类型：后端重构 / 对话能力
- 复杂度：M
- 风险：高
- 依赖：G1.2
- 涉及文件：`server/src/image/image.controller.ts`、`server/src/db/repositories/dialogue.repo.ts`、`server/src/image/*dialogue*.ts`
- 目标：将对话创作的 chain/message 读取、previous response、输入图、输出图和任务状态更新抽出。
- 验收标准：继续对话、从历史图继续、查询 chain、删除 chain 行为不变；对话失败不会污染 chain。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build --prefix server`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G1.4 执行：拆分 dialogue workflow。只处理后端对话生成和 chain/message 持久化，不改前端 UI。补充成功、失败、从历史继续和删除 chain 的测试。完成后运行后端测试和构建。
```

## Phase 2：资产服务端化和复用

### G2.1 服务端收藏图片

- 类型：产品功能 / 资产管理
- 复杂度：M
- 风险：中
- 依赖：当前历史分页能力
- 涉及文件：`server/src/db/sqlite.service.ts`、`server/src/db/repositories/images.repo.ts`、`server/src/image/image.controller.ts`、`src/stores/preferences.js`、`src/stores/images.js`、`src/views/studio/HistoryView.vue`
- 目标：把图片收藏从本地偏好迁移到服务端字段或独立表，历史页收藏筛选支持跨分页准确查询。
- 验收标准：登录用户收藏在多设备一致；旧本地收藏可一次性迁移或兼容读取；收藏筛选不再只筛当前页。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G2.1 执行：将图片收藏服务端化。先设计最小 schema 和 API，再迁移前端 HistoryView/images store 的收藏读写。保持旧本地收藏兼容或提供一次性同步。完成后运行后端测试和前端构建。
```

### G2.2 服务端模板收藏

- 类型：产品功能 / 留存
- 复杂度：M
- 风险：中
- 依赖：G2.1 的收藏 API 风格
- 涉及文件：`server/src/db/sqlite.service.ts`、新增模板收藏 repo/controller、`src/stores/preferences.js`、`src/views/studio/ModelsView.vue`
- 目标：将模板收藏从 localStorage 迁移到服务端，支持用户跨设备保留模板偏好。
- 验收标准：模板收藏登录后从服务端加载；未登录时仍可本地临时使用；收藏视图行为不变。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G2.2 执行：将模板收藏服务端化。复用 G2.1 的收藏设计风格，更新 ModelsView 和 preferences store。未登录用户保持本地临时收藏。完成后运行后端测试和前端构建。
```

### G2.3 对话链列表服务端聚合

- 类型：性能 / 对话资产
- 复杂度：M
- 风险：中
- 依赖：现有 `continuation_chain_id`
- 涉及文件：`server/src/db/repositories/images.repo.ts`、`server/src/image/image.controller.ts`、`src/stores/images.js`、`src/views/studio/CreateView.vue`
- 目标：后端按 chain 聚合返回对话链列表，包括首图、尾图、轮次数、最近更新时间，减少前端当前页聚合。
- 验收标准：对话模式左侧会话列表不依赖当前历史页是否加载到该 chain；链路切换准确。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G2.3 执行：新增服务端对话链聚合列表 API，并让 CreateView 的对话会话列表使用该 API。不要改变生成接口。完成后运行后端测试和前端构建。
```

### G2.4 图片缩略图和列表预览策略

- 类型：性能 / 存储
- 复杂度：M
- 风险：中
- 依赖：历史图片落地路径稳定
- 涉及文件：`server/src/image/*`、`server/src/db/repositories/images.repo.ts`、`src/views/studio/HistoryView.vue`、`src/views/studio/HistoryDetailView.vue`
- 目标：生成结果落地时创建缩略图或预览图字段，历史列表优先加载小图，详情页加载原图。
- 验收标准：旧记录没有缩略图时降级显示原图；新记录列表不直接解码大图。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G2.4 执行：为图片历史增加缩略图/预览图策略。新生成图片保存缩略图引用，历史列表优先用缩略图，旧记录自动降级原图。完成后运行后端测试和前端构建。
```

## Phase 3：前端工作台拆分

### G3.1 抽出工作台生成选项 composable

- 类型：前端重构
- 复杂度：M
- 风险：中
- 依赖：无
- 涉及文件：`src/views/studio/CreateView.vue`、`src/views/studio/create.presets.js`、新增 `src/composables` 或 `src/views/studio/composables`
- 目标：抽出比例、质量、张数、格式、背景、审核、URL 初始化和默认设置合并逻辑。
- 验收标准：`CreateView.vue` 行数下降；文生图、图生图、对话、工具仍使用同一选项状态；再次创作参数回填不变。
- 推荐验证：`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G3.1 执行：从 CreateView.vue 抽出 useGenerationOptions composable，负责生成参数、默认设置和 URL 初始化。不要改 UI 布局。完成后运行 npm run build。
```

### G3.2 抽出 TextCreatePanel 和 ImageReferencePanel

- 类型：前端重构
- 复杂度：M
- 风险：中
- 依赖：G3.1
- 涉及文件：`src/views/studio/CreateView.vue`、新增 `src/components/studio/*Panel.vue`
- 目标：拆出文生图和参考图生图的表单 panel，让主页面只负责模式编排。
- 验收标准：文生图 prompt、参考图上传、快速预设、高级参数行为不变；按钮状态不变。
- 推荐验证：`npm run build`，手动打开 `http://127.0.0.1:5173` 检查工作台
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G3.2 执行：从 CreateView.vue 抽出 TextCreatePanel 和 ImageReferencePanel，只拆组件边界，不改视觉和提交逻辑。完成后运行 npm run build，并用本地浏览器检查工作台模式切换。
```

### G3.3 抽出 DialoguePanel

- 类型：前端重构 / 对话体验
- 复杂度：M
- 风险：中
- 依赖：G2.3、G3.1
- 涉及文件：`src/views/studio/CreateView.vue`、新增 `src/components/studio/DialoguePanel.vue`
- 目标：把对话模式左侧会话、中间图像、底部输入栏抽成独立组件。
- 验收标准：从历史继续、选择会话、删除会话、发送下一轮修改行为不变。
- 推荐验证：`npm run build`，浏览器检查对话模式
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G3.3 执行：抽出 DialoguePanel，保留现有对话创作视觉和行为。若 G2.3 已完成，使用服务端 chain 列表；否则保持现有本地聚合。完成后运行 npm run build 并检查对话模式。
```

### G3.4 抽出 ToolPanel

- 类型：前端重构
- 复杂度：M
- 风险：中
- 依赖：G3.1
- 涉及文件：`src/views/studio/CreateView.vue`、`src/components/studio/ImageEditModal.vue`、新增 `ToolPanel.vue`
- 目标：把局部编辑、抠图、扩图、高清增强工具入口和源图选择拆出。
- 验收标准：工具 source 解析、编辑弹窗、历史图进入工具模式行为不变。
- 推荐验证：`npm run build`，浏览器检查工具模式
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G3.4 执行：抽出 ToolPanel，保持局部编辑、抠图、扩图、高清增强入口行为不变。不要改后端 API。完成后运行 npm run build 并检查工具模式。
```

## Phase 4：数据库和后台治理

### G4.1 抽出 SQLite migration runner

- 类型：后端架构
- 复杂度：M
- 风险：高
- 依赖：G0.2
- 涉及文件：`server/src/db/sqlite.service.ts`、新增 `server/src/db/migrations/*`
- 目标：将 schema 创建、版本迁移、补字段逻辑从 `SqliteService` 拆出，让 service 专注连接、pragma 和 transaction。
- 验收标准：现有数据库可启动；空库可初始化；旧版本字段可补齐；migration 测试覆盖版本推进。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build --prefix server`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G4.1 执行：抽出 SQLite migration runner。保持现有 schema 行为不变，先补 migration 测试，再从 SqliteService 搬迁建表和补字段逻辑。完成后运行后端测试和构建。
```

### G4.2 后台分页体验统一

- 类型：后台体验 / 性能
- 复杂度：M
- 风险：中
- 依赖：现有 common table 组件
- 涉及文件：`server/src/admin/admin.controller.ts`、`server/src/credits/credits.controller.ts`、`server/src/db/repositories/*`、`src/components/common/Pagination.vue`、后台视图
- 目标：统一用户、积分流水、审计日志、兑换码 claim 列表的 limit/offset/total 模式和前端分页 UI。
- 验收标准：后台大列表不一次性加载；分页组件交互一致；筛选条件改变重置页码。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G4.2 执行：统一后台列表分页体验。先盘点已有分页组件和接口，只处理用户、积分流水、审计日志、兑换码 claim 列表，不新增后台功能。完成后运行后端测试和前端构建。
```

### G4.3 后台关键操作确认和审计补齐

- 类型：安全 / 后台治理
- 复杂度：M
- 风险：高
- 依赖：现有 audit logs
- 涉及文件：`server/src/admin/admin.controller.ts`、`server/src/db/repositories/audit-logs.repo.ts`、后台视图
- 目标：补齐用户禁用、删用户、改角色、调积分、兑换码启停等关键操作的确认文案和审计字段。
- 验收标准：高风险操作都有前端确认；审计日志能看出操作者、目标、操作前后摘要。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G4.3 执行：补齐后台关键操作确认和审计字段。重点处理禁用用户、删除用户、改角色、调积分、兑换码启停。完成后运行后端测试和前端构建。
```

## Phase 5：商业闭环

### G5.1 订单和套餐数据模型

- 类型：商业化基础
- 复杂度：M
- 风险：高
- 依赖：G4.1
- 涉及文件：`server/src/db/migrations/*`、新增 orders/packages repo/service/controller
- 目标：新增套餐、订单、订单状态、支付渠道占位、积分入账关联，不接真实支付。
- 验收标准：用户能创建待支付订单；后台能查看订单；订单不直接加积分。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build --prefix server`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G5.1 执行：新增套餐和订单数据模型，不接真实支付。订单创建后保持 pending，不直接加积分。补 repository/service/controller 测试。完成后运行后端测试和构建。
```

### G5.2 套餐页和订单页 MVP

- 类型：前端产品功能
- 复杂度：M
- 风险：中
- 依赖：G5.1
- 涉及文件：`src/router/index.js`、`src/views/studio/ProfileView.vue` 或新增 billing view、订单 store
- 目标：用户可查看套餐、创建订单、查看订单状态。
- 验收标准：无支付也能展示待支付状态；失败/空态清晰；不伪造支付成功。
- 推荐验证：`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G5.2 执行：基于已有订单 API 做套餐页和订单页 MVP。只展示套餐、创建订单、查看状态，不接支付成功。完成后运行 npm run build。
```

### G5.3 支付回调和补单审计

- 类型：商业化 / 安全
- 复杂度：L
- 风险：高
- 依赖：G5.1、G5.2、明确支付渠道
- 涉及文件：订单 service/controller、credits repo、audit logs、后台订单页
- 目标：接入选定支付渠道的回调验签、订单完成、积分入账、重复回调幂等、后台补单/退款审计。
- 验收标准：回调验签失败不入账；重复回调不重复加积分；手动补单有审计。
- 推荐验证：支付回调单测、`npm test --prefix server -- --runInBand`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G5.3 执行前先确认支付渠道和验签规则。实现支付回调、订单完成、积分入账、幂等处理、后台补单和审计。必须补安全测试和幂等测试。
```

## Phase 6：真正异步任务队列

### G6.1 后台 worker 和任务轮询

- 类型：后端架构
- 复杂度：L
- 风险：高
- 依赖：G1.1、G1.2-G1.4
- 涉及文件：`server/src/image/*job*`、任务 repo、server bootstrap
- 目标：把生成从请求同步执行演进为可后台执行的 worker 模式，API 返回任务 id，前端轮询任务状态。
- 验收标准：刷新后任务状态可恢复；成功后能拿到结果；失败后能看到错误并已退款。
- 推荐验证：后端任务状态测试、前端构建、手动端到端
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G6.1 执行：实现后台 worker 和任务轮询。只在已有任务状态和 workflow 拆分完成后做。API 返回任务 id，前端轮询状态，失败退款保持幂等。完成后运行后端测试、前端构建和手动端到端。
```

### G6.2 前端任务中心

- 类型：前端产品功能
- 复杂度：M
- 风险：中
- 依赖：G6.1
- 涉及文件：`src/stores/images.js`、`src/views/studio/CreateView.vue`、新增任务中心组件/视图
- 目标：显示排队、运行、成功、失败任务，支持查看结果、重试失败任务、清理已完成任务。
- 验收标准：刷新页面后仍能看到未完成任务；生成按钮不再只依赖内存 `activeJob`。
- 推荐验证：`npm run build`，浏览器手动检查
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G6.2 执行：新增前端任务中心，展示排队/运行/成功/失败任务，支持查看结果和重试失败任务。依赖 G6.1 的任务 API。完成后运行 npm run build 并手动检查。
```

### G6.3 并发控制、取消和重试策略

- 类型：可靠性
- 复杂度：L
- 风险：高
- 依赖：G6.1、G6.2
- 涉及文件：任务 worker、任务 repo、后台配置、前端任务中心
- 目标：增加任务并发上限、取消排队任务、失败重试、后台失败率可见。
- 验收标准：并发上限生效；取消不扣费或正确退款；重试不重复扣费；后台能看到失败率。
- 推荐验证：并发/幂等单测、手动端到端
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G6.3 执行：在已有异步任务队列上增加并发控制、取消和重试。重点测试扣费幂等、取消退款和重试不重复扣费。完成后运行后端测试并手动端到端。
```

## Phase 7：增强型创作能力

### G7.1 从历史生成变体

- 类型：产品功能
- 复杂度：M
- 风险：中
- 依赖：`generationParams` 稳定、资产服务端化
- 涉及文件：`src/views/studio/HistoryView.vue`、`src/views/studio/HistoryDetailView.vue`、`src/stores/images.js`、`CreateView.vue`
- 目标：历史项支持“生成变体”，带回 prompt、比例、质量、参考图和可用参数，并允许用户在工作台微调。
- 验收标准：旧记录缺参数时降级到 prompt+ratio；新记录能完整回填。
- 推荐验证：`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G7.1 执行：实现历史生成变体。复用 generationParams，把 prompt、比例、质量、参考图等带回工作台，旧记录降级兼容。完成后运行 npm run build。
```

### G7.2 反推提示词 / Describe

- 类型：AI 辅助功能
- 复杂度：M
- 风险：中
- 依赖：HiAPI 或可用模型能力确认
- 涉及文件：`server/src/prompts/*`、`src/views/studio/HistoryDetailView.vue`、`src/components/studio/*`
- 目标：从图片生成可编辑 prompt，作为再次创作的起点。
- 验收标准：不覆盖原 prompt；失败时给清晰错误；扣费策略明确。
- 推荐验证：后端 prompt service 测试、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G7.2 执行前先确认当前 HiAPI 是否支持图片理解/describe。实现从图片反推提示词，不覆盖原 prompt，结果可复制或带入工作台。明确扣费策略并补测试。
```

### G7.3 项目级风格板

- 类型：资产复用
- 复杂度：L
- 风险：高
- 依赖：资产服务端化、任务队列稳定
- 涉及文件：新增 style boards 后端模块、前端资产页/工作台入口
- 目标：用户可以建立项目风格板，保存参考图集合和描述，用于某次生成时手动选择。
- 重要边界：不做全局默认风格污染，不自动影响所有生成。
- 验收标准：风格板只在用户明确选择时参与生成；可增删参考图；可从历史图加入。
- 推荐验证：后端测试、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap.md 的 G7.3 执行：实现项目级风格板，但不得恢复全局风格偏好。风格板只在用户明确选择时参与当前生成。支持从历史图加入参考图。完成后运行后端测试和前端构建。
```

## 暂缓或不建议

- 视频生成：会扩大存储、计费、队列和审核复杂度，任务队列成熟前暂缓。
- 实时画布：需要低延迟模型、画布状态和任务调度，当前阶段收益不如任务队列和资产复用。
- 团队协作：需要权限、团队空间、共享资产和审计模型，商业闭环前暂缓。
- 全局默认风格要求：已废弃，不应重新引入。
- 大爆炸式重写 `CreateView.vue` 或 `ImageController`：必须分阶段逐条拆。

## 推荐执行顺序

1. G0.2 后端生图路径 mock 测试基线。
2. G1.1 生成任务状态落库基础版。
3. G1.2-G1.4 分阶段拆图片生成 workflow。
4. G2.1-G2.3 资产服务端化和对话链聚合。
5. G3.1-G3.4 拆前端工作台。
6. G4.1 SQLite migration runner。
7. G4.2-G4.3 后台分页和审计治理。
8. G5.1-G5.3 商业订单闭环。
9. G6.1-G6.3 真正异步任务队列。
10. G7.1-G7.3 创作增强能力。

## 每次目标模式的固定收尾

- 读取本路线图中对应目标。
- 创建 CCG task。
- 写代码前读取相关现有文件和测试。
- 优先补或更新测试。
- 运行目标要求的验证命令。
- `git diff --check`。
- 写 review.md，记录验证结果和遗留风险。
- 归档 `.ccg/tasks/<task>` 并提交。
