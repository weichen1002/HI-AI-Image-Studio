# 管理中心 UI 组件化（common/layout）设计稿

## 背景与问题

当前管理中心（用户管理 / 账务流水 / 管理员管理）页面为了快速上线，样式主要以页面内 `scoped` CSS 堆叠完成，导致：

- 不同页面之间的按钮、输入框、表格密度与交互状态不一致
- table/toolbar 的列宽策略、换行策略不统一，在不同宽度/字体渲染下出现错位
- toast、空状态、加载态重复实现，后续维护成本高

目标是沉淀一套可复用的 UI primitives，统一风格与布局策略，后续抽屉（Drawer）等交互也可复用，类似 sub2api 的 `frontend/src/components/common/` 与 `frontend/src/components/layout/` 思路。

## 设计目标

- 统一管理中心三页视觉与交互：按钮、输入、select、表格、空状态、加载态、toast
- 解决错位：以组件层约束 table-layout/colgroup/ellipsis，避免页面各写一套导致漂移
- 复用为先：后续页面（更多后台功能、抽屉等）能复用同一套组件
- 不引入新依赖：沿用现有项目的 CSS 变量、`.btn/.input` 等基础语义

## 范围

### In Scope

- 新增 `src/components/common/` 组件：
  - Button、Input、Select、Toggle
  - DataTable（核心，承载“不再错位”的约束）
  - Toast（全局单例式渲染 + 统一 API）
- 新增 `src/components/layout/` 组件：
  - TablePageLayout（后台表格页统一框架：标题区 + 工具条 + 内容区 + 状态区）
- 迁移并重构管理中心三页，移除页面级“重复且冲突”的样式策略
- 抽屉能力预留统一组件接口（下一阶段落地 Drawer）

### Out of Scope（本次不做）

- 抽屉 Drawer 的完整组件化（只预留接口与迁移策略）
- 复杂表格能力（排序持久化、分页组件、虚拟滚动、列拖拽等）
- 全站 UI 全量组件化（先覆盖管理中心与后续后台场景）

## 目录结构（落地约定）

- `src/components/common/`
  - `Button.vue`
  - `Input.vue`
  - `Select.vue`
  - `Toggle.vue`
  - `DataTable.vue`
  - `Toast.vue`
  - `index.js`（按需导出）
- `src/components/layout/`
  - `TablePageLayout.vue`
  - `index.js`

说明：沿用 sub2api 结构习惯，但保持本项目为 Vue + `<script setup>` + 现有 CSS 变量体系。

## 视觉与交互原则（沿用现有 Studio 风格）

- 使用现有 CSS 变量：`--primary / --muted / --text / --gradient-subtle / --line` 等
- 按钮/输入框以现有 `.btn/.input` 语义为底座，组件封装只做结构化与状态化
- 表格与工具条密度：管理中心偏“紧凑”，但不改变整体站点气质
- 交互反馈统一：成功/失败 toast，重要操作禁用态与 loading 态一致

## 组件设计

### 1) common/Button

- Props（建议）
  - `variant`: `primary | ghost | danger`
  - `size`: `sm | md`
  - `loading`: boolean
  - `disabled`: boolean
- Slots
  - default（按钮文案）
  - icon（可选）
- 行为
  - `loading` 时显示 loading 状态并禁用点击

### 2) common/Input

- Props
  - `modelValue`
  - `placeholder`
  - `size`
  - `disabled`
- Slots（可选）
  - prefix / suffix

### 3) common/Select

- Props
  - `modelValue`
  - `options`: `{ label, value, disabled? }[]`
  - `placeholder`
  - `size`
  - `disabled`

### 4) common/Toggle

- Props
  - `modelValue`（boolean）
  - `label`
- 行为
  - 使用原生 checkbox，但外观统一

### 5) common/Toast（全局）

- 在 Studio 的 layout（或 App 根组件）挂载一次 `<Toast />`
- 提供一个轻量 store（不引新依赖）：
  - `addToast({ type, message, duration })`
  - `success(message)` / `error(message)`
- 管理中心页面不再各自实现 toast CSS

### 6) common/DataTable（核心）

#### 目标

把“不会错位”的约束收敛在组件内，使页面只关心数据与列定义。

#### Props（建议）

- `columns`: `[{ key, title, width?, align?, nowrap?, ellipsis? }]`
- `rows`: `any[]`
- `rowKey`: `string | (row)=>string`
- `loading`: boolean
- `emptyText`: string
- `selectedKey`: string（可选）
- `clickable`: boolean（行是否可点击）

#### Slots

- `cell-{key}`：自定义单元格渲染

#### 强约束（防错位）

- `table-layout: fixed`
- 通过 `colgroup` 使用 `columns[].width` 固定列宽（支持 `% / px / fr-like`）
- `td/th` 默认 `overflow: hidden`
- `ellipsis` 默认开启：`text-overflow: ellipsis; white-space: nowrap`
- 行 hover/selected 统一

### 7) layout/TablePageLayout

- Props
  - `title`
  - `subtitle`
  - `actions`（可用 slot）
- Slots
  - `toolbar`（筛选/搜索）
  - default（表格/内容）
  - `footer`（可选）
- 统一布局策略
  - 工具条默认“可换行两行布局”，避免一行挤压导致错位

## 页面迁移方案（管理中心三页）

### 用户管理

- 使用 `TablePageLayout`
- 工具条：SearchInput + Select(plan/role) + Input(min/max) + Toggle(低余额) + 刷新按钮
- 表格：DataTable
- 行点击：打开抽屉（下一阶段抽成 `common/Drawer`，本次先保留现有抽屉实现但样式对齐组件 tokens）

### 账务流水

- 使用 `TablePageLayout`
- 工具条：userId 输入 + 类型 Select + 复制按钮 + 刷新
- 表格：DataTable

### 管理员管理

- 使用 `TablePageLayout`
- 工具条：搜索 + role 筛选
- 表格：DataTable

## 验收标准

- 三个管理中心页面的按钮、输入、select、表格样式一致
- 不同窗口宽度下（尤其 1280/1440/1680）不出现工具条与表格错位
- 表格列宽稳定，超长字段（userId）以 ellipsis 展示但可一键复制
- toast 统一且不重复渲染
- 页面级 `scoped` 样式大幅减少，布局约束集中在 common/layout 组件

## 风险与对策

- 风险：现有页面已写入大量 `scoped` CSS，迁移时容易残留冲突样式
  - 对策：迁移时优先删页面级 table/toolbar 样式，改为组件提供样式
- 风险：未来组件越来越多导致目录膨胀
  - 对策：坚持 common 只收敛“原子组件 + 表格/弹窗/抽屉”级别，业务组件留在 views 内

