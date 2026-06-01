# 需求说明

## 用户请求

规划 HI-Image-Studio 后续全部优化点和新功能，整理成之后可以直接交给 Codex 目标模式执行的目标列表。

## 约束

- 统一使用 Codex，不再调用 Claude 或 Gemini。
- 本次只做规划和文档，不改业务代码。
- 规划需要覆盖工程优化、产品新功能、阶段顺序、依赖关系、验收标准和推荐验证命令。
- 每个目标应尽量能被独立执行，避免跨多个大模块一次性改动。

## 输入依据

- `docs/product-roadmap.md`
- `docs/platform-feature-audit.md`
- `docs/architecture-optimization.md`
- `docs/performance-optimization.md`
- `docs/dialogue-workflow-redesign.md`
- `.ccg/tasks/archive/2026-05/*/review.md`
- 当前代码结构和关键模块规模

## 现状摘要

- 后端 `server/src/image/image.controller.ts` 仍约 1524 行，是最大工程风险点。
- 前端 `src/views/studio/CreateView.vue` 仍约 3243 行，是最大 UI 维护风险点。
- 已有 `image-job-lifecycle` helper，说明扣费、退款、失败清理已经迈出第一步，但任务状态还未持久化。
- 历史记录已经支持服务端分页、搜索、folder/tag、`generationParams`。
- 收藏、模板收藏和部分资产偏好仍在本地 `preferences` 中。
- 后端测试有基础，但生图 controller 集成路径、任务状态、订单、前端冒烟测试仍不足。
