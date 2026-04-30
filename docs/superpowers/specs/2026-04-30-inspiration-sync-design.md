# 灵感库定期同步（构建时）设计

## 背景

当前项目的“灵感库”数据来源为前端页面内的静态数组，无法自动跟随开源仓库更新。目标是把灵感库模板改为可定期同步的构建产物，避免线上运行时依赖 GitHub 可用性与限流。

## 目标

- 以 `https://github.com/YouMind-OpenLab/awesome-gpt-image-2` 为上游数据源
- 使用中文数据源：`README_zh.md`
- 通过脚本把上游内容转换为本项目可消费的 JSON 数据文件
- 通过定期自动化任务更新 JSON（可选 PR 或直接 push，按项目策略）
- 前端灵感库页面从 JSON 读取数据，不再硬编码

## 非目标

- 不在运行时从 GitHub 拉取（不增加后端同步定时器/缓存/接口）
- 不保证完整复刻上游网站展示形态（先保证提示词数据可用）

## 数据源与获取方式

- 上游文件：`README_zh.md`
- 获取方式：raw 下载
  - `https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/README_zh.md`

## 数据模型（本项目内部）

输出文件：`src/data/inspiration-templates.json`

字段（尽量稳定、便于前端渲染）：

- `id`: string（稳定 ID，建议基于标题/作者/源链接等内容哈希）
- `title`: string
- `description`: string
- `prompt`: string（多行文本，保留原始格式）
- `categories`: string[]（若上游可解析到；否则为空数组）
- `source`:
  - `repo`: 固定为 `YouMind-OpenLab/awesome-gpt-image-2`
  - `path`: `README_zh.md`
  - `url`: 对应条目的来源链接（若可解析；否则空）

## 解析策略

由于上游 README 是 Markdown 且结构可能变动，解析采用“尽量宽容”的策略：

- 以“条目块”为单位解析：优先识别标题/描述/Prompt 代码块
- Prompt 识别规则：优先提取紧随“📝 Prompt/Prompt/提示词”等标识后的 fenced code block（```）
- 对解析失败的块忽略，保证脚本不会因单条异常中断整体同步

## 同步脚本

新增脚本：`scripts/sync-inspiration-templates.mjs`

职责：

1. 拉取 `README_zh.md` 原文（HTTP GET）
2. 解析为内部数据结构（见数据模型）
3. 写入 `src/data/inspiration-templates.json`
4. 在 CI 中用 `git diff` 判断是否有变化，以决定是否提交更新

安全与稳定性：

- 不写入任何密钥
- 请求失败时返回非 0 退出码，便于 CI 失败告警

## 前端接入

- `ModelsView.vue` 改为从 `src/data/inspiration-templates.json` 导入并渲染
- 若需要兼容现有字段（category/coverImage 等），在页面侧做兜底展示（例如无封面则不展示或用已有 fallback 方案）

## 自动化更新策略（GitHub Actions）

新增 workflow（例如每周 1 次）：

- `schedule` 触发（可加 `workflow_dispatch` 手动触发）
- 步骤：
  - checkout
  - 安装依赖（npm）
  - 运行 `node scripts/sync-inspiration-templates.mjs`
  - 若有变更：
    - 生成提交或创建 PR（两者二选一，默认建议 PR）
  - 运行 `npm run build` 验证

## 验收标准

- 本项目灵感库页面不再依赖硬编码 templates 数组
- 手动运行脚本可生成/更新 `src/data/inspiration-templates.json`
- workflow 能在上游更新后拉取并生成变更
- 构建通过

