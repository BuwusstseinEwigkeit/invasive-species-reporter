const path = require("path");

const uploadIndex = new Map();

function registerUpload(file) {
  const fileId = path.basename(file.filename);

  uploadIndex.set(fileId, {
    fileId,
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    filePath: file.path
  });

  return uploadIndex.get(fileId);
}

function getUpload(fileId) {
  return uploadIndex.get(fileId) || null;
}

module.exports = {
  registerUpload,
  getUpload
};
