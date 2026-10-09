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
let userToken;
let otherUserToken;
let adminToken;
let userId;
let otherUserId;
const uploadedFiles = [];
let seed = 30;

async function makeImage(value) {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 3,
      background: {
        r: value % 255,
        g: (value * 5) % 255,
        b: (value * 11) % 255
      }
    }
  }).png().toBuffer();
}

async function uploadFor(token, imageSeed) {
  const value = imageSeed === undefined ? seed++ : imageSeed;
  const res = await request(app)
    .post("/api/uploads")
    .set("Authorization", `Bearer ${token}`)
    .attach("image", await makeImage(value), `security-${value}.png`);
  expect(res.status).toBe(201);
  uploadedFiles.push(res.body.item.fileId);
  return res.body.item;
}

async function createReportFor(token, overrides) {
  const upload = await uploadFor(token);
  const body = Object.assign({
    fileId: upload.fileId,
    speciesId: "species-001",
    latitude: 31.95 + seed / 1000,
    longitude: 118.89 + seed / 1000,
    address: "安全测试地址",
    remark: "安全测试"
  }, overrides || {});
  const res = await request(app)
    .post("/api/reports")
    .set("Authorization", `Bearer ${token}`)
    .send(body);
  return { res, upload };
}

beforeAll(async () => {
  const db = require("../server/lib/database");
  db._reset && db._reset();
  delete require.cache[require.resolve("../server/lib/store")];
  app = require("../server/index");

  const user = await request(app)
    .post("/api/auth/register")
    .send({ username: "securitytest1", password: "pass123456" });
  expect(user.status).toBe(201);
  userToken = user.body.item.token;
  userId = user.body.item.id;

  const other = await request(app)
    .post("/api/auth/register")
    .send({ username: "securitytest2", password: "pass123456" });
  expect(other.status).toBe(201);
  otherUserToken = other.body.item.token;
  otherUserId = other.body.item.id;

  const admin = await request(app)
    .post("/api/auth/login")
    .send({ username: "admin", password: "admin123" });
  expect(admin.status).toBe(200);
  adminToken = admin.body.item.token;
});

afterAll(() => {
  for (const fileId of uploadedFiles) {
    const filePath = path.join(__dirname, "..", "server", "uploads", fileId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  const db = require("../server/lib/database");
  db._reset && db._reset();
});

describe("authentication and ownership", () => {
  test("protected report/upload/recognition endpoints reject anonymous requests", async () => {
    expect((await request(app).post("/api/uploads")).status).toBe(401);
    expect((await request(app).post("/api/recognitions").send({ fileId: "x" })).status).toBe(401);
    expect((await request(app).post("/api/reports").send({})).status).toBe(401);
    expect((await request(app).get("/api/reports/my")).status).toBe(401);
  });

  test("registration cannot self-assign admin role", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "role-injection", password: "pass123456", role: "admin" });
    expect(res.status).toBe(201);
    expect(res.body.item.role).toBe("user");
  });

  test("an upload belongs only to its creator", async () => {
    const upload = await uploadFor(userToken);

    expect((await request(app).get("/uploads/" + upload.fileId)).status).toBe(404);
    expect((await request(app)
      .get("/uploads/" + upload.fileId)
      .set("Authorization", `Bearer ${otherUserToken}`)).status).toBe(404);
    expect((await request(app)
      .get("/uploads/" + upload.fileId)
      .set("Authorization", `Bearer ${userToken}`)).status).toBe(200);

    const recognition = await request(app)
      .post("/api/recognitions")
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({ fileId: upload.fileId });
    expect(recognition.status).toBe(404);

    const report = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({
        fileId: upload.fileId,
        speciesId: "species-001",
        latitude: 32.2,
        longitude: 119.2
      });
    expect(report.status).toBe(404);
  });

  test("avatar assignment consumes only an owned upload", async () => {
    const upload = await uploadFor(userToken);

    const crossUser = await request(app)
      .post("/api/user/avatar")
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({ avatarUrl: upload.imageUrl });
    expect(crossUser.status).toBe(404);

    const external = await request(app)
      .post("/api/user/avatar")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ avatarUrl: "https://evil.example/tracker.png" });
    expect(external.status).toBe(400);

    const assigned = await request(app)
      .post("/api/user/avatar")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ avatarUrl: upload.imageUrl });
    expect(assigned.status).toBe(200);
    expect(assigned.body.item.avatarUrl).toBe(`/uploads/${upload.fileId}`);
    expect((await request(app).get(assigned.body.item.avatarUrl)).status).toBe(200);

    const consumed = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        fileId: upload.fileId,
        speciesId: "species-001",
        latitude: 32.3,
        longitude: 119.3
      });
    expect(consumed.status).toBe(404);
  });

  test("cross-user points, purchases and orders remain private", async () => {
    expect((await request(app)
      .get(`/api/points/${userId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)).status).toBe(403);

    expect((await request(app)
      .get(`/api/shop/purchases/${userId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)).status).toBe(403);

    expect((await request(app)
      .get(`/api/shop/orders/${userId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)).status).toBe(403);
  });
});

describe("trusted report submission chain", () => {
  let pendingId;

  test("client-controlled AI and image fields are ignored", async () => {
    const created = await createReportFor(userToken, {
      aiTop1: "伪造高危物种",
      aiScore: 1,
      aiCandidates: [{ speciesName: "伪造", confidence: 1 }],
      imageUrl: "https://evil.example/forged.jpg",
      latitude: 31.61,
      longitude: 118.61
    });
    expect(created.res.status).toBe(201);
    pendingId = created.res.body.item.id;

    const mine = await request(app)
      .get("/api/reports/my")
      .set("Authorization", `Bearer ${userToken}`);
    const report = mine.body.items.find((item) => item.id === pendingId);
    expect(report.aiTop1).toBe("待人工审核");
    expect(Number(report.aiScore)).toBe(0);
    expect(report.aiCandidates).toEqual([]);
    expect(report.imageUrl).toContain("/uploads/");
    expect(report.imageUrl).not.toContain("evil.example");
  });

  test("pending data cannot be pulled through public feed or species detail", async () => {
    const publicFeed = await request(app).get("/api/reports?status=pending");
    expect(publicFeed.status).toBe(200);
    expect(publicFeed.body.items.some((item) => item.id === pendingId)).toBe(false);

    const species = await request(app).get("/api/species/species-001");
    expect(species.status).toBe(200);
    expect(species.body.reports.some((item) => item.id === pendingId)).toBe(false);
  });

  test("pending detail is owner/reviewer only", async () => {
    expect((await request(app).get(`/api/reports/${pendingId}`)).status).toBe(404);
    expect((await request(app)
      .get(`/api/reports/${pendingId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)).status).toBe(404);
    const ownerDetail = await request(app)
      .get(`/api/reports/${pendingId}`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(ownerDetail.status).toBe(200);
    expect((await request(app)
      .get(`/api/reports/${pendingId}`)
      .set("Authorization", `Bearer ${adminToken}`)).status).toBe(200);

    expect((await request(app).get(ownerDetail.body.item.imageUrl)).status).toBe(404);
    expect((await request(app)
      .get(ownerDetail.body.item.imageUrl)
      .set("Authorization", `Bearer ${otherUserToken}`)).status).toBe(404);
    expect((await request(app)
      .get(ownerDetail.body.item.imageUrl)
      .set("Authorization", `Bearer ${userToken}`)).status).toBe(200);
    expect((await request(app)
      .get(ownerDetail.body.item.imageUrl)
      .set("Authorization", `Bearer ${adminToken}`)).status).toBe(200);
  });

  test("review queue is privileged", async () => {
    expect((await request(app)
      .get("/api/reports/review-queue")
      .set("Authorization", `Bearer ${userToken}`)).status).toBe(403);
    const adminQueue = await request(app)
      .get("/api/reports/review-queue")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminQueue.status).toBe(200);
    expect(adminQueue.body.items.some((item) => item.id === pendingId)).toBe(true);
  });
});

describe("review idempotency and notification ownership", () => {
  let reportId;
  let notificationId;

  test("review side effects happen once", async () => {
    const created = await createReportFor(otherUserToken, {
      latitude: 32.31,
      longitude: 119.31
    });
    expect(created.res.status).toBe(201);
    reportId = created.res.body.item.id;

    const approve = await request(app)
      .post(`/api/reports/${reportId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "approved", finalSpeciesId: "species-001" });
    expect(approve.status).toBe(200);
    expect((await request(app).get(approve.body.item.imageUrl)).status).toBe(200);

    const afterFirst = await request(app)
      .get(`/api/points/${otherUserId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    const repeat = await request(app)
      .post(`/api/reports/${reportId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "approved", finalSpeciesId: "species-001" });
    expect(repeat.status).toBe(409);

    const afterRepeat = await request(app)
      .get(`/api/points/${otherUserId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);
    expect(afterRepeat.body.item.total).toBe(afterFirst.body.item.total);

    const notifications = await request(app)
      .get(`/api/notifications/${otherUserId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);
    notificationId = notifications.body.items.find((item) => item.referenceId === reportId).id;
    expect(notificationId).toBeTruthy();
  });

  test("notification mark-read cannot cross users", async () => {
    const attack = await request(app)
      .post(`/api/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${userToken}`);
    expect(attack.status).toBe(404);

    const owner = await request(app)
      .post(`/api/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${otherUserToken}`);
    expect(owner.status).toBe(200);
    expect(owner.body.item.isRead).toBe(true);
  });

  test("normal users cannot export CSV, admins can", async () => {
    expect((await request(app)
      .get("/api/reports/export/csv")
      .set("Authorization", `Bearer ${userToken}`)).status).toBe(403);

    const adminExport = await request(app)
      .get("/api/reports/export/csv")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminExport.status).toBe(200);
    expect(adminExport.headers["content-type"]).toContain("text/csv");
  });
});

describe("image deduplication", () => {
  test("same bytes re-uploaded under a new fileId are blocked for seven days", async () => {
    const sameSeed = 233;
    const firstUpload = await uploadFor(otherUserToken, sameSeed);
    const first = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({
        fileId: firstUpload.fileId,
        speciesId: "species-001",
        latitude: 33.1,
        longitude: 120.1
      });
    expect(first.status).toBe(201);

    const secondUpload = await uploadFor(otherUserToken, sameSeed);
    const duplicate = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({
        fileId: secondUpload.fileId,
        speciesId: "species-001",
        latitude: 34.1,
        longitude: 121.1
      });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toContain("图片重复");
  });
});

describe("input and role guards", () => {
  test("invalid review action is rejected", async () => {
    const created = await createReportFor(userToken, {
      latitude: 31.73,
      longitude: 118.73
    });
    expect(created.res.status).toBe(201);

    const review = await request(app)
      .post(`/api/reports/${created.res.body.item.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "approved;drop", finalSpeciesId: "species-001" });
    expect(review.status).toBe(400);
  });

  test("regular users cannot review", async () => {
    const created = await createReportFor(userToken, {
      latitude: 31.83,
      longitude: 118.83
    });
    expect(created.res.status).toBe(201);

    const review = await request(app)
      .post(`/api/reports/${created.res.body.item.id}/review`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ action: "approved", finalSpeciesId: "species-001" });
    expect(review.status).toBe(403);
  });

  test("invalid JSON does not leak parser internals", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${userToken}`)
      .set("Content-Type", "application/json")
      .send("invalid json{{{");
    expect(res.status).toBe(400);
    expect(res.body.error).not.toContain("SyntaxError");
    expect(res.body.error).not.toContain(" at ");
  });
});

describe("admin order fulfilment", () => {
  test("only admin can list and update fulfilment orders", async () => {
    const db = require("../server/lib/database");
    db.addPoints(userId, 1000, "test_order_seed", "security-order-seed");

    const purchase = await request(app)
      .post("/api/shop/purchase")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        productId: "product-stickers",
        shippingName: "测试收件人",
        shippingPhone: "13800138000",
        shippingAddress: "测试地址"
      });
    expect(purchase.status).toBe(201);
    const orderId = purchase.body.item.order.id;

    expect((await request(app)
      .get("/api/shop/admin/orders")
      .set("Authorization", `Bearer ${userToken}`)).status).toBe(403);

    const list = await request(app)
      .get("/api/shop/admin/orders")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((item) => item.id === orderId)).toBe(true);

    const updated = await request(app)
      .patch(`/api/shop/admin/orders/${orderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "shipped" });
    expect(updated.status).toBe(200);
    expect(updated.body.item.status).toBe("shipped");
  });
});
