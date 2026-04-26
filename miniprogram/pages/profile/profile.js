var api = require("../../utils/api");
var app = getApp();

Page({
  data: {
    loggedIn: false,
    username: "",
    role: "",
    userId: "",
    points: 0,
    pointsLogs: [],
    loading: true,
    logsCollapsed: false,
    unread: 0,
    achievements: [],
    achievementStats: { totalReports: 0, approvedReports: 0 }
  },

  toggleLogs() {
    this.setData({ logsCollapsed: !this.data.logsCollapsed });
  },

  onPullDownRefresh() {
    this.checkLogin();
    wx.stopPullDownRefresh();
  },

  onShow() {
    this.checkLogin();
  },

  checkLogin() {
    var token = api.getToken();
    if (token) {
      var username = api.getMyUsername();
      var userId = api.getMyUserId();
      var role = api.getMyRole();
      // Fallback: use globally cached role from login response
      if (!role && app.globalData && app.globalData.role) {
        role = app.globalData.role;
      }
      this.setData({
        loggedIn: true,
        username: username,
        userId: userId,
        role: role,
        loading: true
      });
      this.loadPoints();
      this.loadUnreadCount();
      this.loadAchievements();
    } else {
      this.setData({
        loggedIn: false,
        loading: false
      });
    }
  },

  async loadPoints() {
    try {
      var userId = this.data.userId;
      if (!userId) return;
      var res = await api.getPoints(userId);
      this.setData({
        points: res.item.total || 0,
        pointsLogs: (res.item.logs || []).slice(0, 10),
        loading: false
      });
    } catch (_e) {
      this.setData({
        points: 0,
        pointsLogs: [],
        loading: false
      });
    }
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" });
  },

  onLogout() {
    var self = this;
    wx.showModal({
      title: "退出登录",
      content: "确定要退出当前账号吗？",
      success(res) {
        if (res.confirm) {
          api.clearToken();
          self.setData({
            loggedIn: false,
            username: "",
            userId: "",
            role: "",
            points: 0,
            pointsLogs: []
          });
          wx.showToast({ title: "已退出", icon: "success" });
        }
      }
    });
  },

  async loadUnreadCount() {
    try {
      var userId = this.data.userId;
      if (!userId) return;
      var res = await api.getNotifications(userId);
      this.setData({ unread: res.unread || 0 });
    } catch (_e) { /* ignore */ }
  },

  async loadAchievements() {
    try {
      var res = await api.getAchievements();
      var achievements = res.items || [];
      // Transform badge paths to LOCAL images (bundled with miniprogram)
      achievements.forEach(function(a) {
        if (a.badge) {
          // Extract badge filename from server path like "/static/images/badge-newbie.png"
          var match = a.badge.match(/\/([^/]+\.png)$/);
          if (match) {
            a.badge = "/images/" + match[1];
          }
        }
      });
      // Calculate stats for progress display
      var totalReports = 0;
      var approvedReports = 0;
      achievements.forEach(function(a) {
        if (a.progress) {
          totalReports = a.progress.current || 0;
        }
      });
      // Get approved count from the last achievement if available
      var lastAchievement = achievements[achievements.length - 1];
      if (lastAchievement && lastAchievement.progress) {
        approvedReports = Math.floor(lastAchievement.progress.current / 2);
      }
      this.setData({
        achievements: achievements,
        achievementStats: { totalReports: totalReports, approvedReports: approvedReports }
      });
    } catch (_e) {
      // Use local fallback images if API fails
      this.setData({
        achievements: [
          { key: "first_report", name: "新手识别员", description: "提交第一份外来物种上报", badge: "/images/badge-newbie.png", earned: false, progress: { current: 0, target: 1 } },
          { key: "eco_guard", name: "生态卫士", description: "累计提交5份上报", badge: "/images/badge-ecoguard.png", earned: false, progress: { current: 0, target: 5 } },
          { key: "contributor", name: "社区贡献者", description: "累计10份上报或5份审核通过", badge: "/images/badge-contributor.png", earned: false, progress: { current: 0, target: 10 } },
          { key: "expert", name: "火眼金睛", description: "累计20份上报或10份审核通过", badge: "/images/badge-expert.png", earned: false, progress: { current: 0, target: 20 } },
          { key: "honorary_medal", name: "物种专家", description: "累计50份上报或获得所有其他成就", badge: "/images/badge-species.png", earned: false, progress: { current: 0, target: 50 } }
        ]
      });
    }
  },

  goNotifications() {
    wx.navigateTo({ url: "/pages/notifications/notifications" });
  },

  goMyReports() {
    wx.navigateTo({ url: "/pages/my-reports/my-reports" });
  },

  goApprovedReports() {
    wx.navigateTo({ url: "/pages/approved-reports/approved-reports" });
  },

  goShop() {
    wx.navigateTo({ url: "/pages/shop/shop" });
  },

  goReview() {
    wx.navigateTo({ url: "/pages/review/review" });
  },

  goMyDetail() {
    wx.showToast({ title: "功能开发中", icon: "none" });
  },

  onExportData() {
    var self = this;
    wx.showModal({
      title: "数据导出",
      content: "将导出所有审核通过的上报记录为 CSV 文件，是否继续？",
      success(res) {
        if (res.confirm) {
          wx.showLoading({ title: "导出中..." });
          api.exportCsv().then(function (path) {
            wx.hideLoading();
            wx.showToast({ title: "导出成功", icon: "success" });
            // Show the file path so user knows where it is
            if (path) {
              wx.showModal({
                title: "文件已保存",
                content: "文件路径：" + path + "\n\n您可以在微信文件管理中找到该文件。",
                showCancel: false
              });
            }
          }).catch(function (err) {
            wx.hideLoading();
            wx.showToast({ title: "导出失败，请重试", icon: "none" });
          });
        }
      }
    });
  }
});
