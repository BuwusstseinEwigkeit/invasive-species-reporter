var api = require("../../utils/api");

Page({
  data: {
    activeTab: "weekly",
    weeklyList: [],
    totalList: [],
    newcomerList: [],
    loading: true,
    myRank: null,
    myRankType: ""
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      var token = api.getToken();
      var promises = [
        api.getLeaderboard("weekly"),
        api.getLeaderboard("total"),
        api.getLeaderboard("newcomer")
      ];
      if (token) {
        promises.push(api.getPrivileges());
      }

      var results = await Promise.all(promises);
      this.setData({
        weeklyList: results[0].items || [],
        totalList: results[1].items || [],
        newcomerList: results[2].items || [],
        loading: false
      });
    } catch (_e) {
      this.setData({ loading: false });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  switchTab(e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  }
});
