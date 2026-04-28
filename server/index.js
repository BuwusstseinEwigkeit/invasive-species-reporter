require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const {
  getStats,
  getLeaderboard
} = require("./lib/store");
const db = require("./lib/database");
const corsMiddleware = require("./middleware/cors");
const { rateLimiter } = require("./middleware/rate-limit");
const securityHeaders = require("./middleware/security");
const { authRequired, reviewerRequired } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const speciesRoutes = require("./routes/species");
const reportsRoutes = require("./routes/reports");
const uploadsRoutes = require("./routes/uploads");
const shopRoutes = require("./routes/shop");
const userRoutes = require("./routes/user");
const { sendError, sendSuccess } = require("./lib/helpers");

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
app.use("/api", uploadsRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api", userRoutes);

// --- Stats ---

app.get("/api/stats", (_req, res) => {
  res.json({
    item: getStats()
  });
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
