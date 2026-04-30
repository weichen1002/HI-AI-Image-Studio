# Overlay 基础组件沉淀（Popover / Drawer / Modal）

## 背景

项目需要参照 sub2api 的交互模式沉淀可复用的“浮层类”基础组件，以支撑后续功能：

- 管理中心（用户管理）已有抽屉实现，希望重构为全局可复用 Drawer。
- 后续要新增公告中心：右上角常驻入口 + 小列表预览（Popover），进入公告中心查看详情；未来还会有发布公告/确认类交互（Modal/Confirm）。

## 目标

- 沉淀 3 个基础容器组件：Popover、Drawer、Modal，统一行为与视觉基线。
- 组件具备良好的可用性：Teleport 防裁切、点击外部关闭、Esc 关闭、锁 body 滚动、滚动/resize 位置更新（仅在 open 时监听）。
- 先完成 AdminUsersView 抽屉替换为 common/Drawer，验证抽屉容器可复用。
- 为公告入口与公告中心预留组件能力，但本阶段不实现完整公告业务。

## 非目标

- 不在本阶段实现公告中心页面、公告发布表单、权限等完整业务。
- 不在本阶段实现复杂的多级菜单、嵌套 popover 管理、动画系统等（按需迭代）。

## 组件设计

### 1) common/Drawer

#### API

- `open`（v-model:open，Boolean）
- `title?: string`
- `subtitle?: string`
- `size?: 'sm' | 'md' | 'lg'`（默认 md）
- `closeOnEsc?: boolean`（默认 true）
- `closeOnMask?: boolean`（默认 true）

#### Slots

- `header`：覆盖默认标题区（可选）
- `actions`：右上角按钮区（如关闭、保存等）
- `default`：主体内容

#### 行为

- Teleport 到 `body`，采用 `position: fixed` 的遮罩与右侧面板，避免父容器 overflow/stacking context 影响。
- open 时锁定 body 滚动（记录并恢复滚动条/overflow 状态），close 时释放。
- Esc 关闭：当 `closeOnEsc` 为 true 时监听 keydown（仅 open 时绑定）。
- 点击遮罩关闭：当 `closeOnMask` 为 true 时，点击遮罩（mask self）触发 close。
- 事件：
  - `update:open`
  - 可选 `close`（用于页面收敛额外逻辑）

#### 样式基线

- 宽度由 `size` 控制（sm/md/lg）。
- 标题区、分割线、内容区内边距与现有管理中心一致，避免迁移产生大幅视觉差异。

### 2) common/Modal

#### API

- `open`（v-model:open，Boolean）
- `title?: string`
- `size?: 'sm' | 'md' | 'lg'`（默认 md）
- `closeOnEsc?: boolean`（默认 true）
- `closeOnMask?: boolean`（默认 true）

#### Slots

- `default`：内容
- `footer`：按钮区（取消/确认等）

#### 行为

- Teleport + fixed 居中 + 遮罩。
- open 时锁 body 滚动，close 释放。
- Esc/点击遮罩关闭（可配置）。

#### 后续扩展

- `ConfirmDialog` 可以基于 Modal 封装：统一标题、描述、按钮文案、危险态（danger）等。

### 3) common/Popover

用于公告入口右上角“小列表预览”，也可复用为更多菜单/用户菜单。

#### API

- `open`（v-model:open，Boolean）
- `placement?: 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start'`（先实现 bottom-end）
- `offset?: number`（默认 8）
- `matchWidth?: boolean`（默认 false）

#### Slots

- `trigger`：触发器内容
- `default`：浮层内容

#### 行为与性能

- Teleport 到 body，浮层 `position: fixed`，通过 trigger 的 `getBoundingClientRect()` 计算定位。
- click-outside 关闭、Esc 关闭。
- 仅在 open 时绑定 `scroll`（capture + passive）与 `resize` 用于更新定位，close 时解绑。
- 允许通过 props 控制最小宽度/最大高度由内容自行决定（公告列表可用 max-height + overflow）。

## AdminUsersView 抽屉迁移方案

### 现状

当前抽屉由页面直接实现：
- `drawer-mask`（遮罩）
- `drawer`（面板）
- `drawer-head`、tabs、body 等均在页面内

### 改造策略

- 新增 `common/Drawer` 后，优先迁移外壳容器：
  - 使用 `<Drawer v-model:open="drawerOpen" size="lg">`
  - 将原有 header/tabs/body 内容基本原样移入 Drawer slot
- 关闭逻辑统一走 Drawer（mask/esc/关闭按钮触发 update:open）
- 页面仍保留 tab 切换、数据加载、保存等业务逻辑

### 验证点

- 抽屉打开后不被任何布局裁切（Teleport 生效）
- Esc/点击遮罩能正确关闭
- 打开抽屉时主页面滚动锁定正确，关闭后恢复
- 原有抽屉内部交互（SelectMenu/按钮/表格/复制）不回归

## 公告入口（后续业务）落点

- 右上角常驻图标（badge 显示未读数）
- 点击触发 Popover：展示最近 N 条公告（标题 + 时间 + “查看全部”）
- “查看全部”跳转公告中心页面（后续实现）

## 验收标准

- 组件层：Popover/Drawer/Modal 的基础交互一致、只在 open 时绑定监听，构建通过。
- 页面层：AdminUsersView 抽屉完全复用 Drawer，不出现错位/裁切/滚动异常。
- 构建：`npm run build` exit code 0。

