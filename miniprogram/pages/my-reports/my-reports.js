var api = require("../../utils/api");

Page({
  data: {
    reports: [],
    filteredReports: [],
    searchKeyword: "",
    statusOptions: ["全部", "待审核", "已通过", "已驳回", "已标记无效"],
    statusValues: ["", "pending", "approved", "rejected", "spam"],
    selectedStatusIndex: 0,
    loading: true,
    loadingMore: false,
    loadError: "",
    page: 1,
    totalPages: 1
  },

  onShow() {
    if (!api.getToken()) {
      wx.navigateTo({ url: "/pages/login/login" });
      return;
    }
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
      var status = this.data.statusValues[this.data.selectedStatusIndex] || "";
      var pageToLoad = reset ? 1 : this.data.page + 1;
      var res = await api.getMyReports(status, pageToLoad, 20);
      var reports = reset ? (res.items || []) : this.data.reports.concat(res.items || []);
      this.setData({
        reports: reports,
        page: Number(res.page || pageToLoad),
        totalPages: Number(res.totalPages || 1),
        loading: false,
        loadingMore: false,
        loadError: ""
      });
      this.applyFilters();
    } catch (error) {
      var message = error.message || "记录加载失败";
      this.setData({ loading: false, loadingMore: false, loadError: reset ? message : this.data.loadError });
      if (!reset) wx.showToast({ title: message, icon: "none" });
    }
  },

  onSearchInput(event) {
    this.setData({ searchKeyword: event.detail.value || "" });
    this.applyFilters();
  },

  onStatusChange(event) {
    this.setData({ selectedStatusIndex: Number(event.detail.value) });
    this.loadReports(true);
  },

  applyFilters() {
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
