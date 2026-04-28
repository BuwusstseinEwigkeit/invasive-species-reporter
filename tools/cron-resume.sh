#!/bin/bash
# =============================================================================
# 外来物种哨兵 — 自动续命脚本
# =============================================================================
# 功能:
#   1. 检测 Claude Code 是否还在运行
#   2. 如果已停止但任务未完成，自动重新启动
#   3. 记录中断和恢复日志
#   4. 支持检查点恢复（从上次中断处继续）
#
# 使用方法:
#   bash cron-resume.sh                    # 检查并恢复
#   bash cron-resume.sh --status           # 只检查状态
#   bash cron-resume.sh --schedule-cron    # 注册到 cron 定时检查
#   bash cron-resume.sh --checkpoint       # 保存当前检查点
# =============================================================================

PROJECT_ROOT="C:/Users/admin/source/repos/invasive-species-reporter"
RESUME_LOG="$PROJECT_ROOT/.resume.log"
CHECKPOINT_FILE="$PROJECT_ROOT/.checkpoint.json"
PID_FILE="/tmp/claude-loop.pid"
LOOP_SCRIPT="$PROJECT_ROOT/tools/loop.sh"

# 确保在正确的目录
cd "$PROJECT_ROOT" 2>/dev/null || {
  echo "[resume] ERROR: Can't find project directory"
  exit 1
}

log() {
  echo "[resume] $(date '+%Y-%m-%d %H:%M:%S') — $*" | tee -a "$RESUME_LOG"
}

# =============================================================================
# 检查点管理
# =============================================================================

save_checkpoint() {
  local task_status=$(grep -E '^\[ \]|^\[x\]|^\[blocked\]' TASK.md 2>/dev/null | head -20)
  local last_task=$(grep -E '^\[x\]' TASK.md 2>/dev/null | tail -1)

  cat > "$CHECKPOINT_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "completed_tasks": $(grep -c '^\[x\]' TASK.md 2>/dev/null || echo 0),
  "pending_tasks": $(grep -c '^\[ \]' TASK.md 2>/dev/null || echo 0),
  "last_completed": "$last_task",
  "loop_running": $(pgrep -f "loop.sh" > /dev/null 2>&1 && echo true || echo false),
  "claude_running": $(pgrep -f "claude" > /dev/null 2>&1 && echo true || echo false)
}
EOF
  log "Checkpoint saved: $CHECKPOINT_FILE"
}

load_checkpoint() {
  if [ -f "$CHECKPOINT_FILE" ]; then
    log "Last checkpoint: $(cat "$CHECKPOINT_FILE" | head -5)"
    return 0
  fi
  log "No checkpoint found."
  return 1
}

# =============================================================================
# 状态检查
# =============================================================================

check_status() {
  local claude_running=false
  local loop_running=false
  local pending=0
  local completed=0

  pgrep -f "claude" > /dev/null 2>&1 && claude_running=true
  pgrep -f "loop.sh" > /dev/null 2>&1 && loop_running=true

  pending=$(grep -c '^\[ \]' TASK.md 2>/dev/null || echo 0)
  completed=$(grep -c '^\[x\]' TASK.md 2>/dev/null || echo 0)

  echo "=== 外来物种哨兵 — 迭代状态 ==="
  echo "Claude Code 运行中: $claude_running"
  echo "Loop 脚本运行中:   $loop_running"
  echo "已完成任务:         $completed"
  echo "待完成任务:         $pending"
  echo "检查点存在:         $( [ -f "$CHECKPOINT_FILE" ] && echo '是' || echo '否' )"

  if [ "$pending" -eq 0 ] && [ "$completed" -gt 0 ]; then
    echo "状态: ✅ 所有任务已完成！"
  elif [ "$claude_running" = true ]; then
    echo "状态: 🔄 正在工作中..."
  elif [ "$loop_running" = true ]; then
    echo "状态: ⏳ Loop 存活，等待下一轮..."
  else
    echo "状态: ⛔ 已停止（$pending 个任务待完成）"
  fi
}

# =============================================================================
# 恢复执行
# =============================================================================

resume() {
  log "Checking if resume is needed..."

  local pending=$(grep -c '^\[ \]' TASK.md 2>/dev/null || echo 0)
  local claude_running=false
  local loop_running=false

  pgrep -f "claude" > /dev/null 2>&1 && claude_running=true
  pgrep -f "loop.sh" > /dev/null 2>&1 && loop_running=true

  # 如果所有任务完成，不需要恢复
  if [ "$pending" -eq 0 ]; then
    log "All tasks completed. No resume needed."
    return 0
  fi

  # 如果 Claude 或 Loop 正在运行，不需要恢复
  if [ "$claude_running" = true ] || [ "$loop_running" = true ]; then
    log "Still running (claude=$claude_running, loop=$loop_running). No resume needed."
    return 0
  fi

  # 需要恢复
  log "⚠️  Claude Code 已停止，但还有 $pending 个任务待完成！"
  log "正在重新启动迭代循环..."

  # 加载检查点
  load_checkpoint

  # 启动循环（后台模式）
  nohup bash "$LOOP_SCRIPT" --daemon > /dev/null 2>&1 &
  local new_pid=$!

  log "✅ 循环已重新启动 (PID: $new_pid)"
  echo "$new_pid" > "$PID_FILE"
}

# =============================================================================
# 注册到 cron（定时自动检查）
# =============================================================================

schedule_cron() {
  local cron_expr="*/15 * * * *"  # 每15分钟检查一次
  local resume_script="cd $PROJECT_ROOT && bash tools/cron-resume.sh --quiet"

  log "Registering cron job: $cron_expr $resume_script"

  # 检查是否已注册
  if crontab -l 2>/dev/null | grep -q "cron-resume.sh"; then
    log "Cron job already registered."
    crontab -l 2>/dev/null | grep "cron-resume"
    return 0
  fi

  # 注册
  (crontab -l 2>/dev/null; echo "$cron_expr bash $PROJECT_ROOT/tools/cron-resume.sh --quiet") | crontab -

  log "✅ Cron job registered (every 15 minutes)"
  log "   To remove: crontab -l | grep -v cron-resume | crontab -"
}

# =============================================================================
# 主逻辑
# =============================================================================

case "${1:-}" in
  --status)
    check_status
    ;;
  --checkpoint)
    save_checkpoint
    ;;
  --schedule-cron)
    schedule_cron
    ;;
  --quiet)
    resume > /dev/null 2>&1
    ;;
  *)
    echo "外来物种哨兵 — 自动续命脚本"
    echo ""
    echo "用法:"
    echo "  bash cron-resume.sh              # 检查并恢复"
    echo "  bash cron-resume.sh --status     # 只查看状态"
    echo "  bash cron-resume.sh --checkpoint # 保存检查点"
    echo "  bash cron-resume.sh --schedule-cron # 注册定时检查"
    echo ""
    check_status
    echo ""
    if [ $# -eq 0 ]; then
      resume
    fi
    ;;
esac
