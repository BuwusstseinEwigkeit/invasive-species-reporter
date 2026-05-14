const db = require("./database");

let initialized = false;

function ensureInitialized() {
  if (initialized) return;

  db.initSchema();

  const { species, reports, reviewLogs, products, productCategories } = require("../data/mock-data");
  db.seedSpecies(species);
  db.seedReports(reports);
  db.seedReviewLogs(reviewLogs);
  db.seedProductCategories(productCategories);
  db.seedProducts(products);

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

function getAchievementStats(userId) {
  return db.getAchievementStats(userId);
}

function getUserAchievements(userId) {
  return db.getUserAchievements(userId);
}

function checkAndAwardAchievements(userId) {
  return db.checkAndAwardAchievements(userId);
}

function getAllAchievementsWithStatus(userId) {
  return db.getAllAchievementsWithStatus(userId);
}

function getUserCredit(userId) {
  return db.getUserCredit(userId);
}

function updateUserCredit(userId, delta) {
  return db.updateUserCredit(userId, delta);
}

function checkReportLimit(userId) {
  return db.checkReportLimit(userId);
}

function checkImageDuplicate(md5Hash) {
  return db.checkImageDuplicate(md5Hash);
}

function addImageFingerprint(md5Hash, userId, fileSize, width, height) {
  db.addImageFingerprint(md5Hash, userId, fileSize, width, height);
}

function createReportWithPoints(payload) {
  return db.createReportWithPoints(payload);
}

function getProductCategories() {
  return db.getProductCategories();
}

function getUserPrivileges(userId) {
  return db.getUserPrivileges(userId);
}

function createPurchaseFull(userId, productId, shippingInfo) {
  return db.createPurchaseFull(userId, productId, shippingInfo);
}

function getOrdersByUser(userId) {
  return db.getOrdersByUser(userId);
}

function updateOrderStatus(orderId, status) {
  db.updateOrderStatus(orderId, status);
}

function getLeaderboard(type, limit) {
  return db.getLeaderboard(type, limit);
}

function updateUserAvatar(userId, avatarUrl) {
  return db.updateUserAvatar(userId, avatarUrl);
}

function getUserProfile(userId) {
  return db.getUserProfile(userId);
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
  getUserPurchases,
  getAchievementStats,
  getUserAchievements,
  checkAndAwardAchievements,
  getAllAchievementsWithStatus,
  // new
  getUserCredit,
  updateUserCredit,
  checkReportLimit,
  checkImageDuplicate,
  addImageFingerprint,
  createReportWithPoints,
  getProductCategories,
  getUserPrivileges,
  createPurchaseFull,
  getOrdersByUser,
  updateOrderStatus,
  getLeaderboard,
  updateUserAvatar,
  getUserProfile
};
