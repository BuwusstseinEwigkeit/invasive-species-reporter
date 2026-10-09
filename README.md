# 外来物种哨点

原生微信小程序 + Node.js/Express/SQLite 的外来物种线索上报系统。当前版本：**v0.8.0**。

## 已实现闭环

用户侧：

- 登录 / 注册 / 微信登录
- 图片上传并服务端重编码，自动去除 EXIF/GPS 元数据
- 异步 AI 识别，可在识别未完成时提交人工审核
- 上报位置、备注、用户选择物种
- 我的上报、上报详情、审核意见、通知跳转
- 已核实记录、地图标记、热力图与物种筛选
- 积分、信用分、徽章、排行榜
- 积分商城、兑换记录、实物订单
- 具备权限时导出已核实 CSV

审核 / 管理侧：

- reviewer/admin 专用待审核队列
- approved / rejected / spam 三种审核动作
- 审核操作仅允许 pending 状态执行，并在单个 SQLite 事务内完成状态、积分、信用分、通知和成就副作用
- admin 实物订单履约台，可推进 processing / shipped / completed / cancelled

## 可信边界

上报接口不接受客户端伪造的图片 URL、AI 结果或置信度。

标准链路：

1. 登录用户调用 `POST /api/uploads`，服务端保存 owner，并把图片重新编码为 JPEG。
2. 可选调用 `POST /api/recognitions`，识别任务与当前用户、fileId 绑定。
3. `POST /api/reports` 只接收 `fileId`、可选 `recognitionJobId`、位置、备注和用户选择物种。
4. 服务端根据 upload / recognition 记录生成 `imageUrl`、`aiTop1`、`aiScore`、`aiCandidates`。
5. 待审核、驳回和 spam 记录不进入公开列表或公开物种历史。
6. 上传图片走状态感知媒体路由，未 approved 前仅 owner/reviewer/admin 可读取，审核通过后才公开。

识别提供商按已配置项顺序尝试：**Zhipu → Ollama → Moonshot → Python**。Mock 仅在开发环境默认允许，生产环境必须显式开启 `ENABLE_MOCK_RECOGNITION=true` 才会参与，识别结果同时携带 `provider` 和 `isMock`。

## 业务规则

积分：

- pending 阶段不发放可消费积分，避免未审核线索刷分。
- 奖励有效的 approved 上报在审核事务内结算：上报入账 +5、审核通过 +20。
- 第一份奖励有效的 approved 上报额外 +20，因此首次完整结算为 +45。
- 高质量审核通过：额外 +10。
- contributor 徽章用户的高质量奖励再 +5。
- rejected：-3 积分、-3 信用。
- spam：-10 积分、-10 信用。
- 积分不会降到 0 以下。

徽章与权限：

| 徽章 | 条件 | 权限 |
| --- | --- | --- |
| first_report | 1 次奖励有效的 approved | 成就标记 |
| eco_guard | 5 次奖励有效的 approved | 日上报额度 10 |
| contributor | 20 次奖励有效的 approved | 高质量额外 +5 |
| expert | 50 次奖励有效的 approved | CSV 导出 |
| honorary_medal | 100 次奖励有效的 approved | 专家标记 |

信用分低于 60 时，实际每日上报额度统一降为 2。

反作弊：

- 同一图片内容 MD5 7 天内拒绝重复上报。
- 地理时空重复线索可创建记录，但其 `points_eligible=0`，审核通过也不重复发放正向积分或信用奖励。
- 审核积分按 `user + action + referenceId` 做幂等保护。
- reviewer/admin 的角色权限由数据库实时校验，不只信任 JWT 中的 role。

## 运行

要求 Node.js 22+。

```bash
npm ci
cp .env.example .env
# 至少配置：
# JWT_SECRET=<32 字符以上随机字符串>
# 可选配置 ADMIN_PASS / REVIEWER_PASS / DEMO_PASS
# 配置至少一个真实识别服务
npm start
```

微信开发者工具导入 `miniprogram/`。API 地址优先读取本地 storage 的 `server_base_url`，其次读取 `miniprogram/config.json` 的 `setting.SERVER_BASE_URL`；两者都为空时，开发者工具回退到 `http://127.0.0.1:3000`。真机/生产环境应把 `SERVER_BASE_URL` 配为可访问的 HTTPS 域名，不要提交个人局域网 IP。

生产部署参考 `deploy/deploy.sh` 和 `deploy/nginx.conf`。生产环境建议：

- `NODE_ENV=production`
- `ENABLE_MOCK_RECOGNITION=false`
- `ENABLE_DEV_WX_LOGIN=false`
- Nginx 反代时 `TRUST_PROXY=1`
- 配置 HTTPS 域名、`SERVER_PUBLIC_BASE_URL` 与 `ALLOWED_ORIGINS`
- 配置真实微信 AppID/Secret 和至少一个真实识别服务
- 不要在 Nginx 中对 `/uploads/` 配置 `alias`/`root`，媒体必须进入 Node.js 权限路由

## 测试

```bash
npm run check:js
npm run test:ci
```

当前集成与安全回归共 **58 个测试**，覆盖正常上报闭环、pending 零积分、spam 防刷分、地理重复不奖励、认证/角色、上传与头像所有权、客户端 AI 字段伪造、公开数据边界、重复审核幂等、通知 IDOR、CSV 权限、7 天图片去重、12 小时时空边界、生产 CORS/no-Origin 行为和管理员订单履约。

GitHub Actions 工作流位于 `.github/workflows/ci.yml`。

## 说明

本项目的识别结果是线索辅助信息，最终物种结论由人工审核确认，不构成官方生物鉴定结论。
