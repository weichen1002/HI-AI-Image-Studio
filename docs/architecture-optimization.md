# 仓库优化报告

日期：2026-05-24

范围：只读分析 `HI-Image-Studio` 当前前端、后端、测试和文档结构。当前仓库已有未提交改动：`src/App.vue`、`.workflow/`，本次优化不覆盖这些文件。

## 结论

优先级最高的是后端生图流程和测试基线。`ImageController` 当前承担参数校验、上传处理、积分扣减、HiAPI 调用、图片落地、历史写入和失败回滚，后续功能继续叠加会显著增加回归风险。测试侧目前只有 Nest starter e2e，无法覆盖真实业务路径。

建议按低风险顺序推进：

1. 先修正文档和失效测试，建立可验证基线。
2. 再抽离 SQLite migration runner，降低数据库变更风险。
3. 最后拆 `ImageController` 和 `CreateView.vue`，每次只移动一个业务路径。

## 已发现问题

### 1. 后端生图模块过大

涉及文件：

- `server/src/image/image.controller.ts`
- `server/src/hiapi/hiapi.service.ts`
- `server/src/credits/credits.repo.ts`
- `server/src/db/repositories/images.repo.ts`
- `server/src/db/repositories/dialogue.repo.ts`

现状：

- `ImageController` 约 1400 行。
- 路由层包含 body normalize、上传校验、临时文件保存、积分扣减、HiAPI 调用、结果持久化、失败退款、文件清理。
- 每个新增图片能力都会修改同一个大文件，容易引入回归。

建议：

- 新增 `ImageJobWorkflow` 或按业务路径拆成 `CreateImageWorkflow`、`ContinueDialogueWorkflow`、`EditImageWorkflow`。
- Controller 只做认证上下文、文件 interceptor 和调用 workflow。
- Workflow 内统一处理 charge/refund、asset persistence、transaction、cleanup。

收益：

- 错误回滚逻辑集中。
- 业务路径可以单测。
- Controller 变薄，后续维护成本下降。

### 2. SQLite schema 和 migration 混在 adapter 中

涉及文件：

- `server/src/db/sqlite.service.ts`
- `server/src/db/db.service.ts`

现状：

- `SqliteService.ensureSchema()` 同时负责建表、补字段、写 migration marker、旧 JSON 导入。
- `DbService` 仍保留旧 `db.json` 读写逻辑，但当前 `DbModule` 没有注册它。

建议：

- 保留 `SqliteService` 只负责连接、pragma、transaction。
- 抽出 migration runner，按版本组织 migration。
- 删除未引用的旧 `DbService`。
- 暂时保留 `config.DB_FILE` 和 JSON auto import，作为旧数据迁移兼容入口。

收益：

- 数据库变更更容易审查和测试。
- 减少遗留 JSON 实现造成的误导。

### 3. 前端创作工作台过重

涉及文件：

- `src/views/studio/CreateView.vue`
- `src/stores/images.js`
- `src/components/studio/ImageEditModal.vue`

现状：

- `CreateView.vue` 超过 2300 行。
- 同一文件内混合 text-to-image、image-to-image、dialogue、tools、编辑弹窗入口、预览状态和大量样式。

建议：

- 按模式拆分：`TextCreatePanel`、`ImageReferencePanel`、`DialoguePanel`、`ToolPanel`。
- 抽出共享 composable，例如 `useCreateJobState`，只管理 prompt、options、preview、error。
- 每次只拆一个 panel，避免一次性大改。

收益：

- 模式间变更互不干扰。
- UI 回归更容易定位。
- 组件接口更小。

### 4. 测试基线不足

涉及文件：

- `server/test/app.e2e-spec.ts`
- `server/src/credits/pricing.ts`
- `server/src/utils/index.ts`
- `server/src/hiapi/hiapi.service.ts`

现状：

- `server/src` 没有业务单测。
- e2e 仍断言 Nest starter 的 `Hello World!`，与当前应用不匹配。

建议：

- 替换 starter e2e，覆盖真实公开接口。
- 先给纯函数补单测：pricing、aspect ratio、session signing。
- 下一步给 HiAPI parse/retry 和 image workflow 补 mock 测试。

收益：

- 重构前有基本防线。
- 失败能指向具体模块。

### 5. 文档与实现不同步

涉及文件：

- `README.md`
- `server/README.md`

现状：

- 根 README 仍写本地数据保存在 `data/db.json`，但当前实现已使用 SQLite。
- `server/README.md` 仍是 Nest starter 模板。

建议：

- 根 README 更新为当前 SQLite、uploads、环境变量和生产启动方式。
- server README 替换为项目后端运行手册。

收益：

- 降低部署和接手成本。
- 避免错误配置数据存储。

### 6. 异常日志需要脱敏

涉及文件：

- `server/src/filters/api-exception.filter.ts`
- `server/src/logging/logger.ts`
- `server/src/auth/auth.controller.ts`
- `server/src/admin/admin.controller.ts`

现状：

- 异常过滤器会记录 `req.body`。
- 登录、注册、后台改密码、邮件配置、兑换码等请求可能包含敏感字段。

建议：

- 在统一 logger 层递归脱敏敏感 key。
- 覆盖 `password`、`token`、`secret`、`authorization`、`cookie`、`session`、`captcha`、`redeemCode`、`apiKey` 等字段。

收益：

- 降低日志泄露风险。
- 不需要每个 controller 单独处理日志安全。

### 7. Session 和密码校验需要拒绝畸形输入

涉及文件：

- `server/src/utils/index.ts`
- `server/src/auth/auth.guard.ts`
- `server/src/auth/auth.controller.ts`

现状：

- `verifySession` 只取 token 前两个分段，额外分段会被忽略。
- `verifyPassword` 对长度异常的 stored hash 可能触发 `timingSafeEqual` 异常。

建议：

- session token 必须严格为 `payload.signature` 两段。
- password hash 比较前先检查长度。

收益：

- 避免畸形输入被接受或导致 500。
- 认证工具函数行为更明确。

## 本次处理范围

本次先处理低风险项：

- 新增本报告。
- 更新根 README 和后端 README。
- 删除未引用的旧 `DbService`。
- 替换无效 starter e2e。
- 新增 pricing 和 utils 单测。
- 新增日志脱敏和单测。
- 加固 session 和密码校验边界。

暂不处理：

- 不拆 `ImageController`。
- 不拆 `CreateView.vue`。
- 不重构 SQLite migration runner。

这些需要更细的测试覆盖后再做。
