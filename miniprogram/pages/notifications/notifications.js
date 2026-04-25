var api = require("../../utils/api");

Page({
  data: {
    notifications: [],
    loading: true
  },

  onShow() {
    this.loadNotifications();
  },

  onPullDownRefresh() {
    this.loadNotifications().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  async loadNotifications() {
    this.setData({ loading: true });
    try {
      var userId = api.getMyUserId();
      if (!userId) {
        this.setData({ notifications: [], loading: false });
        return;
      }
      var res = await api.getNotifications(userId);
      this.setData({ notifications: res.items || [], loading: false });
      // Auto-mark all as read
      if (res.unread > 0) {
        api.markAllNotificationsRead(userId);
      }
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  onTapNotif(e) {
    // Navigate to related report or just mark read
    var id = e.currentTarget.dataset.id;
    if (id) {
      api.markNotificationRead(id);
    }
  }
});
