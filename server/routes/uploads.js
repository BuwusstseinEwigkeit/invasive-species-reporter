const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const sharp = require("sharp");
const { registerUpload, getUploadForUser } = require("../lib/upload-store");
const { createRecognitionJob, getRecognitionJobForUser } = require("../lib/recognition-jobs");
const { getSpeciesList } = require("../lib/store");
const { sendError, getPublicBaseUrl } = require("../lib/helpers");
const { authRequired } = require("../middleware/auth");

const router = Router();

const uploadsDir = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed."));
      return;
    }
    cb(null, true);
  },
});

// POST /api/uploads
router.post("/uploads", authRequired, upload.single("image"), async (req, res) => {
  if (!req.file) {
    sendError(res, "No image uploaded.", 400);
    return;
  }

  try {
    const metadata = await sharp(req.file.path, { failOn: "none" }).metadata();
    if (!metadata || !metadata.format || !["jpeg", "jpg", "png", "webp", "gif", "heic"].includes(metadata.format.toLowerCase())) {
      fs.unlinkSync(req.file.path);
      sendError(res, "Invalid image file content.", 400);
      return;
    }
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    if (!width || !height || width * height > 30_000_000) {
      fs.unlinkSync(req.file.path);
      sendError(res, "Image dimensions are not supported.", 400);
      return;
    }

    // Re-encode the upload before it can be served publicly. Sharp strips EXIF/GPS
    // metadata by default, which avoids leaking camera location from pending reports.
    const normalizedName = `${path.parse(req.file.filename).name}-normalized.jpg`;
    const normalizedPath = path.join(uploadsDir, normalizedName);
    await sharp(req.file.path, { failOn: "none" })
      .rotate()
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(normalizedPath);
    fs.unlinkSync(req.file.path);
    req.file.filename = normalizedName;
    req.file.path = normalizedPath;
    req.file.mimetype = "image/jpeg";
    req.file.size = fs.statSync(normalizedPath).size;
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    sendError(res, "Could not validate image file.", 400);
    return;
  }

  const file = registerUpload(req.file, req.user.userId);
  const imageUrl = `${getPublicBaseUrl(req)}/uploads/${file.filename}`;

  res.status(201).json({
    item: {
      fileId: file.fileId,
      imageUrl,
      originalName: file.originalName,
    },
  });
});

// POST /api/recognitions
router.post("/recognitions", authRequired, (req, res) => {
  const fileId = req.body && req.body.fileId;
  const uploadRecord = getUploadForUser(fileId, req.user.userId);

  if (!uploadRecord) {
    sendError(res, "Uploaded file not found.", 404);
    return;
  }

  const job = createRecognitionJob({
    fileId,
    userId: req.user.userId,
    speciesList: getSpeciesList(),
  });

  if (!job) {
    sendError(res, "Uploaded file not found.", 404);
    return;
  }

  res.status(202).json({
    item: {
      jobId: job.jobId,
      status: job.status,
    },
  });
});

// GET /api/recognitions/:jobId
router.get("/recognitions/:jobId", authRequired, (req, res) => {
  const job = getRecognitionJobForUser(req.params.jobId, req.user.userId);

  if (!job) {
    sendError(res, "Recognition job not found.", 404);
    return;
  }

  res.json({ item: job });

  if (job.status === "failed") {
    console.error(`[recognition] failed jobId=${job.jobId} error=${job.error}`);
  }
});

module.exports = router;
