const app = getApp();

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBaseUrl}${path}`,
      method: options.method || "GET",
      data: options.data || {},
      timeout: options.timeout || 6000,
      header: {
        "content-type": "application/json"
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }

        reject(new Error((res.data && res.data.message) || `HTTP ${res.statusCode}`));
      },
      fail: (error) => {
        reject(error);
      }
    });
  });
}

function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.apiBaseUrl}/api/uploads`,
      filePath,
      name: "image",
      success: (res) => {
        try {
          const data = JSON.parse(res.data);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
            return;
          }

          reject(new Error((data && data.message) || `HTTP ${res.statusCode}`));
        } catch (error) {
          reject(error);
        }
      },
      fail: reject
    });
  });
}

function startRecognition(fileId) {
  return request("/api/recognitions", {
    method: "POST",
    data: {
      fileId
    },
    timeout: 10000
  });
}

function getRecognition(jobId) {
  return request(`/api/recognitions/${jobId}`, {
    timeout: 10000
  });
}

function getStats() {
  return request("/api/stats");
}

function getSpecies() {
  return request("/api/species");
}

function getSpeciesDetail(id) {
  return request(`/api/species/${id}`);
}

function getReports(status) {
  const query = status ? `?status=${status}` : "";
  return request(`/api/reports${query}`);
}

function createReport(data) {
  return request("/api/reports", {
    method: "POST",
    data
  });
}

function reviewReport(id, data) {
  return request(`/api/reports/${id}/review`, {
    method: "POST",
    data
  });
}

module.exports = {
  uploadImage,
  startRecognition,
  getRecognition,
  getStats,
  getSpecies,
  getSpeciesDetail,
  getReports,
  createReport,
  reviewReport
};
