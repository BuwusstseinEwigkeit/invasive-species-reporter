/**
 * 外来物种哨兵 — HTTPS 启动脚本（用于开发/测试）
 *
 * 在生产环境建议使用 Nginx 终结 HTTPS，而非直接使用 Node.js HTTPS。
 * 此脚本仅用于本地测试 HTTPS 配置。
 *
 * 使用方式：
 *   1. 生成自签名证书（或使用正式证书）：
 *      openssl req -x509 -newkey rsa:2048 -keyout server.key \
 *        -out server.crt -days 365 -nodes -subj "/CN=localhost"
 *   2. 启动此脚本：
 *      node deploy/https-server.js
 *
 * 环境变量：
 *   SSL_KEY_PATH  — SSL 私钥路径（默认 ./server.key）
 *   SSL_CERT_PATH — SSL 证书路径（默认 ./server.crt）
 *   PORT          — HTTPS 端口（默认 3443）
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// 加载 Express 应用
const app = require("../server/index");

const PORT = Number(process.env.PORT || 3443);
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(__dirname, "server.key");
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, "server.crt");

// 检查证书文件是否存在
if (!fs.existsSync(SSL_KEY_PATH) || !fs.existsSync(SSL_CERT_PATH)) {
  console.error(`
[HTTPS] SSL 证书文件未找到。
请先生成自签名证书：
  openssl req -x509 -newkey rsa:2048 -keyout ${SSL_KEY_PATH} \\
    -out ${SSL_CERT_PATH} -days 365 -nodes -subj "/CN=localhost"
`);
  process.exit(1);
}

const options = {
  key: fs.readFileSync(SSL_KEY_PATH),
  cert: fs.readFileSync(SSL_CERT_PATH)
};

https.createServer(options, app).listen(PORT, "0.0.0.0", () => {
  console.log(`[HTTPS] Server running at https://0.0.0.0:${PORT}`);
  console.log(`[HTTPS] 请确保微信小程序后台配置了此端口的 HTTPS 白名单`);
});
