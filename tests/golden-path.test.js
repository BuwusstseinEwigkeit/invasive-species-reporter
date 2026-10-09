process.env.DATABASE_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long!!";
process.env.ADMIN_PASS = "admin123";
process.env.REVIEWER_PASS = "review123";
process.env.DEMO_PASS = "demo123";
process.env.ENABLE_MOCK_RECOGNITION = "false";

const request = require("supertest");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

let app;
let adminToken;
let userToken;
let testUserId;
let testReportId;
const uploadedFiles = [];

async function makeImage(seed) {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: { r: seed % 255, g: (seed * 3) % 255, b: (seed * 7) % 255 }
    }
  }).png().toBuffer();
}

async function uploadFor(token, seed) {
  const res = await request(app)
    .post("/api/uploads")
    .set("Authorization", `Bearer ${token}`)
    .attach("image", await makeImage(seed), `test-${seed}.png`);
  expect(res.status).toBe(201);
  uploadedFiles.push(res.body.item.fileId);
  return res.body.item;
}

beforeAll(() => {
  const db = require("../server/lib/database");
  db._reset && db._reset();
  delete require.cache[require.resolve("../server/lib/store")];
  app = require("../server/index");
});

afterAll(() => {
  for (const fileId of uploadedFiles) {
    const filePath = path.join(__dirname, "..", "server", "uploads", fileId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  const db = require("../server/lib/database");
  db._reset && db._reset();
});

describe("Golden path: register → upload → report → review", () => {
  test("health check", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("register user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "goldentest", password: "testpass123" });
    expect(res.status).toBe(201);
    userToken = res.body.item.token;
    testUserId = res.body.item.id;
  });

  test("login admin", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });
    expect(res.status).toBe(200);
    adminToken = res.body.item.token;
  });

  test("species catalog is available", async () => {
    const res = await request(app).get("/api/species");
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  test("create report from an owned upload", async () => {
    const upload = await uploadFor(userToken, 11);
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        fileId: upload.fileId,
        speciesId: "species-001",
        latitude: 31.9527,
        longitude: 118.8927,
        address: "测试地址",
        remark: "集成测试上报"
      });

    expect(res.status).toBe(201);
    expect(res.body.item.status).toBe("pending");
    expect(res.body.item.aiTop1).toBe("待人工审核");
    testReportId = res.body.item.id;
  });

  test("owner sees pending report but public feed does not", async () => {
    const mine = await request(app)
      .get("/api/reports/my")
      .set("Authorization", `Bearer ${userToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.items.some((r) => r.id === testReportId)).toBe(true);

    const publicFeed = await request(app).get("/api/reports?status=pending");
    expect(publicFeed.status).toBe(200);
    expect(publicFeed.body.items.some((r) => r.id === testReportId)).toBe(false);

    const points = await request(app)
      .get(`/api/points/${testUserId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(points.status).toBe(200);
    expect(points.body.item.total).toBe(0);
  });

  test("admin approves report", async () => {
    const res = await request(app)
      .post(`/api/reports/${testReportId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "approved", finalSpeciesId: "species-001" });

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe("approved");
  });

  test("approved report becomes public", async () => {
    const res = await request(app).get("/api/reports");
    expect(res.status).toBe(200);
    expect(res.body.items.some((r) => r.id === testReportId)).toBe(true);
    expect(res.body.items.find((r) => r.id === testReportId).userId).toBeUndefined();
  });

  test("points settle only after approval", async () => {
    const res = await request(app)
      .get(`/api/points/${testUserId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.item.total).toBe(45);
  });

  test("achievement and leaderboard endpoints work", async () => {
    const achievements = await request(app)
      .get("/api/achievements")
      .set("Authorization", `Bearer ${userToken}`);
    expect(achievements.status).toBe(200);
    expect(achievements.body.items.some((item) => item.earned)).toBe(true);

    const leaderboard = await request(app).get("/api/leaderboard?type=weekly");
    expect(leaderboard.status).toBe(200);
    expect(Array.isArray(leaderboard.body.items)).toBe(true);
  });
});
