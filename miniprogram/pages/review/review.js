var api = require("../../utils/api");

Page({
  data: {
    reports: [],
    speciesOptions: [],
    speciesNames: [],
    collapsedCandidates: [],
    loading: true
  },

  toggleCandidates(e) {
    var index = Number(e.currentTarget.dataset.index);
    var arr = this.data.collapsedCandidates.slice();
    if (arr.indexOf(index) >= 0) {
      arr.splice(arr.indexOf(index), 1);
    } else {
      arr.push(index);
    }
    this.setData({ collapsedCandidates: arr });
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      var results = await Promise.all([
        api.getReports("pending"),
        api.getSpecies()
      ]);
      var reportsRes = results[0];
      var speciesRes = results[1];

      var speciesNames = (speciesRes.items || []).map(function (item) { return item.chineseName; });

      // Build report list with index mapping, keep original URLs for immediate rendering
      var reports = (reportsRes.items || []).map(function (item) {
        var matchedIndex = speciesRes.items.findIndex(function (s) { return s.id === item.speciesId; });
        return Object.assign({}, item, {
          reviewSpeciesIndex: matchedIndex >= 0 ? matchedIndex : 0
        });
      });

      this.setData({
        reports: reports,
        speciesOptions: speciesRes.items,
        speciesNames: speciesNames,
        loading: false
      });

      // Download images in background for 真机调试 (non-blocking)
      reports.forEach(function (r, i) {
        api.downloadImage(r.imageUrl).then(function (localPath) {
          if (localPath) {
            var updated = "reports[" + i + "].imageUrl";
            this.setData({ [updated]: localPath });
          }
        }.bind(this));
      }.bind(this));
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({
        title: "审核数据加载失败",
        icon: "none"
      });
    }
  },

  onSpeciesChange(event) {
    var reportIndex = Number(event.currentTarget.dataset.index);
    var speciesIndex = Number(event.detail.value);
    var reports = this.data.reports.slice();
    reports[reportIndex].reviewSpeciesIndex = speciesIndex;
    this.setData({ reports: reports });
  },

  previewImage(event) {
    var url = event.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({
      current: url,
      urls: [url]
    });
  },

  confirmReject(event) {
    this.setData({
      showRejectModal: true,
      rejectReportId: event.currentTarget.dataset.id,
      rejectReportIndex: Number(event.currentTarget.dataset.index),
      rejectReason: ""
    });
  },

  closeRejectModal() {
    this.setData({
      showRejectModal: false,
      rejectReason: ""
    });
  },

  onRejectInput(event) {
    this.setData({ rejectReason: event.detail.value });
  },

  async submitReview(event) {
    var reportId = event.currentTarget.dataset.id;
    var action = event.currentTarget.dataset.action;
    var reportIndex = Number(event.currentTarget.dataset.index);
    var report = this.data.reports[reportIndex];
    var selectedSpecies = this.data.speciesOptions[report.reviewSpeciesIndex];

    if (action === "approved" && !selectedSpecies) {
      wx.showToast({
        title: "通过前请先选择物种",
        icon: "none"
      });
      return;
    }

    var comment = action === "approved" ? "审核通过" : (this.data.rejectReason || "审核驳回");

    try {
      await api.reviewReport(reportId, {
        action: action,
        finalSpeciesId: selectedSpecies ? selectedSpecies.id : null,
        comment: comment
      });

      this.setData({
        showRejectModal: false,
        rejectReason: ""
      });

      wx.showToast({
        title: action === "approved" ? "已通过" : "已驳回",
        icon: "success"
      });
      this.loadData();
    } catch (error) {
      wx.showToast({
        title: "审核失败",
        icon: "none"
      });
    }
  }
});