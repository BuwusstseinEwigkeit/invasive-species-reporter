require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
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
  getUserPurchases,
  checkAndAwardAchievements,
  getAllAchievementsWithStatus,
  getUserCredit,
  updateUserCredit,
  checkReportLimit,
  checkImageDuplicate,
  addImageFingerprint,
  checkGeotemporalDuplicate,
  createReportWithPoints,
  getProductCategories,
  getUserPrivileges,
  createPurchaseFull,
  getOrdersByUser,
  updateOrderStatus,
  getLeaderboard
} = require("./lib/store");
const { registerUpload, getUpload, removeUpload } = require("./lib/upload-store");
const { createRecognitionJob, getRecognitionJob } = require("./lib/recognition-jobs");
const db = require("./lib/database");
const corsMiddleware = require("./middleware/cors");
const { rateLimiter } = require("./middleware/rate-limit");
const securityHeaders = require("./middleware/security");
const { authRequired, reviewerRequired } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const speciesRoutes = require("./routes/species");
const { sendError, sendSuccess, getPublicBaseUrl } = require("./lib/helpers");

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
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed."));
      return;
    }
    // Content validation deferred to sharp in upload handler
    cb(null, true);
  }
});

app.use(corsMiddleware);
app.use(rateLimiter);

app.use(securityHeaders);

app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));
app.use("/static", express.static(path.join(__dirname, "static")));


// --- Health ---

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "invasive-species-reporter-api"
  });
});

// --- Auth routes ---

app.use("/api/auth", authRoutes);

// --- Species routes ---

app.use("/api/species", speciesRoutes);

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

app.get("/api/reports/export/csv", authRequired, (_req, res) => {
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

const sharp = require("sharp");

// --- Uploads ---
app.post("/api/uploads", upload.single("image"), async (req, res) => {
  if (!req.file) {
    sendError(res, "No image uploaded.", 400);
    return;
  }

  // Validate actual image content with sharp
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
    let reportUserId = "";
    try {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.userId) reportUserId = decoded.userId;
      }
    } catch (_e) { /* ignore */ }

    const userId = reportUserId || "user-anonymous";

    // Check daily limit
    if (userId !== "user-anonymous") {
      const limit = checkReportLimit(userId);
      if (!limit.allowed) {
        sendError(res, `今日上报已达上限（每日${limit.dailyLimit}次），信用分过低请保持良好记录。`, 429);
        return;
      }
    }

    const { fileId, latitude, longitude } = req.body || {};

    // Image fingerprint dedup
    if (fileId) {
      const uploadRecord = getUpload(fileId);
      if (uploadRecord) {
        // compute md5 from file path
        const fs = require("fs");
        const crypto = require("crypto");
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

    // Geotemporal dedup (do not award points if dupe, but still create report)
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
      imageFingerprint: ""
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
      message: isDupe ? "Report created (duplicate location, no points awarded)." : "Report created and waiting for review.",
      pointsDelta: isDupe ? [] : result.pointsDelta
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

    // Award points based on action
    if (payload.action === "approved") {
      const report = result.report;
      if (report && report.userId && report.userId !== "user-anonymous") {
        try {
          // Base +20 for approval
          addPoints(report.userId, 20, "report_approved", report.id);
          // High quality bonus (+10) if AI score > 0.95 or reviewer marked it
          const isHighQuality = report.aiScore > 0.95 || payload.highQuality;
          if (isHighQuality) {
            addPoints(report.userId, 10, "high_quality", report.id);
          }
          updateUserCredit(report.userId, 2);
          createNotification(report.userId, "上报已通过审核",
            `您的上报「${report.aiTop1}」已通过审核${isHighQuality ? "（高质量+10）" : ""}，获得 ${isHighQuality ? 30 : 20} 积分奖励。`,
            "approved", report.id);
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
  const items = getProducts();
  const categories = getProductCategories();
  res.json({ items, categories });
});

app.post("/api/shop/purchase", authRequired, (req, res) => {
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

app.get("/api/shop/purchases/:userId", (req, res) => {
  res.json({ items: getUserPurchases(req.params.userId) });
});

app.get("/api/shop/orders/:userId", authRequired, (req, res) => {
  if (req.user.userId !== req.params.userId) {
    sendError(res, "Access denied.", 403);
    return;
  }
  res.json({ items: getOrdersByUser(req.params.userId) });
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

// --- Achievements ---

app.get("/api/achievements", authRequired, (req, res) => {
  const achievements = getAllAchievementsWithStatus(req.user.userId);
  res.json({ items: achievements });
});

app.post("/api/achievements/check", authRequired, (req, res) => {
  const newlyEarned = checkAndAwardAchievements(req.user.userId);
  res.json({ items: newlyEarned });
});

// --- User privileges ---

app.get("/api/user/privileges", authRequired, (req, res) => {
  const credit = getUserCredit(req.user.userId);
  const privileges = getUserPrivileges(req.user.userId);
  res.json({ item: { credit, ...privileges } });
});

// --- Leaderboard ---

app.get("/api/leaderboard", (_req, res) => {
  const type = (_req.query.type || "weekly") ;
  if (!["weekly", "total", "newcomer"].includes(type)) {
    sendError(res, "type must be weekly/total/newcomer", 400);
    return;
  }
  const items = getLeaderboard(type, 50);
  res.json({ items });
});

// --- Error handler ---

app.use((error, _req, res, _next) => {
  console.error("[server] request failed:", error);
  sendError(res, error.message || "Request failed.", 400);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
