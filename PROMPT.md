# 外来物种哨兵 — Claude Code 持续迭代任务定义

> 这是一个主任务定义文件。每次 Claude Code 启动时，先读取本文件了解项目全景和当前目标。
> 然后打开 `TASK.md` 获取具体的可执行任务列表。

---

## 项目概览

**项目名称**: 外来物种哨兵 (Invasive Species Reporter)  
**版本**: v0.6.0  
**技术栈**: 微信小程序 + Node.js/Express + SQLite + 智谱AI视觉识别  
**根目录**: `C:/Users/admin/source/repos/invasive-species-reporter`

**核心功能**:
- 用户上报外来物种线索（拍照 + 定位 + 备注）
- AI 自动识别物种（智谱 GLM-4.6v-flash → Moonshot/Kimi → Ollama → Python → Mock 五级降级链）
- 人工审核流程（审核员驳回/通过）
- 地图可视化展示已审核点位
- 积分/商城/个人中心系统
- JWT 用户认证（注册/登录）

## 当前目标

持续迭代小程序，按优先级逐个实现功能和改进。每次迭代的目标是从 `TASK.md` 中选取**当前最高优先级的未完成任务**，完整实现后更新状态，然后自动进入下一个任务。

## 迭代规则

1. **开始工作前**: 读取 `TASK.md`，找到第一个 `[ ]` 未完成的高优先级任务
2. **每个任务完成后**: 
   - 更新 `TASK.md` 将该任务标记为 `[x]`
   - 在 `docs/archive/HANDOFF.md` 中追加本次完成记录
   - 运行 `STATUS_CHECK.md` 中的验证步骤确认没有破坏既有功能
3. **遇到阻塞**: 在 `TASK.md` 中标记为 `[blocked]` 并写明原因，跳到下一个可做任务
4. **上下文管理**: 复杂任务使用子 Agent（Agent tool）拆分子任务，避免主上下文过载
5. **不要停止**: 除非所有任务都完成或被用户中断，否则不要主动停止工作

## 关键约束

- 保持上传流程不变（multer + disk storage）
- 保持识别结果数据结构不变（matchedSpeciesId, matchedSpeciesName, confidence, summary, topCandidates）
- 保持异步 Job 流程（前端已依赖轮询）
- 数据库 schema 见 `server/lib/database.js` → `initSchema()`
- 不要删除或破坏现有 `.gitignore` 中忽略的数据库文件
- 微信小程序前端在 `miniprogram/` 目录下

## 文件地图

```
./
├── PROMPT.md              ← 本文件（每次循环入口）
├── TASK.md                ← 任务清单（追踪进度）
├── STATUS_CHECK.md        ← 完成度验证清单
├── ITERATION.md           ← 调试历史和架构决策记录
├── .claude/CLAUDE.md      ← Claude 项目级行为指南
│
├── tools/                 ← AI 持续迭代工具链
│   ├── auto-iterate.sh
│   ├── cron-resume.sh
│   └── loop.sh
│
├── miniprogram/           ← 微信小程序前端
│   ├── app.js / app.json / app.wxss
│   └── pages/             ← 12 个页面
│
├── server/                ← Node.js 后端
│   ├── index.js           ← 入口（89行，只做连线）
│   ├── middleware/        ← 中间件（CORS, 限流, 安全头, JWT认证）
│   ├── routes/            ← 路由模块（auth, species, reports, uploads, shop, user, misc）
│   ├── lib/               ← 核心逻辑
│   │   ├── database.js    ← DB 层（schema 定义）
│   │   ├── store.js       ← 数据访问
│   │   ├── recognition.js ← 识别服务链（5级降级）
│   │   ├── recognition-jobs.js ← 异步 Job 管理
│   │   ├── upload-store.js← 文件上传注册表
│   │   └── helpers.js     ← 响应工具函数
│   └── data/              ← 数据库 & 种子数据
│
├── tests/                 ← 测试
│   ├── anti-spam.test.js  ← 25个反垃圾机制测试
│   └── golden-path.test.js← 15个集成测试
│
├── docs/                  ← 设计文档
│   ├── architecture.md
│   ├── schema.md
│   ├── api.md
│   └── integration-plan.md
│
└── package.json
```

## 启动方式

```bash
# 启动后端服务
cd C:/Users/admin/source/repos/invasive-species-reporter
npm start
```

服务运行在 `http://localhost:3000`（见 `.env` 配置）。

---

**记住**: 每次循环开始先读 `TASK.md`，不要在已经完成的任务上重复工作。
