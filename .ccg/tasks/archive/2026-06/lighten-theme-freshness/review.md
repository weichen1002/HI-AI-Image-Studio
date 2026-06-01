# Review

## Scope
- 轻微提亮全局主色，不回到用户否定的高亮蓝。
- 主渐变从深蓝尾部改为更轻的蓝系过渡。
- 背景 mesh 和 `--gradient-subtle` 提高一点青绿透明层，降低页面沉重感。
- 下调主按钮和 hover 阴影压感。

## Verification
- `npm run build` 通过：Vite 前端构建通过，Nest 后端构建通过。
- 浏览器刷新 `/studio/dialogue` 后已读取实际 CSS 变量并截图确认。

## Notes
- 只调整 `src/styles.css` 主题 token，未改页面结构。
