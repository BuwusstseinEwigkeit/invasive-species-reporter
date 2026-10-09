const { Router } = require("express");
const { authRequired, authOptional, reviewerRequired } = require("../middleware/auth");
const {
  getReports,
  getReportsByUser,
  getReportById,
  getReviewLogs,
  getApprovedReportsForExport,
  reviewReport,
  getUserPrivileges,
  getUserProfile,
} = require("../lib/store");
const { createUserReport } = require("../lib/report-submission");
const { sendError } = require("../lib/helpers");

const router = Router();
const REVIEW_ACTIONS = new Set(["approved", "rejected", "spam"]);

function publicReport(report) {
  if (!report) return report;
  return {
    id: report.id,
    speciesId: report.speciesId,
    aiTop1: report.aiTop1,
    aiScore: report.aiScore,
    aiCandidates: report.aiCandidates,
    imageUrl: report.imageUrl,
    latitude: report.latitude,
    longitude: report.longitude,
    address: report.address,
    remark: report.remark,
    status: report.status,
    createdAt: report.createdAt,
  };
}

function paginationPayload(result, mapper) {
  return {
    items: result.items.map(mapper || ((item) => item)),
    page: result.pagination.page,
    limit: result.pagination.limit,
    total: result.pagination.total,
    totalPages: result.pagination.totalPages,
  };
}

// Public feed: only approved reports are ever exposed.
router.get("/", (req, res) => {
  const result = getReports("approved", req.query.page, req.query.limit);
  res.json(paginationPayload(result, publicReport));
});

// Reviewer queue: pending reports contain private/raw submission data.
router.get("/review-queue", authRequired, reviewerRequired, (req, res) => {
  const result = getReports("pending", req.query.page, req.query.limit);
  res.json(paginationPayload(result));
});

// Current user's own reports.
router.get("/my", authRequired, (req, res) => {
  const result = getReportsByUser(req.user.userId, req.query.status, req.query.page, req.query.limit);
  res.json(paginationPayload(result));
});

// Privileged CSV export.
router.get("/export/csv", authRequired, (req, res) => {
  const profile = getUserProfile(req.user.userId);
  const privileges = getUserPrivileges(req.user.userId);
  const elevated = profile && (profile.role === "reviewer" || profile.role === "admin");
  if (!elevated && !privileges.canExportReports) {
    sendError(res, "Export permission required.", 403);
    return;
  }

  const rows = getApprovedReportsForExport();
  const bom = "\uFEFF";
  const headers = [
    "ID", "用户ID", "识别物种", "拉丁名", "识别置信度",
    "入侵等级", "物种类别", "原产地",
    "经度", "纬度", "地点", "备注", "图片URL", "上报时间",
  ];

  const csvRows = rows.map((r) =>
    [
      r.id, r.user_id, r.ai_top1, r.species_latin || "",
      r.ai_score !== null ? Number(r.ai_score).toFixed(2) : "",
      r.species_risk || "", r.species_category || "", r.species_origin || "",
      r.longitude, r.latitude, r.address || "",
      r.remark || "", r.image_url || "", r.created_at,
    ]
      .map((value) => (value === null || value === undefined ? "" : `"${String(value).replace(/"/g, '""')}"`))
      .join(",")
  );

  const csv = bom + headers.join(",") + "\n" + csvRows.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="invasive-species-export-${Date.now()}.csv"`);
  res.send(csv);
});

// Report detail: approved reports are public. Draft/rejected/spam reports are owner/reviewer only.
router.get("/:id", authOptional, (req, res) => {
  const report = getReportById(req.params.id);
  if (!report) {
    sendError(res, "Not Found", 404);
    return;
  }

  const profile = req.user ? getUserProfile(req.user.userId) : null;
  const canViewPrivate = !!req.user && (
    report.userId === req.user.userId ||
    (profile && (profile.role === "reviewer" || profile.role === "admin"))
  );

  if (report.status === "approved" && !canViewPrivate) {
    res.json({ item: publicReport(report), review: [] });
    return;
  }

  if (!canViewPrivate) {
    sendError(res, "Not Found", 404);
    return;
  }

  res.json({ item: report, review: getReviewLogs(report.id) });
});

// Create a report from a server-owned upload/recognition chain.
router.post("/", authRequired, (req, res) => {
  try {
    const result = createUserReport(req.user.userId, req.body || {});
    res.status(201).json({
      item: result.report,
      message: result.isDupe
        ? "上报已创建（重复位置，不发放积分）。"
        : "上报已创建，等待审核。",
      pointsDelta: result.pointsDelta,
    });
  } catch (error) {
    if (error.statusCode) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, "Report submission failed.", 500);
  }
});

// Reviewer decision. Database layer enforces pending-only, idempotent and atomic side-effects.
router.post("/:id/review", authRequired, reviewerRequired, (req, res) => {
  try {
    const action = req.body && req.body.action;
    if (!REVIEW_ACTIONS.has(action)) {
      sendError(res, "action must be approved/rejected/spam", 400);
      return;
    }

    const result = reviewReport(req.params.id, {
      ...req.body,
      reviewerId: req.user.userId,
    });

    if (!result) {
      sendError(res, "Not Found", 404);
      return;
    }
    if (result.conflict) {
      sendError(res, "This report has already been reviewed.", 409);
      return;
    }

    res.json({
      item: result.report,
      review: result.log,
    });
  } catch (error) {
    if (error.statusCode) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    sendError(res, "Review failed.", 500);
  }
});

module.exports = router;
