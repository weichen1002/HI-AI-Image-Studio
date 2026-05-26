# Review: server-side-history-filters

## 结果

Verdict: PASS

## 审查范围

- `server/src/db/repositories/images.repo.ts`
- `server/src/image/image.controller.ts`
- `src/stores/images.js`
- `src/views/studio/HistoryView.vue`
- `server/src/db/repositories/images.repo.spec.ts`
- `docs/platform-feature-audit.md`

## Findings

### Critical

无。

### Warning

- 外部双模型审查未完成：`gemini` 命令不在 PATH，`claude` wrapper 启动参数解析失败。因此本轮采用本地代码审查、单元测试、构建和 diff 检查兜底。
- 收藏筛选仍是前端本地过滤。原因是收藏状态目前存在偏好设置里，不在服务端资产表；跨分页准确收藏筛选应作为后续“收藏服务端化”处理。

### Info

- 标签筛选使用 `json_each` 精确匹配 JSON 数组元素，并用 `json_valid` 兼容异常历史数据，避免 `LIKE` 误命中相似标签。
- 历史页切换文件夹 / 标签会重置页码并请求服务端，修复分页下当前页内筛选不完整的问题。
- 当前选中的文件夹 / 标签会被保留进筛选选项，避免服务端当前页为空时 active chip 消失。

## 验证

- `npm test --prefix server -- --runInBand src/db/repositories/images.repo.spec.ts` 通过。
- `npm run build` 通过。
- `npm run build --prefix server` 通过。
- `git diff --check` 通过。
