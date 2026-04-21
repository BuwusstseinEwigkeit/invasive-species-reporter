function resolveApiBaseUrl() {
  let platform = "";

  try {
    if (typeof wx.getDeviceInfo === "function") {
      platform = wx.getDeviceInfo().platform || "";
    } else if (typeof wx.getSystemInfoSync === "function") {
      platform = wx.getSystemInfoSync().platform || "";
    }
  } catch (error) {
    platform = "";
  }

  if (platform === "devtools" || platform === "windows" || platform === "mac") {
    return "http://127.0.0.1:3000";
  }

  return "http://10.198.106.54:3000";
}

App({
  globalData: {
    brandName: "外来物种哨点",
    apiBaseUrl: resolveApiBaseUrl(),
    appVersion: "v0.3.0"
  }
});
