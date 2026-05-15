const POINT_EVENTS = Object.freeze({
  REPORT_SUBMIT: Object.freeze({ action: "report_submit", amount: 5 }),
  FIRST_REPORT: Object.freeze({ action: "first_report", amount: 20 }),
  STREAK_BONUS: Object.freeze({ action: "streak_bonus", amount: 10 }),
  REPORT_APPROVED: Object.freeze({ action: "report_approved", amount: 20 }),
  HIGH_QUALITY: Object.freeze({ action: "high_quality", amount: 10 }),
  REPORT_SPAM: Object.freeze({ action: "report_spam", amount: -10 }),
  PURCHASE: Object.freeze({ action: "purchase" })
});

module.exports = { POINT_EVENTS };
