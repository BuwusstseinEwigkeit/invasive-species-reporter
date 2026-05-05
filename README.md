# 外来物种哨兵

微信小程序，用于记录和上报身边的外来入侵物种。

## 功能

- 拍照上传，AI 五级降级链识别（智谱 GLM-4V → Kimi → Ollama → Python → Mock），管理员人工确认
- 地图标记发现位置 + 热力图展示物种分布
- 积分体系 + 五级徽章（newbie → eco_guard → contributor → expert → species）
- 排行榜（周榜/总榜/新秀榜）
- 积分商城（虚拟+实物）
- 消息通知系统
- 物种知识图谱（天敌/共生/扩散路径）
- 数据导出 CSV
- 三层反作弊（MD5 去重 + 地理时空去重 + 积分门槛）

## 技术栈

- 微信小程序（原生）
- Node.js/Express + SQLite
- JWT 认证（注册/登录/微信 wx-login）
- 智谱 AI 视觉识别 + Kimi 后备

## 说明

个人项目，识别结果仅供参考，不构成任何官方认定。

## 运行

```bash
npm install
cp .env.example .env
# 编辑 .env 填入：
# - ZHIPU_API_KEY（智谱 AI 识别）
# - JWT_SECRET（至少 32 字符的随机字符串）
# - ADMIN_PASS / REVIEWER_PASS / DEMO_PASS（种子账号密码）
node server/index.js
```

然后用微信开发者工具导入 `miniprogram/` 目录。

## 测试

```bash
npx jest --forceExit
```

62 个测试用例覆盖：反垃圾机制（25）、集成流程（15）、安全权限（22）。
