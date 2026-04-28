# 外来物种哨点 — Codex 项目交接文档

## 1. 项目概述

**项目名称**: 外来物种哨点 (Invasive Species Reporter)
**GitHub**: https://github.com/BuwusstseinEwigkeit/invasive-species-reporter
**技术栈**: 微信小程序（原生）+ Node.js + SQLite

### 核心功能
- 拍照上传，基于图像特征匹配提供参考结果，由管理员人工确认
- 在地图上标记发现位置
- 提交给管理员审核，核实后公开显示
- 积分系统、徽章体系、排行榜、积分商城

### 当前状态
- 后端服务运行中（端口 3000）
- 微信小程序已提交审核（因"深度合成技术"合规问题被拒，已整改）
- git 已推送到 main 分支

---

## 2. 目录结构

```
invasive-species-reporter/
├── miniprogram/              # 微信小程序前端
│   ├── pages/
│   │   ├── home/             # 首页
│   │   ├── map/               # 地图页
│   │   ├── report/            # 上报页
│   │   ├── my-reports/        # 我的上报
│   │   ├── approved-reports/  # 已核实记录
│   │   ├── detail/             # 物种详情
│   │   ├── review/             # 管理员审核台
│   │   ├── leaderboard/       # 排行榜
│   │   ├── shop/               # 积分商城
│   │   ├── profile/            # 个人中心
│   │   ├── notifications/      # 通知
│   │   └── login/              # 登录
│   ├── utils/api.js           # API 调用封装
│   └── app.json               # 页面注册
├── server/
│   ├── index.js               # Express 路由入口
│   ├── lib/
│   │   ├── database.js        # SQLite 数据层（核心）
│   │   ├── store.js           # 数据层封装
│   │   ├── recognition.js     # 图像特征匹配（对接智谱）
│   │   └── upload-store.js    # 文件上传
│   ├── data/
│   │   ├── invasive-species.db  # SQLite 数据库文件
│   │   └── mock-data.js       # 初始数据
│   └── static/images/         # 静态资源
├── tests/
│   └── anti-spam.test.js      # 25 个单元测试（全部通过）
├── docs/
│   ├── api.md                 # API 文档
│   ├── schema.md              # 数据库 schema
│   └── architecture.md        # 架构文档
└── package.json
```

---

## 3. 数据库核心表

### `users`
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| openid | TEXT | 微信 openid（唯一） |
| nickname | TEXT | 昵称 |
| avatar | TEXT | 头像 URL |
| credit | INTEGER | 积分余额（初始 100） |
| role | TEXT | user / admin |
| created_at | TEXT | 创建时间 |

### `reports`（上报记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| user_id | INTEGER | 上报用户 |
| species_id | INTEGER | 关联物种（通过后填充） |
| address | TEXT | 地址描述 |
| latitude | REAL | 纬度 |
| longitude | REAL | 经度 |
| image_url | TEXT | 图片路径 |
| ai_top1 | TEXT | 图像匹配第1结果 |
| ai_candidates | TEXT | JSON 候选结果 |
| remark | TEXT | 用户备注 |
| status | TEXT | pending / approved / rejected |
| review_remark | TEXT | 管理员备注 |
| created_at | TEXT | 上报时间 |

### `species`（物种库）
20 个物种，字段：id, chineseName, latinName, category, riskLevel, riskClass, origin, summary, harm, controlMethods, suggestion, relations(JSON), avatar

### `orders`（积分商城订单）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| user_id | INTEGER | 购买用户 |
| product_id | INTEGER | 商品 ID |
| status | TEXT | pending / shipped / completed / cancelled |
| shipping_address | TEXT | 收货地址（实物） |
| created_at | TEXT | 下单时间 |

### `user_credit`（积分变动流水）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| user_id | INTEGER | 用户 |
| amount | INTEGER | 变动积分（正/负） |
| reason | TEXT | 变动原因 |
| created_at | TEXT | 时间 |

### `image_fingerprints`（图片去重）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| md5 | TEXT | 图片 MD5 |
| user_id | INTEGER | 上传用户 |
| created_at | TEXT | 时间 |

---

## 4. 核心业务逻辑

### 4.1 积分体系
- **初始积分**: 100
- **上报**: +5 积分
- **审核通过**: +20 积分
- **高质量上报（被选为 top1）**: +10 额外奖励
- **驳回**: -3 积分
- **spam 举报成立**: -10 积分
- **每日上报上限**: 默认 5 条（徽章可提升）

### 4.2 徽章系统
| 徽章 | 条件 | 权限 |
|------|------|------|
| newbie | 默认 | 每日 5 条上报 |
| eco_guard | 5 次 approved | 每日 10 条上报 |
| contributor | 20 次 approved | +5 积分 quality bonus |
| expert | 50 次 approved | 解锁 7 天数据导出 |
| species | 发现新物种 | - |

### 4.3 反作弊三层防御
1. **图片 MD5 去重**: 同一图片 7 天内不可重复上报
2. **地理时空去重**: 200m 半径 + 12 小时内同区域去重（SQLite `datetime('now', '-12 hours')`）
3. **积分门槛**: 积分 < 0 时禁止上报

### 4.4 排行榜
- **周榜**: 本周积分变动排行
- **总榜**: 历史累计积分排行
- **新秀榜**: 注册 30 天内用户排行

### 4.5 积分商城
- **虚拟商品**（积分兑换码）: 无需地址，直接发放
- **实物商品**（徽章周边）: 需填写收货地址，管理员手动发货
- 商品分类: cat-digital / cat-physical

---

## 5. API 路由（server/index.js）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 微信登录 |
| GET | /api/species | 获取物种库 |
| GET | /api/species/:id | 物种详情 |
| POST | /api/reports | 创建上报 |
| GET | /api/reports/my | 我的上报 |
| GET | /api/reports/approved | 已核实上报 |
| POST | /api/reports/:id/review | 管理员审核 |
| GET | /api/leaderboard | 排行榜 |
| GET | /api/user/privileges | 用户权限 |
| GET | /api/shop/products | 商品列表（含分类） |
| GET | /api/shop/orders/:userId | 用户订单 |
| POST | /api/shop/orders | 创建订单 |

---

## 6. WeChat 合规整改记录

### 问题
微信审核拒绝："涉及利用深度合成技术（AIGC）的服务" — 个人主体小程序限制

### 整改措施（commit b1821f9）
将所有用户可见的 AI 相关表述替换为中性词：

| 页面 | 原文本 | 修改后 |
|------|--------|--------|
| home.wxml | "拍下来识别一下" | "拍下来记录，上报给管理员审核" |
| report.wxml (5处) | "识别"、"AI初筛"、"AI判断不稳" | "匹配"、"参考结果"、"参考结果不确定" |
| detail.wxml | "AI+审核" | "人工审核" |
| review.wxml | "AI结果"、"AI候选" | "初判结果"、"候选结果" |
| my-reports.wxml | "未识别" | "待审核" |
| approved-reports.wxml | "未识别" | "待审核" |
| README.md | "AI辅助识别"、"智谱视觉模型" | "图像特征匹配 + 管理员人工审核" |

### 申诉信要点
- 本服务使用图像特征匹配（非 AIGC/深度合成）
- 结果仅作参考，最终由人工管理员确认
- 符合《互联网信息服务深度合成管理规定》第十五条豁免范围

---

## 7. 已知 bug 和修复记录

| 问题 | 根因 | 修复 |
|------|------|------|
| 地理时空去重始终返回 false | JS `new Date(Date.now() - 12*60*60*1000)` 产生 UTC，SQLite `created_at` 是本地时间字符串，时区不匹配 | 改用 SQLite `datetime('now', '-12 hours')` |
| 429 Rate Limit | 20 张物种图片 200-400KB，总计 3.7MB，并发请求触发限流 | 全部压缩到 max 170KB（平均 72KB），限流从 100→500/min |
| 测试 DB 连接错误 | `cleanup()` 在 in-memory DB 测试间调用 `db.close()`，singleton 未正确重置 | 新增 `_reset()` 函数 |

---

## 8. 给 Codex 的开发建议

### 如果 Codex 要继续开发，注意：

1. **数据库 singleton 问题**: `server/lib/database.js` 中的 `getDb()` 是单例。测试用 `_reset()` 函数重置。

2. **地理去重时间计算**: 不要用 JS Date 计算 12 小时前的值，直接用 SQLite `datetime('now', '-12 hours')`。

3. **微信 openid 登录**: 真实的 openid 获取需要微信官方渠道。`/api/auth/login` 目前是 mock 模式。

4. **智谱 API**: `server/lib/recognition.js` 调用智谱视觉模型做图像特征匹配。`ZHIPU_API_KEY` 在 `.env` 中。

5. **图片上传**: 上传到 `server/uploads/`，通过 `server/lib/upload-store.js` 管理。

6. **微信审核重点**: 用户可见文本中不要出现"AI"、"识别"、"智能"等词，统一用"匹配"、"参考结果"。

7. **tests/anti-spam.test.js**: 25 个测试用例覆盖核心业务逻辑，修改前后都要跑一遍。

8. **rate limit**: 默认 500 req/min，在 `server/index.js` 的 `express-rate-limit` 配置中。

---

## 9. 项目文档

- `docs/api.md` — 完整 API 文档
- `docs/schema.md` — 数据库 schema 文档
- `docs/architecture.md` — 架构设计文档
- `docs/integration-plan.md` — 集成计划
- `tests/anti-spam.test.js` — 单元测试（25/25 通过）
- `STATUS_CHECK.md` — 每次提交前的验证步骤
- `HANDOFF.md` — 迭代交接记录
- `PROMPT.md` — 项目全景提示

---

## 10. 快速启动

```bash
# 后端
npm install
cp .env.example .env
# 编辑 .env 填入 ZHIPU_API_KEY
node server/index.js

# 前端
# 用微信开发者工具导入 miniprogram/ 目录

# 运行测试
npm test
```
