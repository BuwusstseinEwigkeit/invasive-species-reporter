const { getUpload } = require("./upload-store");
const { recognizeSpeciesFromImage } = require("./recognition");

const recognitionJobs = new Map();
const MAX_JOB_ATTEMPTS = 2;

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
  } catch (error) {
    const message = error.message || "Recognition failed.";
    const retryable = message.includes("429") || message.includes("访问量过大") || message.includes("503");

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
  }
}

function createRecognitionJob({ fileId, speciesList }) {
  const uploadRecord = getUpload(fileId);

  if (!uploadRecord) {
    return null;
  }

  const jobId = `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const job = {
    jobId,
    fileId,
    status: "queued",
    result: null,
    error: "",
    attempts: 0,
    createdAt: new Date().toISOString()
  };

  recognitionJobs.set(jobId, job);
  runRecognition(job, uploadRecord, speciesList);

  return job;
}

function getRecognitionJob(jobId) {
  return recognitionJobs.get(jobId) || null;
}

module.exports = {
  createRecognitionJob,
  getRecognitionJob
};
