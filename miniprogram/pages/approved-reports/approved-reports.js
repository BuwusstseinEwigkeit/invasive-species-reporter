const api = require("../../utils/api");

Page({
  data: {
    reports: [],
    filteredReports: [],
    searchKeyword: ""
  },

  onShow() {
    this.loadReports();
  },

  async loadReports() {
    try {
      const res = await api.getReports("approved");
      this.setData({
        reports: res.items
      });
      this.applyFilter();
    } catch (error) {
      wx.showToast({
        title: "记录加载失败",
        icon: "none"
      });
    }
  },

  onSearchInput(event) {
    this.setData({
      searchKeyword: event.detail.value || ""
    });
    this.applyFilter();
  },

  applyFilter() {
    const keyword = this.data.searchKeyword.trim().toLowerCase();
    const filteredReports = this.data.reports.filter((item) => {
      return (
        !keyword ||
        item.aiTop1.toLowerCase().includes(keyword) ||
        item.address.toLowerCase().includes(keyword) ||
        (item.remark || "").toLowerCase().includes(keyword)
      );
    });

    this.setData({
      filteredReports
    });
  },

  previewImage(event) {
    const { url } = event.currentTarget.dataset;
    if (!url) return;
    wx.previewImage({
      current: url,
      urls: [url]
    });
  }
});
