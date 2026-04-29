const { Router } = require("express");
const { getStats, getLeaderboard } = require("../lib/store");
const { sendError } = require("../lib/helpers");

const router = Router();

// GET /api/stats
router.get("/stats", (_req, res) => {
  res.json({ item: getStats() });
});

// GET /api/leaderboard
router.get("/leaderboard", (req, res) => {
  const type = req.query.type || "weekly";
  if (!["weekly", "total", "newcomer"].includes(type)) {
    sendError(res, "type must be weekly/total/newcomer", 400);
    return;
  }
  const items = getLeaderboard(type, 50);
  res.json({ items });
});

module.exports = router;
