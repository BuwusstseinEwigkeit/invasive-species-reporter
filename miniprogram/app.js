var config = {};
try {
  config = require("./config.json") || {};
} catch (_e) {
  config = {};
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

/**
 * API base URL priority:
 * 1. developer override in local storage;
 * 2. tracked config.json for packaged builds;
 * 3. localhost fallback in WeChat DevTools.
 */
function resolveApiBaseUrl() {
  try {
    var stored = wx.getStorageSync("server_base_url");
    if (stored) return trimTrailingSlash(stored);
  } catch (_e) { /* ignore */ }

  var platform = "devtools";
  try {
    var systemInfo = wx.getSystemInfoSync() || {};
    platform = (systemInfo.platform || "").toLowerCase();
  } catch (_e) { /* ignore */ }

  var configured = config.setting && config.setting.SERVER_BASE_URL;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (platform === "devtools") {
    return "http://127.0.0.1:3000";
  }

  return "";
}

App({
  globalData: {
    brandName: "外来物种哨点",
    apiBaseUrl: resolveApiBaseUrl(),
    appVersion: "v0.8.0",
    authToken: "",
    role: ""
  },

  onLaunch: function () {
    try {
      this.globalData.authToken = wx.getStorageSync("auth_token") || "";
    } catch (_e) { /* ignore */ }

    wx.onError(function (error) {
      console.error("[app] unhandled error:", error);
      wx.showToast({
        title: "出现异常，请稍后重试",
        icon: "none",
        duration: 3000
      });
    });
  }
});
