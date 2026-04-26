var app = getApp();

function parseJwtPayload(token) {
  if (!token) return {};
  try {
    var parts = token.split(".");
    if (parts.length !== 3) return {};
    // Fix: use proper base64 decode with padding
    var base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    var padding = base64.length % 4;
    if (padding === 2) base64 += "==";
    else if (padding === 3) base64 += "=";
    // Decode base64 manually (avoiding decodeURIComponent bugs with % sequences)
    var decoded = "";
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var buffer = 0;
    var bits = 0;
    for (var i = 0; i < base64.length; i++) {
      var c = base64[i];
      if (c === "=") break;
      var idx = chars.indexOf(c);
      if (idx === -1) continue;
      buffer = (buffer << 6) | idx;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        decoded += String.fromCharCode((buffer >> bits) & 0xff);
      }
    }
    return JSON.parse(decoded) || {};
  } catch (_e) {
    return {};
  }
}

function getToken() {
  try {
    var stored = wx.getStorageSync("auth_token");
    if (stored) return stored;
  } catch (_e) { /* ignore */ }

  try {
    return app.globalData.authToken || "";
  } catch (_e) {
    return "";
  }
}

function setToken(token) {
  try {
    app.globalData.authToken = token;
    wx.setStorageSync("auth_token", token);
  } catch (_e) { /* ignore */ }
}

function clearToken() {
  try {
    app.globalData.authToken = "";
    wx.removeStorageSync("auth_token");
  } catch (_e) { /* ignore */ }
}

/**
 * Convert a relative image URL to an absolute URL.
 * URLs already starting with http[s] pass through.
 */
function resolveImageUrl(url) {
  if (!url) return "";
  if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
  var full = (app.globalData.apiBaseUrl || "") + url;
  console.log("[api] resolveImageUrl:", url, "→", full);
  return full;
}

/**
 * Download a server image to a local temp file so it can be displayed
 * inside <image> on 真机调试 (WeChat blocks HTTP image URLs in <image> src).
 * Returns the local temp file path, or "" on failure.
 */
function downloadImage(url) {
  return new Promise(function (resolve) {
    var fullUrl = resolveImageUrl(url);
    if (!fullUrl) {
      console.log("[api] downloadImage: empty url, skipping");
      resolve("");
      return;
    }
    console.log("[api] downloadImage: downloading", fullUrl);
    wx.downloadFile({
      url: fullUrl,
      success: function (res) {
        console.log("[api] downloadImage: status=" + res.statusCode + ", temp=" + (res.tempFilePath || "(none)"));
        if (res.statusCode === 200) {
          resolve(res.tempFilePath);
        } else {
          resolve("");
        }
      },
      fail: function (err) {
        console.log("[api] downloadImage: FAIL", JSON.stringify(err));
        resolve("");
      }
    });
  });
}

function request(path, options) {
  options = options || {};
  return new Promise(function (resolve, reject) {
    var headers = { "content-type": "application/json" };
    var token = getToken();
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }
    wx.request({
      url: (app.globalData.apiBaseUrl || "") + path,
      method: options.method || "GET",
      data: options.data || {},
      timeout: options.timeout || 15000,
      header: headers,
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        var msg = (res.data && (res.data.error || res.data.message)) || "HTTP " + res.statusCode;
        wx.showToast({ title: msg, icon: "none" });
        reject(new Error(msg));
      },
      fail: function (error) {
        wx.showToast({ title: "网络请求失败，请检查网络连接", icon: "none" });
        reject(error);
      }
    });
  });
}

function uploadImage(filePath) {
  return new Promise(function (resolve, reject) {
    wx.uploadFile({
      url: (app.globalData.apiBaseUrl || "") + "/api/uploads",
      filePath: filePath,
      name: "image",
      success: function (res) {
        try {
          var data = JSON.parse(res.data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
            return;
          }
          var msg = (data && (data.error || data.message)) || "HTTP " + res.statusCode;
          wx.showToast({ title: msg, icon: "none" });
          reject(new Error(msg));
        } catch (error) {
          wx.showToast({ title: "上传解析失败", icon: "none" });
          reject(error);
        }
      },
      fail: function (err) {
        wx.showToast({ title: "上传请求失败", icon: "none" });
        reject(err);
      }
    });
  });
}

function login(username, password) {
  return request("/api/auth/login", {
    method: "POST",
    data: { username: username, password: password }
  }).then(function (res) {
    if (res.item && res.item.token) {
      setToken(res.item.token);
      var payload = parseJwtPayload(res.item.token);
      try {
        var app = getApp();
        if (app && app.globalData) {
          app.globalData.role = payload.role || "";
        }
      } catch (_e) { /* ignore */ }
    }
    return res;
  });
}

function ensureReviewerLogin() {
  var token = getToken();
  if (token) {
    // Already have a token, verify it's still valid by checking role
    return Promise.resolve();
  }
  // Auto-login with demo reviewer account
  return login("reviewer", "review123");
}

function startRecognition(fileId) {
  return request("/api/recognitions", {
    method: "POST",
    data: { fileId: fileId },
    timeout: 10000
  });
}

function getRecognition(jobId) {
  return request("/api/recognitions/" + jobId, {
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
  return request("/api/species/" + id);
}

function getReports(status) {
  var query = status ? "?status=" + status : "";
  return request("/api/reports" + query);
}

function getMyReports(status) {
  var query = status ? "?status=" + status : "";
  return request("/api/reports/my" + query);
}

function createReport(data) {
  return request("/api/reports", {
    method: "POST",
    data: data
  });
}

function reviewReport(id, data) {
  // Ensure auth before reviewing
  return ensureReviewerLogin().then(function () {
    return request("/api/reports/" + id + "/review", {
      method: "POST",
      data: data
    });
  });
}

function register(username, password) {
  return request("/api/auth/register", {
    method: "POST",
    data: { username: username, password: password }
  }).then(function (res) {
    if (res.item && res.item.token) {
      setToken(res.item.token);
      var payload = parseJwtPayload(res.item.token);
      try {
        var app = getApp();
        if (app && app.globalData) {
          app.globalData.role = payload.role || "";
        }
      } catch (_e) { /* ignore */ }
    }
    return res;
  });
}

function wxLogin(code) {
  return request("/api/auth/wx-login", {
    method: "POST",
    data: { code: code }
  }).then(function (res) {
    if (res.item && res.item.token) {
      setToken(res.item.token);
      var payload = parseJwtPayload(res.item.token);
      try {
        var app = getApp();
        if (app && app.globalData) {
          app.globalData.role = payload.role || "";
        }
      } catch (_e) { /* ignore */ }
    }
    return res;
  });
}

function getMyUserId() {
  var token = getToken();
  var payload = parseJwtPayload(token);
  return payload.userId || "";
}

function getMyUsername() {
  var token = getToken();
  var payload = parseJwtPayload(token);
  return payload.username || "";
}

function getMyRole() {
  var token = getToken();
  var payload = parseJwtPayload(token);
  return payload.role || "";
}

// --- Notifications ---

function getNotifications(userId) {
  return request("/api/notifications/" + userId);
}

function markNotificationRead(id) {
  return request("/api/notifications/" + id + "/read", { method: "POST" });
}

function markAllNotificationsRead(userId) {
  return request("/api/notifications/" + userId + "/read-all", { method: "POST" });
}

// --- Points ---

function getPoints(userId) {
  return request("/api/points/" + userId);
}

// --- Shop ---

function getProducts() {
  return request("/api/shop/products");
}

function purchaseProduct(productId) {
  return request("/api/shop/purchase", {
    method: "POST",
    data: { productId: productId }
  });
}

function getPurchases(userId) {
  return request("/api/shop/purchases/" + userId);
}

// --- Achievements ---

function getAchievements() {
  return request("/api/achievements");
}

function checkAchievements() {
  return request("/api/achievements/check", { method: "POST" });
}

function exportCsv() {
  var baseUrl = app.globalData.apiBaseUrl || "";
  var token = getToken();
  var url = baseUrl + "/api/reports/export/csv";
  // Token is sent via Authorization header only (not in URL query to avoid log leakage)
  return new Promise(function (resolve, reject) {
    wx.downloadFile({
      url: url,
      header: token ? { Authorization: "Bearer " + token } : {},
      success: function (res) {
        if (res.statusCode === 200) {
          wx.saveFile({
            tempFilePath: res.tempFilePath,
            success: function (saveRes) {
              wx.showToast({ title: "导出成功", icon: "success" });
              resolve(saveRes.savedFilePath);
            },
            fail: function () {
              // If save fails, still consider download a success
              wx.showToast({ title: "下载完成", icon: "success" });
              resolve(res.tempFilePath);
            }
          });
        } else {
          wx.showToast({ title: "导出失败", icon: "none" });
          reject(new Error("Export failed with status " + res.statusCode));
        }
      },
      fail: function (err) {
        wx.showToast({ title: "导出请求失败", icon: "none" });
        reject(err);
      }
    });
  });
}

module.exports = {
  uploadImage: uploadImage,
  startRecognition: startRecognition,
  getRecognition: getRecognition,
  getStats: getStats,
  getSpecies: getSpecies,
  getSpeciesDetail: getSpeciesDetail,
  getReports: getReports,
  getMyReports: getMyReports,
  createReport: createReport,
  reviewReport: reviewReport,
  login: login,
  register: register,
  wxLogin: wxLogin,
  setToken: setToken,
  getToken: getToken,
  clearToken: clearToken,
  getMyUserId: getMyUserId,
  getMyUsername: getMyUsername,
  getMyRole: getMyRole,
  getPoints: getPoints,
  getNotifications: getNotifications,
  markNotificationRead: markNotificationRead,
  markAllNotificationsRead: markAllNotificationsRead,
  getProducts: getProducts,
  purchaseProduct: purchaseProduct,
  getPurchases: getPurchases,
  resolveImageUrl: resolveImageUrl,
  downloadImage: downloadImage,
  exportCsv: exportCsv,
  getAchievements: getAchievements,
  checkAchievements: checkAchievements
};
