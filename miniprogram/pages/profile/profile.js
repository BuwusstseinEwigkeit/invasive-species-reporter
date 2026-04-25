var api = require("../../utils/api");

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
    unread: 0
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
      this.setData({
        loggedIn: true,
        username: username,
        userId: userId,
        role: role,
        loading: true
      });
      this.loadPoints();
      this.loadUnreadCount();
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
