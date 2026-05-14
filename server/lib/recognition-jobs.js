const crypto = require("crypto");
const { getUpload, removeUpload } = require("./upload-store");
const { recognizeSpeciesFromImage } = require("./recognition");

const recognitionJobs = new Map();
const MAX_JOB_ATTEMPTS = 2;
const JOB_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Detect retryable errors by message content OR by error object properties
function isRetryableError(error) {
  if (!error) return false;
  // Check message strings
  const msg = error.message || "";
  if (msg.includes("429") || msg.includes("访问量过大") || msg.includes("503")) return true;
  // Check numeric statusCode set by recognition.js
  if (error.statusCode === 429 || error.statusCode === 503) return true;
  return false;
}

async function runRecognition(job, uploadRecord, speciesList) {
  job.status = "processing";
  job.attempts += 1;

  try {
    const result = await recognizeSpeciesFromImage({
      filePath: uploadRecord.filePath,
      mimeType: uploadRecord.mimeType,
      speciesList
    });

    job.status = "completed";
    job.result = result;
    job.error = "";

    // Clean up upload record to free memory
    removeUpload(job.fileId);
  } catch (error) {
    const message = error.message || "Recognition failed.";
    const retryable = isRetryableError(error);

    if (retryable && job.attempts < MAX_JOB_ATTEMPTS) {
      job.status = "queued";
      job.error = `服务繁忙，正在自动重试（${job.attempts}/${MAX_JOB_ATTEMPTS}）`;
      setTimeout(() => {
        runRecognition(job, uploadRecord, speciesList);
      }, 3000);
      return;
    }

    job.status = "failed";
    job.error = message;

    // Clean up upload record even on failure
    removeUpload(job.fileId);
  }
}

function createRecognitionJob({ fileId, speciesList }) {
  const uploadRecord = getUpload(fileId);

  if (!uploadRecord) {
    return null;
  }

  const jobId = `job-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;

  const job = {
    jobId,
    fileId,
    status: "queued",
    result: null,
    error: "",
    attempts: 0,
    createdAt: Date.now()
  };

  recognitionJobs.set(jobId, job);
  runRecognition(job, uploadRecord, speciesList);

  return job;
}

function getRecognitionJob(jobId) {
  return recognitionJobs.get(jobId) || null;
}

// Periodic cleanup of expired jobs
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, job] of recognitionJobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      recognitionJobs.delete(key);
    }
  }
}, 10 * 60 * 1000); // every 10 minutes
if (cleanupTimer.unref) cleanupTimer.unref();

module.exports = {
  createRecognitionJob,
  getRecognitionJob
};
