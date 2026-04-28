# Architecture Refactor: Route Splitting + Integration Test

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 872-line monolithic `server/index.js` into focused middleware and route modules, then add a golden-path integration test to prevent demo-time regressions.

**Architecture:** Extract 4 middleware modules (CORS, rate-limit, security headers, JWT auth) and 7 route modules (auth, species, reports, uploads, shop, user, misc). Rewrite `server/index.js` to ~80 lines that wires everything together. The store layer and database layer remain unchanged.

**Tech Stack:** Node.js, Express 5, Jest, Supertest, better-sqlite3 (in-memory for tests)

---

## File Map

```
server/
  index.js              ← MODIFY: 872 → ~80 lines, wiring only
  middleware/
    cors.js             ← CREATE: CORS origin validation
    rate-limit.js       ← CREATE: IP-based rate limiter
    security.js         ← CREATE: security headers
    auth.js             ← CREATE: authRequired, reviewerRequired
  routes/
    auth.js             ← CREATE: register, login, wx-login
    species.js          ← CREATE: list, detail
    reports.js          ← CREATE: CRUD, my, export, review
    uploads.js          ← CREATE: image upload, recognition create/poll
    shop.js             ← CREATE: products, purchase, orders
    user.js             ← CREATE: points, notifications, achievements, privileges
    misc.js             ← CREATE: stats, leaderboard, health
tests/
  golden-path.test.js   ← CREATE: end-to-end integration test
```

---

### Task 1: Extract CORS middleware

**Files:**
- Create: `server/middleware/cors.js`
- Modify: `server/index.js` (extract CORS logic, replace with require)

- [ ] **Step 1: Create `server/middleware/cors.js`**

```js
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  console.warn(
    "[CORS] WARNING: Running in production without specific ALLOWED_ORIGINS. CORS is fully restrictive."
  );
}

function corsMiddleware(req, res, next) {
  if (isProduction && allowedOrigins.length > 0 && !allowedOrigins.includes("*")) {
    const origin = req.headers.origin;
    if (!allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", "null");
      res.status(403).json({ success: false, error: "CORS not allowed.", code: 403 });
      return;
    }
    res.header("Access-Control-Allow-Origin", origin);
  } else if (allowedOrigins.includes("*")) {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  } else {
    res.header("Access-Control-Allow-Origin", "null");
  }

  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

module.exports = corsMiddleware;
```

- [ ] **Step 2: Replace CORS inline code in `server/index.js`**

Remove lines 122-154 (the CORS block and the `isProduction`/`allowedOrigins` variables at lines 122-127, and the `app.use` block at lines 129-154).

Add this require near the top (after the existing requires around line 47):

```js
const corsMiddleware = require("./middleware/cors");
```

Replace the removed block with:

```js
app.use(corsMiddleware);
```

- [ ] **Step 3: Start server to verify no errors**

Run: `npm start`
Expected: Server starts, no errors. Press Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add server/middleware/cors.js server/index.js
git commit -m "refactor: extract CORS middleware to server/middleware/cors.js"
```

---

### Task 2: Extract rate-limit middleware

**Files:**
- Create: `server/middleware/rate-limit.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create `server/middleware/rate-limit.js`**

```js
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 500;
const rateLimitStore = new Map();

function rateLimiter(req, res, next) {
  if (req.path === "/health") {
    next();
    return;
  }

  const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
  const key = `rate:${clientIp}`;
  const now = Date.now();

  let record = rateLimitStore.get(key);
  if (!record || now - record.windowStart > rateLimitWindowMs) {
    record = { windowStart: now, count: 0 };
  }

  record.count += 1;
  rateLimitStore.set(key, record);

  res.setHeader("X-RateLimit-Limit", rateLimitMaxRequests);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, rateLimitMaxRequests - record.count));
  res.setHeader("X-RateLimit-Reset", Math.ceil((record.windowStart + rateLimitWindowMs) / 1000));

  if (record.count > rateLimitMaxRequests) {
    res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
      code: 429,
      retryAfter: Math.ceil((record.windowStart + rateLimitWindowMs - now) / 1000),
    });
    return;
  }

  next();
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > rateLimitWindowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}, rateLimitWindowMs);

module.exports = { rateLimiter, rateLimitStore };
```

- [ ] **Step 2: Replace rate-limit inline code in `server/index.js`**

Remove lines 157-209 (the rate-limit constants, the `rateLimiter` function, the cleanup interval, and the `app.use(rateLimiter)` line).

Add this require near the top:

```js
const { rateLimiter } = require("./middleware/rate-limit");
```

Add after the CORS middleware:

```js
app.use(rateLimiter);
```

- [ ] **Step 3: Start server to verify no errors**

Run: `npm start`
Expected: Server starts normally. Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add server/middleware/rate-limit.js server/index.js
git commit -m "refactor: extract rate-limit middleware to server/middleware/rate-limit.js"
```

---

### Task 3: Extract security headers middleware

**Files:**
- Create: `server/middleware/security.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create `server/middleware/security.js`**

```js
function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.removeHeader("X-Powered-By");
  next();
}

module.exports = securityHeaders;
```

- [ ] **Step 2: Replace security headers in `server/index.js`**

Remove lines 212-218 (the `app.use` for security headers).

Add this require:

```js
const securityHeaders = require("./middleware/security");
```

Add after the rate limiter:

```js
app.use(securityHeaders);
```

- [ ] **Step 3: Start server to verify no errors**

Run: `npm start`
Expected: Server starts normally. Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add server/middleware/security.js server/index.js
git commit -m "refactor: extract security headers middleware to server/middleware/security.js"
```

---

### Task 4: Extract auth middleware + helpers

**Files:**
- Create: `server/middleware/auth.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create `server/middleware/auth.js`**

```js
const jwt = require("jsonwebtoken");
const db = require("../lib/database");

const JWT_SECRET = process.env.JWT_SECRET;

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ success: false, error: "Authentication required.", code: 401 });
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_err) {
    res.status(401).json({ success: false, error: "Invalid or expired token.", code: 401 });
  }
}

function reviewerRequired(req, res, next) {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Authentication required.", code: 401 });
    return;
  }

  const user = db.getUserById(req.user.userId);
  if (!user) {
    res.status(401).json({ success: false, error: "User not found.", code: 401 });
    return;
  }

  if (user.role !== "reviewer" && user.role !== "admin") {
    res.status(403).json({ success: false, error: "Reviewer role required.", code: 403 });
    return;
  }

  req.userRole = user.role;
  next();
}

module.exports = { authRequired, reviewerRequired };
```

- [ ] **Step 2: Remove auth middleware and helpers from `server/index.js`**

Remove lines 224-273 (the `authRequired` function, `reviewerRequired` function, and the `sendError`/`sendSuccess`/`getPublicBaseUrl` helpers at lines 265-279).

Save `sendError`, `sendSuccess`, and `getPublicBaseUrl` — we'll move them to a shared helpers file in Task 5. For now, keep them as inline requires. Actually, let's create a small helpers file right here.

Create `server/lib/helpers.js`:

```js
function sendError(res, error, code = 400) {
  res.status(code).json({ success: false, error, code });
}

function sendSuccess(res, data, statusCode = 200) {
  res.status(statusCode).json(data);
}

function getPublicBaseUrl(req) {
  return process.env.SERVER_PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

module.exports = { sendError, sendSuccess, getPublicBaseUrl };
```

In `server/index.js`, remove lines 265-279 and add:

```js
const { sendError, sendSuccess, getPublicBaseUrl } = require("./lib/helpers");
```

- [ ] **Step 3: Start server to verify no errors**

Run: `npm start`
Expected: Server starts normally. Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add server/middleware/auth.js server/lib/helpers.js server/index.js
git commit -m "refactor: extract auth middleware and response helpers"
```

---

### Task 5: Create auth routes module

**Files:**
- Create: `server/routes/auth.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create `server/routes/auth.js`**

```js
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
```

- [ ] **Step 2: Replace auth routes in `server/index.js`**

Remove lines 292-417 (all three auth route handlers).

Add this require near the top:

```js
const authRoutes = require("./routes/auth");
```

Add this route mount (replacing the removed routes):

```js
app.use("/api/auth", authRoutes);
```

- [ ] **Step 3: Start server and test auth endpoints**

Run: `npm start` (in background or separate terminal)

Test register:
```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testrefactor","password":"test1234"}' | head -c 200
```
Expected: JSON with `item.id`, `item.username`, `item.token`.

Test login:
```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | head -c 200
```
Expected: JSON with token.

Stop server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add server/routes/auth.js server/index.js
git commit -m "refactor: extract auth routes to server/routes/auth.js"
```

---

### Task 6: Create species routes module

**Files:**
- Create: `server/routes/species.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create `server/routes/species.js`**

```js
const { Router } = require("express");
const { getSpeciesList, getSpeciesById, getSpeciesReports } = require("../lib/store");
const { sendError } = require("../lib/helpers");

const router = Router();

// GET /api/species
router.get("/", (_req, res) => {
  res.json({ items: getSpeciesList() });
});

// GET /api/species/:id
router.get("/:id", (req, res) => {
  const species = getSpeciesById(req.params.id);

  if (!species) {
    sendError(res, "Not Found", 404);
    return;
  }

  res.json({
    item: species,
    reports: getSpeciesReports(req.params.id),
  });
});

module.exports = router;
```

- [ ] **Step 2: Replace species routes in `server/index.js`**

Remove lines 421-439 (both species route handlers).

Add require:

```js
const speciesRoutes = require("./routes/species");
```

Add mount:

```js
app.use("/api/species", speciesRoutes);
```

- [ ] **Step 3: Test species endpoint**

Run: `npm start`

```bash
curl -s http://localhost:3000/api/species | head -c 200
```
Expected: JSON with `items` array.

```bash
curl -s http://localhost:3000/api/species/species-001 | head -c 200
```
Expected: JSON with `item` and `reports`.

Stop server.

- [ ] **Step 4: Commit**

```bash
git add server/routes/species.js server/index.js
git commit -m "refactor: extract species routes to server/routes/species.js"
```

---

### Task 7: Create reports routes module

**Files:**
- Create: `server/routes/reports.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create `server/routes/reports.js`**

```js
const { Router } = require("express");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const crypto = require("crypto");
const { authRequired, reviewerRequired } = require("../middleware/auth");
const {
  getReports,
  getReportsByUser,
  getApprovedReportsForExport,
  createReportWithPoints,
  reviewReport,
  checkReportLimit,
  checkImageDuplicate,
  addImageFingerprint,
  checkGeotemporalDuplicate,
  addPoints,
  updateUserCredit,
  createNotification,
  checkAndAwardAchievements,
} = require("../lib/store");
const { getUpload } = require("../lib/upload-store");
const { sendError } = require("../lib/helpers");

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

// GET /api/reports
router.get("/", (req, res) => {
  const result = getReports(req.query.status, req.query.page, req.query.limit);
  res.json({
    items: result.items,
    page: result.pagination.page,
    limit: result.pagination.limit,
    total: result.pagination.total,
    totalPages: result.pagination.totalPages,
  });
});

// GET /api/reports/my
router.get("/my", authRequired, (req, res) => {
  const result = getReportsByUser(req.user.userId, req.query.status, req.query.page, req.query.limit);
  res.json({
    items: result.items,
    page: result.pagination.page,
    limit: result.pagination.limit,
    total: result.pagination.total,
    totalPages: result.pagination.totalPages,
  });
});

// GET /api/reports/export/csv
router.get("/export/csv", authRequired, (_req, res) => {
  const rows = getApprovedReportsForExport();

  const bom = "\uFEFF";
  const headers = [
    "ID", "用户ID", "识别物种", "拉丁名", "识别置信度",
    "入侵等级", "物种类别", "原产地",
    "经度", "纬度", "地点", "备注", "图片URL",
    "上报时间",
  ];

  const csvRows = rows.map((r) =>
    [
      r.id, r.user_id, r.ai_top1, r.species_latin || "",
      r.ai_score !== null ? Number(r.ai_score).toFixed(2) : "",
      r.species_risk || "", r.species_category || "", r.species_origin || "",
      r.longitude, r.latitude, r.address || "",
      (r.remark || "").replace(/"/g, '""'),
      r.image_url || "", r.created_at,
    ]
      .map((v) => (v === null || v === undefined ? "" : `"${String(v).replace(/"/g, '""')}"`))
      .join(",")
  );

  const csv = bom + headers.join(",") + "\n" + csvRows.join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="invasive-species-export-${Date.now()}.csv"`);
  res.send(csv);
});

// POST /api/reports
router.post("/", (req, res) => {
  try {
    let reportUserId = "";
    try {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.userId) reportUserId = decoded.userId;
      }
    } catch (_e) { /* ignore */ }

    const userId = reportUserId || "user-anonymous";

    if (userId !== "user-anonymous") {
      const limit = checkReportLimit(userId);
      if (!limit.allowed) {
        sendError(res, `今日上报已达上限（每日${limit.dailyLimit}次），信用分过低请保持良好记录。`, 429);
        return;
      }
    }

    const { fileId, latitude, longitude } = req.body || {};

    if (fileId) {
      const uploadRecord = getUpload(fileId);
      if (uploadRecord) {
        let md5Hash = "";
        try {
          const fileBuffer = fs.readFileSync(uploadRecord.path);
          md5Hash = crypto.createHash("md5").update(fileBuffer).digest("hex");
        } catch (_e) { /* ignore */ }

        if (md5Hash && checkImageDuplicate(md5Hash)) {
          sendError(res, "图片重复，请勿重复上传相同图片。", 400);
          return;
        }
        if (md5Hash) {
          addImageFingerprint(md5Hash, userId, uploadRecord.size, 0, 0);
        }
      }
    }

    let isDupe = false;
    if (userId !== "user-anonymous" && latitude && longitude) {
      isDupe = checkGeotemporalDuplicate(userId, latitude, longitude);
    }

    const reportPayload = {
      userId,
      speciesId: req.body.speciesId,
      aiTop1: req.body.aiTop1,
      aiScore: req.body.aiScore,
      aiCandidates: req.body.aiCandidates,
      imageUrl: req.body.imageUrl,
      latitude,
      longitude,
      address: req.body.address,
      remark: req.body.remark,
      imageFingerprint: "",
    };

    const result = createReportWithPoints(reportPayload);

    if (userId !== "user-anonymous" && !isDupe) {
      try {
        const newlyEarned = checkAndAwardAchievements(userId);
        if (newlyEarned.length > 0) {
          createNotification(userId, "🏆 获得新成就", `恭喜获得「${newlyEarned[0].name}」成就！`, "achievement", null);
        }
      } catch (_e) { /* optional */ }
    }

    res.status(201).json({
      item: result.report,
      message: isDupe
        ? "Report created (duplicate location, no points awarded)."
        : "Report created and waiting for review.",
      pointsDelta: isDupe ? [] : result.pointsDelta,
    });
  } catch (error) {
    sendError(res, "Invalid JSON body", 400);
  }
});

// POST /api/reports/:id/review
router.post("/:id/review", authRequired, reviewerRequired, (req, res) => {
  try {
    const payload = {
      ...req.body,
      reviewerId: req.user.userId,
    };

    const result = reviewReport(req.params.id, payload);

    if (!result) {
      sendError(res, "Not Found", 404);
      return;
    }

    if (payload.action === "approved") {
      const report = result.report;
      if (report && report.userId && report.userId !== "user-anonymous") {
        try {
          addPoints(report.userId, 20, "report_approved", report.id);
          const isHighQuality = report.aiScore > 0.95 || payload.highQuality;
          if (isHighQuality) {
            addPoints(report.userId, 10, "high_quality", report.id);
          }
          updateUserCredit(report.userId, 2);
          createNotification(
            report.userId,
            "上报已通过审核",
            `您的上报「${report.aiTop1}」已通过审核${isHighQuality ? "（高质量+10）" : ""}，获得 ${isHighQuality ? 30 : 20} 积分奖励。`,
            "approved",
            report.id
          );
          const newlyEarned = checkAndAwardAchievements(report.userId);
          if (newlyEarned.length > 0) {
            createNotification(report.userId, "🏆 获得新成就", `恭喜获得「${newlyEarned[0].name}」成就！`, "achievement", null);
          }
        } catch (_e) { /* optional */ }
      }
    } else if (payload.action === "rejected") {
      const report = result.report;
      if (report && report.userId && report.userId !== "user-anonymous") {
        try {
          updateUserCredit(report.userId, -3);
          const reason = payload.comment ? `原因：${payload.comment}` : "请查看审核意见。";
          createNotification(report.userId, "上报未通过审核", `您的上报「${report.aiTop1}」未通过审核。${reason}`, "rejected", report.id);
        } catch (_e) { /* optional */ }
      }
    } else if (payload.action === "spam") {
      const report = result.report;
      if (report && report.userId && report.userId !== "user-anonymous") {
        try {
          addPoints(report.userId, -10, "report_spam", report.id);
          updateUserCredit(report.userId, -10);
          createNotification(report.userId, "⚠️ 上报被标记为无效", `您的上报「${report.aiTop1}」被判定为垃圾上报，积分-10，信用分-10。`, "rejected", report.id);
        } catch (_e) { /* optional */ }
      }
    }

    res.json({
      item: result.report,
      review: result.log,
    });
  } catch (error) {
    sendError(res, "Invalid JSON body", 400);
  }
});

module.exports = router;
```

- [ ] **Step 2: Replace reports routes in `server/index.js`**

Remove lines 443-738 (all report-related routes: GET /api/reports, GET /api/reports/my, GET /api/reports/export/csv, POST /api/reports, POST /api/reports/:id/review).

Add require:

```js
const reportsRoutes = require("./routes/reports");
```

Add mount:

```js
app.use("/api/reports", reportsRoutes);
```

Also remove the `const sharp = require("sharp");` on line 501 — it's only used in the upload route now.

- [ ] **Step 3: Start server and test reports endpoint**

Run: `npm start`

```bash
curl -s http://localhost:3000/api/reports | head -c 200
```
Expected: JSON with `items` array.

```bash
# Get admin token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).item.token))")

curl -s http://localhost:3000/api/reports/my -H "Authorization: Bearer $TOKEN" | head -c 200
```
Expected: JSON with `items`.

Stop server.

- [ ] **Step 4: Commit**

```bash
git add server/routes/reports.js server/index.js
git commit -m "refactor: extract reports routes to server/routes/reports.js"
```

---

### Task 8: Create uploads + recognition routes module

**Files:**
- Create: `server/routes/uploads.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create `server/routes/uploads.js`**

```js
const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const sharp = require("sharp");
const { registerUpload, getUpload, removeUpload } = require("../lib/upload-store");
const { createRecognitionJob, getRecognitionJob } = require("../lib/recognition-jobs");
const { getSpeciesList } = require("../lib/store");
const { sendError, getPublicBaseUrl } = require("../lib/helpers");

const router = Router();

const uploadsDir = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed."));
      return;
    }
    cb(null, true);
  },
});

// POST /api/uploads
router.post("/uploads", upload.single("image"), async (req, res) => {
  if (!req.file) {
    sendError(res, "No image uploaded.", 400);
    return;
  }

  try {
    const metadata = await sharp(req.file.path, { failOn: "none" }).metadata();
    if (!metadata || !metadata.format || !["jpeg", "jpg", "png", "webp", "gif", "heic"].includes(metadata.format.toLowerCase())) {
      fs.unlinkSync(req.file.path);
      sendError(res, "Invalid image file content.", 400);
      return;
    }
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    sendError(res, "Could not validate image file.", 400);
    return;
  }

  const file = registerUpload(req.file);
  const imageUrl = `${getPublicBaseUrl(req)}/uploads/${file.filename}`;

  res.status(201).json({
    item: {
      fileId: file.fileId,
      imageUrl,
      originalName: file.originalName,
    },
  });
  console.log(`[upload] fileId=${file.fileId} originalName=${file.originalName}`);
});

// POST /api/recognitions
router.post("/recognitions", (req, res) => {
  const uploadRecord = getUpload(req.body.fileId);

  if (!uploadRecord) {
    sendError(res, "Uploaded file not found.", 404);
    return;
  }

  const job = createRecognitionJob({
    fileId: req.body.fileId,
    speciesList: getSpeciesList(),
  });

  if (!job) {
    sendError(res, "Uploaded file not found.", 404);
    return;
  }

  res.status(202).json({
    item: {
      jobId: job.jobId,
      status: job.status,
    },
  });
  console.log(`[recognition] created jobId=${job.jobId} fileId=${req.body.fileId}`);
});

// GET /api/recognitions/:jobId
router.get("/recognitions/:jobId", (req, res) => {
  const job = getRecognitionJob(req.params.jobId);

  if (!job) {
    sendError(res, "Recognition job not found.", 404);
    return;
  }

  res.json({ item: job });

  if (job.status === "failed") {
    console.error(`[recognition] failed jobId=${job.jobId} error=${job.error}`);
  }
});

module.exports = router;
```

- [ ] **Step 2: Replace upload/recognition code in `server/index.js`**

Remove lines 96-119 (multer config), lines 500-581 (uploads route, recognitions create/poll routes).

Add require:

```js
const uploadsRoutes = require("./routes/uploads");
```

Add mount:

```js
app.use("/api", uploadsRoutes);
```

Also ensure `express.json` and `express.static` lines remain (lines 220-222).

- [ ] **Step 3: Start server and test**

Run: `npm start`

```bash
curl -s http://localhost:3000/health
```
Expected: `{"status":"ok",...}`

Stop server.

- [ ] **Step 4: Commit**

```bash
git add server/routes/uploads.js server/index.js
git commit -m "refactor: extract upload and recognition routes to server/routes/uploads.js"
```

---

### Task 9: Create shop routes module

**Files:**
- Create: `server/routes/shop.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create `server/routes/shop.js`**

```js
const { Router } = require("express");
const { authRequired } = require("../middleware/auth");
const {
  getProducts,
  getProductCategories,
  createPurchaseFull,
  getUserPurchases,
  getOrdersByUser,
} = require("../lib/store");
const { sendError } = require("../lib/helpers");

const router = Router();

// GET /api/shop/products
router.get("/products", (_req, res) => {
  const items = getProducts();
  const categories = getProductCategories();
  res.json({ items, categories });
});

// POST /api/shop/purchase
router.post("/purchase", authRequired, (req, res) => {
  const { productId, shippingName, shippingPhone, shippingAddress } = req.body || {};
  if (!productId) {
    sendError(res, "Product ID is required.", 400);
    return;
  }
  const shippingInfo = { name: shippingName, phone: shippingPhone, address: shippingAddress };
  const result = createPurchaseFull(req.user.userId, productId, shippingInfo);
  if (result.error) {
    sendError(res, result.error, 400);
    return;
  }
  res.status(201).json({ item: result });
});

// GET /api/shop/purchases/:userId
router.get("/purchases/:userId", (req, res) => {
  res.json({ items: getUserPurchases(req.params.userId) });
});

// GET /api/shop/orders/:userId
router.get("/orders/:userId", authRequired, (req, res) => {
  if (req.user.userId !== req.params.userId) {
    sendError(res, "Access denied.", 403);
    return;
  }
  res.json({ items: getOrdersByUser(req.params.userId) });
});

module.exports = router;
```

- [ ] **Step 2: Replace shop routes in `server/index.js`**

Remove lines 767-798 (all shop-related route handlers).

Add require:

```js
const shopRoutes = require("./routes/shop");
```

Add mount:

```js
app.use("/api/shop", shopRoutes);
```

- [ ] **Step 3: Test shop endpoints**

Run: `npm start`

```bash
curl -s http://localhost:3000/api/shop/products | head -c 200
```
Expected: JSON with `items` and `categories`.

Stop server.

- [ ] **Step 4: Commit**

```bash
git add server/routes/shop.js server/index.js
git commit -m "refactor: extract shop routes to server/routes/shop.js"
```

---

### Task 10: Create user routes module

**Files:**
- Create: `server/routes/user.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create `server/routes/user.js`**

```js
const { Router } = require("express");
const { authRequired } = require("../middleware/auth");
const {
  getPoints,
  addPoints,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  checkAndAwardAchievements,
  getAllAchievementsWithStatus,
  getUserCredit,
  getUserPrivileges,
} = require("../lib/store");
const { sendError } = require("../lib/helpers");

const router = Router();

// GET /api/points/:userId
router.get("/points/:userId", (req, res) => {
  const result = getPoints(req.params.userId);
  res.json({ item: result });
});

// POST /api/points/:userId
router.post("/points/:userId", authRequired, (req, res) => {
  const { amount, action, referenceId } = req.body || {};
  if (!amount || !action) {
    sendError(res, "Amount and action are required.", 400);
    return;
  }
  const result = addPoints(req.params.userId, amount, action, referenceId);
  res.status(201).json({ item: result });
});

// GET /api/notifications/:userId
router.get("/notifications/:userId", authRequired, (req, res) => {
  if (req.user.userId !== req.params.userId) {
    sendError(res, "Access denied.", 403);
    return;
  }
  const items = getNotifications(req.params.userId, Number(req.query.limit) || 50);
  const unread = getUnreadNotificationCount(req.params.userId);
  res.json({ items, unread });
});

// POST /api/notifications/:id/read
router.post("/notifications/:id/read", authRequired, (req, res) => {
  const notif = markNotificationRead(req.params.id);
  if (!notif) {
    sendError(res, "Not Found", 404);
    return;
  }
  res.json({ item: notif });
});

// POST /api/notifications/:userId/read-all
router.post("/notifications/:userId/read-all", authRequired, (req, res) => {
  if (req.user.userId !== req.params.userId) {
    sendError(res, "Access denied.", 403);
    return;
  }
  markAllNotificationsRead(req.params.userId);
  res.json({ success: true });
});

// GET /api/achievements
router.get("/achievements", authRequired, (req, res) => {
  const achievements = getAllAchievementsWithStatus(req.user.userId);
  res.json({ items: achievements });
});

// POST /api/achievements/check
router.post("/achievements/check", authRequired, (req, res) => {
  const newlyEarned = checkAndAwardAchievements(req.user.userId);
  res.json({ items: newlyEarned });
});

// GET /api/user/privileges
router.get("/user/privileges", authRequired, (req, res) => {
  const credit = getUserCredit(req.user.userId);
  const privileges = getUserPrivileges(req.user.userId);
  res.json({ item: { credit, ...privileges } });
});

module.exports = router;
```

- [ ] **Step 2: Replace user-related routes in `server/index.js`**

Remove lines 750-848 (points routes, notification routes, achievements routes, user privileges route).

Add require:

```js
const userRoutes = require("./routes/user");
```

Add mount:

```js
app.use("/api", userRoutes);
```

- [ ] **Step 3: Start server and test user endpoints**

Run: `npm start`

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).item.token))")

# Test achievements
curl -s http://localhost:3000/api/achievements -H "Authorization: Bearer $TOKEN" | head -c 200

# Test privileges
curl -s http://localhost:3000/api/user/privileges -H "Authorization: Bearer $TOKEN" | head -c 200
```
Expected: Both return valid JSON.

Stop server.

- [ ] **Step 4: Commit**

```bash
git add server/routes/user.js server/index.js
git commit -m "refactor: extract user routes (points, notifications, achievements, privileges)"
```

---

### Task 11: Create misc routes module + finalize index.js

**Files:**
- Create: `server/routes/misc.js`
- Rewrite: `server/index.js`

- [ ] **Step 1: Create `server/routes/misc.js`**

```js
const { Router } = require("express");
const { getStats, getLeaderboard } = require("../lib/store");
const { sendError } = require("../lib/helpers");

const router = Router();

// GET /api/stats
router.get("/stats", (_req, res) => {
  res.json({ item: getStats() });
});

// GET /api/leaderboard
router.get("/leaderboard", (req, res) => {
  const type = req.query.type || "weekly";
  if (!["weekly", "total", "newcomer"].includes(type)) {
    sendError(res, "type must be weekly/total/newcomer", 400);
    return;
  }
  const items = getLeaderboard(type, 50);
  res.json({ items });
});

module.exports = router;
```

- [ ] **Step 2: Rewrite `server/index.js` to final lean form**

```js
require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const db = require("./lib/database");

// --- Configuration ---
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("[FATAL] JWT_SECRET environment variable is required. Exit.");
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  console.error("[FATAL] JWT_SECRET must be at least 32 characters for security. Exit.");
  process.exit(1);
}
if (JWT_SECRET === "change-me-in-production" || JWT_SECRET === "invasive-species-reporter-dev-secret") {
  console.error("[FATAL] JWT_SECRET is using an insecure default value. Set a strong random string in .env. Exit.");
  process.exit(1);
}

// --- Uploads directory ---
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// --- Initialize database ---
db.initSchema();

const { species, reports, reviewLogs, products } = require("./data/mock-data");
db.seedSpecies(species);
db.seedReports(reports);
db.seedReviewLogs(reviewLogs);
db.seedProducts(products);

if (!db.getUserByUsername("admin")) {
  db.createUser("admin", "admin123", "admin");
  console.log("[init] Created admin: admin / admin123");
}
if (!db.getUserByUsername("reviewer")) {
  db.createUser("reviewer", "review123", "reviewer");
  console.log("[init] Created demo reviewer: reviewer / review123");
}
if (!db.getUserByUsername("demo")) {
  db.createUser("demo", "demo123", "user");
  console.log("[init] Created demo user: demo / demo123");
}
console.log("[init] Database ready.");

// --- Global middleware ---
app.use(require("./middleware/cors"));
app.use(require("./middleware/rate-limit").rateLimiter);
app.use(require("./middleware/security"));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));
app.use("/static", express.static(path.join(__dirname, "static")));

// --- Routes ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "invasive-species-reporter-api" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/species", require("./routes/species"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api", require("./routes/uploads"));
app.use("/api/shop", require("./routes/shop"));
app.use("/api", require("./routes/user"));
app.use("/api", require("./routes/misc"));

// --- Error handler ---
app.use((error, _req, res, _next) => {
  console.error("[server] request failed:", error);
  res.status(400).json({ success: false, error: error.message || "Request failed.", code: 400 });
});

// --- Start ---
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
```

- [ ] **Step 3: Start server and run full smoke test**

Run: `npm start`

```bash
# Test every route group
curl -s http://localhost:3000/health
curl -s http://localhost:3000/api/species | node -e "process.stdin.on('data',d=>console.log('species:',JSON.parse(d).items.length))"
curl -s http://localhost:3000/api/reports | node -e "process.stdin.on('data',d=>console.log('reports:',JSON.parse(d).items.length))"
curl -s http://localhost:3000/api/stats | node -e "process.stdin.on('data',d=>console.log('stats:',JSON.parse(d).item.totalReports))"
curl -s http://localhost:3000/api/leaderboard | node -e "process.stdin.on('data',d=>console.log('leaderboard:',JSON.parse(d).items.length))"
curl -s http://localhost:3000/api/shop/products | node -e "process.stdin.on('data',d=>console.log('shop:',JSON.parse(d).items.length))"

# Auth
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).item.token))")
echo "Got token: ${TOKEN:0:20}..."

curl -s http://localhost:3000/api/achievements -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>console.log('achievements:',JSON.parse(d).items.length))"
curl -s http://localhost:3000/api/user/privileges -H "Authorization: Bearer $TOKEN" | node -e "process.stdin.on('data',d=>console.log('privileges ok'))"
```

Expected: All endpoints return valid JSON, no errors.

Stop server.

- [ ] **Step 4: Run existing tests**

```bash
npx jest tests/anti-spam.test.js
```
Expected: 25 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add server/routes/misc.js server/index.js
git commit -m "refactor: extract misc routes, finalize lean server/index.js"
```

---

### Task 12: Add golden-path integration test

**Files:**
- Create: `tests/golden-path.test.js`

- [ ] **Step 1: Create `tests/golden-path.test.js`**

```js
/**
 * Golden-path integration test: end-to-end user flow.
 *
 * Run with: npx jest tests/golden-path.test.js
 *
 * Requires: server to NOT be running (supertest binds to the app directly).
 * Uses in-memory SQLite so no real database is modified.
 */

process.env.DATABASE_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long!!";

const request = require("supertest");
const db = require("../server/lib/database");

// Reset DB module state so it picks up :memory:
delete require.cache[require.resolve("../server/lib/database")];

let app;
let adminToken;
let userToken;
let testUserId;
let testReportId;

beforeAll(() => {
  // Ensure fresh state
  const freshDb = require("../server/lib/database");
  freshDb._reset && freshDb._reset();

  // Load app (which initializes DB + seeds)
  app = require("../server/index");
});

afterAll(() => {
  const d = require("../server/lib/database");
  d._reset && d._reset();
});

describe("Golden Path: Register → Report → Review", () => {
  test("1. Health check returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("2. Register a new user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "goldentest", password: "testpass123" });

    expect(res.status).toBe(201);
    expect(res.body.item.username).toBe("goldentest");
    expect(res.body.item.token).toBeTruthy();
    userToken = res.body.item.token;
    testUserId = res.body.item.id;
  });

  test("3. Login with existing user", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });

    expect(res.status).toBe(200);
    expect(res.body.item.token).toBeTruthy();
    adminToken = res.body.item.token;
  });

  test("4. Species list is not empty", async () => {
    const res = await request(app).get("/api/species");
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  test("5. Species detail returns item + reports", async () => {
    const res = await request(app).get("/api/species/species-001");
    expect(res.status).toBe(200);
    expect(res.body.item.id).toBe("species-001");
    expect(res.body.reports).toBeDefined();
  });

  test("6. Create a report (no image, using species-001)", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        speciesId: "species-001",
        aiTop1: "加拿大一枝黄花",
        aiScore: 0.85,
        aiCandidates: [],
        latitude: 31.9527,
        longitude: 118.8927,
        address: "测试地址",
        remark: "集成测试上报",
      });

    expect(res.status).toBe(201);
    expect(res.body.item.id).toBeTruthy();
    testReportId = res.body.item.id;
  });

  test("7. Report appears in my reports", async () => {
    const res = await request(app)
      .get("/api/reports/my")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const found = res.body.items.find((r) => r.id === testReportId);
    expect(found).toBeTruthy();
  });

  test("8. Admin reviews and approves the report", async () => {
    const res = await request(app)
      .post(`/api/reports/${testReportId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe("approved");
  });

  test("9. After approval, report is in public list", async () => {
    const res = await request(app)
      .get("/api/reports")
      .query({ status: "approved" });

    expect(res.status).toBe(200);
    const found = res.body.items.find((r) => r.id === testReportId);
    expect(found).toBeTruthy();
  });

  test("10. User earned points from approval", async () => {
    const res = await request(app).get(`/api/points/${testUserId}`);
    expect(res.status).toBe(200);
    expect(res.body.item.total).toBeGreaterThanOrEqual(25);
    // +5 for submission, +20 for approval (+ possibly first report bonus)
  });

  test("11. Achievements endpoint is accessible", async () => {
    const res = await request(app)
      .get("/api/achievements")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    // Should have at least the "newbie" badge for first report
    const earned = res.body.items.filter((a) => a.earned);
    expect(earned.length).toBeGreaterThan(0);
  });

  test("12. Unauthenticated access is rejected", async () => {
    const res = await request(app).get("/api/reports/my");
    expect(res.status).toBe(401);
  });

  test("13. Stats endpoint returns data", async () => {
    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(200);
    expect(res.body.item.totalReports).toBeGreaterThanOrEqual(1);
  });

  test("14. Leaderboard returns array", async () => {
    const res = await request(app).get("/api/leaderboard?type=weekly");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test("15. Non-reviewer cannot approve reports", async () => {
    const res = await request(app)
      .post(`/api/reports/${testReportId}/review`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ action: "approved" });

    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Make server/index.js export the app for supertest**

In `server/index.js`, replace the final `app.listen(...)` block with:

```js
// --- Start (skip when imported by test runner) ---
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
```

- [ ] **Step 3: Run the golden-path test**

```bash
npx jest tests/golden-path.test.js --verbose
```
Expected: 15 tests pass.

- [ ] **Step 4: Run all tests together**

```bash
npx jest --verbose
```
Expected: 25 anti-spam tests + 15 golden-path tests = 40 tests, all pass.

- [ ] **Step 5: Verify server still starts normally**

```bash
npm start
```
Expected: Server starts (not in test mode). Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add tests/golden-path.test.js server/index.js
git commit -m "test: add golden-path integration test (register → report → review)"
```

---

### Task 13: Clean up python-service directory

**Files:**
- Delete: `python-service/` (entire directory)

- [ ] **Step 1: Remove python-service directory**

```bash
git rm -r python-service/
```

- [ ] **Step 2: Update docker-compose.yml to remove python-service**

Read `docker-compose.yml` first, then remove any service definition referencing `python-service`.

If docker-compose.yml only has the python service, delete the file entirely:
```bash
git rm docker-compose.yml
```

- [ ] **Step 3: Update docs if they reference python-service**

Check and update:
- `docs/architecture.md` — remove Python microservice from architecture diagram
- `docs/integration-plan.md` — if it describes Python integration

- [ ] **Step 4: Run tests to confirm nothing broke**

```bash
npx jest --verbose
```
Expected: All 40 tests pass.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: remove unused python-service directory

PyTorch recognition mode was an untrained model shell and never
functional. The Zhipu GLM-4V-Flash API is the primary recognition
provider and sufficient for the project's needs."
```

---

### Task 14: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npx jest --verbose
```
Expected: 40 tests, all green.

- [ ] **Step 2: Run regression test script**

```bash
bash scripts/regression-test.sh
```
Expected: 14 API checks pass.

- [ ] **Step 3: Review final `server/index.js` line count**

```bash
wc -l server/index.js
```
Expected: ~80 lines (down from 872).

- [ ] **Step 4: Verify all route files exist and import cleanly**

```bash
node -e "
  require('./server/middleware/cors');
  require('./server/middleware/rate-limit');
  require('./server/middleware/security');
  require('./server/middleware/auth');
  require('./server/routes/auth');
  require('./server/routes/species');
  require('./server/routes/reports');
  require('./server/routes/uploads');
  require('./server/routes/shop');
  require('./server/routes/user');
  require('./server/routes/misc');
  require('./server/lib/helpers');
  console.log('All modules load without error');
"
```
Expected: "All modules load without error"

- [ ] **Step 5: Final commit**

```bash
git add -A
git status
# Verify only expected files changed
git commit -m "chore: final verification after architecture refactor"
```

---

## Self-Review

**1. Spec coverage:**
- Split `server/index.js` into route modules — Tasks 5-11
- Extract middleware — Tasks 1-4
- Add golden-path integration test — Task 12
- Clean up python-service — Task 13
- No feature regressions — verified by test runs at every step

**2. Placeholder scan:** No TBD, TODO, or "implement later" found.

**3. Type consistency:**
- `authRequired` and `reviewerRequired` imported from `../middleware/auth` in routes — consistent
- `sendError` imported from `../lib/helpers` in all route files — consistent
- Store functions imported from `../lib/store` — consistent
- Route mount prefixes match route handler paths — verified in each task
