var api = require("../../utils/api");

Page({
  data: {
    reports: [],
    speciesOptions: [],
    speciesNames: ["请选择最终物种"],
    reviewingId: "",
    rejectSubmitting: false,
    loading: true,
    loadingMore: false,
    loadError: "",
    page: 1,
    totalPages: 1,
    total: 0,
    showRejectModal: false,
    rejectReportId: "",
    rejectReportIndex: -1,
    rejectReason: ""
  },

  onShow() {
    var role = api.getMyRole();
    if (role !== "reviewer" && role !== "admin") {
      wx.showModal({
        title: "无审核权限",
        content: "该页面仅供审核员和管理员使用。",
        showCancel: false,
        complete: function () {
          wx.navigateBack({
            fail: function () {
              wx.switchTab({ url: "/pages/profile/profile" });
            }
          });
        }
      });
      return;
    }
    this.loadData(true);
  },

  onPullDownRefresh() {
    this.loadData(true).finally(function () {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (!this.data.loadingMore && this.data.page < this.data.totalPages) {
      this.loadData(false);
    }
  },

  toggleCandidates(e) {
    var index = Number(e.currentTarget.dataset.index);
    var report = this.data.reports[index];
    if (!report) return;
    var key = "reports[" + index + "].candidateCollapsed";
    this.setData({ [key]: !report.candidateCollapsed });
  },

  retryLoad() {
    this.loadData(true);
  },

  async loadData(reset) {
    if (reset) {
      this.setData({ loading: true, page: 1, loadError: "" });
    } else {
      this.setData({ loadingMore: true });
    }

    try {
      var speciesRes;
      if (this.data.speciesOptions.length) {
        speciesRes = { items: this.data.speciesOptions };
      } else {
        speciesRes = await api.getSpecies();
      }

      var pageToLoad = reset ? 1 : this.data.page + 1;
      var reportsRes = await api.getReviewQueue(pageToLoad, 20);
      var speciesItems = speciesRes.items || [];
      var prepared = this.prepareReports(reportsRes.items || [], speciesItems);
      var reports = reset ? prepared : this.data.reports.concat(prepared);

      this.setData({
        reports: reports,
        speciesOptions: speciesItems,
        speciesNames: ["请选择最终物种"].concat(speciesItems.map(function (item) {
          return item.chineseName;
        })),
        page: Number(reportsRes.page || pageToLoad),
        totalPages: Number(reportsRes.totalPages || 1),
        total: Number(reportsRes.total || reports.length),
        loading: false,
        loadingMore: false,
        loadError: ""
      });

      this.cacheReportImages(prepared);
    } catch (error) {
      var message = error.message || "审核数据加载失败";
      this.setData({
        loading: false,
        loadingMore: false,
        loadError: reset ? message : this.data.loadError
      });
      if (!reset) wx.showToast({ title: message, icon: "none" });
    }
  },

  prepareReports(items, speciesItems) {
    return items.map(function (item) {
      var matchedIndex = speciesItems.findIndex(function (s) {
        return s.id === item.speciesId;
      });
      return Object.assign({}, item, {
        reviewSpeciesIndex: matchedIndex >= 0 ? matchedIndex + 1 : 0,
        candidateCollapsed: false,
        imageUrl: api.resolveImageUrl(item.imageUrl || "")
      });
    });
  },

  cacheReportImages(reports) {
    reports.forEach(function (report) {
      if (!report.imageUrl) return;
      api.downloadImage(report.imageUrl).then(function (localPath) {
        if (!localPath) return;
        var index = this.data.reports.findIndex(function (item) {
          return item.id === report.id;
        });
        if (index < 0) return;
        var key = "reports[" + index + "].imageUrl";
        this.setData({ [key]: localPath });
      }.bind(this));
    }.bind(this));
  },

  onSpeciesChange(event) {
    var reportIndex = Number(event.currentTarget.dataset.index);
    var speciesIndex = Number(event.detail.value);
    var key = "reports[" + reportIndex + "].reviewSpeciesIndex";
    this.setData({ [key]: speciesIndex });
  },

  previewImage(event) {
    var url = event.currentTarget.dataset.url;
    if (url) {
      wx.previewImage({ current: url, urls: [url] });
    }
  },

  confirmReject(event) {
    this.setData({
      showRejectModal: true,
      rejectReportId: event.currentTarget.dataset.id,
      rejectReportIndex: Number(event.currentTarget.dataset.index),
      rejectReason: ""
    });
  },

  confirmSpam(event) {
    var reportId = event.currentTarget.dataset.id;
    var reportIndex = Number(event.currentTarget.dataset.index);
    wx.showModal({
      title: "标记为无效上报",
      content: "该操作会扣除用户积分和信用分，仅用于明显垃圾、伪造或恶意上报。",
      confirmText: "确认标记",
      confirmColor: "#b23a2f",
      success: function (res) {
        if (res.confirm) {
          this.performReview(reportId, reportIndex, "spam", "标记为垃圾或无效上报");
        }
      }.bind(this)
    });
  },

  closeRejectModal() {
    if (this.data.rejectSubmitting) return;
    this.setData({
      showRejectModal: false,
      rejectReason: ""
    });
  },

  onRejectInput(event) {
    this.setData({ rejectReason: event.detail.value });
  },

  submitReview(event) {
    var reportId = event.currentTarget.dataset.id;
    var action = event.currentTarget.dataset.action;
    var reportIndex = Number(event.currentTarget.dataset.index);
    var comment = action === "approved" ? "审核通过" : (this.data.rejectReason || "审核驳回");
    this.performReview(reportId, reportIndex, action, comment);
  },

  async performReview(reportId, reportIndex, action, comment) {
    if (this.data.reviewingId) return;

    var report = this.data.reports[reportIndex];
    if (!report || report.id !== reportId) {
      reportIndex = this.data.reports.findIndex(function (item) {
        return item.id === reportId;
      });
      report = this.data.reports[reportIndex];
    }
    if (!report) return;

    var selectedSpecies = report.reviewSpeciesIndex > 0
      ? this.data.speciesOptions[report.reviewSpeciesIndex - 1]
      : null;

    if (action === "approved" && !selectedSpecies) {
      wx.showToast({ title: "通过前请主动选择最终物种", icon: "none" });
      return;
    }

    this.setData({
      reviewingId: reportId,
      rejectSubmitting: action === "rejected"
    });

    try {
      await api.reviewReport(reportId, {
        action: action,
        finalSpeciesId: selectedSpecies ? selectedSpecies.id : null,
        comment: comment
      });

      var remaining = this.data.reports.filter(function (item) {
        return item.id !== reportId;
      });
      this.setData({
        reports: remaining,
        total: Math.max(0, this.data.total - 1),
        showRejectModal: false,
        rejectReason: ""
      });

      var label = action === "approved" ? "已通过" : (action === "spam" ? "已标记无效" : "已驳回");
      wx.showToast({ title: label, icon: "success" });
    } catch (error) {
      if (error.statusCode === 409) {
        this.setData({
          reports: this.data.reports.filter(function (item) {
            return item.id !== reportId;
          })
        });
        wx.showToast({ title: "该记录已被处理", icon: "none" });
      } else {
        wx.showToast({ title: error.message || "审核失败", icon: "none" });
      }
    } finally {
      this.setData({
        reviewingId: "",
        rejectSubmitting: false
      });
    }
  }
});
