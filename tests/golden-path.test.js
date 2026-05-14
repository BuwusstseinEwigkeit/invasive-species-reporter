/**
 * Golden-path integration test: end-to-end user flow.
 *
 * Run with: npx jest tests/golden-path.test.js --verbose
 *
 * Uses in-memory SQLite so no real database is modified.
 * Uses supertest to test the Express app without starting a listener.
 */

process.env.DATABASE_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long!!";

const request = require("supertest");

// Reset DB module state so it picks up :memory:
beforeAll(() => {
  const db = require("../server/lib/database");
  db._reset && db._reset();
  // Clear require cache for store (which caches the db singleton)
  delete require.cache[require.resolve("../server/lib/store")];
});

let app;
let adminToken;
let userToken;
let testUserId;
let testReportId;

beforeAll(() => {
  app = require("../server/index");
});

afterAll(() => {
  const db = require("../server/lib/database");
  db._reset && db._reset();
});

describe("Golden Path: Register → Report → Review", () => {
  test("1. Health check returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("2. Register a new user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "goldentest", password: "testpass123" });

    expect(res.status).toBe(201);
    expect(res.body.item.username).toBe("goldentest");
    expect(res.body.item.token).toBeTruthy();
    userToken = res.body.item.token;
    testUserId = res.body.item.id;
  });

  test("3. Login with existing user (admin)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });

    expect(res.status).toBe(200);
    expect(res.body.item.token).toBeTruthy();
    adminToken = res.body.item.token;
  });

  test("4. Species list is not empty", async () => {
    const res = await request(app).get("/api/species");
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  test("5. Species detail returns item + reports", async () => {
    const res = await request(app).get("/api/species/species-001");
    expect(res.status).toBe(200);
    expect(res.body.item.id).toBe("species-001");
    expect(res.body.reports).toBeDefined();
  });

  test("6. Create a report", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        speciesId: "species-001",
        aiTop1: "加拿大一枝黄花",
        aiScore: 0.85,
        aiCandidates: [],
        latitude: 31.9527,
        longitude: 118.8927,
        address: "测试地址",
        remark: "集成测试上报",
      });

    expect(res.status).toBe(201);
    expect(res.body.item.id).toBeTruthy();
    testReportId = res.body.item.id;
  });

  test("7. Report appears in my reports", async () => {
    const res = await request(app)
      .get("/api/reports/my")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const found = res.body.items.find((r) => r.id === testReportId);
    expect(found).toBeTruthy();
  });

  test("8. Admin reviews and approves the report", async () => {
    const res = await request(app)
      .post(`/api/reports/${testReportId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe("approved");
  });

  test("9. After approval, report is in public list", async () => {
    const res = await request(app)
      .get("/api/reports")
      .query({ status: "approved" });

    expect(res.status).toBe(200);
    const found = res.body.items.find((r) => r.id === testReportId);
    expect(found).toBeTruthy();
  });

  test("10. User earned points from approval", async () => {
    const res = await request(app)
      .get(`/api/points/${testUserId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    // +5 for submission, +20 for first report bonus, +20 for approval = 45 total
    expect(res.body.item.total).toBe(45);
  });

  test("11. Achievements endpoint is accessible", async () => {
    const res = await request(app)
      .get("/api/achievements")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    const earned = res.body.items.filter((a) => a.earned);
    expect(earned.length).toBeGreaterThan(0);
  });

  test("12. Unauthenticated access is rejected", async () => {
    const res = await request(app).get("/api/reports/my");
    expect(res.status).toBe(401);
  });

  test("13. Stats endpoint returns data", async () => {
    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(200);
    expect(res.body.item.totalReports).toBeGreaterThanOrEqual(1);
  });

  test("14. Leaderboard returns array", async () => {
    const res = await request(app).get("/api/leaderboard?type=weekly");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test("15. Non-reviewer cannot approve reports", async () => {
    const res = await request(app)
      .post(`/api/reports/${testReportId}/review`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ action: "approved" });

    expect(res.status).toBe(403);
  });
});
