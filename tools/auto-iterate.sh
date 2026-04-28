#!/bin/bash
# =============================================================================
# 外来物种哨兵 — 持续迭代 一键入口
# =============================================================================
# 融合全部五种方法:
#   1. 任务循环 loop.sh
#   2. 子 Agent（写在 .claude/CLAUDE.md 中）
#   3. 自动续命 claude-auto-resume
#   4. 项目管理 PROMPT.md + TASK.md
#   5. 进阶技巧（hooks、plan mode）
#
# 使用方法:
#   bash auto-iterate.sh                 # 完整迭代（前台）
#   bash auto-iterate.sh --daemon        # 后台运行
#   bash auto-iterate.sh --status        # 查看当前迭代状态
#   bash auto-iterate.sh --install       # 安装依赖（claude-auto-resume）
#   bash auto-iterate.sh --check         # 系统健康检查
#   bash auto-iterate.sh --help          # 帮助
# =============================================================================

PROJECT_ROOT="C:/Users/admin/source/repos/invasive-species-reporter"
RESUME_LOG="$PROJECT_ROOT/.resume.log"

cd "$PROJECT_ROOT" || {
  echo "[ERROR] 无法进入项目目录: $PROJECT_ROOT"
  exit 1
}

log() {
  echo "[auto-iterate] $(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$RESUME_LOG"
}

# =============================================================================
# 状态检查
# =============================================================================
show_status() {
  echo ""
  echo "=========================================="
  echo "  外来物种哨兵 — 迭代状态报告"
  echo "=========================================="

  local pending=$(grep -c '^- \[ \]' TASK.md 2>/dev/null || echo 0)
  local completed=$(grep -c '^- \[x\]' TASK.md 2>/dev/null || echo 0)
  local blocked=$(grep -c '^- \[blocked\]' TASK.md 2>/dev/null || echo 0)
  local total=$((pending + completed + blocked))

  echo "  任务总览:"
  echo "    总计:      $total"
  echo "    已完成:    $completed  ✅"
  echo "    待办:      $pending"
  echo "    阻塞:      $blocked"
  echo ""

  if [ "$total" -gt 0 ]; then
    local pct=$((completed * 100 / total))
    echo "  完成进度: $pct%"
    local filled=$((pct / 5))
    local empty=$((20 - filled))
    printf "  ["
    for ((i=0; i<filled; i++)); do printf "█"; done
    for ((i=0; i<empty; i++)); do printf "░"; done
    printf "] %d/%d\n" $completed $total
  fi

  echo ""
  echo "  工具链:"
  echo -n "    claude:           "
  command -v claude &> /dev/null && echo "✅ $(which claude)" || echo "❌ 未安装"
  echo -n "    claude-auto-resume: "
  command -v claude-auto-resume &> /dev/null && echo "✅ $(which claude-auto-resume)" || echo "❌ 未安装"
  echo -n "    loop.sh:          "
  [ -f loop.sh ] && echo "✅" || echo "❌"
  echo -n "    cron-resume.sh:   "
  [ -f cron-resume.sh ] && echo "✅" || echo "❌"

  echo ""
  echo "  最近检查点:"
  if [ -f .checkpoint.json ]; then
    cat .checkpoint.json 2>/dev/null || echo "    无法读取"
  else
    echo "    无"
  fi

  echo ""
  echo "  最近日志:"
  if [ -f "$RESUME_LOG" ]; then
    tail -5 "$RESUME_LOG" 2>/dev/null || echo "    空"
  else
    echo "    无"
  fi

  echo "=========================================="
}

# =============================================================================
# 系统健康检查
# =============================================================================
check_system() {
  echo ""
  echo "=========================================="
  echo "  系统健康检查"
  echo "=========================================="

  local all_ok=true

  echo ""
  echo "--- 项目文件 ---"
  for f in PROMPT.md TASK.md STATUS_CHECK.md loop.sh cron-resume.sh .claude/CLAUDE.md; do
    if [ -f "$f" ]; then
      echo "  ✅ $f"
    else
      echo "  ❌ $f — 缺失"
      all_ok=false
    fi
  done

  echo ""
  echo "--- 工具 ---"
  echo -n "  Claude CLI: "
  if command -v claude &> /dev/null; then
    echo "✅ $(claude --version 2>/dev/null || echo '版本未知')"
  else
    echo "❌ 未安装 (需要 Claude Code CLI)"
    all_ok=false
  fi

  echo -n "  claude-auto-resume: "
  if command -v claude-auto-resume &> /dev/null; then
    echo "✅ v$(claude-auto-resume --version 2>&1 | grep -oP '[\d.]+' || echo '?')"
  else
    echo "⚠️ 未安装 (可选，用于自动续命)"
  fi

  echo ""
  echo "--- 任务状态 ---"
  local pending=$(grep -c '^- \[ \]' TASK.md 2>/dev/null || echo 0)
  echo "  待完成任务: $pending"

  if [ "$all_ok" = true ]; then
    echo ""
    echo "✅ 系统就绪，可以开始迭代！"
  else
    echo ""
    echo "⚠️ 部分组件缺失，请修复后重试。"
  fi
  echo "=========================================="
}

# =============================================================================
# 安装依赖
# =============================================================================
install_deps() {
  echo ""
  echo "=========================================="
  echo "  安装依赖"
  echo "=========================================="

  if command -v claude-auto-resume &> /dev/null; then
    echo "✅ claude-auto-resume 已安装: $(which claude-auto-resume)"
  else
    echo "📦 安装 claude-auto-resume..."
    SRC="/c/Users/admin/source/repos/claude-auto-resume"
    if [ -d "$SRC" ]; then
      cp "$SRC/claude-auto-resume.sh" ~/bin/claude-auto-resume
      chmod +x ~/bin/claude-auto-resume
      cp "$SRC/claude-auto-resume.ps1" ~/bin/
      cp "$SRC/claude-auto-resume.cmd" ~/bin/
      echo "✅ 安装完成: ~/bin/claude-auto-resume"
    else
      echo "❌ 未找到 claude-auto-resume 源码目录"
      echo "   请先克隆: git clone https://github.com/terryso/claude-auto-resume.git"
    fi
  fi

  echo ""
  echo "📦 安装项目依赖..."
  cd "$PROJECT_ROOT" && npm install 2>&1 | tail -5

  echo "=========================================="
}

# =============================================================================
# 主逻辑
# =============================================================================
case "${1:-}" in
  --status|-s)
    show_status
    ;;
  --check|-c)
    check_system
    ;;
  --install|-i)
    install_deps
    ;;
  --daemon|-d)
    log "启动后台迭代模式..."
    bash tools/loop.sh --daemon --max-loops="${MAX_LOOPS:-100}"
    ;;
  --help|-h)
    echo "外来物种哨兵 — 持续迭代系统"
    echo ""
    echo "用法: bash auto-iterate.sh [选项]"
    echo ""
    echo "选项:"
    echo "  (无参数)     启动完整迭代循环（前台）"
    echo "  --daemon     后台运行"
    echo "  --status     查看迭代状态"
    echo "  --check      系统健康检查"
    echo "  --install    安装依赖"
    echo "  --help       显示帮助"
    echo ""
    echo "示例:"
    echo "  bash auto-iterate.sh                    # 前台迭代"
    echo "  bash auto-iterate.sh --daemon           # 后台迭代"
    echo "  bash auto-iterate.sh --status           # 查看进度"
    echo "  bash auto-iterate.sh --check            # 体检"
    ;;
  *)
    echo "=========================================="
    echo "  外来物种哨兵 — 持续迭代系统"
    echo "  融合 任务循环 + 子Agent + 自动续命"
    echo "=========================================="
    echo ""

    # 先做健康检查
    check_system

    echo ""
    echo "🚀 启动迭代循环..."
    echo "   按 Ctrl+C 停止"
    echo "   查看状态: bash auto-iterate.sh --status"
    echo ""

    # 保存检查点
    bash tools/cron-resume.sh --checkpoint 2>/dev/null || true

    # 启动循环
    bash tools/loop.sh "$@"
    ;;
esac
