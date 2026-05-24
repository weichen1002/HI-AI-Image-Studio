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
SQLITE_FILE=data/app.db
HIAPI_API_KEY=your_hiapi_api_key
HIAPI_BASE_URL=https://hiapis.cloud/v1
HIAPI_MODEL=gpt-image-2
HIAPI_TEXT_MODEL=
HIAPI_TIMEOUT_MS=300000
```

`SESSION_SECRET` 和 `ADMIN_TOKEN` 生产环境必须使用高强度随机值。

## 数据目录

- SQLite 数据库：默认 `data/app.db`
- 上传和生成图片：`data/uploads/`
- 旧 JSON 数据：空 SQLite 数据库首次启动时会尝试导入 `data/db.json`，成功后重命名为 `data/db.json.bak`

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
