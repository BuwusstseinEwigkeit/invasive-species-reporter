/**
 * Anti-spam mechanism tests
 *
 * Run with: node tests/anti-spam.test.js
 * Or: npx jest tests/anti-spam.test.js
 */

const db = require("../server/lib/database");
const fs = require("fs");
const crypto = require("crypto");

// Initialize fresh in-memory DB for testing
process.env.DATABASE_PATH = ":memory:";

let d = null;

function setup() {
  db._reset();
  db.initSchema();
  // Seed minimal data
  const { species, reports, reviewLogs, products, productCategories } = require("../server/data/mock-data");
  db.seedSpecies(species.slice(0, 3));
  db.seedReports([]);
  db.seedReviewLogs([]);
  if (products) db.seedProductCategories(productCategories);
  if (products) db.seedProducts(products);
  d = db.getDb();
}

function cleanup() {
  if (d) {
    d.close();
    d = null;
    // Reset the module-level singleton so next test gets a fresh connection
    require("../server/lib/database")._reset && require("../server/lib/database")._reset();
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition, msg) {
  if (!condition) {
    throw new Error(`${msg}: expected truthy, got ${condition}`);
  }
}

function assertFalse(condition, msg) {
  if (condition) {
    throw new Error(`${msg}: expected falsy, got ${condition}`);
  }
}

// ─── Test helpers ────────────────────────────────────────────────────────────

function createTestUser(username) {
  const user = db.createUser(username, "test1234", "user");
  return user;
}

function createTestReport(userId, lat, lng, fileId) {
  const payload = {
    userId,
    speciesId: "species-001",
    aiTop1: "加拿大一枝黄花",
    aiScore: 0.82,
    aiCandidates: [],
    latitude: lat,
    longitude: lng,
    address: "测试地址",
    remark: "测试",
    imageFingerprint: fileId || ""
  };
  return db.createReportWithPoints(payload);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

function testCreditInitialValue() {
  console.log("  ✓ credit starts at 100");
  const user = createTestUser("credit_test_user_" + Date.now());
  const credit = db.getUserCredit(user.id);
  assertEqual(credit, 100, "credit initial value");
}

function testCreditUpdateIncrease() {
  const user = createTestUser("credit_inc_" + Date.now());
  const newCredit = db.updateUserCredit(user.id, 5);
  assertEqual(newCredit, 105, "credit +5");
}

function testCreditUpdateDecrease() {
  const user = createTestUser("credit_dec_" + Date.now());
  const newCredit = db.updateUserCredit(user.id, -20);
  assertEqual(newCredit, 80, "credit -20");
}

function testCreditFloorAtZero() {
  const user = createTestUser("credit_floor_" + Date.now());
  const newCredit = db.updateUserCredit(user.id, -200);
  assertEqual(newCredit, 0, "credit floor at 0");
}

function testDailyReportLimitNormal() {
  const user = createTestUser("limit_normal_" + Date.now());
  const result = db.checkReportLimit(user.id);
  assertTrue(result.allowed, "daily limit should be allowed (0 reports today)");
  assertEqual(result.dailyLimit, 5, "normal daily limit");
  assertEqual(result.credit, 100, "credit is 100");
}

function testDailyReportLimitLowCredit() {
  const user = createTestUser("limit_low_" + Date.now());
  db.updateUserCredit(user.id, -50); // credit = 50
  const result = db.checkReportLimit(user.id);
  assertEqual(result.dailyLimit, 2, "low credit → daily limit = 2");
}

function testImageDuplicateMD5() {
  const hash = "abcd1234efgh5678ijkl9012mnop3456";
  const user = createTestUser("img_dup_" + Date.now());

  assertFalse(db.checkImageDuplicate(hash), "hash should not exist yet");

  db.addImageFingerprint(hash, user.id, 12345, 800, 600);

  assertTrue(db.checkImageDuplicate(hash), "hash should exist after add");

  // Same hash from different user should also be detected
  const user2 = createTestUser("img_dup2_" + Date.now());
  db.addImageFingerprint(hash, user2.id, 99999, 1920, 1080);
  assertTrue(db.checkImageDuplicate(hash), "hash still detected");
}

function testImageDuplicateDifferentHash() {
  const hash1 = "aaaa1111bbbb2222cccc3333dddd4444";
  const hash2 = "aaaa1111bbbb2222cccc3333dddd5555";
  const user = createTestUser("img_diff_" + Date.now());

  db.addImageFingerprint(hash1, user.id, 12345, 800, 600);
  assertFalse(db.checkImageDuplicate(hash2), "different hash should not match");
}

function testGeotemporalDuplicateSameLocation() {
  const user = createTestUser("geo_dup_" + Date.now());
  const lat = 31.9527;
  const lng = 118.8927;

  // First report should NOT be dupe
  assertFalse(db.checkGeotemporalDuplicate(user.id, lat, lng), "first report not dupe");

  // Create a report
  createTestReport(user.id, lat, lng, "file1");

  // Same location within 12h should be dupe
  assertTrue(db.checkGeotemporalDuplicate(user.id, lat, lng), "same location within 12h is dupe");
}

function testGeotemporalDuplicateDoesNotAwardPoints() {
  const user = createTestUser("geo_points_" + Date.now());
  const lat = 31.9527;
  const lng = 118.8927;

  createTestReport(user.id, lat, lng, "file1");
  const afterFirst = db.getPoints(user.id).total;
  const duplicate = createTestReport(user.id, lat, lng, "file2");
  const afterDuplicate = db.getPoints(user.id).total;

  assertTrue(duplicate.isDupe, "second nearby report should be marked duplicate");
  assertEqual(afterDuplicate, afterFirst, "duplicate report should not award points");
  assertEqual(duplicate.pointsDelta.length, 0, "duplicate report should return no points delta");
}

function testGeotemporalDuplicateDifferentLocation() {
  const user = createTestUser("geo_diff_" + Date.now());
  const lat1 = 31.9527;
  const lng1 = 118.8927;
  const lat2 = 32.0527; // ~11km away
  const lng2 = 118.9927;

  createTestReport(user.id, lat1, lng1, "file1");
  assertFalse(db.checkGeotemporalDuplicate(user.id, lat2, lng2), "different location not dupe");
}

function testGeotemporalDuplicateFarAway() {
  const user = createTestUser("geo_far_" + Date.now());
  createTestReport(user.id, 31.9527, 118.8927, "file1");
  // ~200km away
  assertFalse(
    db.checkGeotemporalDuplicate(user.id, 33.5, 121.0),
    "far location not dupe"
  );
}

function testPointsSubmission() {
  const user = createTestUser("pts_" + Date.now());
  const initialPoints = db.getPoints(user.id).total;

  const result = createTestReport(user.id, 31.1, 118.1, "ptfile1");

  const afterPoints = db.getPoints(user.id).total;
  assertTrue(afterPoints >= initialPoints + 5, `should get +5 points, got ${afterPoints - initialPoints}`);
}

function testFirstReportBonus() {
  const user = createTestUser("first_" + Date.now());
  const initialPoints = db.getPoints(user.id).total;

  createTestReport(user.id, 31.1, 118.1, "firstfile1");

  const afterPoints = db.getPoints(user.id).total;
  assertTrue(afterPoints >= initialPoints + 25, "first report should give +20 bonus on top of +5");
}

function testReportWithoutCoordinates() {
  const user = createTestUser("nocoord_" + Date.now());
  const payload = {
    userId: user.id,
    speciesId: "species-001",
    aiTop1: "测试",
    latitude: 0,
    longitude: 0,
    address: "",
    remark: ""
  };
  const result = db.createReportWithPoints(payload);
  assertTrue(result.report && result.report.id, "should create report even without coords");
  assertFalse(result.isDupe, "no coords = no dupe check");
}

function testUserPrivilegesDefault() {
  const user = createTestUser("priv_default_" + Date.now());
  const priv = db.getUserPrivileges(user.id);
  assertEqual(priv.dailyReportLimit, 5, "default daily limit");
  assertEqual(priv.highQualityBonus, 0, "no bonus without badge");
  assertFalse(priv.canExportWeek, "can't export week without badge");
}

function testUserPrivilegesEcoGuard() {
  const user = createTestUser("priv_guard_" + Date.now());
  // Simulate earning eco_guard
  d.prepare("INSERT INTO achievements (id, user_id, achievement_key) VALUES (?, ?, ?)").run(
    "ach-" + Date.now(), user.id, "eco_guard"
  );
  const priv = db.getUserPrivileges(user.id);
  assertEqual(priv.dailyReportLimit, 7, "eco_guard → daily limit 7");
}

function testUserPrivilegesExpert() {
  const user = createTestUser("priv_expert_" + Date.now());
  d.prepare("INSERT INTO achievements (id, user_id, achievement_key) VALUES (?, ?, ?)").run(
    "ach-" + Date.now(), user.id, "expert"
  );
  const priv = db.getUserPrivileges(user.id);
  assertTrue(priv.canExportWeek, "expert → can export week");
}

function testPurchaseVirtualNoShipping() {
  const user = createTestUser("purchase_v_" + Date.now());
  // Give user some points first
  db.addPoints(user.id, 1000, "test_init", null);

  const result = db.createPurchaseFull(user.id, "product-avatar-frame", null);
  assertTrue(!result.error, "virtual purchase should succeed without shipping: " + (result.error || ""));
  assertEqual(result.newTotal, 920, "points deducted");
  const purchaseLog = db.getPoints(user.id).logs.find((log) => log.action === "purchase");
  assertTrue(!!purchaseLog, "purchase should write a points ledger entry");
  assertEqual(purchaseLog.amount, -80, "purchase ledger amount");
}

function testPurchaseInsufficientPoints() {
  const user = createTestUser("purchase_fail_" + Date.now());
  db.addPoints(user.id, 10, "test_init", null);

  const result = db.createPurchaseFull(user.id, "product-avatar-frame", null);
  assertEqual(result.error, "Insufficient points", "should fail with insufficient points");
}

function testPurchasePhysicalNeedsShipping() {
  const user = createTestUser("purchase_phys_" + Date.now());
  db.addPoints(user.id, 1000, "test_init", null);

  const result = db.createPurchaseFull(user.id, "product-stickers", null);
  assertEqual(result.error, "Shipping info required", "physical product requires shipping info");

  const result2 = db.createPurchaseFull(user.id, "product-stickers", {
    name: "张三",
    phone: "13800138000",
    address: "测试地址"
  });
  assertTrue(!result2.error, "purchase with shipping should succeed");
  assertTrue(result2.order && result2.order.id, "order should be created");
  assertEqual(result2.order.shippingName, "张三", "shipping name recorded");
}

function testPurchaseFixtureUsesRealProducts() {
  const user = createTestUser("purchase_req_" + Date.now());
  db.addPoints(user.id, 10000, "test_init", null);

  const result = db.createPurchaseFull(user.id, "product-showcase", null);
  assertTrue(!result.error, "mock product should exist and be purchasable: " + (result.error || ""));
}

function testPurchaseWithBadgeStillUsesRealProduct() {
  const user = createTestUser("purchase_badge_" + Date.now());
  db.addPoints(user.id, 10000, "test_init", null);

  // Give expert badge
  d.prepare("INSERT INTO achievements (id, user_id, achievement_key) VALUES (?, ?, ?)").run(
    "ach-" + Date.now(), user.id, "expert"
  );

  const result = db.createPurchaseFull(user.id, "product-showcase", null);
  assertTrue(!result.error, "should succeed with a real product: " + (result.error || ""));
}

function testLeaderboardWeekly() {
  const lb = db.getLeaderboard("weekly", 10);
  assertTrue(Array.isArray(lb), "should return array");
  lb.forEach(item => {
    assertTrue(typeof item.rank === "number", "rank should be number");
    assertTrue(typeof item.username === "string", "username should be string");
    assertTrue(typeof item.count === "number", "count should be number");
  });
}

function testLeaderboardTotal() {
  const lb = db.getLeaderboard("total", 10);
  assertTrue(Array.isArray(lb), "should return array");
}

function testLeaderboardNewcomer() {
  const lb = db.getLeaderboard("newcomer", 10);
  assertTrue(Array.isArray(lb), "should return array");
}

// ─── Run all tests ────────────────────────────────────────────────────────────

const tests = [
  { name: "Credit initial value", fn: testCreditInitialValue },
  { name: "Credit update increase", fn: testCreditUpdateIncrease },
  { name: "Credit update decrease", fn: testCreditUpdateDecrease },
  { name: "Credit floor at zero", fn: testCreditFloorAtZero },
  { name: "Daily report limit normal", fn: testDailyReportLimitNormal },
  { name: "Daily report limit low credit", fn: testDailyReportLimitLowCredit },
  { name: "Image duplicate same MD5", fn: testImageDuplicateMD5 },
  { name: "Image duplicate different MD5", fn: testImageDuplicateDifferentHash },
  { name: "Geotemporal duplicate same location", fn: testGeotemporalDuplicateSameLocation },
  { name: "Geotemporal duplicate does not award points", fn: testGeotemporalDuplicateDoesNotAwardPoints },
  { name: "Geotemporal duplicate different location", fn: testGeotemporalDuplicateDifferentLocation },
  { name: "Geotemporal duplicate far away", fn: testGeotemporalDuplicateFarAway },
  { name: "Points submission", fn: testPointsSubmission },
  { name: "First report bonus", fn: testFirstReportBonus },
  { name: "Report without coordinates", fn: testReportWithoutCoordinates },
  { name: "User privileges default", fn: testUserPrivilegesDefault },
  { name: "User privileges eco_guard", fn: testUserPrivilegesEcoGuard },
  { name: "User privileges expert", fn: testUserPrivilegesExpert },
  { name: "Purchase virtual no shipping", fn: testPurchaseVirtualNoShipping },
  { name: "Purchase insufficient points", fn: testPurchaseInsufficientPoints },
  { name: "Purchase physical needs shipping", fn: testPurchasePhysicalNeedsShipping },
  { name: "Purchase fixture uses real products", fn: testPurchaseFixtureUsesRealProducts },
  { name: "Purchase with badge still uses real product", fn: testPurchaseWithBadgeStillUsesRealProduct },
  { name: "Leaderboard weekly", fn: testLeaderboardWeekly },
  { name: "Leaderboard total", fn: testLeaderboardTotal },
  { name: "Leaderboard newcomer", fn: testLeaderboardNewcomer },
];

function runOne(testCase) {
  setup();
  try {
    testCase.fn();
  } finally {
    cleanup();
  }
}

function runScript() {
  let passed = 0;
  let failed = 0;

  console.log("\n=== Anti-Spam & Points System Tests ===\n");

  for (const testCase of tests) {
    try {
      runOne(testCase);
      console.log(`  ✓ ${testCase.name}`);
      passed++;
    } catch (err) {
      console.log(`  ✗ ${testCase.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

if (typeof describe === "function" && typeof it === "function") {
  describe("Anti-Spam & Points System", () => {
    for (const testCase of tests) {
      it(testCase.name, () => {
        runOne(testCase);
      });
    }
  });
} else {
  runScript();
}
