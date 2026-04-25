#!/bin/bash
# 外来物种哨兵 - 回归测试脚本
# 用法: bash scripts/regression-test.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# 服务器配置
SERVER_URL="${SERVER_URL:-http://localhost:3000}"
SERVER_PORT="${SERVER_PORT:-3000}"
START_SERVER="${START_SERVER:-false}"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL=0
PASSED=0
FAILED=0

# 日志函数
log_info() { echo -e "${NC}[INFO] $1"; }
log_pass() { echo -e "${GREEN}[PASS] $1${NC}"; }
log_fail() { echo -e "${RED}[FAIL] $1${NC}"; }
log_warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }

# 测试结果记录
test_result() {
  TOTAL=$((TOTAL + 1))
  if [ "$1" = "pass" ]; then
    PASSED=$((PASSED + 1))
    log_pass "TC-$TOTAL: $2"
  else
    FAILED=$((FAILED + 1))
    log_fail "TC-$TOTAL: $2"
    if [ -n "$3" ]; then
      echo -e "       详情: $3"
    fi
  fi
}

# 启动服务器（如需要）
start_server_if_needed() {
  if [ "$START_SERVER" = "true" ]; then
    log_info "启动服务器..."
    cd "$PROJECT_ROOT"
    npm start &
    SERVER_PID=$!
    sleep 5

    # 检查服务器是否启动
    if ! curl -s "$SERVER_URL/health" > /dev/null 2>&1; then
      log_warn "服务器启动失败，尝试端口 3000..."
      SERVER_URL="http://localhost:3000"
      if ! curl -s "$SERVER_URL/health" > /dev/null 2>&1; then
        log_fail "无法连接到服务器"
        exit 1
      fi
    fi
  fi
}

# 等待服务器就绪
wait_for_server() {
  log_info "等待服务器就绪..."
  for i in {1..30}; do
    if curl -s "$SERVER_URL/health" > /dev/null 2>&1; then
      log_info "服务器已就绪"
      return 0
    fi
    sleep 1
  done
  log_fail "服务器无响应"
  exit 1
}

# ==================== 测试用例 ====================

# TC-01: 健康检查
test_health() {
  RESPONSE=$(curl -s "$SERVER_URL/health")
  if echo "$RESPONSE" | grep -q '"status":"ok"'; then
    test_result "pass" "健康检查"
  else
    test_result "fail" "健康检查" "响应: $RESPONSE"
  fi
}

# TC-02: 物种列表
test_species_list() {
  RESPONSE=$(curl -s "$SERVER_URL/api/species")
  if echo "$RESPONSE" | grep -q '"items"'; then
    COUNT=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | wc -l)
    test_result "pass" "物种列表 (共 $COUNT 个物种)"
  else
    test_result "fail" "物种列表" "响应: $RESPONSE"
  fi
}

# TC-03: 上报列表
test_reports_list() {
  RESPONSE=$(curl -s "$SERVER_URL/api/reports")
  if echo "$RESPONSE" | grep -q '"items"'; then
    test_result "pass" "上报列表"
  else
    test_result "fail" "上报列表" "响应: $RESPONSE"
  fi
}

# TC-04: 统计接口
test_stats() {
  RESPONSE=$(curl -s "$SERVER_URL/api/stats")
  if echo "$RESPONSE" | grep -q '"totalReports"'; then
    test_result "pass" "统计接口"
  else
    test_result "fail" "统计接口" "响应: $RESPONSE"
  fi
}

# TC-05: 用户登录
test_login() {
  RESPONSE=$(curl -s -X POST "$SERVER_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"demo","password":"demo123"}')

  if echo "$RESPONSE" | grep -q '"token"'; then
    TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    export TEST_TOKEN="$TOKEN"
    test_result "pass" "用户登录 (token获取成功)"
  else
    test_result "fail" "用户登录" "响应: $RESPONSE"
  fi
}

# TC-06: 我的上报（认证）
test_my_reports_auth() {
  if [ -z "$TEST_TOKEN" ]; then
    test_result "fail" "我的上报(认证)" "无有效token，跳过"
    return
  fi

  RESPONSE=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$SERVER_URL/api/reports/my")
  if echo "$RESPONSE" | grep -q '"items"'; then
    test_result "pass" "我的上报(认证)"
  else
    test_result "fail" "我的上报(认证)" "响应: $RESPONSE"
  fi
}

# TC-07: 无效token拒绝
test_invalid_token() {
  RESPONSE=$(curl -s -H "Authorization: Bearer invalid_token_12345" "$SERVER_URL/api/reports/my")
  if echo "$RESPONSE" | grep -q '"error"'; then
    test_result "pass" "无效token拒绝"
  else
    test_result "fail" "无效token拒绝" "响应: $RESPONSE"
  fi
}

# TC-08: 物种详情
test_species_detail() {
  SPECIES_ID=$(curl -s "$SERVER_URL/api/species" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -z "$SPECIES_ID" ]; then
    test_result "fail" "物种详情" "无法获取物种ID"
    return
  fi

  RESPONSE=$(curl -s "$SERVER_URL/api/species/$SPECIES_ID")
  if echo "$RESPONSE" | grep -q '"item"'; then
    test_result "pass" "物种详情 (ID: $SPECIES_ID)"
  else
    test_result "fail" "物种详情" "响应: $RESPONSE"
  fi
}

# TC-09: 上报分页
test_reports_pagination() {
  RESPONSE=$(curl -s "$SERVER_URL/api/reports?page=1&limit=2")
  if echo "$RESPONSE" | grep -q '"total"' && echo "$RESPONSE" | grep -q '"totalPages"'; then
    test_result "pass" "上报分页"
  else
    test_result "fail" "上报分页" "响应: $RESPONSE"
  fi
}

# TC-10: 积分查询
test_points() {
  # 先登录获取用户ID
  LOGIN_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"demo","password":"demo123"}')

  USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$USER_ID" ]; then
    test_result "fail" "积分查询" "无法获取用户ID"
    return
  fi

  RESPONSE=$(curl -s "$SERVER_URL/api/points/$USER_ID")
  if echo "$RESPONSE" | grep -q '"total"'; then
    test_result "pass" "积分查询 (用户: $USER_ID)"
  else
    test_result "fail" "积分查询" "响应: $RESPONSE"
  fi
}

# TC-11: 商店产品列表
test_shop_products() {
  RESPONSE=$(curl -s "$SERVER_URL/api/shop/products")
  if echo "$RESPONSE" | grep -q '"items"'; then
    test_result "pass" "商店产品列表"
  else
    test_result "fail" "商店产品列表" "响应: $RESPONSE"
  fi
}

# TC-12: CSV导出端点
test_csv_export() {
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/api/reports/export/csv")
  if [ "$RESPONSE" = "200" ]; then
    test_result "pass" "CSV导出端点"
  else
    test_result "fail" "CSV导出端点" "HTTP状态: $RESPONSE"
  fi
}

# TC-13: 图片上传
test_image_upload() {
  # 创建测试图片到项目目录（不会被 git 跟踪）
  # 使用绝对路径确保兼容性
  local TEST_IMAGE="C:/Users/admin/source/repos/invasive-species-reporter/test_upload.png"

  # 使用 Node.js 创建有效 PNG 图片
  node -e "
const fs = require('fs');
const pngData = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9C, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE,
  0xD4, 0xEF, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);
fs.writeFileSync('C:/Users/admin/source/repos/invasive-species-reporter/test_upload.png', pngData);
"

  if [ ! -f "$TEST_IMAGE" ]; then
    test_result "fail" "图片上传" "测试图片创建失败"
    return
  fi

  RESPONSE=$(curl -s -X POST "$SERVER_URL/api/uploads" -F "image=@$TEST_IMAGE")

  # 清理
  rm -f "$TEST_IMAGE"

  if echo "$RESPONSE" | grep -q '"fileId"'; then
    test_result "pass" "图片上传"
  else
    test_result "fail" "图片上传" "响应: $RESPONSE"
  fi
}

# TC-14: 通知列表（需要认证）
test_notifications() {
  if [ -z "$TEST_TOKEN" ]; then
    test_result "fail" "通知列表" "无有效token，跳过"
    return
  fi

  # 获取用户ID
  LOGIN_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"demo","password":"demo123"}')
  USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$USER_ID" ]; then
    test_result "fail" "通知列表" "无法获取用户ID"
    return
  fi

  RESPONSE=$(curl -s -H "Authorization: Bearer $TEST_TOKEN" "$SERVER_URL/api/notifications/$USER_ID")
  if echo "$RESPONSE" | grep -q '"items"'; then
    test_result "pass" "通知列表"
  else
    test_result "fail" "通知列表" "响应: $RESPONSE"
  fi
}

# ==================== 主流程 ====================

main() {
  echo "========================================"
  echo "外来物种哨兵 - 回归测试"
  echo "========================================"
  echo "服务器: $SERVER_URL"
  echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "========================================"
  echo ""

  # 启动服务器（如需要）
  start_server_if_needed

  # 等待服务器就绪
  wait_for_server

  echo ""
  log_info "开始运行测试用例..."
  echo ""

  # 运行测试
  test_health
  test_species_list
  test_reports_list
  test_stats
  test_login
  test_my_reports_auth
  test_invalid_token
  test_species_detail
  test_reports_pagination
  test_points
  test_shop_products
  test_csv_export
  test_image_upload
  test_notifications

  echo ""
  echo "========================================"
  echo "测试结果汇总"
  echo "========================================"
  echo "总计: $TOTAL"
  echo -e "通过: ${GREEN}$PASSED${NC}"
  echo -e "失败: ${RED}$FAILED${NC}"
  echo "========================================"

  if [ $FAILED -gt 0 ]; then
    echo -e "${RED}注意: 有 $FAILED 个测试失败${NC}"
    exit 1
  else
    echo -e "${GREEN}所有测试通过!${NC}"
    exit 0
  fi
}

# 运行
main