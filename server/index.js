require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {
  getSpeciesList,
  getSpeciesById,
  getSpeciesReports,
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
const reportsRoutes = require("./routes/reports");
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

app.use("/api/reports", reportsRoutes);


// --- Uploads ---
const sharp = require("sharp");

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
