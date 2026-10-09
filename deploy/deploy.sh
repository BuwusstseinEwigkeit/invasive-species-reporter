#!/bin/bash
# 外来物种哨点 — 生产环境部署脚本
# Ubuntu/Debian + Nginx + Node.js 22+
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="invasive-species-reporter"
DEPLOY_DIR="/opt/${APP_NAME}"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"

echo "==> 1. 同步代码"
sudo mkdir -p "$DEPLOY_DIR"
sudo chown "$USER:$USER" "$DEPLOY_DIR"
rsync -av --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='server/data/*.db*' \
  "$PROJECT_DIR/" "$DEPLOY_DIR/"

echo "==> 2. 安装生产依赖"
cd "$DEPLOY_DIR"
npm ci --omit=dev

echo "==> 3. 初始化运行目录与环境变量"
mkdir -p "$DEPLOY_DIR/server/data" "$DEPLOY_DIR/server/uploads"
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  JWT_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
  cat > "$DEPLOY_DIR/.env" <<ENVEOF
PORT=3000
NODE_ENV=production
SERVER_PUBLIC_BASE_URL=https://your-domain.com
TRUST_PROXY=1
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=500
ENABLE_MOCK_RECOGNITION=false
ENABLE_DEV_WX_LOGIN=false
DATABASE_PATH=server/data/invasive-species.db
ALLOWED_ORIGINS=https://your-domain.com
JWT_SECRET=${JWT_SECRET}

# Configure at least one real recognition provider before launch.
ZHIPU_API_KEY=
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
ZHIPU_MODEL=glm-4.6v-flash
ENVEOF
  echo "  已创建 .env，并自动生成 JWT_SECRET。请补齐域名和识别服务密钥。"
fi

sudo chown -R www-data:www-data "$DEPLOY_DIR/server/data" "$DEPLOY_DIR/server/uploads"
sudo chown root:www-data "$DEPLOY_DIR/.env"
sudo chmod 640 "$DEPLOY_DIR/.env"

echo "==> 4. 配置 systemd"
cat | sudo tee "$SERVICE_FILE" > /dev/null <<SERVICEEOF
[Unit]
Description=${APP_NAME} API Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${DEPLOY_DIR}
ExecStart=/usr/bin/node ${DEPLOY_DIR}/server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICEEOF

echo "==> 5. 配置 Nginx"
if [ ! -f "$NGINX_CONF" ]; then
  sudo cp "$PROJECT_DIR/deploy/nginx.conf" "$NGINX_CONF"
  echo "  已复制 Nginx 配置，请替换域名与证书路径。"
fi

if sudo awk '
  /location[[:space:]]+\/uploads\// { in_uploads=1 }
  in_uploads && /alias[[:space:]]|root[[:space:]]/ { insecure=1 }
  in_uploads && /}/ { in_uploads=0 }
  END { exit insecure ? 0 : 1 }
' "$NGINX_CONF"; then
  echo "ERROR: ${NGINX_CONF} 仍直接暴露 /uploads/。这会绕过私有媒体权限。" >&2
  echo "请删除 /uploads/ 的 alias/root 配置，让请求进入 Node.js media route 后再重新部署。" >&2
  exit 1
fi

echo "==> 6. 启动服务"
sudo systemctl daemon-reload
sudo systemctl enable "$APP_NAME"
sudo systemctl restart "$APP_NAME"
sudo systemctl status "$APP_NAME" --no-pager || true

echo
echo "部署文件已就绪。上线前必须确认："
echo "  1. ${DEPLOY_DIR}/.env 中 SERVER_PUBLIC_BASE_URL / ALLOWED_ORIGINS / 识别服务密钥"
echo "  2. ${NGINX_CONF} 中域名和 TLS 证书"
echo "  3. 微信小程序合法请求域名已配置为同一 HTTPS 域名"
echo "  4. sudo journalctl -u ${APP_NAME} -f 检查启动日志"
