/**
 * Resolve API base URL.
 * - In WeChat DevTools simulator on PC → localhost
 * - On real device (真机调试/预览) → LAN IP of dev machine
 *
 * Override: set SERVER_BASE_URL in miniprogram/config.json
 */
function resolveApiBaseUrl() {
  var platform = "devtools";
  try {
    var systemInfo = wx.getSystemInfoSync() || {};
    platform = (systemInfo.platform || "").toLowerCase();
  } catch (_e) { /* ignore */ }

  // PC devtools simulator: use localhost
  if (platform === "devtools") {
    return "http://127.0.0.1:3000";
  }

  // Real phone: try to read from local storage first (set by developer tools)
  try {
    var stored = wx.getStorageSync("server_base_url");
    if (stored) {
      return stored;
    }
  } catch (_e) { /* ignore */ }

  // Fallback: detect LAN IP automatically or use hardcoded value
  // This should be configured in config.json before building
  console.warn("[app] resolveApiBaseUrl: no SERVER_BASE_URL configured. Please set it in miniprogram/config.json");
  return "http://10.198.106.54:3000"; // Your LAN IP - update this if it changes
}

App({
  globalData: {
    brandName: "外来物种哨点",
    apiBaseUrl: resolveApiBaseUrl(),
    appVersion: "v0.6.0"
  },
  onLaunch: function () {
    console.log("[app] launch, version=v0.6.0, base=" + this.globalData.apiBaseUrl);

    // Global unhandled error handler
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
