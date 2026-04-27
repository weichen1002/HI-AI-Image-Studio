# Image2 Create

一个轻量的 GPT Image 2 生图网站，使用 HiAPI 的 OpenAI 兼容中转接口。

## 功能

- 注册 / 登录 / 退出
- 服务端保存用户和生成历史
- 服务端代理 HiAPI，API Key 不暴露给浏览器
- 支持 `gpt-image-2` 和常用图片比例

## 启动

```bash
cp .env.example .env
```

编辑 `.env`：

```bash
HIAPI_API_KEY=你的_HiAPI_Key
SESSION_SECRET=一段足够长的随机字符串
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

默认请求 `response_format=url`，服务端会读取 `data[0].url` 给前端展示。如果中转站返回 `data[0].b64_json`，也会自动转成 `data:image/png;base64,...`。

默认按 OpenAI Images API 常见尺寸传参，例如 `1:1` 会映射为 `1024x1024`。如果你的 Sub2API 部署要求直接传比例，可以设置：

```bash
HIAPI_SIZE_FORMAT=ratio
```

## 数据存储

本地数据保存在 `data/db.json`，该目录已加入 `.gitignore`。生产环境建议替换为 SQLite、PostgreSQL 或托管数据库。
