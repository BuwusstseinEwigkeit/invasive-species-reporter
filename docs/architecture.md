# 系统架构

## 1. 主流程

```text
登录
  ↓
上传图片（鉴权、绑定 userId、sharp 校验与重编码）
  ↓
可选异步识别（job 绑定 userId + fileId）
  ↓
用户补充位置 / 备注 / 可选物种
  ↓
服务端创建 pending 上报
  ↓
reviewer / admin 审核
  ├─ approved → 公开地图/物种历史 + 在事务内结算奖励/信用/通知/成就
  ├─ rejected → 私有可见 + 扣分/扣信用/通知
  └─ spam → 私有可见 + 更高惩罚/通知
```

核心原则是服务端保存证据链。客户端只能提供 `fileId`、`recognitionJobId`、用户选择和地理信息，不能指定可信 AI 结果或服务端图片 URL。

## 2. 数据可见性

- `GET /api/reports`：永远只返回 approved，并移除 userId 等内部字段。
- `GET /api/reports/review-queue`：reviewer/admin 专用 pending 队列。
- `GET /api/reports/my`：当前用户自己的全部状态记录。
- `GET /api/reports/:id`：
  - approved 可公开读取脱敏字段；
  - owner/reviewer/admin 可读取完整记录与审核日志；
  - 其他主体不能读取 pending/rejected/spam。
- `GET /api/species/:id` 的历史记录只包含 approved。
- `/uploads/:fileName` 是状态感知媒体路由：未审核图片只允许 owner/reviewer/admin，approved 图片公开；已设置为头像的媒体作为展示资产公开。

## 3. 审核事务

`database.reviewReport()` 仅允许 `pending` 进入一次审核事务。一个事务内完成：

- report 状态和最终物种
- review log
- 积分变动
- 信用分变动
- 通知
- 新成就

重复审核返回冲突，不再次发放或扣除积分。

## 4. 积分、信用与徽章

- pending：不发放可消费积分
- 奖励有效的 approved：上报入账 +5、审核通过 +20
- 第一份奖励有效的 approved：再加 first_report +20，首次合计 +45
- 高质量 approved：额外 +10
- contributor 高质量加成：额外 +5
- rejected：-3 积分、-3 信用
- spam：-10 积分、-10 信用
- 积分最低为 0

徽章：

- first_report：1 次奖励有效的 approved
- eco_guard：5 次奖励有效的 approved，日额度 10
- contributor：20 次奖励有效的 approved，高质量加成 +5
- expert：50 次奖励有效的 approved，可导出 CSV
- honorary_medal：100 次奖励有效的 approved，显示专家标记

信用 < 60 时每日上报额度覆盖为 2。

## 5. 反作弊

1. 服务端读取上传文件计算 MD5，相同内容 7 天内不能再次创建上报。
2. 地理时空重复记录标记 `points_eligible=0`；记录仍可审核和公开，但不结算正向积分、信用奖励，也不计入徽章进度。
3. 审核积分事件以 user/action/referenceId 做幂等检查。
4. 上传、识别任务与 userId 绑定，跨用户 fileId/jobId 不可使用。
5. 图片在公开服务前由 sharp 重编码，去除 EXIF/GPS。

## 6. 排行榜

- weekly：本周 `points_log.amount` 的正净积分。
- total：当前累计积分。
- newcomer：近 30 天注册用户按当前累计积分。
- 同分共享排名。

## 7. 商城和订单

- 虚拟商品：兑换后生成 purchase。
- 实物商品：兑换与扣分在事务中完成，同时生成 pending order。
- 用户可查看自己的兑换和实物订单。
- admin 可查看全部实物订单并更新履约状态。

## 8. 识别服务

`server/lib/recognition.js` 根据环境变量动态构建链路：

1. Zhipu
2. Ollama
3. Moonshot
4. Python recognition service
5. Mock，仅开发环境默认启用或显式 `ENABLE_MOCK_RECOGNITION=true`

异步 job 位于内存 Map，upload owner 索引也位于内存 Map。服务重启后未提交的 upload/job 需要用户重新上传，这是当前明确保留的运行时限制。

## 9. 前端页面

主要页面：

- home / login
- report / report-detail
- map / detail
- my-reports / approved-reports
- notifications
- review
- leaderboard
- shop / orders
- profile

列表页使用服务端分页或主动拉取全部分页；401 由 API 层统一清 token 并跳转登录。

## 10. 工程

- Node.js/Express
- better-sqlite3
- 原生微信小程序
- Jest + Supertest
- GitHub Actions CI
- Nginx + systemd 生产部署

生产环境必须关闭默认 Mock 识别和开发微信登录回退、使用强 JWT_SECRET，并正确设置受信任反向代理边界。`/uploads/` 必须由 Node.js 媒体路由处理，Nginx 不得用 `alias`/`root` 绕过权限判断。
