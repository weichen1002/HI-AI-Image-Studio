# 下一步目标建议

## 结论

建议下一步目标定为：生成任务队列基础版。

更具体地说，先做一个低风险的纵向切片：为图片生成引入服务端持久化任务状态，让生成任务具备 `queued`、`running`、`succeeded`、`failed`、`cancelled` 的统一模型，但第一轮不改变现有用户主流程的同步体验。

## 判断依据

- `docs/product-roadmap.md` 将 V4 定位为任务队列，目标是刷新后恢复状态、失败重试和后台控制并发。
- `docs/platform-feature-audit.md` 的下一批建议里，任务队列排在后台分页体验之后，但后台分页和历史分页已有部分落地，任务队列成为商业化前更关键的稳定性基础。
- `docs/architecture-optimization.md` 指出 `ImageController` 仍然过重，继续叠加生成能力会放大回归风险。
- `.ccg/tasks/archive/2026-05/project-optimization-opportunities/review.md` 将任务队列和生图 workflow 拆分列为 P0/P1 交汇点。

## 推荐范围

第一阶段只做任务队列基础，不做完整异步化：

- 新增生成任务领域模型和状态机。
- 新增 `image_jobs` 或同等任务表及 repository 测试。
- 在现有生成入口创建任务记录，生成开始、成功、失败时更新状态。
- 保留现有 API 返回形态，避免一次性改前端交互。
- 为扣费、失败退款、任务状态更新补 mock 测试。

## 暂不做

- 不做真正后台 worker。
- 不做并发限流。
- 不做取消执行。
- 不做前端任务中心。
- 不做支付/订单闭环。

## 验收标准

- 服务端能记录每次生成任务的用户、模式、状态、错误信息和结果关联。
- 成功、失败、异常退款路径都有测试覆盖。
- 现有前端生成体验不变。
- `ImageController` 至少把任务状态更新逻辑委托给独立 service/repository，不继续堆在 controller 内。
- 后续可以自然扩展到 worker、重试、取消和任务中心。

## 后续第二阶段

完成任务状态落库后，再做 `ImageController` workflow 拆分，把 text-to-image、image-to-image、dialogue、edit/tool 的公共 charge/refund/persist/cleanup 流程抽出来。这样重构有任务状态和测试兜底，风险更低。
