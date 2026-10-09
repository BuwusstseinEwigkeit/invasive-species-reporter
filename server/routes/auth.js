const { Router } = require("express");
const jwt = require("jsonwebtoken");
const db = require("../lib/database");
const { sendError } = require("../lib/helpers");

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/register
router.post("/register", (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== "string" || typeof password !== "string") {
    sendError(res, "Username and password are required.", 400);
    return;
  }

  const normalizedUsername = username.trim();
  if (normalizedUsername.length < 3 || normalizedUsername.length > 32 || password.length < 8 || password.length > 128) {
    sendError(res, "Username must be 3-32 chars, password 8-128 chars.", 400);
    return;
  }

  const user = db.createUser(normalizedUsername, password, "user");

  if (!user) {
    sendError(res, "Username already taken.", 409);
    return;
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.status(201).json({
    item: {
      id: user.id,
      username: user.username,
      role: user.role,
      token,
    },
  });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
    sendError(res, "Username and password are required.", 400);
    return;
  }

  const user = db.authenticateUser(username.trim(), password);

  if (!user) {
    sendError(res, "Invalid username or password.", 401);
    return;
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    item: {
      id: user.id,
      username: user.username,
      role: user.role,
      token,
    },
  });
});

// POST /api/auth/wx-login
router.post("/wx-login", async (req, res) => {
  const { code } = req.body || {};

  if (!code) {
    sendError(res, "WeChat login code is required.", 400);
    return;
  }

  const appid = process.env.WECHAT_APPID || "";
  const secret = process.env.WECHAT_SECRET || "";

  let openid;

  if (appid && secret) {
    try {
      const https = require("https");
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
      const result = await new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          let data = "";
          resp.on("data", (chunk) => { data += chunk; });
          resp.on("end", () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        }).on("error", reject);
      });

      if (result.errcode) {
        console.error("[wx-login] WeChat API error:", result.errcode, result.errmsg);
        sendError(res, "微信登录失败：" + (result.errmsg || "code无效"), 401);
        return;
      }

      openid = result.openid;
    } catch (err) {
      console.error("[wx-login] WeChat API request failed:", err.message);
      sendError(res, "微信登录服务暂不可用", 502);
      return;
    }
  } else if (process.env.NODE_ENV !== "production" && String(process.env.ENABLE_DEV_WX_LOGIN || "").toLowerCase() === "true") {
    console.log("[wx-login] Dev mode: WECHAT_APPID not set, using code as openid");
    openid = `dev-${code}`;
  } else {
    sendError(res, "微信登录尚未配置。", 503);
    return;
  }

  let user = db.getUserByOpenId(openid);
  if (!user) {
    user = db.createUserFromOpenId(openid);
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    item: {
      id: user.id,
      username: user.username,
      role: user.role,
      token,
    },
  });
});

module.exports = router;
