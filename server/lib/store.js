const fs = require("fs");
const path = require("path");
const { species, reports: seedReports, reviewLogs: seedReviewLogs } = require("../data/mock-data");

const runtimePath = path.join(__dirname, "../data/runtime-data.json");

function ensureRuntimeData() {
  if (!fs.existsSync(runtimePath)) {
    fs.writeFileSync(
      runtimePath,
      JSON.stringify(
        {
          reports: seedReports,
          reviewLogs: seedReviewLogs
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function readRuntimeData() {
  ensureRuntimeData();
  return JSON.parse(fs.readFileSync(runtimePath, "utf8"));
}

function writeRuntimeData(data) {
  fs.writeFileSync(runtimePath, JSON.stringify(data, null, 2), "utf8");
}

function getSpeciesList() {
  return species;
}

function getSpeciesById(id) {
  return species.find((item) => item.id === id) || null;
}

function getReports(status) {
  const data = readRuntimeData();

  if (!status) {
    return data.reports;
  }

  return data.reports.filter((item) => item.status === status);
}

function getSpeciesReports(speciesId) {
  const data = readRuntimeData();
  return data.reports.filter((item) => item.speciesId === speciesId);
}

function createReport(payload) {
  const data = readRuntimeData();
  const report = {
    id: `report-${Date.now()}`,
    userId: payload.userId || "user-anonymous",
    speciesId: payload.speciesId || null,
    aiTop1: payload.aiTop1 || "未识别",
    aiScore: Number(payload.aiScore || 0),
    aiCandidates: payload.aiCandidates || [],
    imageUrl: payload.imageUrl || "",
    latitude: Number(payload.latitude || 0),
    longitude: Number(payload.longitude || 0),
    address: payload.address || "",
    remark: payload.remark || "",
    status: "pending",
    createdAt: new Date().toISOString()
  };

  data.reports.unshift(report);
  writeRuntimeData(data);
  return report;
}

function reviewReport(reportId, payload) {
  const data = readRuntimeData();
  const target = data.reports.find((item) => item.id === reportId);

  if (!target) {
    return null;
  }

  target.status = payload.action;
  target.speciesId = payload.finalSpeciesId || target.speciesId;

  const finalSpecies = payload.finalSpeciesId ? getSpeciesById(payload.finalSpeciesId) : null;
  if (finalSpecies) {
    target.aiTop1 = finalSpecies.chineseName;
  }

  const log = {
    id: `review-${Date.now()}`,
    reportId,
    reviewerId: payload.reviewerId || "reviewer-demo",
    action: payload.action,
    finalSpeciesId: payload.finalSpeciesId || null,
    comment: payload.comment || "",
    createdAt: new Date().toISOString()
  };

  data.reviewLogs.unshift(log);
  writeRuntimeData(data);

  return {
    report: target,
    log
  };
}

function getStats() {
  const data = readRuntimeData();
  const approved = data.reports.filter((item) => item.status === "approved").length;
  const pending = data.reports.filter((item) => item.status === "pending").length;
  const rejected = data.reports.filter((item) => item.status === "rejected").length;

  return {
    totalReports: data.reports.length,
    approvedReports: approved,
    pendingReports: pending,
    rejectedReports: rejected,
    totalSpecies: species.length
  };
}

module.exports = {
  getSpeciesList,
  getSpeciesById,
  getReports,
  getSpeciesReports,
  createReport,
  reviewReport,
  getStats
};
