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

返回：JWT token + 用户信息。用户名需 >= 3 字符，密码 >= 4 字符。默认角色为 `user`。

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

**预置账号：**
- 审核员: `reviewer` / `review123` (role: reviewer)
- 普通用户: `demo` / `demo123` (role: user)

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

识别提供商链路：**智谱 GLM-4V → (可选：Ollama 本地模型) → Mock 降级**

## `GET /api/species`

返回物种列表。

## `GET /api/species/:id`

返回物种详情与该物种的历史上报记录。

## `GET /api/reports?status=pending|approved|rejected`

查询上报记录，可按状态筛选。

## `POST /api/reports`

创建线索上报。

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
