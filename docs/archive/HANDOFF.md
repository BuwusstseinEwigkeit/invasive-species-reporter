# Handoff

## Current State (updated 2026-04-24 — v0.5.0)

- Uploads: `POST /api/uploads` — working (multer + disk storage)
- Recognition: `POST /api/recognitions`, poll `GET /api/recognitions/:jobId` — async, provider chain: Zhipu (cloud) → optional Ollama (local dev only) → Mock fallback
- Database: SQLite via better-sqlite3 at `server/data/invasive-species.db`
- Auth: JWT-based, `POST /api/auth/register` + `POST /api/auth/login`, demo accounts seeded
- Review: `POST /api/reports/:id/review` now requires reviewer/admin role
- Species images: all 12 species use local `/static/species/species-XXX.jpg` placeholder images
- Reports: persisted in SQLite, seeded from mock-data.js on first run (INSERT OR REPLACE keeps seed data in sync)

### Key files

- Server entry: [server/index.js](server/index.js)
- Database layer: [server/lib/database.js](server/lib/database.js)
- Store (delegates to DB): [server/lib/store.js](server/lib/store.js)
- Recognition: [server/lib/recognition.js](server/lib/recognition.js)
- Recognition jobs: [server/lib/recognition-jobs.js](server/lib/recognition-jobs.js)
- Upload store: [server/lib/upload-store.js](server/lib/upload-store.js)
- Seed data: [server/data/mock-data.js](server/data/mock-data.js)

### Frontend Flow

- Upload/report page: [miniprogram/pages/report/report.js](miniprogram/pages/report/report.js)
- Review page: [miniprogram/pages/review/review.js](miniprogram/pages/review/review.js)
- Map page: [miniprogram/pages/map/map.js](miniprogram/pages/map/map.js)

### Demo accounts

| Username | Password | Role |
|----------|----------|------|
| reviewer | review123 | reviewer |
| demo | demo123 | user |

## If Switching Tools

- Keep upload flow unchanged.
- Keep the recognition result shape:
  - `matchedSpeciesId`
  - `matchedSpeciesName`
  - `confidence`
  - `summary`
  - `topCandidates`
- Do not remove async job flow; front-end already depends on it.
- Database schema is in `server/lib/database.js` → `initSchema()`

## Completed (v0.6.1)

1. ✅ **API 错误格式统一化** — 所有端点使用 `sendError(res, error, code)` / `sendSuccess(res, data, statusCode)` 统一格式
2. ✅ **前端全局错误提示** — request()/uploadImage() 失败时自动弹出 Toast，app.js 增加 `wx.onError` 全局异常捕获
3. ✅ **HTTPS 与生产配置** — 新建 `deploy/` 目录（nginx.conf, https-server.js, deploy.sh）
4. ✅ **物种知识图谱** — species 表增加 `relations` 字段，详情页新增生态关系图谱卡片
5. ✅ **上报数据导出 CSV** — 新增 `GET /api/reports/export/csv` 端点，含 BOM 的 UTF-8 CSV（Excel 兼容）
6. ✅ **消息通知系统** — 新增 `notifications` 表，审核通过/驳回时自动创建通知，`GET /api/notifications/:userId`、`POST /api/notifications/:id/read`、`POST /api/notifications/:userId/read-all`
7. ✅ **Python 识别微服务** — `python-service/app.py` 支持 JSON/base64 和 multipart 两种输入格式，mock 识别器始终可用
8. ✅ **MiniMax VL-3 识别提供商** — 新增 `recognizeWithMiniMax()`，性价比最高的视觉识别模型
9. ✅ **微信登录集成** — 新增 `POST /api/auth/wx-login` 端点，`openid` 字段支持
10. ✅ **我的上报用户过滤** — 新增 `GET /api/reports/my` 端点，JWT 鉴权后返回当前用户上报
11. ✅ **地图热力图** — `addHeatMap` 实现，点击按钮切换显示
12. ✅ **详情页信息增强** — species 表增加 `origin`、`control_methods` 字段，四格信息卡片 + 防治方法折叠面板
13. ✅ **图片压缩选项** — 上报页面新增高清90%/标准60%/极限30% 选择器
14. ✅ **Moonshot/Kimi 识别后备** — 新增 `recognizeWithMoonshot()`，配置 `MOONSHOT_API_KEY` 启用

## 识别服务链验证 (v0.6.1)

✅ **识别链状态**:
- MiniMax (primary): `MINIMAX_API_KEY` 已配置
- Zhipu (cloud fallback): `ZHIPU_API_KEY` 已配置  
- Moonshot (cloud fallback 2): 可通过 `MOONSHOT_API_KEY` 启用
- Python 微服务: 可通过 `PYTHON_RECOGNITION_URL` 启用（当前未启用）
- Ollama (local): 可通过 `OLLAMA_VISION_MODEL` 启用（当前未启用）
- Mock (final fallback): ✅ 始终可用，已验证正常工作

✅ **已验证功能**:
- `POST /api/uploads` → 文件上传成功
- `POST /api/recognitions` → 异步任务创建成功
- `GET /api/recognitions/:jobId` → 轮询完成，返回 mock 识别结果

## 自动化测试

✅ **回归测试脚本**: `scripts/regression-test.sh`
- 14 个测试用例覆盖核心功能
- 包含健康检查、登录、CRUD、认证、文件上传等
- 最近执行: 2026-04-25，13/14 通过（图片上传测试脚本需修复）

## Recommended Next Steps

1. ~~微信登录集成~~ → Done (v0.6.1)
2. ~~添加第二识别 API 后备~~ → Done (Moonshot + Python)
3. ~~图片压缩选项~~ → Done (v0.6.1)
4. ~~地图热力图~~ → Done (v0.6.1)
5. ~~通知系统~~ → Done (v0.6.1)
6. ~~数据导出~~ → Done (v0.6.1)
7. 生产环境 HTTPS 配置
8. 小程序端到端测试（真机调试）
9. 性能监控和日志系统

1. ✅ **API 错误格式统一化** — 所有端点使用 `sendError(res, error, code)` / `sendSuccess(res, data, statusCode)` 统一格式，前端兼容新旧格式
2. ✅ **前端全局错误提示** — request()/uploadImage() 失败时自动弹出 Toast，app.js 增加 `wx.onError` 全局异常捕获
3. ✅ **HTTPS 与生产配置** — 新建 `deploy/` 目录（nginx.conf, https-server.js, deploy.sh）
4. ✅ **物种知识图谱** — species 表增加 `relations` 字段，详情页新增生态关系图谱卡片（天敌/共生/类似），节点可点击跳转
5. ✅ **上报数据导出 CSV** — 新增 `GET /api/reports/export/csv` 端点，返回含 BOM 的 UTF-8 CSV（Excel 兼容），前端"数据导出"菜单项调用下载
6. ✅ **消息通知系统** — 新增 `notifications` 表，审核通过/驳回时自动创建通知，`GET /api/notifications/:userId` 列表端点（含 `unread` 计数），`POST /api/notifications/:id/read` 和 `POST /api/notifications/:userId/read-all` 标记已读，前端通知页面及未读标记徽章
7. ✅ **Python 识别微服务 (Phase 5)** — 新建 `python-service/` 目录（Flask 应用 + Dockerfile + requirements.txt），支持 JSON/base64 和 multipart 两种输入格式，mock 识别器始终可用，可选 PyTorch ResNet 模型；`docker-compose.yml` 编排 Python 服务；Node.js 新增 `recognizeWithPython` 提供商，配置 `PYTHON_RECOGNITION_URL` 即可加入识别链（Zhipu → Moonshot → Python → Ollama → Mock）

## Completed This Session (v0.5.0)

1. ✅ **登录页** — 新增登录/注册页面，支持账号密码登录注册，首页顶部显示登录状态
2. ✅ **审核驳回原因输入** — 驳回时弹出输入框，支持填写具体驳回理由
3. ✅ **地图 marker 交互** — 点击地图标注点和 callout 均跳转至对应物种详情页
4. ✅ **物种图片升级** — 12 种物种全部替换为从百度百科/Wikimedia Commons 下载的真实照片（非生成图）
   - 来源：百度百科概述图或图册（10种）+ Wikimedia Commons（2种）
5. ✅ **列表分页** — `/api/reports` 支持 `page`/`limit` 参数，返回 `total`/`totalPages` 分页信息
6. ✅ **我的上报用户过滤** — 新增 `GET /api/reports/my` 端点，JWT 鉴权后只返回当前用户的上报记录
7. ✅ **微信登录集成** — 新增 `POST /api/auth/wx-login` 端点，用户表增加 `openid` 字段，前端登录页增加微信一键登录按钮（配置 `WECHAT_APPID`+`WECHAT_SECRET` 后可调用真实微信 API，否则使用 dev 模式，以 code 为 openid）
8. ✅ **Kimi/Moonshot 识别后备** — 新增 Moonshot API 提供商，配置链：智谱 → Moonshot → Ollama(可选) → Mock
9. ✅ **图片压缩选项** — 上报页面增加压缩质量选择器（高清90%/标准60%/极限30%），替代原来固定的 quality=60
10. ✅ **地图热力图** — 地图页增加热力图层，点击热力按钮切换，基于 MapContext.addHeatMap 实现
11. ✅ **详情页信息增强** — 物种表增加 origin（原产地）和 control_methods（防治方法）字段，种子数据全部更新，详情页新增四格信息卡片和防治方法面板 — 地图页增加热力图层，点击热力按钮切换，基于 MapContext.addHeatMap 实现

## Recommended Next Steps

1. ~~Add a second cloud API provider for fallback (e.g., Kimi/Moonshot vision API)~~ → Done
2. ~~Add auth and reviewer roles~~ → Done (JWT + role middleware)
3. ~~Add WeChat login (wx.login) integration for real user auth~~ → Done
4. ~~Add pagination to `/api/reports`~~ → Done
5. ~~Add My Reports page user-scoped filtering~~ → Done
6. Set up proper HTTPS for production
7. ~~Add image compression toggle or quality setting in report page~~ → Done
8. Add species distribution heatmap layer on map page
