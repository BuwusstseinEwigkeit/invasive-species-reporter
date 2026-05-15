const { Router } = require("express");
const { authRequired, reviewerRequired } = require("../middleware/auth");
const {
  getReports,
  getReportsByUser,
  getApprovedReportsForExport,
  reviewReport,
  updateUserCredit,
  createNotification,
  checkAndAwardAchievements,
} = require("../lib/store");
const pointsLedger = require("../lib/points-ledger");
const { createUserReport } = require("../lib/report-submission");
const { sendError } = require("../lib/helpers");

const router = Router();
const REVIEW_ACTIONS = new Set(["approved", "rejected", "spam"]);

// GET /api/reports
router.get("/", (req, res) => {
  const result = getReports(req.query.status, req.query.page, req.query.limit);
  res.json({
    items: result.items,
    page: result.pagination.page,
    limit: result.pagination.limit,
    total: result.pagination.total,
    totalPages: result.pagination.totalPages,
  });
});

// GET /api/reports/my
router.get("/my", authRequired, (req, res) => {
  const result = getReportsByUser(req.user.userId, req.query.status, req.query.page, req.query.limit);
  res.json({
    items: result.items,
    page: result.pagination.page,
    limit: result.pagination.limit,
    total: result.pagination.total,
    totalPages: result.pagination.totalPages,
  });
});

// GET /api/reports/export/csv
router.get("/export/csv", authRequired, (_req, res) => {
  const rows = getApprovedReportsForExport();

  const bom = "\uFEFF";
  const headers = [
    "ID", "用户ID", "识别物种", "拉丁名", "识别置信度",
    "入侵等级", "物种类别", "原产地",
    "经度", "纬度", "地点", "备注", "图片URL",
    "上报时间",
  ];

  const csvRows = rows.map((r) =>
    [
      r.id, r.user_id, r.ai_top1, r.species_latin || "",
      r.ai_score !== null ? Number(r.ai_score).toFixed(2) : "",
      r.species_risk || "", r.species_category || "", r.species_origin || "",
      r.longitude, r.latitude, r.address || "",
      (r.remark || "").replace(/"/g, '""'),
      r.image_url || "", r.created_at,
    ]
      .map((v) => (v === null || v === undefined ? "" : `"${String(v).replace(/"/g, '""')}"`))
      .join(",")
  );

  const csv = bom + headers.join(",") + "\n" + csvRows.join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="invasive-species-export-${Date.now()}.csv"`);
  res.send(csv);
});

// POST /api/reports
router.post("/", authRequired, (req, res) => {
  try {
    const userId = req.user.userId;
    const result = createUserReport(userId, req.body || {});
    const isDupe = result.isDupe;

    res.status(201).json({
      item: result.report,
      message: isDupe
        ? "上报已创建（重复位置，不发放积分）。"
        : "上报已创建，等待审核。",
      pointsDelta: result.pointsDelta,
    });
  } catch (error) {
    if (error.statusCode) {
      sendError(res, error.message, error.statusCode);
    } else {
      sendError(res, "Invalid request", 400);
    }
  }
});

// POST /api/reports/:id/review
router.post("/:id/review", authRequired, reviewerRequired, (req, res) => {
  try {
    if (!REVIEW_ACTIONS.has(req.body && req.body.action)) {
      sendError(res, "action must be approved/rejected/spam", 400);
      return;
    }

    const payload = {
      ...req.body,
      reviewerId: req.user.userId,
    };

    const result = reviewReport(req.params.id, payload);

    if (!result) {
      sendError(res, "Not Found", 404);
      return;
    }

    if (payload.action === "approved") {
      const report = result.report;
      if (report && report.userId && report.userId !== "user-anonymous") {
        try {
          pointsLedger.awardReportApproved(report.userId, report.id);
          const isHighQuality = report.aiScore > 0.95 || payload.highQuality;
          if (isHighQuality) {
            pointsLedger.awardHighQualityReport(report.userId, report.id);
          }
          updateUserCredit(report.userId, 2);
          createNotification(
            report.userId,
            "上报已通过审核",
            `您的上报「${report.aiTop1}」已通过审核${isHighQuality ? "（高质量+10）" : ""}，获得 ${isHighQuality ? 30 : 20} 积分奖励。`,
            "approved",
            report.id
          );
          const newlyEarned = checkAndAwardAchievements(report.userId);
          if (newlyEarned.length > 0) {
            createNotification(report.userId, "🏆 获得新成就", `恭喜获得「${newlyEarned[0].name}」成就！`, "achievement", null);
          }
        } catch (_e) { /* optional */ }
      }
    } else if (payload.action === "rejected") {
      const report = result.report;
      if (report && report.userId && report.userId !== "user-anonymous") {
        try {
          updateUserCredit(report.userId, -3);
          const reason = payload.comment ? `原因：${payload.comment}` : "请查看审核意见。";
          createNotification(report.userId, "上报未通过审核", `您的上报「${report.aiTop1}」未通过审核。${reason}`, "rejected", report.id);
        } catch (_e) { /* optional */ }
      }
    } else if (payload.action === "spam") {
      const report = result.report;
      if (report && report.userId && report.userId !== "user-anonymous") {
        try {
          pointsLedger.penalizeSpamReport(report.userId, report.id);
          updateUserCredit(report.userId, -10);
          createNotification(report.userId, "⚠️ 上报被标记为无效", `您的上报「${report.aiTop1}」被判定为垃圾上报，积分-10，信用分-10。`, "rejected", report.id);
        } catch (_e) { /* optional */ }
      }
    }

    res.json({
      item: result.report,
      review: result.log,
    });
  } catch (error) {
    sendError(res, "Invalid JSON body", 400);
  }
});

module.exports = router;
