var api = require("../../utils/api");

var STATUS_TEXT = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已驳回",
  spam: "已标记无效"
};

var REVIEW_ACTION_TEXT = {
  approved: "审核通过",
  rejected: "审核驳回",
  spam: "标记无效"
};

function confidenceText(value) {
  var score = Number(value);
  if (!Number.isFinite(score) || score <= 0) return "未提供";
  return Math.round(score * 100) + "%";
}

Page({
  data: {
    reportId: "",
    report: null,
    review: [],
    statusText: "",
    loading: true,
    error: ""
  },

  onLoad(options) {
    var id = options && options.id ? decodeURIComponent(options.id) : "";
    this.setData({ reportId: id });
    if (!id) {
      this.setData({ loading: false, error: "缺少上报编号" });
      return;
    }
    this.loadDetail();
  },

  onPullDownRefresh() {
    this.loadDetail().finally(function () {
      wx.stopPullDownRefresh();
    });
  },

  retryLoad() {
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true, error: "" });
    try {
      var res = await api.getReportDetail(this.data.reportId);
      var report = res.item || null;
      if (!report) {
        throw new Error("上报记录不存在");
      }

      report.imageUrl = api.resolveImageUrl(report.imageUrl || "");
      report.aiScoreText = confidenceText(report.aiScore);
      report.aiCandidates = (report.aiCandidates || []).map(function (item) {
        return Object.assign({}, item, {
          confidenceText: confidenceText(item.confidence)
        });
      });
      var review = (res.review || []).map(function (item) {
        return Object.assign({}, item, {
          actionText: REVIEW_ACTION_TEXT[item.action] || item.action || "审核处理"
        });
      });
      this.setData({
        report: report,
        review: review,
        statusText: STATUS_TEXT[report.status] || report.status || "未知状态",
        loading: false
      });

      if (report.imageUrl) {
        api.downloadImage(report.imageUrl).then(function (localPath) {
          if (localPath && this.data.report && this.data.report.id === report.id) {
            this.setData({ "report.imageUrl": localPath });
          }
        }.bind(this));
      }
    } catch (error) {
      this.setData({
        loading: false,
        error: error.message || "详情加载失败",
        report: null,
        review: []
      });
    }
  },

  previewImage() {
    var url = this.data.report && this.data.report.imageUrl;
    if (url) {
      wx.previewImage({ current: url, urls: [url] });
    }
  },

  openSpecies() {
    var speciesId = this.data.report && this.data.report.speciesId;
    if (!speciesId) {
      wx.showToast({ title: "尚未确认最终物种", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: "/pages/detail/detail?id=" + encodeURIComponent(speciesId)
    });
  },

  openLocation() {
    var report = this.data.report;
    if (!report) return;
    var latitude = Number(report.latitude);
    var longitude = Number(report.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    wx.openLocation({
      latitude: latitude,
      longitude: longitude,
      name: report.aiTop1 || "上报位置",
      address: report.address || "",
      scale: 16
    });
  }
});
