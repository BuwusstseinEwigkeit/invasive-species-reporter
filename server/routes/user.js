const { Router } = require("express");
const path = require("path");
const { authRequired } = require("../middleware/auth");
const { getUploadForUser, removeUpload } = require("../lib/upload-store");
const {
  getPoints,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  checkAndAwardAchievements,
  getAllAchievementsWithStatus,
  getUserCredit,
  getUserPrivileges,
  updateUserAvatar,
  getUserProfile,
} = require("../lib/store");
const { sendError } = require("../lib/helpers");

const router = Router();

// GET /api/points/:userId
router.get("/points/:userId", authRequired, (req, res) => {
  if (req.user.userId !== req.params.userId) {
    sendError(res, "Access denied.", 403);
    return;
  }
  const result = getPoints(req.params.userId);
  res.json({ item: result });
});

// POST /api/points/:userId
router.post("/points/:userId", authRequired, (req, res) => {
  if (req.user.userId !== req.params.userId) {
    sendError(res, "Access denied.", 403);
    return;
  }
  sendError(res, "Point balances are managed by system events.", 403);
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
  const notif = markNotificationRead(req.params.id, req.user.userId);
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

// GET /api/user/profile/:userId
router.get("/user/profile/:userId", authRequired, (req, res) => {
  if (req.user.userId !== req.params.userId) {
    sendError(res, "Access denied.", 403);
    return;
  }
  const profile = getUserProfile(req.params.userId);
  if (!profile) {
    sendError(res, "User not found.", 404);
    return;
  }
  res.json({ item: profile });
});

// POST /api/user/avatar
router.post("/user/avatar", authRequired, (req, res) => {
  const { avatarUrl } = req.body || {};
  if (avatarUrl === undefined) {
    sendError(res, "avatarUrl is required.", 400);
    return;
  }

  const rawAvatarUrl = String(avatarUrl || "").trim();
  if (!rawAvatarUrl) {
    const user = updateUserAvatar(req.user.userId, "");
    res.json({ item: { avatarUrl: user ? user.avatarUrl : "" } });
    return;
  }

  let pathname = rawAvatarUrl;
  try {
    if (/^https?:\/\//i.test(rawAvatarUrl)) {
      pathname = new URL(rawAvatarUrl).pathname;
    } else {
      pathname = rawAvatarUrl.split("?")[0];
    }
  } catch (_e) {
    sendError(res, "Invalid avatarUrl.", 400);
    return;
  }

  if (!pathname.startsWith("/uploads/")) {
    sendError(res, "Avatar must come from an owned upload.", 400);
    return;
  }

  const fileId = path.posix.basename(pathname);
  const upload = getUploadForUser(fileId, req.user.userId);
  if (!upload) {
    sendError(res, "Avatar upload not found or not owned by current user.", 404);
    return;
  }

  const storedAvatarUrl = `/uploads/${upload.filename}`;
  const user = updateUserAvatar(req.user.userId, storedAvatarUrl);
  if (!user) {
    sendError(res, "User not found.", 404);
    return;
  }
  removeUpload(upload.fileId);
  res.json({ item: { avatarUrl: user.avatarUrl } });
});

module.exports = router;
