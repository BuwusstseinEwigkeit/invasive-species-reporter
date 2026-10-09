var api = require("../../utils/api");
var app = getApp();

function badgeFallback() {
  return [
    { key: "first_report", name: "新手识别员", description: "第一份有效上报通过审核", badge: "/images/badge-newbie.png", earned: false, progress: { current: 0, target: 1 } },
    { key: "eco_guard", name: "生态卫士", description: "累计5份上报通过审核", badge: "/images/badge-ecoguard.png", earned: false, progress: { current: 0, target: 5 } },
    { key: "contributor", name: "社区贡献者", description: "累计20份上报通过审核", badge: "/images/badge-contributor.png", earned: false, progress: { current: 0, target: 20 } },
    { key: "expert", name: "火眼金睛", description: "累计50份上报通过审核", badge: "/images/badge-expert.png", earned: false, progress: { current: 0, target: 50 } },
    { key: "honorary_medal", name: "物种专家", description: "累计100份上报通过审核", badge: "/images/badge-species.png", earned: false, progress: { current: 0, target: 100 } }
  ];
}

var POINT_ACTION_TEXT = {
  report_submit: "有效上报入账",
  first_report: "首次有效上报",
  report_approved: "审核通过奖励",
  high_quality: "高质量线索奖励",
  streak_bonus: "连续有效上报",
  report_rejected: "审核驳回",
  report_spam: "无效上报扣分",
  purchase: "兑换商品",
  admin_adjustment: "管理员调整"
};

function decoratePointLogs(logs) {
  return (logs || []).slice(0, 20).map(function (item) {
    return Object.assign({}, item, {
      actionText: POINT_ACTION_TEXT[item.action] || item.action || "积分变动"
    });
  });
}

Page({
  data: {
    loggedIn: false,
    username: "",
    avatarInitial: "",
    role: "",
    userId: "",
    avatarUrl: "",
    createdAt: "",
    points: 0,
    pointsLogs: [],
    credit: 100,
    privileges: {
      dailyReportLimit: 5,
      highQualityBonus: 0,
      canExportReports: false,
      showExpertBadge: false
    },
    loading: true,
    logsCollapsed: false,
    unread: 0,
    achievements: []
  },

  toggleLogs() {
    this.setData({ logsCollapsed: !this.data.logsCollapsed });
  },

  onPullDownRefresh() {
    this.checkLogin().finally(function () {
      wx.stopPullDownRefresh();
    });
  },

  onShow() {
    this.checkLogin();
  },

  async checkLogin() {
    var token = api.getToken();
    if (!token) {
      this.setData({
        loggedIn: false,
        loading: false,
        username: "",
        avatarInitial: "",
        role: "",
        userId: "",
        avatarUrl: "",
        points: 0,
        pointsLogs: [],
        unread: 0
      });
      return;
    }

    var username = api.getMyUsername();
    var userId = api.getMyUserId();
    var role = api.getMyRole();
    if (!role && app.globalData && app.globalData.role) {
      role = app.globalData.role;
    }

    this.setData({
      loggedIn: true,
      username: username,
      avatarInitial: username ? username.substring(0, 1).toUpperCase() : "U",
      userId: userId,
      role: role,
      loading: true
    });

    await Promise.all([
      this.loadProfile(),
      this.loadPoints(),
      this.loadUnreadCount(),
      this.loadAchievements(),
      this.loadPrivileges()
    ]);
    this.setData({ loading: false });
  },

  async loadProfile() {
    try {
      if (!this.data.userId) return;
      var res = await api.getUserProfile(this.data.userId);
      var item = res.item || {};
      this.setData({
        avatarUrl: item.avatarUrl ? api.resolveImageUrl(item.avatarUrl) : "",
        createdAt: item.createdAt || "",
        role: item.role || this.data.role
      });
    } catch (_e) { /* handled globally for auth */ }
  },

  async loadPoints() {
    try {
      if (!this.data.userId) return;
      var res = await api.getPoints(this.data.userId);
      this.setData({
        points: Number(res.item.total || 0),
        pointsLogs: decoratePointLogs(res.item.logs)
      });
    } catch (_e) {
      this.setData({ points: 0, pointsLogs: [] });
    }
  },

  async loadUnreadCount() {
    try {
      if (!this.data.userId) return;
      var res = await api.getNotifications(this.data.userId);
      this.setData({ unread: Number(res.unread || 0) });
    } catch (_e) { /* ignore */ }
  },

  async loadPrivileges() {
    try {
      var res = await api.getPrivileges();
      var item = res.item || {};
      this.setData({
        credit: Number(item.credit === undefined ? 100 : item.credit),
        privileges: {
          dailyReportLimit: Number(item.dailyReportLimit || 5),
          highQualityBonus: Number(item.highQualityBonus || 0),
          canExportReports: !!item.canExportReports,
          showExpertBadge: !!item.showExpertBadge
        }
      });
    } catch (_e) { /* ignore */ }
  },

  async loadAchievements() {
    try {
      var res = await api.getAchievements();
      var achievements = (res.items || []).map(function (achievement) {
        var item = Object.assign({}, achievement);
        if (item.badge) {
          var match = item.badge.match(/\/([^/]+\.png)$/);
          if (match) item.badge = "/images/" + match[1];
        }
        return item;
      });
      this.setData({ achievements: achievements });
    } catch (_e) {
      this.setData({ achievements: badgeFallback() });
    }
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" });
  },

  onLogout() {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出当前账号吗？",
      success: (res) => {
        if (!res.confirm) return;
        api.clearToken();
        this.setData({
          loggedIn: false,
          username: "",
          avatarInitial: "",
          userId: "",
          role: "",
          avatarUrl: "",
          points: 0,
          pointsLogs: [],
          unread: 0
        });
        wx.showToast({ title: "已退出", icon: "success" });
      }
    });
  },

  onChangeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: (res) => {
        var tempFile = res.tempFiles && res.tempFiles[0];
        if (!tempFile) return;
        wx.showLoading({ title: "上传中..." });
        api.uploadAvatar(tempFile.tempFilePath)
          .then((uploadRes) => {
            var fullUrl = uploadRes.item ? uploadRes.item.imageUrl : "";
            var avatarUrl = fullUrl;
            var baseUrl = app.globalData.apiBaseUrl || "";
            if (baseUrl && fullUrl.indexOf(baseUrl) === 0) {
              avatarUrl = fullUrl.substring(baseUrl.length);
            }
            return api.updateAvatar(avatarUrl);
          })
          .then(() => this.loadProfile())
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: "头像已更新", icon: "success" });
          })
          .catch((error) => {
            wx.hideLoading();
            wx.showToast({ title: error.message || "上传失败，请重试", icon: "none" });
          });
      }
    });
  },

  goNotifications() { wx.navigateTo({ url: "/pages/notifications/notifications" }); },
  goMyReports() { wx.navigateTo({ url: "/pages/my-reports/my-reports" }); },
  goApprovedReports() { wx.navigateTo({ url: "/pages/approved-reports/approved-reports" }); },
  goShop() { wx.navigateTo({ url: "/pages/shop/shop" }); },
  goOrders() { wx.navigateTo({ url: "/pages/orders/orders" }); },
  goLeaderboard() { wx.navigateTo({ url: "/pages/leaderboard/leaderboard" }); },
  goReview() { wx.navigateTo({ url: "/pages/review/review" }); },

  goExport() {
    api.exportCsv().catch(function (error) {
      wx.showToast({ title: error.message || "导出失败", icon: "none" });
    });
  },

  goMyDetail() {
    var roleText = this.data.role === "admin" ? "管理员" : (this.data.role === "reviewer" ? "审核员" : "普通用户");
    wx.showModal({
      title: "账号与权益",
      content:
        "用户名：" + this.data.username +
        "\n角色：" + roleText +
        "\n信用分：" + this.data.credit +
        "\n每日上报额度：" + this.data.privileges.dailyReportLimit +
        "\n高质量额外奖励：" + this.data.privileges.highQualityBonus +
        "\n注册时间：" + (this.data.createdAt || "未知"),
      showCancel: false,
      confirmText: "知道了"
    });
  }
});
