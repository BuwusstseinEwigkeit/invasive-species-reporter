var api = require("../../utils/api");

Page({
  data: {
    reports: [],
    filteredReports: [],
    searchKeyword: "",
    statusOptions: ["全部", "pending", "approved", "rejected"],
    selectedStatusIndex: 0,
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
      var res = await api.getMyReports();
      this.setData({ reports: res.items || [], loading: false });
      this.applyFilters();
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: "记录加载失败", icon: "none" });
    }
  },

  onSearchInput(event) {
    this.setData({ searchKeyword: event.detail.value || "" });
    this.applyFilters();
  },

  onStatusChange(event) {
    this.setData({ selectedStatusIndex: Number(event.detail.value) });
    this.applyFilters();
  },

  applyFilters() {
    var keyword = this.data.searchKeyword.trim().toLowerCase();
    var selectedStatus = this.data.statusOptions[this.data.selectedStatusIndex];
    var filteredReports = this.data.reports.filter(function (item) {
      var matchesKeyword =
        !keyword ||
        (item.aiTop1 || "").toLowerCase().indexOf(keyword) >= 0 ||
        (item.address || "").toLowerCase().indexOf(keyword) >= 0 ||
        (item.remark || "").toLowerCase().indexOf(keyword) >= 0;
      var matchesStatus = selectedStatus === "全部" || item.status === selectedStatus;
      return matchesKeyword && matchesStatus;
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