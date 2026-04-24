/**
 * Resolve API base URL.
 * - In WeChat DevTools simulator on PC → localhost
 * - On real device (真机调试/预览) → LAN IP of dev machine
 *
 * Override: set SERVER_BASE_URL in project.config.json or change the fallback IP below.
 */
function resolveApiBaseUrl() {
  // Allow explicit override via global config
  try {
    var accountInfo = wx.getAccountInfoSync();
    if (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion) {
      // release / trial / develop
    }
  } catch (_e) { /* ignore */ }

  var systemInfo = {};
  try {
    systemInfo = wx.getSystemInfoSync() || {};
  } catch (_e) { /* ignore */ }

  var platform = (systemInfo.platform || "").toLowerCase();
  var model = (systemInfo.model || "").toLowerCase();

  // PC devtools simulator: use localhost
  if (platform === "devtools") {
    return "http://127.0.0.1:3000";
  }

  // Real phone (android/ios) or anything else: use LAN IP
  // CHANGE THIS to your current LAN IP if different
  return "http://10.198.106.54:3000";
}

App({
  globalData: {
    brandName: "外来物种哨点",
    apiBaseUrl: resolveApiBaseUrl(),
    appVersion: "v0.6.0"
  },
  onLaunch: function () {
    console.log("[app] launch, version=v0.6.0, base=" + this.globalData.apiBaseUrl);
  }
});
