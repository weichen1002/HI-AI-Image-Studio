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
BILLING_WEBHOOK_SECRET=一段足够长的支付回调验签密钥
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

### 备份和恢复

备份脚本会在线复制 SQLite 数据库，并把 uploads 目录一起复制到一个备份目录。默认输出到 `backups/<timestamp>/`，备份目录中包含 `manifest.json`、`app.db` 和 `uploads/`。

```bash
npm run backup:data
```

可先查看将要备份的路径：

```bash
npm run backup:data -- --dry-run
```

也可以显式指定路径：

```bash
npm run backup:data -- --sqlite-file data/app.db --uploads-dir data/uploads --out /tmp/hi-image-backup
```

恢复脚本默认是 dry-run，只打印恢复计划，不会覆盖当前数据：

```bash
npm run restore:data -- --from /tmp/hi-image-backup
```

确认无误后再传 `--force` 执行恢复。恢复时如果目标数据库或 uploads 已存在，脚本会先把现有路径重命名为 `.before-restore-<timestamp>`，再写入备份内容。

```bash
npm run restore:data -- --from /tmp/hi-image-backup --force
```

## 支付回调

开发和测试环境提供 mock 支付回调：

```text
POST /api/billing/webhooks/mock
Header: x-billing-signature: <hex hmac-sha256>
```

验签密钥来自 `BILLING_WEBHOOK_SECRET`。签名内容为 `orderId.paymentRef.amountCents.CURRENCY`，例如 `order-1.mock:pay-1.990.CNY`。真实支付渠道接入时，应复用服务端订单完成和幂等入账逻辑，并替换为对应渠道的官方验签规则。

## 测试

后端测试：

```bash
npm test --prefix server
npm run test:e2e --prefix server
```

当前优化建议见：

```text
docs/goal-mode-roadmap-next.md
docs/goal-mode-roadmap.md
docs/architecture-optimization.md
docs/performance-optimization.md
```
