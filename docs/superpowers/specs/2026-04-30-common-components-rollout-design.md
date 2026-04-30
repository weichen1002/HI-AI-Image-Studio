# 全站 common 组件替换设计（方案 A）

## 背景

当前项目已新增并在管理中心落地一套 common/layout 组件（Button/Input/SelectMenu/Toggle/DataTable/TablePageLayout/Toast）。但其他页面仍大量使用原生元素与内联样式（高度、padding、圆角、字号不一致），导致全站风格不统一且难维护。

目标是把“可复用的 UI 规则”收敛到组件层，页面只负责布局与业务逻辑。

## 目标

- 全站能替则替：把常规按钮、输入框、下拉选择、提示 toast 替换为 common 组件。
- 风格统一：尽量不再使用 inline style 强行控制控件尺寸/样式。
- 体验一致：disabled/loading/hover/focus 的行为在全站一致。
- 兼容特殊页面：CreateView 等强视觉 CTA 可保留内部结构，但外层采用统一按钮基类（例如 btn btn-primary），不破坏特效。

## 非目标

- 不做大规模重新设计与重排版（不改变页面信息架构与主要布局）。
- 暂不实现 SelectMenu 的 searchable/creatable/multi-select（后续可增量）。

## 组件策略

### Button

- 统一使用全局 `.btn` 基类与派生类：`.btn-primary/.btn-ghost/.btn-danger`。
- 尺寸通过 `.btn-xs/.btn-sm`（全局定义）控制，页面不再写高度/字号。

### Input / SelectMenu

- 统一基类 `.input`，并通过 `.input-sm/.input-xs` 全局类对齐高度与圆角。
- SelectMenu 的 trigger 使用 `class="input"` + sizeClass，对齐 Input。

### SelectMenu（自绘下拉）

- Teleport 到 body + fixed 定位，避免被父容器 overflow 裁切。
- 仅在 open 状态绑定 scroll/resize 监听，close 解绑，避免常驻监听影响性能。
- 键盘交互：↑/↓/Enter/Esc/Tab；click-outside 关闭。

## size 策略（统一默认 + 组件兜底）

- 默认：md = 48px（对齐现有全局 `.btn/.input`）。
- 紧凑区（toolbar/筛选/密集表单）：使用 sm = 42px。
- 表格内/次级小动作：使用 xs（按钮 30px，输入 36px）。

规则：
- 发现页面控件“显得大/显得小”时，优先通过组件 size 解决，不回退到 inline style。

### 例外规则：页面优先（先替换，后对齐）

当某些页面已存在强约束的“视觉尺寸/间距”（例如 hero CTA、卡片大按钮、特殊输入框高度），且：

- 组件现有 size 无法覆盖；
- 或临时不适合为组件新增参数（会引入过多复杂度/影响全局一致性）；

则采用“页面优先”策略：

1. 先把元素替换为 common 组件（统一交互/禁用态/可访问性/行为）。
2. 再在页面层保留原本的宽度/高度/padding/margin（可用 class 或局部样式）以维持当前视觉效果。
3. 后续再评估是否需要把该能力抽象为组件参数或新增一个更合适的 size。

## 替换范围与顺序

按“风险从低到高 + 复用收益最大”推进，逐页完成后跑一次 build 验证：

1. Studio 内页面
   - CreateView：表单中的输入/按钮，保留生成按钮内部结构但统一外层 btn class
   - SettingsView：常规表单控件替换为 Input/Button/SelectMenu（如有）
   - HistoryView / HistoryDetailView：卡片动作按钮与筛选/搜索区域（若有）替换
   - ModelsView：分类筛选按钮、卡片动作按钮替换
2. 非 Studio 页面
   - AuthView：登录/注册表单输入与提交按钮替换（允许保留视觉背景与特效）
   - LandingView：CTA 按钮与输入（如有）替换
3. Studio 外壳
   - StudioView：顶部/侧边导航内按钮（如存在）替换

## 验证标准

- 功能不回归：提交、禁用态、加载态、路由跳转正常。
- 视觉一致：同一区域内 input/select/button 高度一致；无明显挤压换行。
- 下拉不裁切：SelectMenu 在任意滚动容器内仍可完整展开。
- 构建通过：`npm run build` exit code 0。
