const db = require("./database");

let initialized = false;

function ensureInitialized() {
  if (initialized) return;

  db.initSchema();

  const { species, reports, reviewLogs } = require("../data/mock-data");
  db.seedSpecies(species);
  db.seedReports(reports);
  db.seedReviewLogs(reviewLogs);

  initialized = true;
}

function getSpeciesList() {
  ensureInitialized();
  return db.getSpeciesList();
}

function getSpeciesById(id) {
  ensureInitialized();
  return db.getSpeciesById(id);
}

function getReports(status, page, limit) {
  ensureInitialized();
  return db.getReports(status, page, limit);
}

function getReportsByUser(userId, status, page, limit) {
  ensureInitialized();
  return db.getReportsByUser(userId, status, page, limit);
}

function getSpeciesReports(speciesId) {
  ensureInitialized();
  return db.getSpeciesReports(speciesId);
}

function createReport(payload) {
  ensureInitialized();
  return db.createReport(payload);
}

function reviewReport(reportId, payload) {
  ensureInitialized();
  return db.reviewReport(reportId, payload);
}

function getApprovedReportsForExport() {
  ensureInitialized();
  return db.getApprovedReportsForExport();
}

function createNotification(userId, title, body, type, referenceId) {
  ensureInitialized();
  return db.createNotification(userId, title, body, type, referenceId);
}

function getNotifications(userId, limit) {
  ensureInitialized();
  return db.getNotifications(userId, limit);
}

function getUnreadNotificationCount(userId) {
  ensureInitialized();
  return db.getUnreadNotificationCount(userId);
}

function markNotificationRead(id) {
  ensureInitialized();
  return db.markNotificationRead(id);
}

function markAllNotificationsRead(userId) {
  ensureInitialized();
  db.markAllNotificationsRead(userId);
}

function getStats() {
  ensureInitialized();
  return db.getStats();
}

function getPoints(userId) {
  ensureInitialized();
  return db.getPoints(userId);
}

function addPoints(userId, amount, action, refId) {
  ensureInitialized();
  return db.addPoints(userId, amount, action, refId);
}

function getProducts() {
  ensureInitialized();
  return db.getProducts();
}

function createPurchase(userId, productId) {
  ensureInitialized();
  return db.createPurchase(userId, productId);
}

function getUserPurchases(userId) {
  ensureInitialized();
  return db.getUserPurchases(userId);
}

module.exports = {
  getSpeciesList,
  getSpeciesById,
  getReports,
  getReportsByUser,
  getSpeciesReports,
  createReport,
  reviewReport,
  getApprovedReportsForExport,
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getStats,
  getPoints,
  addPoints,
  getProducts,
  createPurchase,
  getUserPurchases
};
