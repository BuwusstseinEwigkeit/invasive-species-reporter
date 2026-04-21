const api = require("../../utils/api");

Page({
  data: {
    stats: null,
    species: [],
    version: getApp().globalData.appVersion
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const [statsRes, speciesRes] = await Promise.all([api.getStats(), api.getSpecies()]);

      this.setData({
        stats: statsRes.item,
        species: speciesRes.items
      });
    } catch (error) {
      wx.showToast({
        title: "请确认后端服务已启动",
        icon: "none"
      });
    }
  },

  goReport() {
    wx.navigateTo({
      url: "/pages/report/report"
    });
  },

  goMap() {
    wx.navigateTo({
      url: "/pages/map/map"
    });
  },

  goReview() {
    wx.navigateTo({
      url: "/pages/review/review"
    });
  },

  goMyReports() {
    wx.navigateTo({
      url: "/pages/my-reports/my-reports"
    });
  },

  goApprovedReports() {
    wx.navigateTo({
      url: "/pages/approved-reports/approved-reports"
    });
  },

  openDetail(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  }
});
