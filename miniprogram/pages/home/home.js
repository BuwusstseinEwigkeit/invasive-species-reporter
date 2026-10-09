var api = require("../../utils/api");
var app = getApp();

Page({
  data: {
    stats: null,
    species: [],
    filteredSpecies: [],
    activeCategory: "全部",
    version: app.globalData.appVersion,
    loggedIn: false,
    username: "",
    statsCollapsed: false,
    speciesCollapsed: false,
    loading: true,
    loadError: ""
  },

  toggleStats() {
    this.setData({ statsCollapsed: !this.data.statsCollapsed });
  },

  toggleSpecies() {
    this.setData({ speciesCollapsed: !this.data.speciesCollapsed });
  },

  setCategory(e) {
    var cat = e.currentTarget.dataset.cat;
    this.setData({ activeCategory: cat });
    this.applyFilter(cat);
  },

  applyFilter(category) {
    if (category === "全部") {
      this.setData({ filteredSpecies: this.data.species });
    } else {
      var filtered = this.data.species.filter(function (s) {
        return s.category === category;
      });
      this.setData({ filteredSpecies: filtered });
    }
  },

  onShow() {
    this.checkLogin();
    this.loadData();
  },

  retryLoad() {
    this.loadData();
  },

  checkLogin() {
    var token = api.getToken();
    this.setData({
      loggedIn: !!token,
      username: token ? api.getMyUsername() : ""
    });
  },

  async loadData() {
    var firstLoad = !this.data.species.length && !this.data.stats;
    this.setData({ loading: firstLoad, loadError: "" });
    try {
      var results = await Promise.all([api.getStats(), api.getSpecies()]);
      var statsRes = results[0];
      var speciesRes = results[1];

      // Pre-resolve all avatar URLs to absolute URLs before rendering
      var baseUrl = app.globalData.apiBaseUrl || "";
      var resolvedItems = (speciesRes.items || []).map(function (s) {
        var avatar = s.avatar || "";
        if (avatar && !avatar.startsWith("http")) {
          avatar = avatar.startsWith("/") ? baseUrl + avatar : baseUrl + "/" + avatar;
        }
        return Object.assign({}, s, { avatar: avatar });
      });

      // Apply current category filter
      var filtered = this.data.activeCategory === "全部"
        ? resolvedItems
        : resolvedItems.filter(function (s) { return s.category === this.data.activeCategory; }.bind(this));

      this.setData({
        stats: statsRes.item,
        species: resolvedItems,
        filteredSpecies: filtered,
        loading: false,
        loadError: ""
      });

      // Download thumbnails concurrently (max 3 at a time)
      var self = this;
      var concurrency = 3;
      var index = 0;
      function downloadNext() {
        if (index >= resolvedItems.length) return;
        var i = index++;
        var s = resolvedItems[i];
        if (s.avatar && s.avatar.startsWith("http")) {
          api.downloadImage(s.avatar).then(function (localPath) {
            if (localPath) {
              var patch = {};
              patch["species[" + i + "].avatar"] = localPath;
              var visibleIndex = self.data.filteredSpecies.findIndex(function (item) {
                return item.id === s.id;
              });
              if (visibleIndex >= 0) {
                patch["filteredSpecies[" + visibleIndex + "].avatar"] = localPath;
              }
              self.setData(patch);
            }
            downloadNext();
          }).catch(function () {
            downloadNext();
          });
        } else {
          downloadNext();
        }
      }
      for (var c = 0; c < concurrency; c++) {
        downloadNext();
      }
    } catch (error) {
      this.setData({
        loading: false,
        loadError: error.message || "首页数据加载失败"
      });
    }
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" });
  },

  onLogout() {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出当前账号吗？",
      success: function (res) {
        if (res.confirm) {
          api.clearToken();
          wx.showToast({ title: "已退出", icon: "success" });
          this.setData({ loggedIn: false, username: "" });
        }
      }.bind(this)
    });
  },

  goReport() {
    wx.switchTab({ url: "/pages/report/report" });
  },

  goMap() {
    wx.switchTab({ url: "/pages/map/map" });
  },

  goReview() {
    wx.navigateTo({ url: "/pages/review/review" });
  },

  goMyReports() {
    wx.navigateTo({ url: "/pages/my-reports/my-reports" });
  },

  goApprovedReports() {
    wx.navigateTo({ url: "/pages/approved-reports/approved-reports" });
  },

  openDetail(event) {
    var id = event.currentTarget.dataset.id;
    if (!id || id === "null" || id === "undefined") return;
    wx.navigateTo({ url: "/pages/detail/detail?id=" + id });
  },

  onPullDownRefresh() {
    this.loadData().finally(function () {
      wx.stopPullDownRefresh();
    });
  }
});
