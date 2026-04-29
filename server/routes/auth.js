const { Router } = require("express");
const jwt = require("jsonwebtoken");
const db = require("../lib/database");
const { sendError } = require("../lib/helpers");

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/register
router.post("/register", (req, res) => {
  const { username, password, role } = req.body || {};

  if (!username || !password) {
    sendError(res, "Username and password are required.", 400);
    return;
  }

  if (username.length < 3 || password.length < 8) {
    sendError(res, "Username must be at least 3 chars, password at least 8 chars.", 400);
    return;
  }

  const userRole = role === "reviewer" ? "user" : (role || "user");
  const user = db.createUser(username, password, userRole);

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

  if (!username || !password) {
    sendError(res, "Username and password are required.", 400);
    return;
  }

  const user = db.authenticateUser(username, password);

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
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
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
  } else {
    console.log("[wx-login] Dev mode: WECHAT_APPID not set, using code as openid");
    openid = `dev-${code}`;
  }

  let user = db.getUserByOpenId(openid);
  if (!user) {
    user = db.createUserFromOpenId(openid);
    console.log(`[wx-login] Created new user for openid=${openid}, id=${user.id}`);
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
