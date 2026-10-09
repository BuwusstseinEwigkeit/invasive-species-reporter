const fs = require("fs");
const crypto = require("crypto");
const {
  checkReportLimit,
  checkImageDuplicate,
  addImageFingerprint,
  createReportWithPoints,
  getSpeciesById
} = require("./store");
const { getUploadForUser, removeUpload } = require("./upload-store");
const { getRecognitionJobForUser } = require("./recognition-jobs");

function requestError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateLocation(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw requestError("请提供有效的经纬度。", 400);
  }
  return { latitude: lat, longitude: lng };
}

function fingerprintUpload(uploadRecord) {
  let fileBuffer;
  let fileSize = 0;
  try {
    fileBuffer = fs.readFileSync(uploadRecord.filePath);
    fileSize = fs.statSync(uploadRecord.filePath).size;
  } catch (_e) {
    throw requestError("上传文件已失效，请重新上传图片。", 410);
  }

  const md5Hash = crypto.createHash("md5").update(fileBuffer).digest("hex");
  if (checkImageDuplicate(md5Hash)) {
    throw requestError("图片重复，请勿在 7 天内重复上传相同图片。", 409);
  }
  return { md5Hash, fileSize };
}

function deriveRecognition(userId, fileId, recognitionJobId) {
  if (!recognitionJobId) {
    return {
      aiTop1: "待人工审核",
      aiScore: 0,
      aiCandidates: []
    };
  }

  const job = getRecognitionJobForUser(recognitionJobId, userId);
  if (!job || job.fileId !== fileId) {
    throw requestError("识别任务与当前图片不匹配，请重新识别。", 400);
  }

  if (job.status !== "completed" || !job.result) {
    return {
      aiTop1: "待人工审核",
      aiScore: 0,
      aiCandidates: []
    };
  }

  return {
    aiTop1: job.result.matchedSpeciesName || "未能可靠识别",
    aiScore: Number(job.result.confidence || 0),
    aiCandidates: Array.isArray(job.result.topCandidates) ? job.result.topCandidates : []
  };
}

function buildReportPayload(userId, body, uploadRecord, imageFingerprint) {
  const location = validateLocation(body.latitude, body.longitude);
  const selectedSpeciesId = body.speciesId || null;

  if (selectedSpeciesId && !getSpeciesById(selectedSpeciesId)) {
    throw requestError("选择的物种不存在。", 400);
  }

  const recognition = deriveRecognition(userId, uploadRecord.fileId, body.recognitionJobId);
  return {
    userId,
    speciesId: selectedSpeciesId,
    aiTop1: recognition.aiTop1,
    aiScore: recognition.aiScore,
    aiCandidates: recognition.aiCandidates,
    imageUrl: `/uploads/${uploadRecord.filename}`,
    latitude: location.latitude,
    longitude: location.longitude,
    address: String(body.address || "").slice(0, 200),
    remark: String(body.remark || "").slice(0, 1000),
    imageFingerprint
  };
}

function createUserReport(userId, body) {
  const limit = checkReportLimit(userId);
  if (!limit.allowed) {
    throw requestError(`今日上报已达上限（每日${limit.dailyLimit}次）。`, 429);
  }

  if (!body.fileId) {
    throw requestError("fileId is required.", 400);
  }

  const uploadRecord = getUploadForUser(body.fileId, userId);
  if (!uploadRecord) {
    throw requestError("上传文件不存在、已过期或不属于当前用户。", 404);
  }

  const fingerprint = fingerprintUpload(uploadRecord);
  const payload = buildReportPayload(userId, body, uploadRecord, fingerprint.md5Hash);
  const result = createReportWithPoints(payload);

  addImageFingerprint(fingerprint.md5Hash, userId, fingerprint.fileSize, 0, 0);
  removeUpload(uploadRecord.fileId);

  return {
    report: result.report,
    isDupe: result.isDupe,
    pointsDelta: result.isDupe ? [] : result.pointsDelta
  };
}

module.exports = {
  createUserReport,
  fingerprintUpload,
  deriveRecognition
};
