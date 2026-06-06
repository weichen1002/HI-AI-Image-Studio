# Requirements

## User Request

用户要求新启动独立项目，不再融合旧 `HI-Image-Studio`。新项目需要是完整系统，不是 `localStorage` 原型；同时要求不要把所有逻辑都写在 `App.vue`。

## Scope

- 独立项目目录：`/Users/xiaochen/Documents/learning-space/api/HI-Light-Studio`
- 旧项目只作为功能参考
- 新系统需要持久化业务数据
- 前端需要拆分组件、视图、API client、业务状态
- 后端需要提供账号、会话、任务、市场、审核、积分 API

## Implemented MVP Boundary

- 使用 Node 内置 HTTP 服务作为轻量 API
- 使用 JSON 文件作为本地持久化数据库
- 生产版技术方案写入 `docs/TECHNICAL_PLAN.md`
- 真实模型调用、OIDC、对象存储、PostgreSQL 暂作为下一阶段替换点

## Verification

- `npm run build` passed in `HI-Light-Studio`
- Browser verified:
  - page loads at `http://127.0.0.1:5192/`
  - local development account initializes
  - task submission deducts credits
  - server progresses task
  - completed task writes assistant result back into thread
