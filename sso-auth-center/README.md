# SSO Auth Center

独立自研账号中心 MVP，面向多个自有 Web 站点、手机 App、桌面 App，以及未来第三方网站接入。

第一版实现一个小而标准的 OIDC/OAuth2 子集：

- 用户注册、登录、服务端会话 Cookie
- OAuth2 Authorization Code
- PKCE `S256`
- OIDC discovery
- JWKS
- RS256 `access_token` / `id_token`
- refresh token 轮换
- `/oauth/userinfo`
- client redirect URI 白名单
- 登录/注册/退出 CSRF 防护
- SQLite 持久化

## Quick Start

```bash
npm install
npm test
npm start
```

默认启动：

```text
http://localhost:4100
```

内置开发 client：

```text
client_id: demo-web
client_secret: demo-secret
redirect_uri: http://localhost:4100/demo/callback
scope: openid profile email offline_access
```

## Authorization URL Example

```text
http://localhost:4100/oauth/authorize?response_type=code&client_id=demo-web&redirect_uri=http%3A%2F%2Flocalhost%3A4100%2Fdemo%2Fcallback&scope=openid%20profile%20email%20offline_access&state=abc&nonce=nonce-1&code_challenge=...&code_challenge_method=S256
```

未登录时会跳到 `/login`，登录后自动回到授权流程。

## Environment

```text
PORT=4100
HOST=127.0.0.1
ISSUER=http://localhost:4100
DB_FILE=./data/auth.db
KEY_FILE=./data/jwt-keypair.json
SECURE_COOKIES=false
SEED_DEMO_CLIENT=true
```

可以从示例配置开始：

```bash
cp .env.example .env
```

生产环境必须使用 HTTPS，并设置：

```text
ISSUER=https://accounts.example.com
SECURE_COOKIES=true
SEED_DEMO_CLIENT=false
```

内置 `demo-web/demo-secret` 只适合本地开发。生产环境默认不会 seed demo client，建议显式设置 `SEED_DEMO_CLIENT=false`。

## Create Clients

自有 Web 站点通常用 confidential client：

```bash
npm run create-client -- \
  --id image-web \
  --name "HI Image Studio" \
  --type confidential \
  --redirect https://image.example.com/auth/callback \
  --scopes "openid profile email offline_access" \
  --trusted
```

手机 App / 桌面 App 用 public client，不分配 secret：

```bash
npm run create-client -- \
  --id image-mobile \
  --name "HI Image Mobile" \
  --type public \
  --redirect com.hiimage.app:/oauth/callback \
  --scopes "openid profile email offline_access" \
  --trusted
```

## Web Client Integration

业务站点登录时：

1. 后端生成 `state`、`nonce`、`code_verifier`。
2. 将这三个值存到业务站自己的临时 session。
3. 用 `code_verifier` 生成 S256 `code_challenge`。
4. 跳转到账号中心 `/oauth/authorize`。
5. callback 收到 `code` 后，由业务站后端请求 `/oauth/token`。
6. 校验 `id_token` 的签名、`iss`、`aud`、`exp`、`nonce`。
7. 用 `sub` 绑定或创建业务站本地用户。
8. 业务站设置自己的 HttpOnly session cookie。

业务站不要把账号中心的 token 放到 localStorage。

## Native App Integration

手机 App / 桌面 App 使用系统浏览器登录，不要内嵌 WebView：

1. App 生成 `state`、`nonce`、`code_verifier`。
2. 打开系统浏览器访问 `/oauth/authorize`。
3. 使用 custom scheme 或 loopback redirect 接收 `code`。
4. App 调 `/oauth/token`，不带 client secret。
5. refresh token 存进系统安全存储。

## Project Files

```text
src/config.js        runtime config
src/db.js            SQLite schema and repositories
src/keys.js          RSA keypair, JWT signing, JWKS
src/oauth.js         OAuth/OIDC helpers
src/app.js           Express routes
src/index.js         server entry
src/create-client.js client creation CLI
test/oauth.test.js   protocol tests
DESIGN.md            full technical plan
```

## Important

这是账号中心内核 MVP，不是开放平台最终版。开放第三方前至少还要补：

- client 管理后台和审核流程
- 用户授权 consent 页面
- refresh token 风控与设备管理
- 密钥轮换
- 邮箱验证和找回密码
- MFA
- rate limit
- 审计查询后台
- 第三方应用封禁/撤销授权
