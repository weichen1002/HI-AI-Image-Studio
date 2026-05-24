# HI Image Studio

一个轻量的 AI 图片创作工作台，使用 HiAPI 的 OpenAI 兼容中转接口。前端基于 Vue 3 + Vite，后端基于 NestJS + SQLite。

## 功能

- 注册 / 登录 / 退出
- 服务端保存用户、积分、公告、兑换码和生成历史
- 服务端代理 HiAPI，API Key 不暴露给浏览器
- 支持文生图、参考图生图、连续对话、局部编辑和抠图工具
- 支持后台用户、积分、公告、审计日志和兑换码管理

## 启动

```bash
cp .env.example .env
```

编辑 `.env`：

```bash
HIAPI_API_KEY=你的_HiAPI_Key
SESSION_SECRET=一段足够长的随机字符串
ADMIN_TOKEN=一段足够长的后台初始化令牌
SQLITE_FILE=data/app.db
```

开发模式需要同时启动后端和 Vite 前端：

```bash
npm run server
```

另开一个终端：

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:5173
```

生产模式先构建前端，再启动后端：

```bash
npm run build
npm start
```

打开：

```text
http://127.0.0.1:3000
```

## HiAPI / Sub2API 接口

当前实现按 Sub2API/OpenAI Images API 形态调用：

```text
POST https://hiapis.cloud/v1/images/generations
model: gpt-image-2
```

当前按 `gpt-image-2` 官方行为处理，默认接收 `b64_json`。服务端会把返回的图片结果落地到本地 `/uploads`，数据库中只保存本地 URL，避免在历史记录里长期存储超长 base64。

默认按 OpenAI Images API 常见尺寸传参，例如 `1:1` 会映射为 `1024x1024`。如果你的 Sub2API 部署要求直接传比例，可以设置：

```bash
HIAPI_SIZE_FORMAT=ratio
```

## 数据存储

本地数据默认保存在 SQLite 文件 `data/app.db`，上传和生成后的图片保存在 `data/uploads/`。`data/` 目录已加入 `.gitignore`。

旧版本的 `data/db.json` 会在空 SQLite 数据库首次启动时自动导入，并重命名为 `data/db.json.bak`。

## 测试

后端测试：

```bash
npm test --prefix server
npm run test:e2e --prefix server
```

当前优化建议见：

```text
docs/architecture-optimization.md
docs/performance-optimization.md
```
