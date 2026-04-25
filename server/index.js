require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const {
  getSpeciesList,
  getSpeciesById,
  getReports,
  getReportsByUser,
  getSpeciesReports,
  createReport,
  reviewReport,
  getApprovedReportsForExport,
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getStats,
  getPoints,
  addPoints,
  getProducts,
  createPurchase,
  getUserPurchases
} = require("./lib/store");
const { registerUpload, getUpload } = require("./lib/upload-store");
const { createRecognitionJob, getRecognitionJob } = require("./lib/recognition-jobs");
const db = require("./lib/database");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "invasive-species-reporter-dev-secret";
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// --- Initialize database ---
db.initSchema();

// Seed demo data (idempotent: ignores duplicates)
const { species, reports, reviewLogs, products } = require("./data/mock-data");
db.seedSpecies(species);
db.seedReports(reports);
db.seedReviewLogs(reviewLogs);
db.seedProducts(products);

// Create demo accounts if not exist
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

// --- Multer config ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image uploads are allowed."));
  }
});

// --- CORS ---
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));
app.use("/static", express.static(path.join(__dirname, "static")));

// --- JWT middleware ---

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");

  if (!token) {
    sendError(res, "Authentication required.", 401);
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_err) {
    sendError(res, "Invalid or expired token.", 401);
  }
}

function reviewerRequired(req, res, next) {
  if (!req.user) {
    sendError(res, "Authentication required.", 401);
    return;
  }

  const user = db.getUserById(req.user.userId);
  if (!user) {
    sendError(res, "User not found.", 401);
    return;
  }

  if (user.role !== "reviewer" && user.role !== "admin") {
    sendError(res, "Reviewer role required.", 403);
    return;
  }

  req.userRole = user.role;
  next();
}

// --- Unified API helpers ---

function sendError(res, error, code = 400) {
  res.status(code).json({ success: false, error, code });
}

function sendSuccess(res, data, statusCode = 200) {
  res.status(statusCode).json(data);
}

// --- Helper ---

function getPublicBaseUrl(req) {
  return process.env.SERVER_PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

// --- Health ---

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "invasive-species-reporter-api"
  });
});

// --- Auth routes ---

app.post("/api/auth/register", (req, res) => {
  const { username, password, role } = req.body || {};

  if (!username || !password) {
    sendError(res, "Username and password are required.", 400);
    return;
  }

  if (username.length < 3 || password.length < 4) {
    sendError(res, "Username must be at least 3 chars, password at least 4 chars.", 400);
    return;
  }

  const userRole = role === "reviewer" ? "user" : (role || "user"); // Only admin can create reviewer; default to user
  const user = db.createUser(username, password, userRole);

  if (!user) {
    sendError(res, "Username already taken.", 409);
    return;
  }

  const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

  res.status(201).json({
    item: {
      id: user.id,
      username: user.username,
      role: user.role,
      token
    }
  });
});

app.post("/api/auth/login", (req, res) => {
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

  const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

  res.json({
    item: {
      id: user.id,
      username: user.username,
      role: user.role,
      token
    }
  });
});

// --- WeChat login ---

app.post("/api/auth/wx-login", async (req, res) => {
  const { code } = req.body || {};

  if (!code) {
    sendError(res, "WeChat login code is required.", 400);
    return;
  }

  const appid = process.env.WECHAT_APPID || "";
  const secret = process.env.WECHAT_SECRET || "";

  let openid;

  if (appid && secret) {
    // Real WeChat API call
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
    // Dev mode: no WeChat credentials configured, use code as openid
    console.log("[wx-login] Dev mode: WECHAT_APPID not set, using code as openid");
    openid = `dev-${code}`;
  }

  // Find or create user by openid
  let user = db.getUserByOpenId(openid);
  if (!user) {
    user = db.createUserFromOpenId(openid);
    console.log(`[wx-login] Created new user for openid=${openid}, id=${user.id}`);
  }

  const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

  res.json({
    item: {
      id: user.id,
      username: user.username,
      role: user.role,
      token
    }
  });
});

// --- Species ---

app.get("/api/species", (_req, res) => {
  res.json({
    items: getSpeciesList()
  });
});

app.get("/api/species/:id", (req, res) => {
  const species = getSpeciesById(req.params.id);

  if (!species) {
    sendError(res, "Not Found", 404);
    return;
  }

  res.json({
    item: species,
    reports: getSpeciesReports(req.params.id)
  });
});

// --- Reports ---

app.get("/api/reports", (req, res) => {
  const result = getReports(req.query.status, req.query.page, req.query.limit);
  res.json({
    items: result.items,
    page: result.pagination.page,
    limit: result.pagination.limit,
    total: result.pagination.total,
    totalPages: result.pagination.totalPages
  });
});

app.get("/api/reports/my", authRequired, (req, res) => {
  const result = getReportsByUser(req.user.userId, req.query.status, req.query.page, req.query.limit);
  res.json({
    items: result.items,
    page: result.pagination.page,
    limit: result.pagination.limit,
    total: result.pagination.total,
    totalPages: result.pagination.totalPages
  });
});

app.get("/api/reports/export/csv", (_req, res) => {
  const rows = getApprovedReportsForExport();

  // CSV headers (BOM for Excel compatibility with Chinese characters)
  const bom = "\uFEFF";
  const headers = [
    "ID", "用户ID", "识别物种", "拉丁名", "识别置信度",
    "入侵等级", "物种类别", "原产地",
    "经度", "纬度", "地点", "备注", "图片URL",
    "上报时间"
  ];

  const csvRows = rows.map(r => [
    r.id,
    r.user_id,
    r.ai_top1,
    r.species_latin || "",
    r.ai_score !== null ? Number(r.ai_score).toFixed(2) : "",
    r.species_risk || "",
    r.species_category || "",
    r.species_origin || "",
    r.longitude,
    r.latitude,
    r.address || "",
    (r.remark || "").replace(/"/g, '""'),
    r.image_url || "",
    r.created_at
  ].map(v => v === null || v === undefined ? "" : `"${String(v).replace(/"/g, '""')}"`).join(","));

  const csv = bom + headers.join(",") + "\n" + csvRows.join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="invasive-species-export-${Date.now()}.csv"`);
  res.send(csv);
});

// --- Uploads ---

app.post("/api/uploads", upload.single("image"), (req, res) => {
  if (!req.file) {
    sendError(res, "No image uploaded.", 400);
    return;
  }

  const file = registerUpload(req.file);
  const imageUrl = `${getPublicBaseUrl(req)}/uploads/${file.filename}`;

  res.status(201).json({
    item: {
      fileId: file.fileId,
      imageUrl,
      originalName: file.originalName
    }
  });
  console.log(`[upload] fileId=${file.fileId} originalName=${file.originalName}`);
});

// --- Recognitions ---

app.post("/api/recognitions", (req, res) => {
  const uploadRecord = getUpload(req.body.fileId);

  if (!uploadRecord) {
    sendError(res, "Uploaded file not found.", 404);
    return;
  }

  const job = createRecognitionJob({
    fileId: req.body.fileId,
    speciesList: getSpeciesList()
  });

  if (!job) {
    sendError(res, "Uploaded file not found.", 404);
    return;
  }

  res.status(202).json({
    item: {
      jobId: job.jobId,
      status: job.status
    }
  });
  console.log(`[recognition] created jobId=${job.jobId} fileId=${req.body.fileId}`);
});

app.get("/api/recognitions/:jobId", (req, res) => {
  const job = getRecognitionJob(req.params.jobId);

  if (!job) {
    sendError(res, "Recognition job not found.", 404);
    return;
  }

  res.json({
    item: job
  });

  if (job.status === "failed") {
    console.error(`[recognition] failed jobId=${job.jobId} error=${job.error}`);
  }
});

// --- Create report ---

app.post("/api/reports", (req, res) => {
  try {
    var reportUserId = req.body.userId || "";
    // Extract userId from JWT if available
    try {
      var token = (req.headers.authorization || "").replace("Bearer ", "");
      if (token) {
        var decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.userId) reportUserId = decoded.userId;
      }
    } catch (_e) { /* ignore */ }

    const report = createReport({ ...req.body, userId: reportUserId });
    // Award 10 points for submitting a report
    if (reportUserId && reportUserId !== "user-anonymous") {
      try {
        addPoints(reportUserId, 10, "report_submit", report.id);
      } catch (_e) { /* points award is optional */ }
    }
    res.status(201).json({
      item: report,
      message: "Report created and waiting for review."
    });
  } catch (error) {
    sendError(res, "Invalid JSON body", 400);
  }
});

// --- Review (protected) ---

app.post("/api/reports/:id/review", authRequired, reviewerRequired, (req, res) => {
  try {
    const payload = {
      ...req.body,
      reviewerId: req.user.userId
    };

    const result = reviewReport(req.params.id, payload);

    if (!result) {
      sendError(res, "Not Found", 404);
      return;
    }

    // Award 50 points when a report is approved
    if (payload.action === "approved") {
      const report = result.report;
      if (report && report.userId && report.userId !== "user-anonymous") {
        try {
          addPoints(report.userId, 50, "report_approved", report.id);
          createNotification(report.userId, "上报已通过审核", `您的上报「${report.aiTop1}」已通过审核，获得 50 积分奖励。`, "approved", report.id);
        } catch (_e) { /* points award is optional */ }
      }
    } else if (payload.action === "rejected") {
      const report = result.report;
      if (report && report.userId && report.userId !== "user-anonymous") {
        try {
          const reason = payload.comment ? `原因：${payload.comment}` : "请查看审核意见。";
          createNotification(report.userId, "上报未通过审核", `您的上报「${report.aiTop1}」未通过审核。${reason}`, "rejected", report.id);
        } catch (_e) { /* notification is optional */ }
      }
    }

    res.json({
      item: result.report,
      review: result.log
    });
  } catch (error) {
    sendError(res, "Invalid JSON body", 400);
  }
});

// --- Stats ---

app.get("/api/stats", (_req, res) => {
  res.json({
    item: getStats()
  });
});

// --- Points routes ---

app.get("/api/points/:userId", (req, res) => {
  const result = getPoints(req.params.userId);
  res.json({ item: result });
});

app.post("/api/points/:userId", authRequired, (req, res) => {
  const { amount, action, referenceId } = req.body || {};
  if (!amount || !action) {
    sendError(res, "Amount and action are required.", 400);
    return;
  }
  const result = addPoints(req.params.userId, amount, action, referenceId);
  res.status(201).json({ item: result });
});

// --- Shop routes ---

app.get("/api/shop/products", (_req, res) => {
  res.json({ items: getProducts() });
});

app.post("/api/shop/purchase", authRequired, (req, res) => {
  const { productId } = req.body || {};
  if (!productId) {
    sendError(res, "Product ID is required.", 400);
    return;
  }
  const result = createPurchase(req.user.userId, productId);
  if (result.error) {
    sendError(res, result.error, 400);
    return;
  }
  res.status(201).json({ item: result });
});

app.get("/api/shop/purchases/:userId", (req, res) => {
  res.json({ items: getUserPurchases(req.params.userId) });
});

// --- Notification routes ---

app.get("/api/notifications/:userId", authRequired, (req, res) => {
  if (req.user.userId !== req.params.userId) {
    sendError(res, "Access denied.", 403);
    return;
  }
  const items = getNotifications(req.params.userId, Number(req.query.limit) || 50);
  const unread = getUnreadNotificationCount(req.params.userId);
  res.json({ items, unread });
});

app.post("/api/notifications/:id/read", authRequired, (req, res) => {
  const notif = markNotificationRead(req.params.id);
  if (!notif) {
    sendError(res, "Not Found", 404);
    return;
  }
  res.json({ item: notif });
});

app.post("/api/notifications/:userId/read-all", authRequired, (req, res) => {
  if (req.user.userId !== req.params.userId) {
    sendError(res, "Access denied.", 403);
    return;
  }
  markAllNotificationsRead(req.params.userId);
  res.json({ success: true });
});

// --- Error handler ---

app.use((error, _req, res, _next) => {
  console.error("[server] request failed:", error);
  sendError(res, error.message || "Request failed.", 400);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
