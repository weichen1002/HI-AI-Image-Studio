# 图文生图（Images Edits）能力设计

## 背景

当前创作工作台仅支持文生图（`/v1/images/generations`）。需要新增图文生图：上传参考图 + 输入提示词，同样使用 `gpt-image-2`，并按 OpenAI 兼容接口走 `POST /v1/images/edits`。参考图需要保存到历史记录，可在历史列表卡片切换查看「结果图 / 参考图」，更详细信息在详情页查看。

## 目标

- 在「创作工作台」内增加模式切换：文生图 / 图文生图
- 图文生图支持上传 1 张参考图与提示词，生成 1 张结果图
- 生成记录保存到服务端历史：结果图 + 参考图 + 提示词 + 比例 + 时间 + 模式
- 历史列表卡片支持切换查看「结果图 / 参考图」
- 提供历史详情页展示完整信息，并支持再次创作（可复现）

## 非目标（本期不做）

- 局部重绘/蒙版（inpainting）
- 多图融合
- 高级参数（strength、seed 等，除非中转站必需）

## 信息架构（IA）

- 左侧导航不新增菜单项：仍为「创作工作台 / 灵感记录 / 灵感库 / 偏好设置」
- 工作台页面新增模式切换控件
- 新增历史详情页

路由建议：

- `/studio`：创作工作台（支持 `?mode=text|image`）
- `/studio/history`：灵感记录（列表）
- `/studio/history/:id`：灵感记录（详情）

## 交互与 UI

### 创作工作台（Create）

模式切换：

- 文生图：保持现有表单与请求链路不变
- 图文生图：在提示词区域增加参考图上传模块

参考图上传模块（图文模式可见）：

- 点击上传与拖拽上传
- 缩略图预览
- 删除/替换
- 校验提示：格式与大小超限

复用现有模块：

- 比例选择（aspectRatio）
- 生成按钮
- 生成中状态条与预览展示

### 灵感记录（History 列表）

- 卡片默认展示结果图
- 当记录存在参考图时，卡片右上角提供轻量切换：`结果 / 参考`
- 点击卡片进入详情页
- 列表页保持轻展示：图片 + prompt + 比例 + 时间 + 操作（再次创作/下载）

性能建议：

- 列表默认不渲染参考图的 `<img>`（不设置 `src`），仅在切换到「参考」时才挂载/赋值并触发加载，避免额外带宽
- 参考图加载后可本地缓存切换状态，避免来回切换重复请求

### 灵感记录（History 详情）

- 头部 Tab：`结果图 / 参考图`
- 大图预览 + 下载
- 基础信息：prompt、比例、创建时间、模式
- 操作：
  - 再次创作：带回工作台（`mode` + `prompt`，若有参考图则一并带回）

## API 设计

### 1）文生图（保持现状）

- `POST /api/images`
- Content-Type: `application/json`
- Body：
  - `prompt: string`
  - `aspectRatio: string`（`1:1` 等）
- 调用上游：`POST {HIAPI_BASE_URL}/images/generations`

### 2）图文生图（新增）

- `POST /api/images/from-image`
- Content-Type: `multipart/form-data`
- Form fields：
  - `image: File`（参考图，单张）
  - `prompt: string`
  - `aspectRatio: string`
- 调用上游：`POST {HIAPI_BASE_URL}/images/edits`
  - `model: gpt-image-2`
  - `image: <file>`
  - `prompt`
  - `n: 1`
  - `size`
  - `response_format`

### 3）历史列表（保持现状，扩字段）

- `GET /api/images?limit=12`
- 返回 `images[]` 每条包含必要字段（见数据模型）

### 4）历史详情（新增）

- `GET /api/images/:id`
- 返回 `image`

## 数据模型

服务端保存的 image 记录（db.json）扩展为向后兼容：

- `id: string`
- `userId: string`
- `mode: 'text' | 'image'`
- `prompt: string`
- `aspectRatio: string`
- `content?: string`
- `imageUrls: string[]`（结果图 URL，至少 1）
- `inputImageUrls?: string[]`（参考图 URL，图文模式下至少 1）
- `createdAt: string`

列表裁剪策略：

- `imageUrls` 与 `inputImageUrls` 列表接口只返回首张（与当前列表一致，减少 payload）
- 详情接口返回完整数组（当前仅 n=1，预留）

## 参考图存储与访问

存储：

- 落盘目录：`data/uploads/`
- 文件名：`<uuid>.<ext>`（ext 由检测到的 mime 映射或原始扩展名白名单决定）

访问：

- 暴露静态路径：`GET /uploads/<filename>`
- `inputImageUrls` 存储为上述可访问 URL

## 校验与安全

上传校验（服务端必须做）：

- 文件类型白名单：`image/png`, `image/jpeg`, `image/webp`
- 文件大小限制：建议 5–10MB
- 只允许单文件
- 文件名不信任用户输入，统一使用随机名

鉴权：

- `POST /api/images/from-image`、`GET /api/images/:id` 均需要登录
- 静态 `/uploads` 需考虑是否要鉴权：
  - 简化方案：公开可访问，但 URL 难猜（随机文件名），且历史仅对登录用户可见
  - 更严格方案：通过 `/api/images/:id/input` 代理读取（本期不建议，复杂度上升）

敏感信息：

- 服务端不得在代码中内置真实 API Key；仅从 `.env` 读取

## 错误处理

- 上游超时/网络错误：统一映射为可读 message
- 上游返回 data 为空：按现有逻辑报错
- 上传校验失败：明确提示（格式/大小）

## 兼容性与迁移

- 旧记录缺失 `mode` 与 `inputImageUrls` 时：
  - `mode` 默认按 `text` 处理
  - 列表卡片不显示「参考」切换

## 测试与验收

功能验收（最小集合）：

- 文生图链路完全不受影响
- 图文生图：上传参考图 + 输入 prompt + 选择比例 → 生成成功
- 历史列表：新记录出现，默认展示结果图；可切换到参考图
- 历史详情：可查看结果/参考；再次创作可带回工作台并复现输入

边界：

- 超大图片/不支持格式提示正确
- 生成中禁止重复提交
