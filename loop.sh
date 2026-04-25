#!/bin/bash
# =============================================================================
# 外来物种哨兵 — 持续迭代 + 自动续命 整合循环脚本
# =============================================================================
# 使用方法:
#   bash loop.sh                          # 前台运行
#   bash loop.sh --once                   # 只执行一轮
#   bash loop.sh --daemon                 # 后台运行
#   bash loop.sh --max-loops 10           # 最多 10 轮
#
# 流程:
#   1. 检查 TASK.md，找下一个任务
#   2. 检查 Claude 使用额度（如果安装了 claude-auto-resume）
#   3. 用 --dangerously-skip-permissions 启动 Claude 做实际工作
#   4. 完成后验证，继续下一轮
# =============================================================================

set -e

PROJECT_ROOT="C:/Users/admin/source/repos/invasive-species-reporter"
LOOP_LOG="$PROJECT_ROOT/.loop.log"
MAX_LOOPS=${MAX_LOOPS:-100}
LOOP_COUNT=0
ONCE_MODE=false
DAEMON_MODE=false

# 解析参数
for arg in "$@"; do
  case "$arg" in
    --once) ONCE_MODE=true ;;
    --daemon) DAEMON_MODE=true ;;
    --max-loops=*) MAX_LOOPS="${arg#*=}" ;;
  esac
done

# 后台模式
if [ "$DAEMON_MODE" = true ]; then
  echo "[loop] 启动后台模式 (PID: $$)"
  nohup bash "$0" --max-loops="$MAX_LOOPS" > "$LOOP_LOG" 2>&1 &
  echo "[loop] 后台进程 PID: $!"
  echo "[loop] 日志: $LOOP_LOG"
  exit 0
fi

cd "$PROJECT_ROOT"

echo "=========================================="
echo "  Claude Code 持续迭代循环"
echo "  项目: 外来物种哨兵"
echo "  位置: $PROJECT_ROOT"
echo "  --dangerously-skip-permissions: ✅ 启用"
echo "  最大循环数: $MAX_LOOPS"
echo "  开始时间: $(date)"
echo "=========================================="

while [ $LOOP_COUNT -lt $MAX_LOOPS ]; do
  LOOP_COUNT=$((LOOP_COUNT + 1))

  echo ""
  echo "--- 迭代轮次 #$LOOP_COUNT ---"
  echo "时间: $(date)"

  # ===== Step 1: 检查任务状态 =====
  # 注意: grep 使用 '^- \[ \]' 只匹配以 "- [" 开头的任务行，排除文件头部的格式说明行
  echo "[loop] 检查剩余任务..."
  PENDING_TASKS=$(grep -c '^- \[ \]' "TASK.md" 2>/dev/null || echo "0")
  BLOCKED_TASKS=$(grep -c '^- \[blocked\]' "TASK.md" 2>/dev/null || echo "0")
  echo "[loop] 待办: $PENDING_TASKS | 阻塞: $BLOCKED_TASKS"

  if [ "$PENDING_TASKS" -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "  所有任务已完成！循环结束。"
    echo "  完成时间: $(date)"
    echo "=========================================="
    break
  fi

  # ===== Step 2: 使用额度检查（如果安装了 claude-auto-resume） =====
  if command -v claude-auto-resume &> /dev/null; then
    echo "[loop] 检查 Claude 使用额度..."
    # 只做 check，不做实际工作。如果有额度限制，auto-resume 会等待直到恢复
    # 用 --execute 模式 + 无害命令来触发额度检查
    claude-auto-resume --execute "echo [loop] 额度正常，继续执行" 2>&1
    echo "[loop] 额度检查完成"
  else
    echo "[loop] claude-auto-resume 未安装，跳过额度检查"
  fi

  # ===== Step 3: 执行 Claude Code 迭代工作 =====
  echo "[loop] 启动 Claude Code (--dangerously-skip-permissions)..."
  echo ""

  # 构建迭代提示词
  ITERATION_PROMPT=$(cat << 'PROMPT_EOF'
你正在持续迭代改进"外来物种哨兵"微信小程序。
项目根目录: C:/Users/admin/source/repos/invasive-species-reporter

请依次执行以下步骤，不要跳过：

1. 先读取 PROMPT.md 了解项目全景
2. 打开 TASK.md 找到当前最高优先级且标记为 [ ] 的未完成的任务
3. 深入了解相关代码后，实现这个任务
4. 完成后把 TASK.md 中的对应项从 [ ] 改为 [x]
5. 追加记录到 HANDOFF.md 的"完成记录"表格中
6. 检查 STATUS_CHECK.md 中的验证步骤，确保没有破坏既有功能
7. 如果还有未完成的 [ ] 任务，继续做下一个

重要规则：
- 不要询问"接下来做什么"，直接继续工作
- 如果所有任务都完成了，输出 'ALL_TASKS_COMPLETE' 并退出
- 遇到阻塞时，在 TASK.md 中将该任务标记为 [blocked] 并写明原因，然后跳下一个
PROMPT_EOF
)

  claude --dangerously-skip-permissions -p "$ITERATION_PROMPT" 2>&1 | tee -a .loop_claude.log
  CLAUDE_EXIT=$?
  # 检查 Claude 的输出中是否包含 ALL_TASKS_COMPLETE
  if tail -20 .loop_claude.log 2>/dev/null | grep -q "ALL_TASKS_COMPLETE"; then
    echo ""
    echo "[loop] Claude 报告所有任务已完成 (ALL_TASKS_COMPLETE)"
  fi

  echo ""
  echo "[loop] Claude Code 退出码: $CLAUDE_EXIT"

  # ===== Step 4: 检查完成状态 =====
  PENDING_AFTER=$(grep -c '^- \[ \]' "TASK.md" 2>/dev/null || echo "0")

  if [ "$PENDING_AFTER" -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "  Claude 已完成所有任务！循环结束。"
    echo "=========================================="
    break
  fi

  # ===== Step 5: 检查阻塞 =====
  if grep -q '^- \[blocked\]' "TASK.md" 2>/dev/null; then
    echo "[loop] ⚠️ 发现阻塞任务，需要人工介入处理。"
  fi

  if [ "$ONCE_MODE" = true ]; then
    echo "[loop] --once 模式，单轮执行完毕。"
    break
  fi

  # ===== Step 6: 保存检查点 =====
  bash cron-resume.sh --checkpoint 2>/dev/null || true

  echo "[loop] 等待 5 秒后开始下一轮..."
  sleep 5
done

if [ $LOOP_COUNT -ge $MAX_LOOPS ]; then
  echo "[loop] 达到最大循环数 ($MAX_LOOPS)，退出。"
fi

echo ""
echo "=========================================="
echo "  循环概要"
echo "  总轮次: $LOOP_COUNT"
echo "  结束时间: $(date)"
echo "=========================================="
