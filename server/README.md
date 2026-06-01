# HI Image Studio Server

NestJS 后端，负责认证、用户和积分、图片生成代理、SQLite 持久化、后台管理、公告、兑换码和审计日志。

## 启动

在仓库根目录安装依赖后启动：

```bash
npm run server
```

或在 `server/` 目录内启动：

```bash
npm run start:dev
```

生产模式：

```bash
npm run build
npm run start:prod --prefix server
```

## 关键环境变量

```bash
PORT=3000
HOST=127.0.0.1
SESSION_SECRET=change-this-to-a-long-random-string
ADMIN_TOKEN=change-this-to-a-long-random-string
BILLING_WEBHOOK_SECRET=change-this-to-a-long-random-string
SQLITE_FILE=data/app.db
HIAPI_API_KEY=your_hiapi_api_key
HIAPI_BASE_URL=https://hiapis.cloud/v1
HIAPI_MODEL=gpt-image-2
HIAPI_TEXT_MODEL=
HIAPI_TIMEOUT_MS=300000
```

`SESSION_SECRET`、`ADMIN_TOKEN` 和 `BILLING_WEBHOOK_SECRET` 生产环境必须使用高强度随机值。

## 数据目录

- SQLite 数据库：默认 `data/app.db`
- 上传和生成图片：`data/uploads/`
- 旧 JSON 数据：空 SQLite 数据库首次启动时会尝试导入 `data/db.json`，成功后重命名为 `data/db.json.bak`

## 支付回调

mock 支付回调用于本地开发和自动化测试：

```text
POST /api/billing/webhooks/mock
Header: x-billing-signature: <hex hmac-sha256>
Body: { "orderId": "...", "paymentRef": "...", "amountCents": 990, "currency": "CNY" }
```

签名密钥为 `BILLING_WEBHOOK_SECRET`，签名明文为 `orderId.paymentRef.amountCents.CURRENCY`，币种会按大写处理。验签通过后，服务端会用 `mock` 支付渠道完成订单、发放积分，并对重复回调保持幂等。接入微信、支付宝或 Stripe 等真实渠道时，保留 `BillingService.completePaidOrder` 的订单校验和入账路径，只替换 webhook 入口的渠道验签与 payload 映射。

## 测试

```bash
npm test
npm run test:e2e
npm run test:cov
```

e2e 测试会使用临时 SQLite 文件，不依赖生产数据库。

## 模块

- `auth`：注册、登录、邮箱验证、验证码、session
- `image`：文生图、参考图生图、连续对话、编辑和图片历史
- `hiapi`：HiAPI/OpenAI 兼容接口 adapter
- `credits`：积分扣减和流水
- `admin`：后台用户、配置、审计日志
- `announcements`：公告中心
- `redeem-codes`：兑换码创建和领取
- `db`：SQLite 连接和 repositories
