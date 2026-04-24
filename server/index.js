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
  getSpeciesReports,
  createReport,
  reviewReport,
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
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_err) {
    res.status(401).json({ message: "Invalid or expired token." });
  }
}

function reviewerRequired(req, res, next) {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  const user = db.getUserById(req.user.userId);
  if (!user) {
    res.status(401).json({ message: "User not found." });
    return;
  }

  if (user.role !== "reviewer" && user.role !== "admin") {
    res.status(403).json({ message: "Reviewer role required." });
    return;
  }

  req.userRole = user.role;
  next();
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
    res.status(400).json({ message: "Username and password are required." });
    return;
  }

  if (username.length < 3 || password.length < 4) {
    res.status(400).json({ message: "Username must be at least 3 chars, password at least 4 chars." });
    return;
  }

  const userRole = role === "reviewer" ? "user" : (role || "user"); // Only admin can create reviewer; default to user
  const user = db.createUser(username, password, userRole);

  if (!user) {
    res.status(409).json({ message: "Username already taken." });
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
    res.status(400).json({ message: "Username and password are required." });
    return;
  }

  const user = db.authenticateUser(username, password);

  if (!user) {
    res.status(401).json({ message: "Invalid username or password." });
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

// --- Species ---

app.get("/api/species", (_req, res) => {
  res.json({
    items: getSpeciesList()
  });
});

app.get("/api/species/:id", (req, res) => {
  const species = getSpeciesById(req.params.id);

  if (!species) {
    res.status(404).json({ message: "Not Found" });
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

// --- Uploads ---

app.post("/api/uploads", upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "No image uploaded." });
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
    res.status(404).json({ message: "Uploaded file not found." });
    return;
  }

  const job = createRecognitionJob({
    fileId: req.body.fileId,
    speciesList: getSpeciesList()
  });

  if (!job) {
    res.status(404).json({ message: "Uploaded file not found." });
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
    res.status(404).json({ message: "Recognition job not found." });
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
    res.status(400).json({
      message: "Invalid JSON body"
    });
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
      res.status(404).json({ message: "Not Found" });
      return;
    }

    // Award 50 points when a report is approved
    if (payload.action === "approved") {
      const report = result.report;
      if (report && report.userId && report.userId !== "user-anonymous") {
        try {
          addPoints(report.userId, 50, "report_approved", report.id);
        } catch (_e) { /* points award is optional */ }
      }
    }

    res.json({
      item: result.report,
      review: result.log
    });
  } catch (error) {
    res.status(400).json({
      message: "Invalid JSON body"
    });
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
    res.status(400).json({ message: "Amount and action are required." });
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
    res.status(400).json({ message: "Product ID is required." });
    return;
  }
  const result = createPurchase(req.user.userId, productId);
  if (result.error) {
    res.status(400).json({ message: result.error });
    return;
  }
  res.status(201).json({ item: result });
});

app.get("/api/shop/purchases/:userId", (req, res) => {
  res.json({ items: getUserPurchases(req.params.userId) });
});

// --- Error handler ---

app.use((error, _req, res, _next) => {
  console.error("[server] request failed:", error);
  res.status(400).json({
    message: error.message || "Request failed."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
