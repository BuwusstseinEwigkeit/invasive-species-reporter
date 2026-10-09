var api = require("../../utils/api");

Page({
  data: {
    reports: [],
    filteredReports: [],
    searchKeyword: "",
    loading: true,
    loadingMore: false,
    loadError: "",
    page: 1,
    totalPages: 1
  },

  onShow() {
    this.loadReports(true);
  },

  onPullDownRefresh() {
    this.loadReports(true).finally(function () {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (!this.data.loadingMore && this.data.page < this.data.totalPages) {
      this.loadReports(false);
    }
  },

  retryLoad() {
    this.loadReports(true);
  },

  async loadReports(reset) {
    if (reset) {
      this.setData({ loading: true, page: 1, loadError: "" });
    } else {
      this.setData({ loadingMore: true });
    }
    try {
      var pageToLoad = reset ? 1 : this.data.page + 1;
      var res = await api.getReports("approved", pageToLoad, 20);
      var reports = reset ? (res.items || []) : this.data.reports.concat(res.items || []);
      this.setData({
        reports: reports,
        page: Number(res.page || pageToLoad),
        totalPages: Number(res.totalPages || 1),
        loading: false,
        loadingMore: false,
        loadError: ""
      });
      this.applyFilter();
    } catch (error) {
      var message = error.message || "记录加载失败";
      this.setData({ loading: false, loadingMore: false, loadError: reset ? message : this.data.loadError });
      if (!reset) wx.showToast({ title: message, icon: "none" });
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
    if (!id) return;
    wx.navigateTo({
      url: "/pages/report-detail/report-detail?id=" + encodeURIComponent(id)
    });
  }
});
