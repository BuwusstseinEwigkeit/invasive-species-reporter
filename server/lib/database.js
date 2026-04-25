const Database = require("better-sqlite3");
const path = require("path");

let db = null;

function getDb() {
  if (db) return db;

  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "../data/invasive-species.db");
  const fs = require("fs");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function initSchema() {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS species (
      id TEXT PRIMARY KEY,
      chinese_name TEXT NOT NULL,
      latin_name TEXT,
      category TEXT,
      risk_level TEXT,
      avatar TEXT,
      summary TEXT,
      harm TEXT,
      suggestion TEXT,
      origin TEXT,
      control_methods TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'user-anonymous',
      species_id TEXT,
      ai_top1 TEXT,
      ai_score REAL DEFAULT 0,
      ai_candidates TEXT DEFAULT '[]',
      image_url TEXT,
      latitude REAL DEFAULT 0,
      longitude REAL DEFAULT 0,
      address TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS review_logs (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL DEFAULT 'reviewer-demo',
      action TEXT NOT NULL,
      final_species_id TEXT,
      comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('user','reviewer','admin')),
      openid TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_reports_species ON reports(species_id);
    CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_review_logs_report ON review_logs(report_id);

    CREATE TABLE IF NOT EXISTS points (
      user_id TEXT PRIMARY KEY,
      total INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS points_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      action TEXT NOT NULL,
      reference_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      points_cost INTEGER NOT NULL,
      image_url TEXT,
      stock INTEGER DEFAULT 999
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_points_log_user ON points_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'info',
      reference_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);

  // Schema upgrades for existing databases
  try {
    d.exec("ALTER TABLE users ADD COLUMN openid TEXT");
  } catch (_e) { /* column already exists */ }

  try {
    d.exec("ALTER TABLE species ADD COLUMN origin TEXT");
  } catch (_e) { /* column already exists */ }

  try {
    d.exec("ALTER TABLE species ADD COLUMN control_methods TEXT");
  } catch (_e) { /* column already exists */ }

  try {
    d.exec("ALTER TABLE species ADD COLUMN relations TEXT");
  } catch (_e) { /* column already exists */ }

  try {
    d.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_openid ON users(openid)");
  } catch (_e) { /* ignore */ }
}

function seedSpecies(speciesList) {
  const d = getDb();
  const insert = d.prepare(`
    INSERT OR REPLACE INTO species (id, chinese_name, latin_name, category, risk_level, avatar, summary, harm, suggestion, origin, control_methods, relations)
    VALUES (@id, @chineseName, @latinName, @category, @riskLevel, @avatar, @summary, @harm, @suggestion, @origin, @controlMethods, @relations)
  `);

  const seedMany = d.transaction((items) => {
    for (const item of items) {
      insert.run({
        id: item.id,
        chineseName: item.chineseName,
        latinName: item.latinName,
        category: item.category,
        riskLevel: item.riskLevel,
        avatar: item.avatar,
        summary: item.summary,
        harm: item.harm,
        suggestion: item.suggestion,
        origin: item.origin || '',
        controlMethods: item.controlMethods || '',
        relations: JSON.stringify(item.relations || [])
      });
    }
  });

  seedMany(speciesList);
}

function seedReports(reports) {
  const d = getDb();
  const insert = d.prepare(`
    INSERT OR REPLACE INTO reports (id, user_id, species_id, ai_top1, ai_score, ai_candidates, image_url, latitude, longitude, address, remark, status, created_at)
    VALUES (@id, @userId, @speciesId, @aiTop1, @aiScore, @aiCandidates, @imageUrl, @latitude, @longitude, @address, @remark, @status, @createdAt)
  `);

  const seedMany = d.transaction((items) => {
    for (const item of items) {
      insert.run({
        id: item.id,
        userId: item.userId,
        speciesId: item.speciesId,
        aiTop1: item.aiTop1,
        aiScore: item.aiScore,
        aiCandidates: JSON.stringify(item.aiCandidates || []),
        imageUrl: item.imageUrl,
        latitude: item.latitude,
        longitude: item.longitude,
        address: item.address,
        remark: item.remark,
        status: item.status,
        createdAt: item.createdAt
      });
    }
  });

  seedMany(reports);
}

function seedReviewLogs(logs) {
  const d = getDb();
  const insert = d.prepare(`
    INSERT OR REPLACE INTO review_logs (id, report_id, reviewer_id, action, final_species_id, comment, created_at)
    VALUES (@id, @reportId, @reviewerId, @action, @finalSpeciesId, @comment, @createdAt)
  `);

  const seedMany = d.transaction((items) => {
    for (const item of items) {
      insert.run({
        id: item.id,
        reportId: item.reportId,
        reviewerId: item.reviewerId,
        action: item.action,
        finalSpeciesId: item.finalSpeciesId,
        comment: item.comment,
        createdAt: item.createdAt
      });
    }
  });

  seedMany(logs);
}

function rowToSpecies(row) {
  return {
    id: row.id,
    chineseName: row.chinese_name,
    latinName: row.latin_name,
    category: row.category,
    riskLevel: row.risk_level,
    avatar: row.avatar,
    summary: row.summary,
    harm: row.harm,
    suggestion: row.suggestion,
    origin: row.origin || '',
    controlMethods: row.control_methods || '',
    relations: JSON.parse(row.relations || '[]')
  };
}

function rowToReport(row) {
  return {
    id: row.id,
    userId: row.user_id,
    speciesId: row.species_id,
    aiTop1: row.ai_top1,
    aiScore: row.ai_score,
    aiCandidates: JSON.parse(row.ai_candidates || "[]"),
    imageUrl: row.image_url,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    remark: row.remark,
    status: row.status,
    createdAt: row.created_at
  };
}

function rowToReviewLog(row) {
  return {
    id: row.id,
    reportId: row.report_id,
    reviewerId: row.reviewer_id,
    action: row.action,
    finalSpeciesId: row.final_species_id,
    comment: row.comment,
    createdAt: row.created_at
  };
}

function rowToUser(row) {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    openid: row.openid,
    createdAt: row.created_at
  };
}

// --- Species queries ---

function getSpeciesList() {
  return getDb().prepare("SELECT * FROM species ORDER BY id").all().map(rowToSpecies);
}

function getSpeciesById(id) {
  const row = getDb().prepare("SELECT * FROM species WHERE id = ?").get(id);
  return row ? rowToSpecies(row) : null;
}

// --- Report queries ---

function getReports(status, page, limit) {
  const d = getDb();
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (p - 1) * l;

  let rows, total;
  if (status) {
    rows = d.prepare("SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(status, l, offset);
    total = d.prepare("SELECT COUNT(*) as c FROM reports WHERE status = ?").get(status).c;
  } else {
    rows = d.prepare("SELECT * FROM reports ORDER BY created_at DESC LIMIT ? OFFSET ?").all(l, offset);
    total = d.prepare("SELECT COUNT(*) as c FROM reports").get().c;
  }

  return {
    items: rows.map(rowToReport),
    pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) }
  };
}

function getReportsByUser(userId, status, page, limit) {
  const d = getDb();
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (p - 1) * l;

  let rows, total;
  if (status) {
    rows = d.prepare("SELECT * FROM reports WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(userId, status, l, offset);
    total = d.prepare("SELECT COUNT(*) as c FROM reports WHERE user_id = ? AND status = ?").get(userId, status).c;
  } else {
    rows = d.prepare("SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(userId, l, offset);
    total = d.prepare("SELECT COUNT(*) as c FROM reports WHERE user_id = ?").get(userId).c;
  }

  return {
    items: rows.map(rowToReport),
    pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) }
  };
}

function getSpeciesReports(speciesId) {
  return getDb().prepare("SELECT * FROM reports WHERE species_id = ? ORDER BY created_at DESC").all(speciesId).map(rowToReport);
}

function getReportById(id) {
  const row = getDb().prepare("SELECT * FROM reports WHERE id = ?").get(id);
  return row ? rowToReport(row) : null;
}

function createReport(payload) {
  const d = getDb();
  const id = `report-${Date.now()}`;
  d.prepare(`
    INSERT INTO reports (id, user_id, species_id, ai_top1, ai_score, ai_candidates, image_url, latitude, longitude, address, remark, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    id,
    payload.userId || "user-anonymous",
    payload.speciesId || null,
    payload.aiTop1 || "未识别",
    Number(payload.aiScore || 0),
    JSON.stringify(payload.aiCandidates || []),
    payload.imageUrl || "",
    Number(payload.latitude || 0),
    Number(payload.longitude || 0),
    payload.address || "",
    payload.remark || ""
  );
  return getReportById(id);
}

function reviewReport(reportId, payload) {
  const d = getDb();
  const target = d.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
  if (!target) return null;

  d.prepare("UPDATE reports SET status = ?, species_id = ? WHERE id = ?").run(
    payload.action,
    payload.finalSpeciesId || target.species_id,
    reportId
  );

  const finalSpecies = payload.finalSpeciesId ? getSpeciesById(payload.finalSpeciesId) : null;
  if (finalSpecies) {
    d.prepare("UPDATE reports SET ai_top1 = ? WHERE id = ?").run(finalSpecies.chineseName, reportId);
  }

  const logId = `review-${Date.now()}`;
  d.prepare(`
    INSERT INTO review_logs (id, report_id, reviewer_id, action, final_species_id, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    logId,
    reportId,
    payload.reviewerId || "reviewer-demo",
    payload.action,
    payload.finalSpeciesId || null,
    payload.comment || ""
  );

  return {
    report: getReportById(reportId),
    log: rowToReviewLog(d.prepare("SELECT * FROM review_logs WHERE id = ?").get(logId))
  };
}

function getReviewLogs(reportId) {
  return getDb().prepare("SELECT * FROM review_logs WHERE report_id = ? ORDER BY created_at DESC").all(reportId).map(rowToReviewLog);
}

// --- Export ---

function getApprovedReportsForExport() {
  const rows = getDb().prepare(`
    SELECT r.id, r.user_id, r.ai_top1, r.ai_score, r.image_url,
           r.latitude, r.longitude, r.address, r.remark, r.created_at,
           s.chinese_name AS species_name, s.latin_name AS species_latin,
           s.risk_level AS species_risk, s.category AS species_category,
           s.origin AS species_origin
    FROM reports r
    LEFT JOIN species s ON r.species_id = s.id
    WHERE r.status = 'approved'
    ORDER BY r.created_at DESC
  `).all();
  return rows;
}

// --- Stats ---

function getStats() {
  const d = getDb();
  return {
    totalReports: d.prepare("SELECT COUNT(*) as c FROM reports").get().c,
    approvedReports: d.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'approved'").get().c,
    pendingReports: d.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'").get().c,
    rejectedReports: d.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'rejected'").get().c,
    totalSpecies: d.prepare("SELECT COUNT(*) as c FROM species").get().c
  };
}

// --- User queries ---

const crypto = require("crypto");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash === verify;
}

function createUser(username, password, role = "user") {
  const d = getDb();
  const id = `user-${Date.now()}`;
  try {
    d.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)").run(
      id, username, hashPassword(password), role
    );
    return rowToUser(d.prepare("SELECT * FROM users WHERE id = ?").get(id));
  } catch (err) {
    if (err.message.includes("UNIQUE constraint")) {
      return null; // duplicate username
    }
    throw err;
  }
}

function getUserByUsername(username) {
  const row = getDb().prepare("SELECT * FROM users WHERE username = ?").get(username);
  return row ? rowToUser(row) : null;
}

function getUserById(id) {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
  return row ? rowToUser(row) : null;
}

function getUserByOpenId(openid) {
  const row = getDb().prepare("SELECT * FROM users WHERE openid = ?").get(openid);
  return row ? rowToUser(row) : null;
}

function createUserFromOpenId(openid, username) {
  const d = getDb();
  const id = `user-${Date.now()}`;
  // Generate a random password hash (not used for WeChat login)
  const randomHash = hashPassword(Math.random().toString(36));
  const displayName = username || `wx_${openid.slice(-8)}`;
  d.prepare("INSERT INTO users (id, username, password_hash, role, openid) VALUES (?, ?, ?, 'user', ?)").run(
    id, displayName, randomHash, openid
  );
  return rowToUser(d.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function authenticateUser(username, password) {
  const user = getUserByUsername(username);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

// --- Points queries ---

function getPoints(userId) {
  const d = getDb();
  const row = d.prepare("SELECT * FROM points WHERE user_id = ?").get(userId);
  const logs = d.prepare("SELECT * FROM points_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(userId);
  return {
    total: row ? row.total : 0,
    logs: logs.map(rowToPointsLog)
  };
}

function rowToPointsLog(row) {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    action: row.action,
    referenceId: row.reference_id,
    createdAt: row.created_at
  };
}

function addPoints(userId, amount, action, referenceId) {
  const d = getDb();
  const existing = d.prepare("SELECT * FROM points WHERE user_id = ?").get(userId);
  if (existing) {
    d.prepare("UPDATE points SET total = total + ?, updated_at = datetime('now') WHERE user_id = ?").run(amount, userId);
  } else {
    d.prepare("INSERT INTO points (user_id, total) VALUES (?, ?)").run(userId, Math.max(0, amount));
  }
  const id = `points-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  d.prepare("INSERT INTO points_log (id, user_id, amount, action, reference_id) VALUES (?, ?, ?, ?, ?)").run(
    id, userId, amount, action, referenceId || null
  );
  const total = d.prepare("SELECT total FROM points WHERE user_id = ?").get(userId).total;
  return { total, logId: id };
}

// --- Product queries ---

function getProducts() {
  return getDb().prepare("SELECT * FROM products ORDER BY points_cost ASC").all().map(rowToProduct);
}

function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    pointsCost: row.points_cost,
    imageUrl: row.image_url,
    stock: row.stock
  };
}

function seedProducts(products) {
  const d = getDb();
  const insert = d.prepare(`
    INSERT OR REPLACE INTO products (id, name, description, points_cost, image_url, stock)
    VALUES (@id, @name, @description, @pointsCost, @imageUrl, @stock)
  `);
  const seedMany = d.transaction((items) => {
    for (const item of items) {
      insert.run({
        id: item.id,
        name: item.name,
        description: item.description,
        pointsCost: item.pointsCost,
        imageUrl: item.imageUrl || "",
        stock: item.stock !== undefined ? item.stock : 999
      });
    }
  });
  seedMany(products);
}

function createPurchase(userId, productId) {
  const d = getDb();
  const product = d.prepare("SELECT * FROM products WHERE id = ?").get(productId);
  if (!product) return { error: "Product not found" };
  const pointsRow = d.prepare("SELECT * FROM points WHERE user_id = ?").get(userId);
  const currentTotal = pointsRow ? pointsRow.total : 0;
  if (currentTotal < product.points_cost) {
    return { error: "Insufficient points" };
  }
  if (product.stock <= 0) {
    return { error: "Out of stock" };
  }

  const purchaseId = `purchase-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  d.prepare("UPDATE points SET total = total - ?, updated_at = datetime('now') WHERE user_id = ?").run(product.points_cost, userId);
  d.prepare("INSERT INTO purchases (id, user_id, product_id) VALUES (?, ?, ?)").run(purchaseId, userId, productId);
  d.prepare("UPDATE products SET stock = stock - 1 WHERE id = ?").run(productId);

  const newTotal = d.prepare("SELECT total FROM points WHERE user_id = ?").get(userId).total;
  return {
    purchase: {
      id: purchaseId,
      userId,
      productId,
      createdAt: new Date().toISOString()
    },
    newTotal
  };
}

function getUserPurchases(userId) {
  return getDb().prepare("SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC").all(userId).map(rowToPurchase);
}

function rowToPurchase(row) {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    createdAt: row.created_at
  };
}

// --- Notification queries ---

function createNotification(userId, title, body, type, referenceId) {
  const d = getDb();
  const id = `notif-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  d.prepare(`
    INSERT INTO notifications (id, user_id, title, body, type, reference_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, body || "", type || "info", referenceId || null);
  return rowToNotification(d.prepare("SELECT * FROM notifications WHERE id = ?").get(id));
}

function getNotifications(userId, limit = 50) {
  return getDb().prepare(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
  ).all(userId, limit).map(rowToNotification);
}

function getUnreadNotificationCount(userId) {
  const row = getDb().prepare(
    "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0"
  ).get(userId);
  return row ? row.c : 0;
}

function markNotificationRead(id) {
  getDb().prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
  const row = getDb().prepare("SELECT * FROM notifications WHERE id = ?").get(id);
  return row ? rowToNotification(row) : null;
}

function markAllNotificationsRead(userId) {
  getDb().prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0").run(userId);
}

function rowToNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    type: row.type,
    referenceId: row.reference_id,
    isRead: !!row.is_read,
    createdAt: row.created_at
  };
}

module.exports = {
  getDb,
  initSchema,
  seedSpecies,
  seedReports,
  seedReviewLogs,
  getSpeciesList,
  getSpeciesById,
  getReports,
  getReportsByUser,
  getSpeciesReports,
  getReportById,
  createReport,
  reviewReport,
  getReviewLogs,
  getStats,
  getApprovedReportsForExport,
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  createUser,
  getUserByUsername,
  getUserById,
  getUserByOpenId,
  createUserFromOpenId,
  authenticateUser,
  hashPassword,
  verifyPassword,
  getPoints,
  addPoints,
  getProducts,
  seedProducts,
  createPurchase,
  getUserPurchases
};
