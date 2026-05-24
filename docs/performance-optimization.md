# 性能优化记录

日期：2026-05-24

范围：本次只处理低风险、可验证的性能优化，重点覆盖前端首包、重复请求和列表页重复计算。不引入新依赖，不改业务 API。

## 已实现

### 1. 路由级懒加载

涉及文件：

- `src/router/index.js`

处理内容：

- 将首页、登录页、工作台、历史、模板、设置、后台管理等页面改为动态导入。
- 为动态 chunk 加载失败增加生产环境自动刷新兜底，避免发布后用户缓存旧入口导致白屏。

效果：

- 首屏主入口 chunk 从集中打包变为约 `19.72 kB`。
- 创建页、历史页、模板页、后台页等改为按路由加载。
- `vendor-vue` 独立为约 `106.25 kB`，页面业务代码不再全部进入初始入口。

### 2. `/api/me` 请求去重

涉及文件：

- `src/stores/auth.js`
- `src/views/StudioView.vue`
- `src/stores/images.js`
- `src/components/studio/PromptEnhanceModal.vue`

处理内容：

- `fetchUser()` 增加并发请求去重，多个初始化入口同时调用时只发一个 `/api/me`。
- 新增 `refreshUser()`，用于生成成功、余额不足重查、提示词润色扣费后强制获取最新用户额度。

效果：

- 降低页面初始化和路由切换时的重复认证请求。
- 保留扣费后余额刷新的实时性。

### 3. 模板页重复计算缓存

涉及文件：

- `src/views/studio/ModelsView.vue`

处理内容：

- 新增 `normalizedTemplates`，集中缓存模板 key、参数解析结果和搜索文本。
- 模板卡片渲染时不再重复执行参数正则解析。

效果：

- 模板数量增加时，搜索、分类切换和重新渲染的计算量更稳定。

### 4. 历史页列表派生数据缓存

涉及文件：

- `src/views/studio/HistoryView.vue`

处理内容：

- 新增 `enrichedHistoryItems`，统一计算收藏、文件夹、标签和搜索文本。
- 过滤和渲染阶段直接复用 `assetSummary`，避免每张卡片重复读取偏好数据。

效果：

- 历史记录增多后，搜索、筛选、批量选择时减少重复遍历和字符串拼接。

## 验证结果

已通过：

- `npm run build`
- `npm run build --prefix server`
- `npm test --prefix server`
- `npm run test:e2e --prefix server`
- `git diff --check`

构建输出确认：

- `dist/assets/index-*.js`：约 `19.72 kB`
- `dist/assets/CreateView-*.js`：约 `40.47 kB`
- `dist/assets/HistoryView-*.js`：约 `15.40 kB`
- `dist/assets/LandingView-*.js`：约 `27.43 kB`
- `dist/assets/vendor-vue-*.js`：约 `106.25 kB`

## 后续性能路线

优先级建议：

1. 后端图片历史接口增加 cursor/pageSize 分页，避免用户历史增长后单次返回过多。
2. 管理后台用户、流水、审计日志改为服务端分页和服务端筛选。
3. `CreateView.vue` 拆分为按模式加载的子组件，降低工作台初次进入成本。
4. 图片列表增加缩略图策略和懒加载占位，减少大图同时解码。
5. 为生产构建接入 bundle analyzer，只在分析时启用，避免常驻依赖。

暂不处理：

- 不做虚拟列表。当前列表规模和 UI 复杂度还不值得引入额外复杂度。
- 不引入状态管理新库。
- 不改后端生图主流程，避免和业务稳定性优化交叉。
