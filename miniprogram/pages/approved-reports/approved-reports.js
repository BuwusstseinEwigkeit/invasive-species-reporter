var api = require("../../utils/api");

Page({
  data: {
    reports: [],
    filteredReports: [],
    searchKeyword: "",
    loading: true
  },

  onShow() {
    this.loadReports();
  },

  onPullDownRefresh() {
    this.loadReports().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  async loadReports() {
    this.setData({ loading: true });
    try {
      var res = await api.getReports("approved");
      this.setData({ reports: res.items || [], loading: false });
      this.applyFilter();
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: "记录加载失败", icon: "none" });
    }
  },

  onSearchInput(event) {
    this.setData({ searchKeyword: event.detail.value || "" });
    this.applyFilter();
  },

  applyFilter() {
    var keyword = this.data.searchKeyword.trim().toLowerCase();
    var filteredReports = this.data.reports.filter(function (item) {
      return (
        !keyword ||
        (item.aiTop1 || "").toLowerCase().indexOf(keyword) >= 0 ||
        (item.address || "").toLowerCase().indexOf(keyword) >= 0 ||
        (item.remark || "").toLowerCase().indexOf(keyword) >= 0
      );
    });
    this.setData({ filteredReports: filteredReports });
  },

  openDetail(e) {
    var id = e.currentTarget.dataset.id;
    if (!id || id === "null" || id === "undefined") return;
    wx.navigateTo({
      url: "/pages/detail/detail?id=" + id
    });
  }
});