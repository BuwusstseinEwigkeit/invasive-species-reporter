const api = require("../../utils/api");

Page({
  data: {
    item: null,
    reports: [],
    coverImage: ""
  },

  onLoad(options) {
    if (options.id) {
      this.loadDetail(options.id);
    }
  },

  async loadDetail(id) {
    try {
      const res = await api.getSpeciesDetail(id);
      const coverReport = (res.reports || []).find((report) => report.imageUrl);

      this.setData({
        item: res.item,
        reports: res.reports,
        coverImage: coverReport ? coverReport.imageUrl : ""
      });
    } catch (error) {
      wx.showToast({
        title: "详情加载失败",
        icon: "none"
      });
    }
  }
});
