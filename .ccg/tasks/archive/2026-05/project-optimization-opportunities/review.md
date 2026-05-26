# 项目优化点与新功能建议

## 分析范围

- `README.md`
- `docs/architecture-optimization.md`
- `docs/performance-optimization.md`
- `docs/product-roadmap.md`
- `docs/platform-feature-audit.md`
- `server/src/image/image.controller.ts`
- `server/src/db/repositories/images.repo.ts`
- `server/src/db/sqlite.service.ts`
- `src/views/studio/CreateView.vue`
- `src/stores/images.js`
- `src/stores/preferences.js`

## 结论

当前项目已经从单纯图片生成工具升级为带用户、积分、公告、后台和资产管理雏形的创作工作台。最值得优先投入的是三条线：

1. 后端生图链路模块化和任务队列。
2. 创作工作台拆分和端到端测试基线。
3. 用户资产从本地偏好升级为服务端资产，并补商业闭环。

## 工程优化优先级

### P0

- 拆分 `server/src/image/image.controller.ts` 的生成工作流。当前约 1605 行，包含参数校验、文件落地、扣费退款、HiAPI 调用、历史写入、对话链和删除清理，后续任务队列、重试、取消都会继续放大风险。
- 为生图主流程补 mock 测试。现有后端业务单测主要覆盖 utils、pricing、logger、images repo，缺少 text-to-image、image-to-image、dialogue、edit 的扣费退款和失败回滚测试。
- 完成生成任务表和状态机设计。当前前端 `activeJob` 只是浏览器内存状态，刷新后不可恢复，也无法后台控制并发。

### P1

- 拆分 `src/views/studio/CreateView.vue`。当前约 3411 行，混合文生图、图生图、对话、工具、项目板和大量样式，建议按模式拆 panel，并抽出 `useCreateJobState`、`useDialogueSessions`、`useGenerationOptions`。
- 把 SQLite schema/migration 从 `SqliteService` 抽成 migration runner。当前建表、补字段、schema marker、旧 JSON 导入仍在一个 adapter 中。
- 优化图片历史查询。`ImagesRepo.listByUserPaged` 已支持分页、folder、tag，但搜索仍对 JSON tags 做 LIKE/`json_each`，中大数据量后需要 tags 正规化表或 FTS。
- 明确本地偏好和服务端资产边界。`preferences.js` 仍保存收藏、模板收藏、资产 meta；`images` 表已经有 folder/tags，容易出现双写和展示不一致。

### P2

- 减少前端内联样式和重复视觉规则，沉淀更多通用布局组件。
- 引入前端组件测试或 Playwright 冒烟测试，至少覆盖登录、生成表单、历史筛选、后台分页。
- 为图片文件增加缩略图/预览图策略，避免历史列表直接解码大图。

## 新功能建议

### 短期

- 服务端收藏、模板收藏、最近使用参数同步。
- 参数复制、变体对比、从历史一键再生成。
- 资产批量操作的服务端化，包括收藏、标签、文件夹。
- 生成任务中心第一版：排队、运行、成功、失败、重试、取消。

### 中期

- 风格资产/品牌资产：参考图集合、默认风格提示词、项目级风格板。
- 服务端模板系统：管理员维护模板、参数占位符、推荐权重、用户收藏。
- 订单/充值闭环：套餐页、订单表、支付回调、后台订单管理、补单/退款审计。
- 后台运营看板：生成量、失败率、扣费退款、活跃用户、热门模板。

### 长期

- 多模型/多供应商路由和降级策略。
- 团队空间或项目协作。
- 更完整的在线编辑器：图层、画布、局部编辑历史、版本管理。

## 已部分落地

- 历史分页、folder/tag 查询已进入服务端。
- 管理后台用户列表已支持分页筛选。
- 路由懒加载、`/api/me` 去重、列表派生缓存已在性能文档中记录。
- README 已基本同步 SQLite 和 uploads。

## 仍未落地

- 生图 workflow 拆分。
- SQLite migration runner。
- 任务队列和持久化任务状态。
- 商业订单闭环。
- 前端创作页拆分。
- 前端自动化测试。

## 外部模型分析情况

按 CCG 流程尝试调用 Gemini 和 Claude 进行并行分析，但当前环境中 Gemini 命令不可用，Claude wrapper 参数/端口绑定失败，因此本报告基于本地代码和已有文档完成。
