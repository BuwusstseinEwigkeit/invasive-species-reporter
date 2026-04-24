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

## Completed This Session (v0.5.0)

1. ✅ **登录页** — 新增登录/注册页面，支持账号密码登录注册，首页顶部显示登录状态
2. ✅ **审核驳回原因输入** — 驳回时弹出输入框，支持填写具体驳回理由
3. ✅ **地图 marker 交互** — 点击地图标注点和 callout 均跳转至对应物种详情页
4. ✅ **物种图片升级** — 12 种物种全部替换为从百度百科/Wikimedia Commons 下载的真实照片（非生成图）
   - 来源：百度百科概述图或图册（10种）+ Wikimedia Commons（2种）
5. ✅ **列表分页** — `/api/reports` 支持 `page`/`limit` 参数，返回 `total`/`totalPages` 分页信息

## Recommended Next Steps

1. Add a second cloud API provider for fallback (e.g., Kimi/Moonshot vision API) instead of local Ollama
2. ~~Add auth and reviewer roles~~ → Done (JWT + role middleware)
3. Add WeChat login (wx.login) integration for real user auth
4. ~~Add pagination to `/api/reports`~~ → Done
5. Set up proper HTTPS for production
6. Add My Reports page user-scoped filtering (currently shows all, not user-specific)
7. Add image compression toggle or quality setting in report page
8. Add species distribution heatmap layer on map page
