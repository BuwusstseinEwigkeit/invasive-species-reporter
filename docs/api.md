# API 文档

基础地址：`/api`。除公开接口外，认证接口使用：

```http
Authorization: Bearer <JWT>
```

JWT 默认有效期 7 天。

## 健康检查

### `GET /health`

公开。返回服务状态。

## Auth

### `POST /api/auth/register`

公开。用户名长度 3-32 字符，密码长度 8-128 字符。客户端提交的 role 会被忽略，新用户固定为 `user`。

```json
{
  "username": "testuser",
  "password": "test1234"
}
```

### `POST /api/auth/login`

公开。成功返回用户信息和 JWT。

### `POST /api/auth/wx-login`

公开。请求体：

```json
{ "code": "<wx.login code>" }
```

生产环境配置 `WECHAT_APPID` / `WECHAT_SECRET` 后调用微信接口换 openid。只有在非生产环境且显式 `ENABLE_DEV_WX_LOGIN=true` 时，未配置微信凭据才允许开发 openid 回退；其他情况返回 503。

## 图片和识别

### `POST /api/uploads` 🔒

字段名 `image`，multipart/form-data。上传必须登录。

服务端会：

- 校验真实图片内容；
- 拒绝超过 30MP 的图片；
- 自动旋转；
- 重编码为 JPEG；
- 去除 EXIF/GPS 元数据；
- 将 fileId 与当前 userId 绑定。

返回的 `imageUrl` 在上传阶段不是匿名公开资源。owner 可携带 JWT 读取；被用于 pending/rejected/spam 上报后仍只允许 owner/reviewer/admin；对应上报 approved 后才允许匿名读取。

返回：

```json
{
  "item": {
    "fileId": "....-normalized.jpg",
    "imageUrl": "https://host/uploads/....-normalized.jpg",
    "originalName": "sample.png"
  }
}
```

### `POST /api/recognitions` 🔒

仅允许识别当前用户自己的 fileId。

```json
{ "fileId": "....-normalized.jpg" }
```

### `GET /api/recognitions/:jobId` 🔒

仅 job owner 可轮询。完成结果包含 provider、isMock、候选物种和置信度。

识别提供商按当前已配置项依次尝试：Zhipu → Ollama → Moonshot → Python。Mock 在生产环境不自动参与。

## Species

### `GET /api/species`

公开。物种目录。

### `GET /api/species/:id`

公开。物种详情，以及该物种的 **approved** 历史上报。pending/rejected/spam 不公开。

## Reports

### `GET /api/reports?page=1&limit=20`

公开。始终只返回 approved。即使传入 `status=pending` 也不会扩大可见范围。

返回分页字段：

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 1
}
```

### `GET /api/reports/my?status=&page=1&limit=20` 🔒

当前用户自己的上报。status 可为 `pending|approved|rejected|spam` 或空。

### `GET /api/reports/review-queue?page=1&limit=20` 🔒 reviewer/admin

待审核队列，仅返回 pending。

### `GET /api/reports/:id`

- approved：公开返回脱敏字段。
- owner/reviewer/admin：可读取完整记录和 review log。
- pending/rejected/spam：其他用户与匿名访问返回 404。

### `POST /api/reports` 🔒

创建 pending 上报。

客户端只应提交：

```json
{
  "fileId": "....-normalized.jpg",
  "recognitionJobId": "job-...",
  "speciesId": "species-001",
  "latitude": 31.9527,
  "longitude": 118.8927,
  "address": "南京市玄武区",
  "remark": "在公园发现"
}
```

`recognitionJobId` 和 `speciesId` 可为空。服务端不接受客户端作为可信来源传入的 `imageUrl`、`aiTop1`、`aiScore`、`aiCandidates`。

创建成功时记录保持 pending，**不会立即发放可消费积分**。正向积分在审核通过的事务中结算；地理时空重复记录会保留，但 `points_eligible=false`，通过审核也不重复发放正向积分或信用奖励。

### `POST /api/reports/:id/review` 🔒 reviewer/admin

仅 pending 可执行一次。

```json
{
  "action": "approved",
  "finalSpeciesId": "species-001",
  "comment": "人工复核通过"
}
```

action：`approved | rejected | spam`。

approved 必须最终解析到合法物种（请求中的 `finalSpeciesId`，或上报原本已有的合法 speciesId）。重复审核返回 409，积分/信用/通知不会重复执行。

### `GET /api/reports/export/csv` 🔒

允许：

- admin
- reviewer
- 已获得 expert 导出权限的普通用户

导出 approved 数据。

## User / points / notifications

### `GET /api/points/:userId` 🔒 owner

返回当前积分和积分日志。

### `GET /api/notifications/:userId` 🔒 owner

返回通知和 unread 数。

### `POST /api/notifications/:id/read` 🔒 owner

notification id 同时校验 userId，不能跨用户标记已读。

### `POST /api/notifications/:userId/read-all` 🔒 owner

显式全部已读接口。当前前端不会在打开通知页时自动调用。

### `GET /api/achievements` 🔒

返回全部徽章及当前进度。

### `POST /api/achievements/check` 🔒

手动检查成就。正常上报/审核流程也会自动检查。

### `GET /api/user/privileges` 🔒

返回 credit、dailyReportLimit、badgeDailyReportLimit、highQualityBonus、canExportReports 等。

### `GET /api/user/profile/:userId` 🔒 owner

当前用户资料。

### `POST /api/user/avatar` 🔒

设置当前用户头像。只接受当前用户通过 `/api/uploads` 得到的 `/uploads/...` 资源；外部 URL 和其他用户的上传会被拒绝。设置成功后会消费对应临时 upload 绑定，但头像媒体保留并作为公开展示资产读取。

## Stats / leaderboard

### `GET /api/stats`

公开。系统统计。

### `GET /api/leaderboard?type=weekly|total|newcomer`

公开。

- weekly：本周积分净增量；
- total：当前累计积分；
- newcomer：近 30 天注册用户的累计积分；
- 同分共享排名。

## Shop

### `GET /api/shop/products`

公开。商品和分类。

### `POST /api/shop/purchase` 🔒

统一兑换入口。

虚拟商品：

```json
{ "productId": "product-digital" }
```

实物商品：

```json
{
  "productId": "product-stickers",
  "shippingName": "张三",
  "shippingPhone": "13800138000",
  "shippingAddress": "..."
}
```

扣分、库存和 purchase/order 创建在数据库事务中完成。

### `GET /api/shop/purchases/:userId` 🔒 owner

当前用户兑换记录。

### `GET /api/shop/orders/:userId` 🔒 owner

当前用户实物订单。

### `GET /api/shop/admin/orders` 🔒 admin

管理员查看全部实物订单。

### `PATCH /api/shop/admin/orders/:orderId` 🔒 admin

```json
{ "status": "shipped" }
```

允许状态：`pending | processing | shipped | completed | cancelled`。

## 错误约定

业务错误形如：

```json
{
  "success": false,
  "error": "message",
  "code": 400
}
```

生产环境的未捕获错误返回统一消息，不向客户端泄露内部堆栈。
