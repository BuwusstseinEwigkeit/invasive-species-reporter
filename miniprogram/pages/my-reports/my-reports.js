const api = require("../../utils/api");

Page({
  data: {
    reports: [],
    filteredReports: [],
    searchKeyword: "",
    statusOptions: ["全部", "pending", "approved", "rejected"],
    selectedStatusIndex: 0
  },

  onShow() {
    this.loadReports();
  },

  async loadReports() {
    try {
      const res = await api.getReports();
      this.setData({
        reports: res.items
      });
      this.applyFilters();
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
    this.applyFilters();
  },

  onStatusChange(event) {
    this.setData({
      selectedStatusIndex: Number(event.detail.value)
    });
    this.applyFilters();
  },

  applyFilters() {
    const keyword = this.data.searchKeyword.trim().toLowerCase();
    const selectedStatus = this.data.statusOptions[this.data.selectedStatusIndex];

    const filteredReports = this.data.reports.filter((item) => {
      const matchesKeyword =
        !keyword ||
        item.aiTop1.toLowerCase().includes(keyword) ||
        item.address.toLowerCase().includes(keyword) ||
        (item.remark || "").toLowerCase().includes(keyword);

      const matchesStatus = selectedStatus === "全部" || item.status === selectedStatus;

      return matchesKeyword && matchesStatus;
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
