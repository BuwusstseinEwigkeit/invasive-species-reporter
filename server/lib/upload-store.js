const path = require("path");
const fs = require("fs");

const uploadIndex = new Map();
const UPLOAD_TTL_MS = 60 * 60 * 1000; // 1 hour

function registerUpload(file, userId) {
  const fileId = path.basename(file.filename);

  uploadIndex.set(fileId, {
    fileId,
    userId,
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    filePath: file.path,
    createdAt: Date.now()
  });

  return uploadIndex.get(fileId);
}

function getUpload(fileId) {
  return uploadIndex.get(fileId) || null;
}

function getUploadForUser(fileId, userId) {
  const upload = getUpload(fileId);
  if (!upload || upload.userId !== userId) return null;
  return upload;
}

function removeUpload(fileId) {
  uploadIndex.delete(fileId);
}

// Periodic cleanup of expired uploads
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of uploadIndex) {
    if (now - entry.createdAt > UPLOAD_TTL_MS) {
      uploadIndex.delete(key);
      try {
        if (entry.filePath && fs.existsSync(entry.filePath)) {
          fs.unlinkSync(entry.filePath);
        }
      } catch (_e) {
        // Best-effort cleanup; a later maintenance pass can remove orphaned files.
      }
    }
  }
}, 10 * 60 * 1000); // every 10 minutes
if (cleanupTimer.unref) cleanupTimer.unref();

module.exports = {
  registerUpload,
  getUpload,
  getUploadForUser,
  removeUpload
};
