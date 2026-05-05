# API 文档

## `GET /health`

健康检查。

## Auth 认证

### `POST /api/auth/register`

注册新用户。

请求体：
```json
{
  "username": "testuser",
  "password": "test1234"
}
```

返回：JWT token + 用户信息。用户名需 >= 3 字符，密码 >= 8 字符。默认角色为 `user`。

> ⚠️ 注意：注册时 `role` 参数传 `reviewer` 会被强制降为 `user`（只有 admin 能建审核员账号）。

### `POST /api/auth/login`

登录获取 token。

请求体：
```json
{
  "username": "reviewer",
  "password": "review123"
}
```

返回 JWT token，后续需要认证的接口在 Header 中携带 `Authorization: Bearer <token>`。

**预置账号（通过环境变量配置）：**
- 管理员: `ADMIN_USER` / `ADMIN_PASS` (role: admin)
- 审核员: `REVIEWER_USER` / `REVIEWER_PASS` (role: reviewer)
- 普通用户: `DEMO_USER` / `DEMO_PASS` (role: user)

> 首次启动时自动创建，密码不在代码中硬编码。详见 `.env.example`。

## `POST /api/uploads`

上传图片文件，字段名为 `image`。

返回示例：
```json
{
  "item": {
    "fileId": "1776802245523-ee834003d83878.png",
    "imageUrl": "http://127.0.0.1:3000/uploads/1776802245523-ee834003d83878.png",
    "originalName": "sample.png"
  }
}
```

## `POST /api/recognitions`

创建识别任务，接口会快速返回 `jobId`，真正识别在后台执行。

请求体示例：
```json
{
  "fileId": "1776802245523-ee834003d83878.png"
}
```

返回示例：
```json
{
  "item": {
    "jobId": "job-1776802249000-a1b2c3",
    "status": "queued"
  }
}
```

## `GET /api/recognitions/:jobId`

轮询识别状态。

返回示例：
```json
{
  "item": {
    "jobId": "job-1776802249000-a1b2c3",
    "fileId": "1776802245523-ee834003d83878.png",
    "status": "completed",
    "result": {
      "matchedSpeciesId": "species-001",
      "matchedSpeciesName": "加拿大一枝黄花",
      "confidence": 0.82,
      "summary": "图中花序和叶型与加拿大一枝黄花较为接近，但仍建议人工复核。",
      "topCandidates": [
        {
          "speciesId": "species-001",
          "speciesName": "加拿大一枝黄花",
          "confidence": 0.82
        }
      ]
    },
    "error": "",
    "createdAt": "2026-04-22T01:10:00.000Z"
  }
}
```

识别提供商链路：**智谱 GLM-4V → Moonshot/Kimi → Python 微服务 → Ollama 本地模型 → Mock 降级**

## `GET /api/species`

返回物种列表。

## `GET /api/species/:id`

返回物种详情与该物种的历史上报记录。

## `GET /api/reports?status=pending|approved|rejected`

查询上报记录，可按状态筛选。

## `POST /api/reports` 🔒 需认证

创建线索上报。需要登录（JWT token）。

Header: `Authorization: Bearer <token>`

请求体：
```json
{
  "speciesId": "species-001",
  "aiTop1": "加拿大一枝黄花",
  "aiScore": 0.85,
  "latitude": 31.9527,
  "longitude": 118.8927,
  "address": "南京市玄武区",
  "remark": "在公园发现"
}
```

## `POST /api/reports/:id/review` 🔒 需认证

审核指定上报。**需要 reviewer 或 admin 角色**。

Header: `Authorization: Bearer <token>`

请求体：
```json
{
  "action": "approved",
  "finalSpeciesId": "species-001",
  "comment": "特征清晰，确认为加拿大一枝黄花。"
}
```

`action` 可选值: `approved` | `rejected`

## `GET /api/stats`

返回总上报数、待审核数、已确认数、已驳回数、物种数。

## `POST /api/auth/wx-login`

微信 code 登录（也支持 mock 模式）。

- 正式环境：需配置 `WECHAT_APPID` + `WECHAT_SECRET`，自动用微信接口换 openid
- 开发模式：`WECHAT_APPID` 未配置时，用 `dev-{code}` 作为 openid，适合本地调试

## `GET /api/leaderboard`

排行榜（无需认证）。返回周榜、总榜、新秀榜数据。

## `GET /api/shop/products`

商品列表（含分类）。返回虚拟商品（cat-digital）和实物商品（cat-physical）。

## `POST /api/shop/orders` 🔒 需认证

创建订单。实物商品需传 `shippingAddress`。

## `GET /api/shop/orders/:userId` 🔒 需认证

查询用户订单列表。

## `GET /api/user/privileges` 🔒 需认证

查询当前用户权限（徽章等级、日报上报配额等）。

## `GET /api/reports/my` 🔒 需认证

查询当前用户的上报记录（需带 JWT）。

## `GET /api/reports/export/csv` 🔒 需认证

导出已核实数据为 CSV（含物种详情、经纬度、时间）。
