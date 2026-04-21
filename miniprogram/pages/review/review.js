const api = require("../../utils/api");

Page({
  data: {
    reports: [],
    speciesOptions: [],
    speciesNames: []
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const [reportsRes, speciesRes] = await Promise.all([
        api.getReports("pending"),
        api.getSpecies()
      ]);

      const speciesNames = speciesRes.items.map((item) => item.chineseName);
      const reports = reportsRes.items.map((item) => {
        const matchedIndex = speciesRes.items.findIndex((species) => species.id === item.speciesId);

        return Object.assign({}, item, {
          reviewSpeciesIndex: matchedIndex >= 0 ? matchedIndex : 0
        });
      });

      this.setData({
        reports,
        speciesOptions: speciesRes.items,
        speciesNames
      });
    } catch (error) {
      wx.showToast({
        title: "审核数据加载失败",
        icon: "none"
      });
    }
  },

  onSpeciesChange(event) {
    const reportIndex = Number(event.currentTarget.dataset.index);
    const speciesIndex = Number(event.detail.value);
    const reports = this.data.reports.slice();

    reports[reportIndex].reviewSpeciesIndex = speciesIndex;

    this.setData({
      reports
    });
  },

  previewImage(event) {
    const { url } = event.currentTarget.dataset;

    if (!url) {
      return;
    }

    wx.previewImage({
      current: url,
      urls: [url]
    });
  },

  async submitReview(event) {
    const reportId = event.currentTarget.dataset.id;
    const action = event.currentTarget.dataset.action;
    const reportIndex = Number(event.currentTarget.dataset.index);
    const report = this.data.reports[reportIndex];
    const selectedSpecies = this.data.speciesOptions[report.reviewSpeciesIndex];

    if (action === "approved" && !selectedSpecies) {
      wx.showToast({
        title: "通过前请先选择物种",
        icon: "none"
      });
      return;
    }

    try {
      await api.reviewReport(reportId, {
        action,
        finalSpeciesId: selectedSpecies ? selectedSpecies.id : null,
        comment: action === "approved" ? "演示审核通过" : "演示审核驳回"
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
