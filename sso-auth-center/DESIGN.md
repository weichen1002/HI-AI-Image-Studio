# 自研 SSO 账号中心技术方案

## 1. 目标

建设独立账号中心 `accounts.example.com`，为多个自有网站、手机 App、桌面 App 和未来第三方网站提供统一登录能力。

目标不是发明私有登录协议，而是实现一个可演进的 OIDC/OAuth2 子集：

- Web 使用 Authorization Code + PKCE，业务后端换 token 后建立自己的业务 session。
- Native App 使用系统浏览器 + PKCE，回调 custom scheme 或 loopback。
- 第三方网站使用标准 OIDC client 接入，按 `client_id`、redirect URI 和 scope 管理。

## 2. 非目标

第一版不做：

- SAML / LDAP / 企业微信企业登录
- MFA
- 第三方开发者后台
- 用户授权 consent 页面
- 多租户组织模型
- 自动密钥轮换
- 完整风控系统

这些是二阶段能力，不能挡住第一阶段账号中心内核落地。

## 3. 架构

```text
accounts.example.com
  注册 / 登录 / 会话 / OAuth / OIDC / JWKS

image.example.com
  业务站点，作为 OIDC client

mobile app
  native client，系统浏览器登录，PKCE 回调

desktop app
  native client，loopback/custom scheme 回调

third-party.com
  第三方 confidential client
```

账号中心只回答“用户是谁”和“client 被授权了什么 scope”。业务站点仍然维护自己的套餐、积分、订单、管理员权限。

## 4. 协议端点

### Discovery

```text
GET /.well-known/openid-configuration
```

返回 issuer、authorize、token、userinfo、JWKS 地址。

### JWKS

```text
GET /.well-known/jwks.json
```

返回 RS256 公钥。业务系统用它校验 token。

### Authorize

```text
GET /oauth/authorize
```

必需参数：

- `response_type=code`
- `client_id`
- `redirect_uri`
- `scope`
- `state`
- `code_challenge`
- `code_challenge_method=S256`
- `nonce`

行为：

1. 校验 client 是否存在。
2. 校验 redirect URI 精确匹配白名单。
3. 校验 scope 不超出 client 允许范围。
4. 未登录时跳转 `/login?next=...`。
5. 已登录时创建一次性 authorization code。
6. 回跳 client redirect URI，带上 `code` 和 `state`。

### Token

```text
POST /oauth/token
```

支持：

- `grant_type=authorization_code`
- `grant_type=refresh_token`

authorization code 流程校验：

- code 存在
- code 未消费
- code 未过期
- client 匹配
- redirect URI 匹配
- PKCE verifier 匹配 challenge

返回：

- `access_token`
- `id_token`
- `refresh_token`，仅 scope 包含 `offline_access`
- `expires_in`
- `scope`

### UserInfo

```text
GET /oauth/userinfo
Authorization: Bearer <access_token>
```

根据 token scope 返回：

- `sub`
- `email`
- `email_verified`
- `name`

## 5. 数据模型

### users

```text
id              稳定 subject，例如 usr_xxx
email           登录邮箱
password_hash   PBKDF2 hash
name            展示名
status          active / banned / pending_verification
email_verified  邮箱验证状态
created_at
updated_at
last_login_at
```

### clients

```text
id                  client_id
name
type                public / confidential
secret_hash          confidential client 使用
redirect_uris_json   精确白名单
allowed_scopes
trusted
created_at
```

### sessions

```text
id
user_id
expires_at
created_at
last_used_at
```

账号中心自己的 Web 登录态，使用 HttpOnly Cookie。

登录、注册、退出表单使用 CSRF token：服务端设置 HttpOnly `csrf_token` cookie，并在服务端渲染表单中输出同值 hidden field；POST 时要求二者一致。

### auth_codes

```text
code_hash
client_id
user_id
redirect_uri
scope
nonce
code_challenge
code_challenge_method
expires_at
consumed_at
created_at
```

authorization code 只存 hash，且只能消费一次。

### refresh_tokens

```text
token_hash
client_id
user_id
scope
expires_at
revoked_at
replaced_by_hash
created_at
```

refresh token 轮换：每次刷新都会撤销旧 token，签发新 token。

## 6. Web 业务站接入

业务站点登录流程：

1. 用户点击登录。
2. 业务站后端生成 `state`、`nonce`、`code_verifier`。
3. 存到业务站自己的临时 session。
4. 跳转 `/oauth/authorize`。
5. 账号中心登录并回调业务站。
6. 业务站后端拿 `code` 调 `/oauth/token`。
7. 校验 `id_token` 的 `iss`、`aud`、`exp`、`nonce`、签名。
8. 使用 `sub` 找/创建本地用户映射。
9. 业务站发自己的 HttpOnly session。

业务站本地用户表建议：

```text
id
sso_subject
email
role
plan
status
created_at
last_login_at
```

## 7. Native App 接入

手机 App / 桌面 App 使用 public client：

- 不分配 client secret
- 必须使用 PKCE S256
- 使用系统浏览器打开 authorize URL
- 回调用 custom scheme 或 loopback
- App 只保存 refresh token 到系统安全存储

## 8. 第三方接入

第三方接入必须延后到开放平台阶段。需要补：

- 应用创建与审核
- redirect URI 管理
- scope 申请
- 用户 consent 页面
- 用户撤销授权
- client 禁用
- rate limit
- 开发者协议和审计

第一版代码已经按 client/scope/redirect URI 建模，后续可以平滑扩展。

## 9. 安全要求

生产必做：

- HTTPS
- `ISSUER` 固定为公网 HTTPS 域名
- Cookie `Secure` + `HttpOnly` + `SameSite=Lax`
- 登录、注册、退出 POST 必须校验 CSRF token
- redirect URI 精确匹配，不允许通配符
- authorization code 一次性、短过期
- PKCE 只接受 S256
- token 不进入 URL fragment 以外的非受控位置
- client secret 只存 hash
- refresh token 只存 hash
- refresh token 使用事务性轮换，旧 token 成功撤销后才写入新 token
- 登录、授权、token 刷新写 audit log
- 生产环境不 seed 内置 demo client

开放第三方前必补：

- rate limit
- 密钥轮换
- 邮箱验证
- 找回密码
- MFA
- consent 页面
- refresh token 异常检测
- 管理后台审计查询

## 10. 实施分期

### Phase 1: 账号中心内核

当前已实现：

- 注册/登录
- session cookie
- authorize
- token
- refresh token rotation
- CSRF protection for login/register/logout
- userinfo
- discovery
- JWKS
- SQLite 持久化

### Phase 2: 自有业务站接入

- HI-Image-Studio 接 OIDC
- 新业务站复用同一账号中心
- 本地用户映射 `sso_subject`

### Phase 3: Native App

- public native client
- App deep link / loopback callback
- refresh token 安全存储

### Phase 4: 第三方开放平台

- 开发者后台
- client 审核
- consent 页面
- 应用封禁和授权撤销

### Phase 5: 安全增强

- MFA
- 风控
- 密钥轮换
- 设备管理
- 企业登录
