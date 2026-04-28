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
