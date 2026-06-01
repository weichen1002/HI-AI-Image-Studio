# Codex 目标模式下一阶段路线图

日期：2026-05-29

目标：承接 `docs/goal-mode-roadmap.md` 已完成后的下一批优化点和新功能。每个目标都可以单独交给 Codex 目标模式执行；默认不依赖 Claude/Gemini，不提交，不归档，除非用户另行要求。

## 当前状态判断

旧路线图 G0.1-G7.3 已基本执行完成。当前项目已经具备：

- 图片生成 workflow 拆分、任务落库、后台 worker、前端任务中心、取消和重试。
- 历史资产分页、服务端收藏、模板收藏、对话链聚合、缩略图策略。
- 工作台组件拆分、项目风格板、历史变体、图片 describe。
- 套餐、订单、后台补单、mock 支付回调和幂等入账底座。
- 后台分页、关键操作确认、审计补强、SQLite migration runner。

仍然不能直接完成的事项：

- 真实支付渠道回调：必须先选微信、支付宝、Stripe 或其他渠道，并拿到官方签名规则和 payload 示例。
- 视频生成、实时画布、团队协作：仍然属于高复杂度扩展，建议等当前图片平台稳定后再做。

## 执行原则

- 优先补“上线稳定性”和“可运营性”，再做更大新功能。
- 支付、扣费、任务、权限和数据库迁移一律按高风险处理，必须补测试。
- 前端目标必须跑 `npm run build` 和 `npm run smoke:frontend`。
- 后端目标必须跑 `npm test --prefix server -- --runInBand`。
- 每个目标完成后写 `.ccg/tasks/<task>/review.md`，但按当前用户要求不提交、不归档。

## Phase 8：上线稳定性和运维底座

### N8.1 启动配置校验和健康检查

- 类型：后端可靠性
- 复杂度：M
- 风险：中
- 依赖：现有 config 模块
- 涉及文件：`server/src/config/index.ts`、`server/src/app.module.ts`、新增 health controller/test
- 目标：启动时校验关键环境变量，提供 `/api/health` 和 `/api/health/deep`，区分进程存活、数据库可写、上传目录可写、HiAPI 配置是否存在。
- 验收标准：缺少生产关键密钥时有明确错误；health 不暴露密钥；deep health 能检测 SQLite 和 uploads。
- 推荐验证：`npm test --prefix server -- --runInBand`、`npm run build --prefix server`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N8.1 执行：增加启动配置校验和 health/deep health。不要暴露任何 secret。补测试覆盖缺失配置、SQLite 可用性和 uploads 可写性。完成后运行后端测试和构建。
```

### N8.2 任务和支付链路结构化日志

- 类型：可观测性
- 复杂度：M
- 风险：中
- 依赖：现有 logger、image jobs、billing
- 涉及文件：`server/src/logging/*`、`server/src/image/*job*`、`server/src/billing/*`
- 目标：为任务创建、开始、成功、失败、取消、重试、订单创建、回调验签失败、入账成功增加统一 request/job/order correlation id。
- 验收标准：日志能按 jobId/orderId 追踪完整链路；敏感字段仍被脱敏。
- 推荐验证：logger 单测、`npm test --prefix server -- --runInBand`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N8.2 执行：给图片任务和支付链路补结构化日志与 correlation id。保持日志脱敏。补 logger 和关键 service 测试。完成后运行后端测试。
```

### N8.3 数据库备份和恢复脚本

- 类型：运维工具
- 复杂度：M
- 风险：中
- 依赖：SQLite 数据路径稳定
- 涉及文件：`scripts/*`、`package.json`、`README.md`
- 目标：提供 SQLite 在线备份脚本、上传目录打包脚本、恢复说明和 dry-run 模式。
- 验收标准：备份产物包含数据库和 uploads；恢复步骤清晰；脚本不会覆盖现有数据，除非显式传 `--force`。
- 推荐验证：脚本 dry-run、临时目录备份恢复 smoke
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N8.3 执行：新增数据库和 uploads 备份/恢复脚本，默认 dry-run 或非破坏模式。更新 README。用临时目录验证，不覆盖真实 data。完成后运行 git diff --check。
```

## Phase 9：商业化完善

### N9.1 支付渠道适配接口

- 类型：商业化架构
- 复杂度：M
- 风险：高
- 依赖：G5.3 webhook foundation
- 涉及文件：`server/src/billing/*`
- 目标：抽象 payment provider adapter，让 mock、manual 和未来真实渠道共用统一 payload 映射、验签结果和订单完成路径。
- 验收标准：mock webhook 行为不变；新增 adapter 单测；真实渠道只需实现 provider adapter。
- 推荐验证：billing 单测、`npm test --prefix server -- --runInBand`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N9.1 执行：抽象支付渠道 adapter，不接真实渠道。保持 mock webhook 和 admin manual complete 行为不变。补 adapter 与幂等测试。完成后运行后端测试。
```

### N9.2 真实支付渠道接入

- 类型：商业化 / 安全
- 复杂度：L
- 风险：高
- 依赖：N9.1、明确支付渠道和官方验签规则
- 涉及文件：`server/src/billing/*`、`src/views/studio/BillingView.vue`
- 目标：接入选定支付渠道的下单参数、回调验签、订单状态同步和失败提示。
- 验收标准：验签失败不入账；重复回调不重复加积分；金额/币种/渠道不匹配拒绝；前端不伪造成功。
- 推荐验证：渠道 payload fixture 单测、billing 单测、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N9.2 执行。先读取用户提供的支付渠道、官方验签规则和回调 payload 示例；没有这些信息就只写待办，不硬接。实现真实渠道下单和回调，复用 completePaidOrder。完成后运行后端测试和前端构建。
```

### N9.3 订单退款和积分冲正

- 类型：商业化 / 财务安全
- 复杂度：L
- 风险：高
- 依赖：N9.1
- 涉及文件：`server/src/billing/*`、`server/src/credits/*`、后台订单页
- 目标：新增退款/冲正状态、后台退款记录、积分扣回或负向流水，保留完整审计。
- 验收标准：已消费积分不足时有明确处理策略；重复退款幂等；所有退款动作进入审计。
- 推荐验证：billing/credits 单测、后台构建
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N9.3 执行：实现订单退款和积分冲正。先设计状态机和边界测试，重点覆盖余额不足、重复退款、部分失败和审计记录。完成后运行后端测试和前端构建。
```

## Phase 10：资产库和创作效率

### N10.1 历史资产高级筛选

- 类型：产品功能
- 复杂度：M
- 风险：中
- 依赖：历史服务端分页和资产字段
- 涉及文件：`server/src/db/repositories/images.repo.ts`、`server/src/image/image.controller.ts`、`src/views/studio/HistoryView.vue`
- 目标：历史页支持按比例、质量、模式、时间范围、是否有参考图、是否加入风格板筛选。
- 验收标准：筛选在服务端分页层完成；筛选条件改变重置页码；URL 可保留主要筛选条件。
- 推荐验证：images repo/controller 测试、`npm run build`、`npm run smoke:frontend`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N10.1 执行：为历史资产增加高级筛选。服务端分页查询必须准确，前端筛选条件要能重置页码并保持空态清晰。完成后运行后端测试、前端构建和 smoke。
```

### N10.2 变体对比视图

- 类型：产品功能
- 复杂度：M
- 风险：中
- 依赖：generationParams、历史变体
- 涉及文件：`src/views/studio/HistoryDetailView.vue`、`src/views/studio/HistoryView.vue`
- 目标：从一张图进入对比视图，展示原图、变体、prompt/参数差异和一键继续创作。
- 验收标准：旧记录缺参数时降级；移动端不溢出；不会请求大批历史数据。
- 推荐验证：`npm run build`、`npm run smoke:frontend`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N10.2 执行：新增历史变体对比视图，展示图片和参数差异，支持继续创作。保持移动端布局不溢出。完成后运行前端构建和 smoke。
```

### N10.3 参数化提示词模板

- 类型：创作效率
- 复杂度：M
- 风险：中
- 依赖：模板收藏
- 涉及文件：模板 store、`src/views/studio/ModelsView.vue`、后端模板模块如存在
- 目标：将模板中的变量显式建模，支持保存用户自定义模板、变量默认值和示例。
- 验收标准：系统模板和用户模板分开；用户模板可编辑/删除；填参后进入工作台。
- 推荐验证：后端模板测试如适用、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N10.3 执行：实现参数化提示词模板和用户自定义模板。先盘点现有模板数据来源，保持系统模板只读。完成后运行相关测试和前端构建。
```

## Phase 11：生成质量和模型治理

### N11.1 模型能力配置中心

- 类型：平台配置
- 复杂度：M
- 风险：中
- 依赖：现有 HiAPI adapter
- 涉及文件：`server/src/hiapi/*`、后台设置页、工作台参数
- 目标：把模型支持的尺寸、质量、格式、是否支持编辑/describe 变成服务端能力配置，前端按能力展示选项。
- 验收标准：不支持的参数不会出现在 UI；服务端仍做兜底校验；后台能查看当前能力。
- 推荐验证：hiapi/config 测试、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N11.1 执行：建立模型能力配置中心，前端选项按能力渲染，服务端保留兜底校验。完成后运行后端测试和前端构建。
```

### N11.2 Prompt 质量检查和自动补全

- 类型：AI 辅助
- 复杂度：M
- 风险：中
- 依赖：现有 prompts 模块
- 涉及文件：`server/src/prompts/*`、`src/components/studio/*`
- 目标：提交前检查 prompt 是否过短、冲突、缺主体或缺风格，并给出可接受的一键补全建议。
- 验收标准：不强制改写用户 prompt；失败时不阻塞生成；扣费策略明确。
- 推荐验证：prompt service 测试、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N11.2 执行：新增 prompt 质量检查和自动补全建议。不要强制覆盖用户输入。明确扣费或免费策略并补测试。完成后运行后端测试和前端构建。
```

### N11.3 生成结果评分和反馈

- 类型：产品数据
- 复杂度：M
- 风险：中
- 依赖：历史记录
- 涉及文件：images repo/controller、历史详情、后台统计
- 目标：用户可对生成结果点赞/点踩/标记问题，后台能看失败原因和低分样本。
- 验收标准：反馈与图片记录关联；用户只能改自己的反馈；后台列表可筛选低分。
- 推荐验证：repo/controller 测试、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N11.3 执行：增加生成结果评分和反馈。确保用户隔离和后台筛选。完成后运行后端测试、前端构建和 smoke。
```

## Phase 12：后台运营能力

### N12.1 后台指标总览

- 类型：运营后台
- 复杂度：M
- 风险：中
- 依赖：任务、订单、积分、用户数据
- 涉及文件：`server/src/admin/*`、后台 dashboard view
- 目标：后台首页展示 DAU、生成任务量、成功率、积分消耗、订单收入、失败原因排行。
- 验收标准：查询按时间范围；大表聚合有 limit；无数据时展示空态。
- 推荐验证：admin controller 测试、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N12.1 执行：新增后台指标总览，覆盖用户、任务、积分、订单和失败原因。注意大表聚合性能。完成后运行后端测试和前端构建。
```

### N12.2 后台导出能力

- 类型：运营工具
- 复杂度：M
- 风险：中
- 依赖：后台分页接口
- 涉及文件：后台 controllers、后台列表页
- 目标：用户、订单、积分流水、审计日志支持按当前筛选导出 CSV。
- 验收标准：导出权限仅管理员；导出字段脱敏；大导出有上限和明确提示。
- 推荐验证：controller 测试、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N12.2 执行：为后台列表增加 CSV 导出，按当前筛选生效，敏感字段脱敏并限制最大导出量。完成后运行后端测试和前端构建。
```

### N12.3 运营公告定向投放

- 类型：运营功能
- 复杂度：M
- 风险：中
- 依赖：公告模块
- 涉及文件：announcements repo/controller/admin view
- 目标：公告支持按用户状态、角色、创建时间或是否付费定向展示。
- 验收标准：普通用户只能看到命中的公告；后台可预览命中条件；默认公告行为不变。
- 推荐验证：announcements 测试、`npm run build`
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N12.3 执行：为公告增加定向投放条件。保持现有公告兼容，补用户命中规则测试。完成后运行后端测试和前端构建。
```

## Phase 13：导航和信息架构

### N13.1 侧边栏收起和二级菜单

- 类型：前端体验 / 信息架构
- 复杂度：M
- 风险：中
- 依赖：对话创作已独立为左侧菜单
- 涉及文件：`src/views/StudioView.vue`、`src/router/index.js`、必要时新增导航配置文件
- 目标：左侧菜单支持展开/收起，管理中心支持二级菜单分组，移动端仍保持可用。
- 验收标准：收起状态只显示图标并有 tooltip 或可访问 label；刷新后保留用户选择；管理中心二级菜单不挤占普通功能区；当前路由高亮准确。
- 推荐验证：`npm run build`、`npm run smoke:frontend`、浏览器检查桌面和窄屏导航。
- 目标模式提示词：

```text
按 docs/goal-mode-roadmap-next.md 的 N13.1 执行：重构 StudioView 左侧导航，支持侧边栏收起/展开和管理中心二级菜单。保留当前路由高亮、移动端可用性和无障碍 label。完成后运行前端构建和 smoke，并用浏览器检查桌面/窄屏。
```

## 推荐执行顺序

1. N8.1 启动配置校验和健康检查。
2. N8.2 任务和支付链路结构化日志。
3. N9.1 支付渠道适配接口。
4. N10.1 历史资产高级筛选。
5. N11.1 模型能力配置中心。
6. N12.1 后台指标总览。
7. N10.2 变体对比视图。
8. N10.3 参数化提示词模板。
9. N11.2 Prompt 质量检查和自动补全。
10. N11.3 生成结果评分和反馈。
11. N12.2 后台导出能力。
12. N12.3 运营公告定向投放。
13. N8.3 数据库备份和恢复脚本。
14. N13.1 侧边栏收起和二级菜单。
15. N9.2 真实支付渠道接入，等待支付渠道信息。
16. N9.3 订单退款和积分冲正。

## 暂缓

- 视频生成：先等任务队列、存储和计费监控稳定。
- 实时画布：需要独立画布状态、低延迟推理和更复杂任务调度。
- 团队协作：需要组织、角色、共享资产和审计模型。
- 全局默认风格：继续禁止，风格只应来自当前 prompt、参考图或用户明确选择的风格板。
