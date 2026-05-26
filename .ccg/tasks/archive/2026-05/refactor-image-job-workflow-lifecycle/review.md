# 审查记录

## 变更摘要

- 新增 `server/src/image/image-job-lifecycle.ts`，集中处理图片生成任务的扣费、失败退款、失败文件清理。
- 新增 `server/src/image/image-job-lifecycle.spec.ts`，覆盖扣费后退款、零成本不退款、只清理本次创建结果文件和临时文件。
- 更新 `server/src/image/image.controller.ts`，让 text-to-image、image-to-image、dialogue、edit 四条路径复用 lifecycle helper。

## 本地验证

- `npm test --prefix server -- --runInBand`：通过，5 个 test suites，17 个 tests。
- `npm run build --prefix server`：通过。
- `git diff --check`：通过。

## 审查结论

未发现 Critical 问题。

### Warning

- 这次只是第一步抽离，`ImageController` 仍然很大，参数校验、HiAPI 调用、图片落地和数据库写入仍在同一 controller 文件中。后续应继续拆 workflow。
- 当前测试覆盖 helper 自身，但还没有覆盖 controller 四条生成路径的集成行为，尤其是上游失败后的退款和清理。

### Info

- 成功路径中编辑图片的源图保留/删除规则仍保留在 controller 内，避免 helper 误删需要作为历史输入保存的源图。
- 本次工作树已有多处未提交业务改动，本次修改只在其上增量处理后端生命周期逻辑。

## 外部模型审查

按 CCG 流程尝试双模型审查：

- Gemini：失败，当前环境 `gemini command not found in PATH`。
- Claude：wrapper 进程长时间无实质输出，最终无法取得审查报告。

因此本次以本地测试、构建和人工 diff 检查为准。
