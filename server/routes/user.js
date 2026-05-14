const { Router } = require("express");
const { authRequired } = require("../middleware/auth");
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
  const notif = markNotificationRead(req.params.id);
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
  const user = updateUserAvatar(req.user.userId, avatarUrl);
  if (!user) {
    sendError(res, "User not found.", 404);
    return;
  }
  res.json({ item: { avatarUrl: user.avatarUrl } });
});

module.exports = router;
