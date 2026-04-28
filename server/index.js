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

// --- Start (skip when imported by test runner) ---
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
