# N13.1 Collapsible Sidebar Review

## Scope

- Added a persistent sidebar collapse/expand toggle in `StudioView`.
- Collapsed state is stored in `localStorage` and restored after refresh.
- Collapsed desktop sidebar shows icon-only navigation with `title` and `aria-label`.
- Converted admin navigation into a secondary `管理中心` group.
- Clicking `管理中心` while collapsed expands the sidebar and reveals admin sub-menu links.
- Mobile navigation keeps the existing horizontal compact behavior.

## Verification

- `npm run build` passed.
- `npm run smoke:frontend` passed.
- `git diff --check` passed.
- Browser verification with a temporary SQLite database and temporary admin user passed:
  - `/studio/admin/settings` shows primary navigation, `对话创作`, and `管理中心`.
  - Clicking `收起侧边栏` sets the sidebar width to `84px`, hides visible text labels, and changes the button label to `展开侧边栏`.
  - Reload preserves the collapsed state.
  - Clicking `管理中心` from collapsed state expands the sidebar to `280px` and reveals `系统设置`、`用户管理`、`账务流水`、`订单`、`公告中心`、`兑换码`、`审计日志`.

## Notes

- Verification used `/private/tmp/hi-image-nav-test/app.db`; the project `data/app.db` was not touched.
- The temporary server on port `3100` was stopped after verification.
