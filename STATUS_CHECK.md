# 持续迭代 — 完成度验证清单

> 在每次完成一个任务后，运行以下验证步骤确保没有破坏既有功能。
> 这是一个**外部验证系统**，帮助 Claude Code 客观判断任务是否真正完成。

---

## 1. 基础检查

```bash
# 检查依赖是否安装
ls node_modules/.package-lock.json > /dev/null 2>&1 && echo "✅ dependencies installed" || echo "❌ missing dependencies"
```

## 2. 后端启动测试

```bash
# 检查后端能否正常启动（启动后按 Ctrl+C 停止）
cd $PROJECT_ROOT && timeout 5 node server/index.js 2>&1 || true
```
- 期待输出包含 `Server running on port 3000` 或类似启动成功的日志
- 不应有 `Error` / `Cannot` 等未捕获错误

## 3. API 冒烟测试

启动后端后验证：

```bash
# 3a. 健康检查 / 首页
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/

# 3b. 物种列表
curl -s http://localhost:3000/api/species | head -c 200

# 3c. 上报记录列表
curl -s http://localhost:3000/api/reports | head -c 200

# 3d. 统计信息
curl -s http://localhost:3000/api/stats | head -c 200

# 3e. 登录（测试 JWT Auth）
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' | head -c 200
```

**验收标准**:
- 所有端点返回 HTTP 200
- 登录返回包含 `token` 字段的 JSON
- 物种列表返回数组且不为空

## 4. 前端代码检查

```bash
# JSON 文件格式验证
node -e "JSON.parse(require('fs').readFileSync('miniprogram/app.json','utf8'))" && echo "✅ app.json valid"
node -e "JSON.parse(require('fs').readFileSync('miniprogram/project.config.json','utf8'))" && echo "✅ project.config.json valid"

# 验证所有页面的 json 配置文件
for f in miniprogram/pages/*/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "✅ $f"
done
```

## 5. 特定任务验证

在完成特定功能后，补充验证（在 TASK.md 的任务验收标准中定义）。

### 示例：微信登录验证
```
# 验证登录接口存在
curl -s -X POST http://localhost:3000/api/auth/wx-login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code"}' | head -c 200
```

---

## 验证结果记录

| 日期 | 验证项 | 结果 | 备注 |
|------|--------|------|------|
| 2026-04-25 | 依赖检查, 后端启动, API冒烟测试, 前端JSON验证 | ✅ 全部通过 | 所有 TASK.md 任务已完成，服务运行正常 |
| 2026-04-25 | 依赖检查, 后端启动, API冒烟测试, 前端JSON验证 | ✅ 全部通过 | 全量验证 — 所有任务均已完成，项目稳定 |

## 使用方式

```bash
# 设置项目根目录
export PROJECT_ROOT="C:/Users/admin/source/repos/invasive-species-reporter"

# 逐项手动运行验证，或使用自动化脚本
bash STATUS_CHECK.md  # 注意：本文件不是可执行脚本，是参考清单
```

> 提示: 可以将这些验证步骤集成到 Git hooks 中（pre-commit 或 pre-push）实现自动验证。
