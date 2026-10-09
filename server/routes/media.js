const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const { authOptional } = require("../middleware/auth");
const db = require("../lib/database");
const { getUpload } = require("../lib/upload-store");
const { sendError } = require("../lib/helpers");

const router = Router();
const uploadsDir = path.join(__dirname, "..", "uploads");

router.get("/uploads/:fileName", authOptional, (req, res) => {
  const fileName = req.params.fileName;
  if (!fileName || path.basename(fileName) !== fileName) {
    sendError(res, "Not Found", 404);
    return;
  }

  const relativeUrl = "/uploads/" + fileName;
  const filePath = path.join(uploadsDir, fileName);
  if (!fs.existsSync(filePath)) {
    sendError(res, "Not Found", 404);
    return;
  }

  // Avatars are display assets and become public once assigned to a profile.
  if (db.hasPublicAvatarUrl(relativeUrl)) {
    res.sendFile(filePath);
    return;
  }

  const report = db.getReportByImageUrl(relativeUrl);
  if (report && report.status === "approved") {
    res.sendFile(filePath);
    return;
  }

  if (req.user) {
    const currentUser = db.getUserById(req.user.userId);
    const canReview = currentUser && (currentUser.role === "reviewer" || currentUser.role === "admin");
    if (report && (report.userId === req.user.userId || canReview)) {
      res.sendFile(filePath);
      return;
    }

    const upload = getUpload(fileName);
    if (upload && upload.userId === req.user.userId) {
      res.sendFile(filePath);
      return;
    }
  }

  // Hide existence of pending/private media from unauthorized clients.
  sendError(res, "Not Found", 404);
});

module.exports = router;
