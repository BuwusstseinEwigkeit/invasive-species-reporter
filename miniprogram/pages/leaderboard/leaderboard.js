var api = require("../../utils/api");

Page({
  data: {
    activeTab: "weekly",
    weeklyList: [],
    totalList: [],
    newcomerList: [],
    loading: true,
    loadError: "",
    activeListEmpty: true,
    myRank: null,
    myScore: 0
  },

  onShow() {
    this.loadData();
  },

  retryLoad() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true, loadError: "" });
    try {
      var results = await Promise.all([
        api.getLeaderboard("weekly"),
        api.getLeaderboard("total"),
        api.getLeaderboard("newcomer")
      ]);
      var myUserId = api.getMyUserId();
      var decorate = function (items) {
        return (items || []).map(function (item) {
          return Object.assign({}, item, {
            isMe: !!myUserId && item.userId === myUserId,
            score: Number(item.score !== undefined ? item.score : item.count || 0)
          });
        });
      };
      this.setData({
        weeklyList: decorate(results[0].items),
        totalList: decorate(results[1].items),
        newcomerList: decorate(results[2].items),
        loading: false,
        loadError: ""
      });
      this.updateMyRank();
    } catch (error) {
      this.setData({
        loading: false,
        loadError: error.message || "排行榜加载失败",
        activeListEmpty: true
      });
    }
  },

  currentList() {
    if (this.data.activeTab === "total") return this.data.totalList;
    if (this.data.activeTab === "newcomer") return this.data.newcomerList;
    return this.data.weeklyList;
  },

  updateMyRank() {
    var list = this.currentList();
    var me = list.find(function (item) {
      return item.isMe;
    });
    this.setData({
      myRank: me ? me.rank : null,
      myScore: me ? me.score : 0,
      activeListEmpty: list.length === 0
    });
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
    this.updateMyRank();
  },

  onPullDownRefresh() {
    this.loadData().finally(function () {
      wx.stopPullDownRefresh();
    });
  }
});
