var app = getApp();

function parseJwtPayload(token) {
  if (!token) return {};
  try {
    var parts = token.split(".");
    if (parts.length !== 3) return {};
    var base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    var padding = base64.length % 4;
    if (padding === 2) base64 += "==";
    else if (padding === 3) base64 += "=";
    var binary = "";
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
        binary += String.fromCharCode((buffer >> bits) & 0xff);
      }
    }
    var encoded = "";
    for (var j = 0; j < binary.length; j++) {
      encoded += "%" + ("0" + binary.charCodeAt(j).toString(16)).slice(-2);
    }
    var decoded = decodeURIComponent(encoded);
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
    app.globalData.role = "";
    wx.removeStorageSync("auth_token");
  } catch (_e) { /* ignore */ }
}

var authRedirecting = false;
function handleUnauthorized() {
  clearToken();
  if (authRedirecting) return;

  var currentRoute = "";
  try {
    var pages = getCurrentPages();
    if (pages && pages.length) {
      currentRoute = pages[pages.length - 1].route || "";
    }
  } catch (_e) { /* ignore */ }

  if (currentRoute === "pages/login/login") return;
  authRedirecting = true;
  wx.showToast({ title: "登录已过期，请重新登录", icon: "none" });
  setTimeout(function () {
    wx.navigateTo({
      url: "/pages/login/login",
      complete: function () {
        setTimeout(function () { authRedirecting = false; }, 500);
      }
    });
  }, 100);
}

/**
 * Convert a relative image URL to an absolute URL.
 * URLs already starting with http[s] pass through.
 */
function resolveImageUrl(url) {
  if (!url) return "";
  if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
  var baseUrl = app.globalData.apiBaseUrl || "";
  return baseUrl ? baseUrl + url : "";
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
      resolve("");
      return;
    }
    var token = getToken();
    wx.downloadFile({
      url: fullUrl,
      header: token ? { Authorization: "Bearer " + token } : {},
      success: function (res) {
        if (res.statusCode === 200) {
          resolve(res.tempFilePath);
        } else {
          resolve("");
        }
      },
      fail: function () {
        resolve("");
      }
    });
  });
}

function apiError(message, statusCode, response) {
  var error = new Error(message || "请求失败");
  error.statusCode = Number(statusCode || 0);
  error.response = response || null;
  return error;
}

function getApiBaseUrl() {
  var baseUrl = app.globalData.apiBaseUrl || "";
  if (!baseUrl) {
    throw apiError("服务地址未配置，请先设置服务器地址。", 0, null);
  }
  return baseUrl;
}

function request(path, options) {
  options = options || {};
  return new Promise(function (resolve, reject) {
    var baseUrl;
    try {
      baseUrl = getApiBaseUrl();
    } catch (error) {
      reject(error);
      return;
    }
    var headers = { "content-type": "application/json" };
    var token = getToken();
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }
    wx.request({
      url: baseUrl + path,
      method: options.method || "GET",
      data: options.data || {},
      timeout: options.timeout || 15000,
      header: headers,
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        if (res.statusCode === 401) {
          handleUnauthorized();
        }
        var msg = (res.data && (res.data.error || res.data.message)) || "HTTP " + res.statusCode;
        reject(apiError(msg, res.statusCode, res.data));
      },
      fail: function (error) {
        reject(apiError("网络请求失败，请检查网络连接", 0, error));
      }
    });
  });
}

function uploadImage(filePath) {
  return new Promise(function (resolve, reject) {
    var baseUrl;
    try {
      baseUrl = getApiBaseUrl();
    } catch (error) {
      reject(error);
      return;
    }
    var token = getToken();
    wx.uploadFile({
      url: baseUrl + "/api/uploads",
      filePath: filePath,
      name: "image",
      header: token ? { Authorization: "Bearer " + token } : {},
      success: function (res) {
        try {
          var data = JSON.parse(res.data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
            return;
          }
          if (res.statusCode === 401) {
            handleUnauthorized();
          }
          var msg = (data && (data.error || data.message)) || "HTTP " + res.statusCode;
          reject(apiError(msg, res.statusCode, data));
        } catch (error) {
          reject(apiError("上传响应解析失败", res.statusCode, error));
        }
      },
      fail: function (err) {
        reject(apiError("上传请求失败，请检查网络连接", 0, err));
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
    return Promise.resolve();
  }
  // No token — redirect to login page
  return Promise.reject(new Error("请先登录审核员账号"));
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

function paginationQuery(page, limit, extra) {
  var params = [];
  if (extra) params.push(extra);
  if (page) params.push("page=" + encodeURIComponent(page));
  if (limit) params.push("limit=" + encodeURIComponent(limit));
  return params.length ? "?" + params.join("&") : "";
}

function getReports(_status, page, limit) {
  return request("/api/reports" + paginationQuery(page, limit));
}

function getReviewQueue(page, limit) {
  return request("/api/reports/review-queue" + paginationQuery(page, limit));
}

function getMyReports(status, page, limit) {
  var extra = status ? "status=" + encodeURIComponent(status) : "";
  return request("/api/reports/my" + paginationQuery(page, limit, extra));
}

function getReportDetail(id) {
  return request("/api/reports/" + encodeURIComponent(id));
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

function purchaseProduct(productId, shippingInfo) {
  shippingInfo = shippingInfo || {};
  return request("/api/shop/purchase", {
    method: "POST",
    data: {
      productId: productId,
      shippingName: shippingInfo.name || shippingInfo.shippingName || "",
      shippingPhone: shippingInfo.phone || shippingInfo.shippingPhone || "",
      shippingAddress: shippingInfo.address || shippingInfo.shippingAddress || ""
    }
  });
}

function getPurchases(userId) {
  return request("/api/shop/purchases/" + userId);
}

// --- User Profile ---

function getUserProfile(userId) {
  return request("/api/user/profile/" + userId);
}

function updateAvatar(avatarUrl) {
  return request("/api/user/avatar", {
    method: "POST",
    data: { avatarUrl: avatarUrl }
  });
}

function uploadAvatar(filePath) {
  return new Promise(function (resolve, reject) {
    var baseUrl;
    try {
      baseUrl = getApiBaseUrl();
    } catch (error) {
      reject(error);
      return;
    }
    var token = getToken();
    wx.uploadFile({
      url: baseUrl + "/api/uploads",
      filePath: filePath,
      name: "image",
      header: token ? { Authorization: "Bearer " + token } : {},
      success: function (res) {
        try {
          var data = JSON.parse(res.data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
            return;
          }
          if (res.statusCode === 401) {
            handleUnauthorized();
          }
          var msg = (data && (data.error || data.message)) || "HTTP " + res.statusCode;
          reject(apiError(msg, res.statusCode, data));
        } catch (error) {
          reject(apiError("上传响应解析失败", res.statusCode, error));
        }
      },
      fail: function (err) {
        reject(apiError("上传请求失败，请检查网络连接", 0, err));
      }
    });
  });
}

// --- Achievements ---

function getAchievements() {
  return request("/api/achievements");
}

function checkAchievements() {
  return request("/api/achievements/check", { method: "POST" });
}

// --- Leaderboard ---

function getLeaderboard(type) {
  var query = type ? "?type=" + type : "";
  return request("/api/leaderboard" + query);
}

// --- User Privileges ---

function getPrivileges() {
  return request("/api/user/privileges");
}

// --- Orders ---

function getOrders(userId) {
  return request("/api/shop/orders/" + userId);
}

function getAdminOrders() {
  return request("/api/shop/admin/orders");
}

function updateOrderStatus(orderId, status) {
  return request("/api/shop/admin/orders/" + encodeURIComponent(orderId), {
    method: "PATCH",
    data: { status: status }
  });
}

function exportCsv() {
  return new Promise(function (resolve, reject) {
    var baseUrl;
    try {
      baseUrl = getApiBaseUrl();
    } catch (error) {
      reject(error);
      return;
    }
    var token = getToken();
    var url = baseUrl + "/api/reports/export/csv";
    wx.downloadFile({
      url: url,
      header: token ? { Authorization: "Bearer " + token } : {},
      success: function (res) {
        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            fileType: "csv",
            showMenu: true,
            success: function () {
              wx.showToast({ title: "导出成功", icon: "success" });
              resolve(res.tempFilePath);
            },
            fail: function () {
              wx.showToast({ title: "下载完成，请通过分享转发文件", icon: "none", duration: 3000 });
              resolve(res.tempFilePath);
            }
          });
        } else {
          if (res.statusCode === 401) {
            handleUnauthorized();
          }
          reject(apiError("导出失败", res.statusCode, null));
        }
      },
      fail: function (err) {
        reject(apiError("导出请求失败，请检查网络连接", 0, err));
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
  getReviewQueue: getReviewQueue,
  getMyReports: getMyReports,
  getReportDetail: getReportDetail,
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
  checkAchievements: checkAchievements,
  getLeaderboard: getLeaderboard,
  getPrivileges: getPrivileges,
  getOrders: getOrders,
  getAdminOrders: getAdminOrders,
  updateOrderStatus: updateOrderStatus,
  getUserProfile: getUserProfile,
  updateAvatar: updateAvatar,
  uploadAvatar: uploadAvatar
};
