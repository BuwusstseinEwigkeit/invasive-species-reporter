require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  getSpeciesList,
  getSpeciesById,
  getReports,
  getSpeciesReports,
  createReport,
  reviewReport,
  getStats
} = require("./lib/store");
const { registerUpload, getUpload } = require("./lib/upload-store");
const { createRecognitionJob, getRecognitionJob } = require("./lib/recognition-jobs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }

    cb(new Error("Only image uploads are allowed."));
  }
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));

function getPublicBaseUrl(req) {
  return process.env.SERVER_PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "invasive-species-reporter-api"
  });
});

app.get("/api/species", (_req, res) => {
  res.json({
    items: getSpeciesList()
  });
});

app.get("/api/species/:id", (req, res) => {
  const species = getSpeciesById(req.params.id);

  if (!species) {
    res.status(404).json({ message: "Not Found" });
    return;
  }

  res.json({
    item: species,
    reports: getSpeciesReports(req.params.id)
  });
});

app.get("/api/reports", (req, res) => {
  res.json({
    items: getReports(req.query.status)
  });
});

app.post("/api/uploads", upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "No image uploaded." });
    return;
  }

  const file = registerUpload(req.file);
  const imageUrl = `${getPublicBaseUrl(req)}/uploads/${file.filename}`;

  res.status(201).json({
    item: {
      fileId: file.fileId,
      imageUrl,
      originalName: file.originalName
    }
  });
  console.log(`[upload] fileId=${file.fileId} originalName=${file.originalName}`);
});

app.post("/api/recognitions", (req, res) => {
  const uploadRecord = getUpload(req.body.fileId);

  if (!uploadRecord) {
    res.status(404).json({ message: "Uploaded file not found." });
    return;
  }

  const job = createRecognitionJob({
    fileId: req.body.fileId,
    speciesList: getSpeciesList()
  });

  if (!job) {
    res.status(404).json({ message: "Uploaded file not found." });
    return;
  }

  res.status(202).json({
    item: {
      jobId: job.jobId,
      status: job.status
    }
  });
  console.log(`[recognition] created jobId=${job.jobId} fileId=${req.body.fileId}`);
});

app.get("/api/recognitions/:jobId", (req, res) => {
  const job = getRecognitionJob(req.params.jobId);

  if (!job) {
    res.status(404).json({ message: "Recognition job not found." });
    return;
  }

  res.json({
    item: job
  });

  if (job.status === "failed") {
    console.error(`[recognition] failed jobId=${job.jobId} error=${job.error}`);
  }
});

app.post("/api/reports", (req, res) => {
  try {
    const report = createReport(req.body || {});
    res.status(201).json({
      item: report,
      message: "Report created and waiting for review."
    });
  } catch (error) {
    res.status(400).json({
      message: "Invalid JSON body"
    });
  }
});

app.post("/api/reports/:id/review", (req, res) => {
  try {
    const result = reviewReport(req.params.id, req.body || {});

    if (!result) {
      res.status(404).json({ message: "Not Found" });
      return;
    }

    res.json({
      item: result.report,
      review: result.log
    });
  } catch (error) {
    res.status(400).json({
      message: "Invalid JSON body"
    });
  }
});

app.get("/api/stats", (_req, res) => {
  res.json({
    item: getStats()
  });
});

app.use((error, _req, res, _next) => {
  console.error("[server] request failed:", error);
  res.status(400).json({
    message: error.message || "Request failed."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
