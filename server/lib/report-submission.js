const fs = require("fs");
const crypto = require("crypto");
const {
  checkReportLimit,
  checkImageDuplicate,
  addImageFingerprint,
  createReportWithPoints,
  createNotification,
  checkAndAwardAchievements
} = require("./store");
const { getUpload } = require("./upload-store");

function fingerprintUpload(fileId, userId) {
  if (!fileId) return "";

  const uploadRecord = getUpload(fileId);
  if (!uploadRecord) return "";

  let md5Hash = "";
  let fileSize = 0;
  try {
    const filePath = uploadRecord.filePath;
    const fileBuffer = fs.readFileSync(filePath);
    md5Hash = crypto.createHash("md5").update(fileBuffer).digest("hex");
    fileSize = fs.statSync(filePath).size;
  } catch (_e) {
    // 降级策略：文件读取失败时跳过 MD5 去重（不阻断上报）。
    // 风险：恶意用户可触发读取失败绕过去重，但这是已接受的折中，
    // pHash 升级（已知技术债 #12）后此路径会被替换。
    return "";
  }

  if (checkImageDuplicate(md5Hash)) {
    const error = new Error("图片重复，请勿重复上传相同图片。");
    error.statusCode = 400;
    throw error;
  }

  addImageFingerprint(md5Hash, userId, fileSize, 0, 0);
  return md5Hash;
}

function buildReportPayload(userId, body, imageFingerprint) {
  return {
    userId,
    speciesId: body.speciesId,
    aiTop1: body.aiTop1,
    aiScore: body.aiScore,
    aiCandidates: body.aiCandidates,
    imageUrl: body.imageUrl,
    latitude: body.latitude,
    longitude: body.longitude,
    address: body.address,
    remark: body.remark,
    imageFingerprint
  };
}

function createUserReport(userId, body) {
  const limit = checkReportLimit(userId);
  if (!limit.allowed) {
    const error = new Error(`今日上报已达上限（每日${limit.dailyLimit}次），信用分过低请保持良好记录。`);
    error.statusCode = 429;
    throw error;
  }

  const imageFingerprint = fingerprintUpload(body.fileId, userId);
  const result = createReportWithPoints(buildReportPayload(userId, body, imageFingerprint));

  if (!result.isDupe) {
    try {
      const newlyEarned = checkAndAwardAchievements(userId);
      if (newlyEarned.length > 0) {
        createNotification(userId, "🏆 获得新成就", `恭喜获得「${newlyEarned[0].name}」成就！`, "achievement", null);
      }
    } catch (_e) { /* optional */ }
  }

  return {
    report: result.report,
    isDupe: result.isDupe,
    pointsDelta: result.isDupe ? [] : result.pointsDelta
  };
}

module.exports = {
  createUserReport,
  fingerprintUpload
};
