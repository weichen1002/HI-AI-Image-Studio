# Review

## Scope
- 压缩全局基础视觉密度：按钮、输入框、文本层级、面板圆角/阴影/内边距。
- 压缩 Studio 主框架：侧栏宽度、导航项高度、顶部栏高度、页面滚动区左右边距。
- 压缩通用列表布局：表格页面壳、筛选卡、toolbar、下拉菜单选项。
- 压缩创作页最显眼的大控件：比例按钮、生成按钮、空状态图标和加载核心。

## Verification
- `npm run build` 通过。
- 当前浏览器登录态停在 `/login?redirect=/studio/dialogue`，未做登录后人工目测。

## Codex Review
- Critical: 未发现。
- Warning: 当前仓库存在较多未提交/未跟踪文件，本次只围绕视觉密度调整，不处理历史脏工作区。
- Info: 用户要求只用 Codex，本次未调用外部模型审查。
