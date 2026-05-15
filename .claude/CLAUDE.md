# Claude Code 项目级行为指南 — 持续迭代模式

## 核心行为

1. **启动时自动读取 PROMPT.md** — 了解项目全景和当前目标
2. **始终从 TASK.md 获取下一个任务** — 不要自行决定做什么，检查 TASK.md
3. **完成一个任务后自动继续下一个** — 不要询问"接下来做什么"，直接做
4. **使用子 Agent 拆分复杂任务** — 当单个任务需要改动超过 3 个文件或涉及不确定方案时，用 Agent tool 进行调研或规划
5. **每次修改后验证** — 运行 `STATUS_CHECK.md` 中的验证步骤
6. **更新 docs/archive/HANDOFF.md** — 每次完成重要进展时追加记录

## 任务执行模式

### 简单任务（改动 ≤3 个文件）
直接在主会话中完成。先读所有相关文件，再修改。

### 复杂任务（改动 >3 个文件或有方案分歧）
1. 用 Agent tool（Explore 类型）调研相关代码
2. 用 Plan mode 设计实现方案
3. 从 TASK.md 中创建子任务条目
4. 逐个实现子任务
5. 集成验证

### 技术债务 / Bug 修复
- 优先修复而不是重写
- 理解 bug 根因后再动手
- 改动最小化

## 已知技术债（已核实）

1. ~~🔴 SQL 注入~~ — 已确认无误判，所有查询均用 `?` 参数化
2. ~~🟢 review_logs 未写入~~ — reviewReport 已写入，无需修复
3. ~~🟡 isDupe 返回值死代码~~ — index.js 独立计算 isDupe，database.js 返回值不影响实际行为
4. ~~🟡 created_at 时区混用~~ — 已修复：所有 `datetime('now')` → `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`，新记录统一 UTC ISO 8601
5. ~~🟡 CSV 导出无 expert 徽章权限校验~~ — 已修复，index.js 已有权限判断
6. ~~🔴 任意用户积分操纵~~ — 已修复：POST /api/points/:userId 增加 userId 校验
7. ~~🔴 未认证可创建上报~~ — 已修复：POST /api/reports 改为 authRequired
8. ~~🔴 购买记录可被他人查看~~ — 已修复：GET /api/shop/purchases/:userId 增加认证+userId校验
9. ~~🔴 硬编码管理员凭据~~ — 已修复：种子账号改为环境变量管理
10. ~~🟡 ID 碰撞风险~~ — 已修复：所有 ID 生成改用 crypto.randomUUID()
11. ~~🟡 内存 Map 无 TTL~~ — 已修复：upload-store 和 recognition-jobs 增加定时清理
12. 🟡 图片去重可绕过：MD5 可通过重命名绕过，pHash 升级方案已设计（blockhash-core + 双key迁移），尚未实现
13. 🟡 geo dedup timezone mismatch：函数内部 now() 已统一 UTC，但 200m/12h 阈值参数需实测验证
14. 🟡 database.js God Object：1300+ 行，建议拆分为 schema + repository 模块（待后续迭代）
15. 🟡 store.js 纯透传层：建议消除或转型为业务服务层

## 上下文管理

- 当会话上下文接近用完时（token 计数高），用 `TASK.md` 保存进度后重启
- 重启后读取 `PROMPT.md` 和 `.claude/CLAUDE.md` 恢复上下文
- 复杂调研始终走子 Agent，不要把大量搜索结果塞进主上下文

## Codex 协作流程（审查模式）

**Token 节约原则（必读）：**
- Codex 只读 handoff diff，不要塞完整代码
- diff 压缩：`git diff --stat` 先看改了哪些文件，再针对高风险文件读 diff
- Codex 回复尽量简短，一条 diff 不超过 3 个问题

**Claude Code 写完代码后：**
1. 追加 `docs/archive/HANDOFF.md` 本次完成记录
2. Codex 读取 `docs/archive/HANDOFF.md` 的最新一节
3. Codex 结合 git diff 做安全/性能/可维护性审查
4. Claude Code 收到反馈后修复

**Handoff 格式（Claude Code 写，Codex 读）：**
```markdown
## 本次完成 [YYYY-MM-DD]
- 完成了：xxx
- 涉及文件：file1.js, file2.js
- 关键逻辑：xxx（供 Codex 重点看）
- 待确认：xxx（有疑问的地方）
```

**Codex 审查关注点（按优先级）：**
1. 安全：SQL注入、XSS、权限绕过
2. 边界：空值/undefined/异常输入处理
3. 性能：N+1 查询、大数据量
4. 可维护：命名清晰、函数不过长

## Claude ↔ Codex 取长补短分工

> **核心原则**：按任务性质分工，不按工具能力分。两边互审，覆盖各自的认知盲区。

### 能力差异（实证总结）

| 维度 | Claude Code 强项 | Codex 强项 |
|------|------------------|------------|
| 上下文 | 长上下文 + 项目记忆（skill / .claude/CLAUDE.md / memory）| 冷启动视角、少历史包袱（读完 skill/HANDOFF/diff 后也能做架构判断，但不会带历史惯性） |
| 改动范围 | 跨多文件、架构判断、新功能编排 | 验收标准清楚、可测试闭环明确的实现/重构 |
| 一致性检查 | 对照项目历史决策、命名风格 | 纯代码细节、边界、异常分支、隐藏行为变更 |
| 共同盲区 | 自己写的代码自己审，看不见思路偏差 | 同上 |

### 分工矩阵（主笔 / 终审）

| 谁主笔 | 谁终审 | 任务类型 | 例子 |
|--------|--------|----------|------|
| **Claude 主笔** | Codex 终审 hidden behavior | 跨模块重构、架构判断、新功能编排、文档/HANDOFF 维护 | 抽 ledger + report-submission 模块（v0.7.1）|
| **Codex 主笔** | Claude 终审项目约定 | 验收明确的风险收束型实现/重构、测试补强、行为不变的模块抽取 | PointsLedger 专属单测、错误脱敏回归测试、移除旧透传层 |
| **Claude 审 Codex** | — | 项目约定一致性（ID 风格、错误响应格式、技术债清单）| ID 用 randomUUID 还是 Date.now |
| **Codex 审 Claude** | — | 纯代码细节、隐藏行为变更、边界条件 | 购买事务有没有重复扣分 |

> **关键洞察**（Codex 反馈采纳）：Codex 的范围不限于"小函数/单测"，只要**验收边界先定清楚**，PointsLedger / ReportSubmission 这种业务模块抽取它也能主笔。

### 互审操作要点

1. **给 Codex 喂 diff + 项目约定速记**（不喂全代码）
   - ID 必须用 `crypto.randomUUID()`
   - 错误响应不回显内部信息（`error.message` 兜底有泄露风险）
   - SQL 必须参数化（已核实，但新代码仍要查）
   - store.js 是纯透传层，不要在它里面加业务逻辑（已知技术债 #15）

2. **Claude 写完后自审一遍再交 Codex**
   - 把"项目一致性"问题自己先过一遍
   - 让 Codex 专注查纯技术问题，省 token

3. **互换主笔避免盲区**
   - 高架构难度 → Claude 主笔（Phase 7.1 拆 database.js）
   - 验收明确的风险收束 → Codex 主笔（Phase 7.4 路由层单测、错误脱敏回归测试）

4. **Codex 主笔时，Claude 必须先定验收边界**
   - 函数签名、返回值结构、副作用清单
   - 测试用例覆盖列表
   - 不能改的项目约定（ID 风格、错误响应、SQL 参数化）

### 案例参考（v0.7.1 重构）

实证 Claude 审查 Codex 改动 7 条发现里：
- #2、#4 依赖项目历史决策（`.claude/CLAUDE.md` 已知技术债 #15、v0.7.0 ID 统一基调）→ **Claude 命中、Codex 单看 diff 易漏**
- #3 错误脱敏回退 → 纯逻辑题，**两边都能查**
- #1 购买事务隐藏行为变更 → **Codex 终审更敏感**（无"我刚写过"的认知盲区）

→ 结论印证：**Claude 看全局、Codex 看局部**，互补而非替代。

## 服务端结构

- `server/index.js` — 入口（89行，纯连线：初始化 → 中间件 → 路由 → 错误处理）
- `server/middleware/` — cors, rate-limit, security, auth
- `server/routes/` — auth, species, reports, uploads, shop, user, misc（按功能拆分）
- `server/lib/` — database, store, recognition, recognition-jobs, upload-store, helpers

## 验证标准

每次提交前必须验证：
1. 后端启动无报错：`npm start`（只检查启动日志，不需要保持运行）
2. API 基础可用性：检查关键端点响应
3. 前端代码无语法错误：JSON 文件格式正确

## 退出条件

只有在以下情况才停止工作：
1. TASK.md 中所有任务都标记为 `[x]`
2. 遇到无法解决的阻塞性问题（需用户决策）
3. 用户明确要求停止
