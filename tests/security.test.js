/**
 * Security & permission tests.
 *
 * Run with: npx jest tests/security.test.js --verbose
 *
 * Verifies that the security fixes properly enforce authentication
 * and authorization across all protected endpoints.
 */

process.env.DATABASE_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long!!";
process.env.ADMIN_PASS = "admin123";
process.env.REVIEWER_PASS = "review123";
process.env.DEMO_PASS = "demo123";

const request = require("supertest");

beforeAll(() => {
  const db = require("../server/lib/database");
  db._reset && db._reset();
  delete require.cache[require.resolve("../server/lib/store")];
});

let app;
let userToken;
let otherUserToken;
let adminToken;
let userId;
let otherUserId;

beforeAll(() => {
  app = require("../server/index");
});

afterAll(() => {
  const db = require("../server/lib/database");
  db._reset && db._reset();
});

describe("Authentication: unauthenticated requests are rejected", () => {
  test("POST /api/reports without token returns 401", async () => {
    const res = await request(app)
      .post("/api/reports")
      .send({ latitude: 31.95, longitude: 118.89 });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("GET /api/reports/my without token returns 401", async () => {
    const res = await request(app).get("/api/reports/my");
    expect(res.status).toBe(401);
  });

  test("GET /api/achievements without token returns 401", async () => {
    const res = await request(app).get("/api/achievements");
    expect(res.status).toBe(401);
  });

  test("GET /api/user/privileges without token returns 401", async () => {
    const res = await request(app).get("/api/user/privileges");
    expect(res.status).toBe(401);
  });

  test("POST /api/shop/purchase without token returns 401", async () => {
    const res = await request(app)
      .post("/api/shop/purchase")
      .send({ productId: "prod-001" });
    expect(res.status).toBe(401);
  });
});

describe("Setup: create test users", () => {
  test("Register first user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "securitytest1", password: "pass123456" });
    expect(res.status).toBe(201);
    userToken = res.body.item.token;
    userId = res.body.item.id;
  });

  test("Register second user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "securitytest2", password: "pass123456" });
    expect(res.status).toBe(201);
    otherUserToken = res.body.item.token;
    otherUserId = res.body.item.id;
  });

  test("Login as admin", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });
    expect(res.status).toBe(200);
    adminToken = res.body.item.token;
  });
});

describe("Permission: cross-user point manipulation is blocked", () => {
  test("POST /api/points/:userId with wrong user returns 403", async () => {
    const res = await request(app)
      .post(`/api/points/${otherUserId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 100, action: "hack" });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Access denied");
  });

  test("POST /api/points/:userId with own user succeeds", async () => {
    const res = await request(app)
      .post(`/api/points/${userId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 5, action: "test_reward" });
    expect(res.status).toBe(201);
  });
});

describe("Permission: purchase records are private", () => {
  test("GET /api/shop/purchases/:userId without auth returns 401", async () => {
    const res = await request(app).get(`/api/shop/purchases/${userId}`);
    expect(res.status).toBe(401);
  });

  test("GET /api/shop/purchases/:userId with wrong user returns 403", async () => {
    const res = await request(app)
      .get(`/api/shop/purchases/${userId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);
    expect(res.status).toBe(403);
  });

  test("GET /api/shop/purchases/:userId with correct user returns 200", async () => {
    const res = await request(app)
      .get(`/api/shop/purchases/${userId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

describe("Permission: notification access is private", () => {
  test("GET /api/notifications/:userId with wrong user returns 403", async () => {
    const res = await request(app)
      .get(`/api/notifications/${userId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);
    expect(res.status).toBe(403);
  });

  test("GET /api/notifications/:userId with correct user returns 200", async () => {
    const res = await request(app)
      .get(`/api/notifications/${userId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });
});

describe("Permission: review requires reviewer role", () => {
  let testReportId;

  test("Create a report to review", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        aiTop1: "测试物种",
        latitude: 31.95,
        longitude: 118.89,
      });
    expect(res.status).toBe(201);
    testReportId = res.body.item.id;
  });

  test("Regular user cannot review reports", async () => {
    const res = await request(app)
      .post(`/api/reports/${testReportId}/review`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ action: "approved" });
    expect(res.status).toBe(403);
  });

  test("Admin can review reports", async () => {
    const res = await request(app)
      .post(`/api/reports/${testReportId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "approved" });
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe("approved");
  });
});

describe("Permission: order access is private", () => {
  test("GET /api/shop/orders/:userId with wrong user returns 403", async () => {
    const res = await request(app)
      .get(`/api/shop/orders/${userId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);
    expect(res.status).toBe(403);
  });

  test("GET /api/shop/orders/:userId with correct user returns 200", async () => {
    const res = await request(app)
      .get(`/api/shop/orders/${userId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });
});

describe("Error handling: no internal info leaked", () => {
  test("Invalid JSON body returns generic error", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Content-Type", "application/json")
      .send("invalid json{{{");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    // Should not contain stack trace or internal paths
    expect(res.body.error).not.toContain("SyntaxError");
    expect(res.body.error).not.toContain("at ");
  });
});

describe("Report ID uniqueness", () => {
  test("Multiple reports created have unique IDs", async () => {
    // Create reports sequentially to avoid daily limit issues
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${otherUserToken}`)
        .send({ aiTop1: `并发测试${i}`, latitude: 31.95 + i * 0.001, longitude: 118.89 });
      if (res.status === 201 && res.body.item) {
        ids.push(res.body.item.id);
      }
    }
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    // Verify IDs use UUID format (contain hyphens, long enough)
    ids.forEach((id) => {
      expect(id).toMatch(/^report-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });
});
