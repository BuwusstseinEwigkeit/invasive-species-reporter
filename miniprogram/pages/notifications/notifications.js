var api = require("../../utils/api");

Page({
  data: {
    notifications: [],
    loading: true,
    unread: 0,
    loadError: ""
  },

  onShow() {
    this.loadNotifications();
  },

  onPullDownRefresh() {
    this.loadNotifications().finally(function () {
      wx.stopPullDownRefresh();
    });
  },

  retryLoad() {
    this.loadNotifications();
  },

  async loadNotifications() {
    this.setData({ loading: true, loadError: "" });
    try {
      var userId = api.getMyUserId();
      if (!userId) {
        this.setData({ notifications: [], loading: false, unread: 0 });
        return;
      }
      var res = await api.getNotifications(userId);
      this.setData({
        notifications: res.items || [],
        unread: Number(res.unread || 0),
        loading: false,
        loadError: ""
      });
    } catch (error) {
      this.setData({
        loading: false,
        loadError: error.message || "通知加载失败"
      });
    }
  },

  async onTapNotif(e) {
    var id = e.currentTarget.dataset.id;
    var referenceId = e.currentTarget.dataset.referenceId;
    if (!id) return;

    var index = this.data.notifications.findIndex(function (item) {
      return item.id === id;
    });
    var notification = index >= 0 ? this.data.notifications[index] : null;

    if (notification && !notification.isRead) {
      try {
        await api.markNotificationRead(id);
        var key = "notifications[" + index + "].isRead";
        this.setData({
          [key]: true,
          unread: Math.max(0, this.data.unread - 1)
        });
      } catch (_error) {
        wx.showToast({ title: "标记已读失败", icon: "none" });
      }
    }

    if (referenceId) {
      wx.navigateTo({
        url: "/pages/report-detail/report-detail?id=" + encodeURIComponent(referenceId)
      });
    }
  }
});
