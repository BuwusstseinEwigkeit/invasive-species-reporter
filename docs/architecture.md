# 系统架构

## 目标

让普通用户在野外发现疑似外来物种时，能够：拍照 → 得到参考结果 → 上报 → 管理员审核 → 在地图上看到自己的发现。叠加积分、徽章、排行榜、商城等运营机制驱动持续参与。

## 核心业务系统（已实现）

### 1. 上报流程
拍照 → 图像送入 5 级 AI 识别降级链返回候选物种 → 用户选择物种并 GPS 打点 → 提交上报 → 管理员审核（approved/rejected）→ 通过后公开展示

### 2. 积分体系
- 初始积分：100
- 上报提交：+5
- 审核通过：+20
- top1 高质量上报（被选为最终物种）：+10 额外奖励
- 驳回：-3
- spam 举报成立：-10
- 积分 < 0 时禁止上报

### 3. 徽章系统（逐级解锁）
| 徽章 | 条件 | 权限 |
|------|------|------|
| newbie | 默认 | 每日 5 条上报 |
| eco_guard | 5 次 approved | 每日 10 条上报 |
| contributor | 20 次 approved | +5 积分质量奖励 |
| expert | 50 次 approved | 可导出数据 |
| species | 发现新物种 | 特殊标识 |

### 4. 三层反作弊
1. **图片 MD5 去重**：同一图片 MD5 7 天内不可重复上报
2. **地理时空去重**：200m 半径 + 12 小时内同区域去重
3. **积分门槛**：积分 < 0 禁止上报

### 5. 排行榜
- 周榜：本周积分变动排行
- 总榜：历史累计积分排行
- 新秀榜：注册 30 天内用户排行

### 6. 积分商城
- 虚拟商品（积分兑换码）：直接发放
- 实物商品（徽章周边）：需填写收货地址，管理员手动发货

### 7. 图像识别
智谱 GLM-4V 视觉模型（主）→ Moonshot/Kimi → Ollama 本地模型 → Python Docker 微服务 → Mock 随机匹配（兜底）。逐级降级，每级结果验证 speciesId 合法性。最终由**管理员人工确认**。

## 模块拆分

### 小程序端（miniprogram/）
- 首页 / 地图 / 上报 / 我的上报 / 已核实记录 / 物种详情 / 审核台 / 排行榜 / 积分商城 / 个人中心 / 通知 / 登录

### API 服务（server/）
- 入口：`index.js`（89行，纯连线：初始化 → 中间件 → 路由 → 错误处理）
- 中间件：`middleware/`（CORS, 限流, 安全头, JWT 认证）
- 路由模块：`routes/`（auth, species, reports, uploads, shop, user, misc）
- Auth：用户名密码登录、微信 wx-login、注册
- Species：列表、详情（含历史上报）
- Reports：列表、我的上报、创建、审核、导出 CSV
- Shop：商品列表、订单创建、订单查询
- User：权限查询、徽章状态
- Notifications：通知列表、已读/全部已读
- Uploads：图片上传（sharp 内容验证，限制 10MB）
- Leaderboard：排行榜

### 数据层（server/lib/）
- `database.js`：SQLite 底层建表 + 种子数据 + 查询封装
- `store.js`：数据访问包装层（调用 database.js）
- `recognition.js`：5 级识别降级链（智谱 GLM-4V → Moonshot/Kimi → Ollama → Python 微服务 → Mock 兜底）
- `recognition-jobs.js`：异步识别任务管理（内存 Map，最多重试 2 次）
- `upload-store.js`：上传文件注册表（内存 Map）
- `helpers.js`：响应工具函数（sendError, sendSuccess, getPublicBaseUrl）

### 测试层（tests/）
- `anti-spam.test.js`：25 个反垃圾机制单元测试（SQLite 内存模式）
- `golden-path.test.js`：15 个集成测试（supertest + 内存 SQLite），覆盖注册→登录→上报→审核→积分→成就 全流程

## 技术决策

- **SQLite**：轻量、零配置、适合个人项目
- **sharp**：图片内容验证（防止恶意文件伪装）
- **JWT**：7 天过期，用于所有需要认证的接口
- **bcrypt**：密码哈希
- **微信 mock 登录**：无 WECHAT_APPID 时用 `dev-{code}` 作为 openid，方便本地开发
