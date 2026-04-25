#!/bin/bash
# 外来物种哨兵 — 生产环境部署脚本
# 假设：Ubuntu/Debian + Nginx + Node.js 18+
# 使用方式: bash deploy/deploy.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="invasive-species-reporter"
DEPLOY_DIR="/opt/${APP_NAME}"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"

echo "==> 1. 同步代码"
if [ ! -d "$DEPLOY_DIR" ]; then
  sudo mkdir -p "$DEPLOY_DIR"
  sudo chown "$USER:$USER" "$DEPLOY_DIR"
fi
rsync -av --exclude='node_modules' --exclude='.git' --exclude='server/data/*.db' "$PROJECT_DIR/" "$DEPLOY_DIR/"

echo "==> 2. 安装依赖"
cd "$DEPLOY_DIR"
npm install --production

echo "==> 3. 配置环境变量"
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  cat > "$DEPLOY_DIR/.env" << 'ENVEOF'
PORT=3000
NODE_ENV=production
# 请替换为实际值
SERVER_PUBLIC_BASE_URL=https://your-domain.com
ZHIPU_API_KEY=your_key_here
ENVEOF
  echo "  .env 文件已创建，请编辑并填入实际配置"
fi

echo "==> 4. 配置 systemd 服务"
cat | sudo tee "/etc/systemd/system/${APP_NAME}.service" > /dev/null << SERVICEEOF
[Unit]
Description=${APP_NAME} API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=${DEPLOY_DIR}
ExecStart=/usr/bin/node ${DEPLOY_DIR}/server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICEEOF

echo "==> 5. 配置 Nginx"
if [ -f "$NGINX_CONF" ]; then
  echo "  Nginx 配置已存在，跳过"
else
  sudo cp "$PROJECT_DIR/deploy/nginx.conf" "$NGINX_CONF"
  echo "  Nginx 配置已复制到 $NGINX_CONF"
  echo "  请编辑该文件并替换域名、证书路径等占位符"
fi

echo "==> 6. 启动服务"
sudo systemctl daemon-reload
sudo systemctl enable "${APP_NAME}"
sudo systemctl restart "${APP_NAME}"
sudo systemctl status "${APP_NAME}" --no-pager || true

echo ""
echo "部署完成！后续步骤："
echo "  1. 编辑 ${DEPLOY_DIR}/.env 填入实际配置"
echo "  2. 编辑 ${NGINX_CONF} 设置域名和证书路径"
echo "  3. sudo systemctl restart nginx"
echo "  4. 检查日志: sudo journalctl -u ${APP_NAME} -f"
