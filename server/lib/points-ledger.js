const db = require("./database");
const { POINT_EVENTS } = require("./point-events");

function writeEvent(userId, event, referenceId, overrideAmount) {
  const amount = overrideAmount === undefined ? event.amount : overrideAmount;
  if (!userId || !event || !event.action || !Number.isFinite(amount) || amount === 0) {
    throw new Error("Invalid points ledger event.");
  }
  db.addPoints(userId, amount, event.action, referenceId);
  return { action: event.action, amount };
}

function getPoints(userId) {
  return db.getPoints(userId);
}

function insertLedgerRow(database, userId, event, amount, referenceId) {
  if (!database || !userId || !event || !event.action || !Number.isFinite(amount) || amount === 0) {
    throw new Error("Invalid points ledger row.");
  }
  const crypto = require("crypto");
  database.prepare("INSERT INTO points_log (id, user_id, amount, action, reference_id) VALUES (?, ?, ?, ?, ?)").run(
    `points-${crypto.randomUUID()}`,
    userId,
    amount,
    event.action,
    referenceId || null
  );
}

// NOTE: 仅写 points_log 流水，不更新 points 表余额。
// 调用方必须已在同一事务内 UPDATE points 扣减余额，否则会导致余额/流水不一致。
// 与 writeEvent 的区别：writeEvent 通过 db.addPoints 同时更新余额+流水（事务外路径）。
function recordPurchaseInTransaction(database, userId, purchaseId, pointsCost) {
  insertLedgerRow(database, userId, POINT_EVENTS.PURCHASE, -pointsCost, purchaseId);
}

function awardReportSubmitted(userId, reportId) {
  return writeEvent(userId, POINT_EVENTS.REPORT_SUBMIT, reportId);
}

function awardFirstReport(userId, reportId) {
  return writeEvent(userId, POINT_EVENTS.FIRST_REPORT, reportId);
}

function awardStreakBonus(userId, reportId) {
  return writeEvent(userId, POINT_EVENTS.STREAK_BONUS, reportId);
}

function awardReportApproved(userId, reportId) {
  return writeEvent(userId, POINT_EVENTS.REPORT_APPROVED, reportId);
}

function awardHighQualityReport(userId, reportId) {
  return writeEvent(userId, POINT_EVENTS.HIGH_QUALITY, reportId);
}

function penalizeSpamReport(userId, reportId) {
  return writeEvent(userId, POINT_EVENTS.REPORT_SPAM, reportId);
}

module.exports = {
  POINT_EVENTS,
  getPoints,
  recordPurchaseInTransaction,
  awardReportSubmitted,
  awardFirstReport,
  awardStreakBonus,
  awardReportApproved,
  awardHighQualityReport,
  penalizeSpamReport
};
