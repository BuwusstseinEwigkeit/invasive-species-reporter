# 外来物种哨兵 — 迭代任务清单

> 优先级: P0 = 必须做, P1 = 重要, P2 = 锦上添花, P3 = 未来考虑
> 状态: `[ ]` 待办, `[x]` 已完成, `[blocked]` 阻塞

---

## Phase 1: 核心功能完善 (P0)

- [x] **1.1 我的上报页面用户过滤**
  - 描述: 当前 `我的上报` 页面显示所有上报记录，应只显示当前登录用户的上报
  - 验收: 登录后进入"我的上报"只看到自己的记录
  - 涉及文件: `miniprogram/pages/my-reports/`, `server/lib/store.js`, `server/index.js`

- [x] **1.2 微信登录集成 (wx.login)**
  - 描述: 添加微信一键登录能力，替代当前纯 JWT 注册/登录流程
  - 验收: 小程序可直接用微信授权登录，无需输入账号密码
  - 涉及文件: `miniprogram/pages/login/`, `server/index.js`, `server/lib/store.js`

- [x] **1.3 第二识别 API 后备 (Kimi/Moonshot)**
  - 描述: 在智谱 API 失败时增加 Kimi 视觉 API 作为后备（替代本地 Ollama）
  - 验收: 智谱返回 429/5xx 后自动切换到 Kimi 识别
  - 涉及文件: `server/lib/recognition.js`, `.env`

## Phase 2: 体验优化 (P1)

- [x] **2.1 上报页面图片压缩选项**
  - 描述: 增加图片压缩开关或质量选择，减少上传流量
  - 验收: 开启压缩后图片体积明显减小，识别仍能正常工作
  - 涉及文件: `miniprogram/pages/report/report.js`, `server/lib/upload-store.js`

- [x] **2.2 地图物种分布热力图**
  - 描述: 在地图页叠加热力图层展示物种分布密度
  - 验收: 地图上可见热力渲染，颜色随密度变化
  - 涉及文件: `miniprogram/pages/map/map.js`, `server/index.js`

- [x] **2.3 详情页物种危害信息增强**
  - 描述: 展示更丰富的物种信息（原产地、入侵等级、生态危害、防治方法）
  - 验收: 从详情页可查看完整的物种档案卡片
  - 涉及文件: `miniprogram/pages/detail/`, `server/index.js`, `server/lib/store.js`

## Phase 3: 系统健壮性 (P1)

- [x] **3.1 API 错误处理统一化**
  - 描述: 所有 API 端点返回统一的错误格式 `{ success: false, error: string, code: number }`
  - 验收: 任意无效请求都返回一致错误结构，前端可统一处理
  - 涉及文件: `server/index.js`, `server/lib/`

- [x] **3.2 前端全局错误提示**
  - 描述: 网络请求失败时统一弹出 Toast 或提示，而非静默失败
  - 验收: 断网/API 错误时用户能看到友好提示
  - 涉及文件: `miniprogram/utils/api.js`, `miniprogram/app.js`

- [x] **3.3 HTTPS 与生产配置**
  - 描述: 准备生产环境的 HTTPS 证书配置和部署脚本
  - 验收: 提供可用的 HTTPS 启动脚本和 nginx 配置参考
  - 涉及文件: 新建 `deploy/` 目录

## Phase 4: 扩展功能 (P2)

- [x] **4.1 物种知识图谱**
  - 描述: 在详情页展示物种的生态关系图谱（天敌、共生、扩散路径）
  - 验收: 图谱可视化展示，节点可点击跳转
  - 涉及文件: `miniprogram/pages/detail/`

- [x] **4.2 上报数据导出**
  - 描述: 支持将审核通过的上报数据导出为 CSV/Excel
  - 验收: 点击导出后下载结构化数据文件
  - 涉及文件: `server/index.js`, `server/lib/store.js`

- [x] **4.3 消息通知系统**
  - 描述: 审核状态变更时通知用户（审核通过/驳回）
  - 验收: 用户登录后能看到通知列表，有未读标记
  - 涉及文件: `miniprogram/pages/profile/`, `server/index.js`

## Phase 5: Python 识别引擎整合 (P3)

- [x] **5.1 Python 识别微服务基础架构**
  - 描述: 为 Python 识别引擎搭建 Docker 开发环境
  - 验收: Docker Compose 一键启动 Python 识别服务

- [x] **5.2 Node.js ↔ Python 服务集成**
  - 描述: Node.js 网关通过 HTTP 调用 Python 识别微服务
  - 验收: 图片识别请求可以路由到 Python 服务

## Phase 6: 安全修复 + UX 优化 + 工程改进 (P0/P1) — v0.7.0

- [x] **6.1 权限漏洞修复** — 积分操纵/匿名上报/购买记录泄露/硬编码凭据 4 个安全漏洞全部修复
- [x] **6.2 UX 优化** — 登录拦截/GPS 快捷定位/压缩选项隐藏/callout 点击展开/状态动画/头像并发下载
- [x] **6.3 ID 碰撞修复** — 所有 ID 生成改用 crypto.randomUUID()
- [x] **6.4 内存泄漏修复** — upload-store 和 recognition-jobs 增加 TTL 定时清理
- [x] **6.5 安全测试** — 新增 tests/security.test.js，22 个测试用例

## Phase 7: 工程重构 (P1) — 待开始

- [ ] **7.1 database.js 拆分** — 将 1300+ 行的 God Object 拆分为 db-schema.js / db-reports.js / db-users.js / db-shop.js
- [ ] **7.2 store.js 重构** — 消除纯透传层，将 ensureInitialized 逻辑移入 database.js 懒初始化
- [ ] **7.3 积分系统整理** — 审查 points 表 vs user_credit 表的职责边界，消除冗余
- [ ] **7.4 测试覆盖扩充** — 补充路由层单元测试（商城、通知、排行榜）+ 新模块专属单测（`tests/points-ledger.test.js` 覆盖 award/purchase 两条路径、`tests/report-submission.test.js` 覆盖限流/重复图片/降级路径）

## Phase 8: 运维就绪 (P2) — 待开始

- [ ] **8.1 PM2 进程管理** — 添加 ecosystem.config.js，支持崩溃重启
- [ ] **8.2 SQLite 备份策略** — 定时备份脚本 + 恢复文档
- [ ] **8.3 图片存储迁移** — 迁移到腾讯云 COS / 阿里云 OSS
- [ ] **8.4 CI/CD 自动化** — GitHub Actions 自动运行测试 + 部署

---

## 工作进度

**当前迭代轮次**: 2  
**最后更新**: 2026-05-02  
**当前活跃任务**: 无（Phase 6 全部完成）

### 完成记录

| 日期 | 完成任务 | 备注 |
|------|---------|------|
| 2026-04-25 | 1.1 我的上报页面用户过滤 | 后端新增 `/api/reports/my` 端点（authRequired），前端改用 `api.getMyReports()` |
| 2026-04-25 | 1.2 微信登录集成 | 后端新增 `/api/auth/wx-login`，前端登录页增加微信一键登录按钮，用户表增加 openid 字段 |
| 2026-04-25 | 1.3 Kimi/Moonshot 识别后备 | 新增 Moonshot API 提供商，配置链：智谱 → Moonshot → Ollama(可选) → Mock |
| 2026-04-25 | 2.1 图片压缩选项 | 上报页面增加压缩质量选择器（高清/标准/极限），替代固定 quality=60 |
| 2026-04-25 | 2.2 地图热力图 | 地图页增加热力图层，基于经纬度聚合显示分布密度 |
| 2026-04-25 | 2.3 详情页信息增强 | 物种表增加 origin/control_methods 字段，详情页新增信息网格（原产地/入侵等级）和防治方法折叠面板 |
| 2026-04-25 | 3.1 API 错误格式统一化 | 所有错误响应改为 {success,false,error,code} 格式，新增 sendError/sendSuccess 助手函数，前端同时支持新旧格式 |
| 2026-04-25 | 3.2 前端全局错误提示 | request()/uploadImage() 失败时自动弹出 Toast，app.js 增加 wx.onError 全局异常捕获 |
| 2026-04-25 | 3.3 HTTPS 与生产配置 | 新建 deploy/ 目录，包含 nginx.conf（HTTPS反向代理）、https-server.js（本地HTTPS测试）、deploy.sh（自动部署脚本）|
| 2026-04-25 | 4.1 物种知识图谱 | species 表增加 relations 字段，详情页新增生态关系图谱卡片（天敌/共生/类似），节点可点击跳转 |
| 2026-04-25 | 4.2 上报数据导出 | 新增 `GET /api/reports/export/csv` 端点返回含 BOM 的 UTF-8 CSV，前端"数据导出"菜单项下载 |
| 2026-04-25 | 4.3 消息通知系统 | 新增 notifications 表，审核通过/驳回时自动创建通知，新增通知页面及未读标记 |
| 2026-04-25 | 5.1 Python 微服务 | 新建 python-service/ 目录，含 Flask 应用、Dockerfile、requirements.txt；docker-compose.yml 编排 Python 服务 |
| 2026-04-25 | 5.2 Node.js↔Python 集成 | 新增 recognizeWithPython 提供商，JSON/base64 方式调用 Python 服务，配置 PYTHON_RECOGNITION_URL 即可启用 |
| 2026-05-02 | 6.1 权限漏洞修复 | 积分操纵/匿名上报/购买记录泄露/硬编码凭据 4 个 🔴 漏洞 + 错误脱敏 + 前端凭据移除 |
| 2026-05-02 | 6.2 UX 优化 | 登录拦截、GPS 快捷定位、压缩选项隐藏、callout BYCLICK、状态动画、头像并发下载 |
| 2026-05-02 | 6.3 ID 碰撞修复 | report/user ID 从 Date.now() 改为 crypto.randomUUID() |
| 2026-05-02 | 6.4 内存泄漏修复 | upload-store (1h TTL) 和 recognition-jobs (2h TTL) 定时清理 |
| 2026-05-02 | 6.5 安全测试 | tests/security.test.js 22 个用例覆盖认证、权限、隐私、ID 唯一性 |
