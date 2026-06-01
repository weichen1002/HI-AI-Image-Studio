# Review

## Scope
- 压缩 `src/components/studio/DialoguePanel.vue` 的对话创作布局尺寸与间距。
- 新增 `src/components/studio/DialogueImagePreview.vue`，用于对话图片缩略展示与点击放大预览。
- 保留之前 loading 文案统一为“正在唤醒艺术引擎”的调整。

## Verification
- `npm run build` 通过。
- 浏览器当前登录态跳转到 `/login?redirect=/studio/dialogue`，未能直接进入工作台交互验证。

## Codex Review
- Critical: 未发现。
- Warning: 放大预览为轻量自管弹层，后续若其他页面也需要同款能力，可以继续抽到更通用的 `ImageLightbox`。
- Info: 用户明确要求“只用 codex”，因此本次未继续调用外部模型审查。
