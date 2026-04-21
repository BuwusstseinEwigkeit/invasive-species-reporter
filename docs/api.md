# API 草案

## `GET /health`

健康检查。

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

## `GET /api/species`

返回物种列表。

## `GET /api/species/:id`

返回物种详情与最近记录。

## `GET /api/reports?status=pending|approved|rejected`

查询上报记录。

## `POST /api/reports`

创建线索上报。

## `POST /api/reports/:id/review`

审核指定上报。

## `GET /api/stats`

返回总上报数、待审核数、已确认数、物种数。
