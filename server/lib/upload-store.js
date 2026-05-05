const path = require("path");

const uploadIndex = new Map();
const UPLOAD_TTL_MS = 60 * 60 * 1000; // 1 hour

function registerUpload(file) {
  const fileId = path.basename(file.filename);

  uploadIndex.set(fileId, {
    fileId,
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

function removeUpload(fileId) {
  uploadIndex.delete(fileId);
}

// Periodic cleanup of expired uploads
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of uploadIndex) {
    if (now - entry.createdAt > UPLOAD_TTL_MS) {
      uploadIndex.delete(key);
    }
  }
}, 10 * 60 * 1000); // every 10 minutes

module.exports = {
  registerUpload,
  getUpload,
  removeUpload
};
