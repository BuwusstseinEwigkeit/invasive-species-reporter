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
    speciesCollapsed: false
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

  checkLogin() {
    var token = api.getToken();
    var username = "";
    if (token) {
      try {
        var parts = token.split(".");
        if (parts.length === 3) {
          var payload = JSON.parse(decodeURIComponent(parts[1].replace(/-/g, "+").replace(/_/g, "/").split("").map(function (c) { return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2); }).join("")));
          username = payload.username || "";
        }
      } catch (_e) { /* ignore */ }
    }
    this.setData({
      loggedIn: !!token,
      username: username
    });
  },

  async loadData() {
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
        filteredSpecies: filtered
      });

      // Download thumbnails in background
      var self = this;
      function downloadNext(i) {
        if (i >= resolvedItems.length) return;
        var s = resolvedItems[i];
        if (s.avatar && s.avatar.startsWith("http")) {
          api.downloadImage(s.avatar).then(function (localPath) {
            if (localPath) {
              self.setData({ ["species[" + i + "].avatar"]: localPath });
            }
            downloadNext(i + 1);
          }).catch(function () {
            downloadNext(i + 1);
          });
        } else {
          downloadNext(i + 1);
        }
      }
      downloadNext(0);
    } catch (error) {
      wx.showToast({
        title: "请确认后端服务已启动",
        icon: "none"
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
    this.loadData();
    wx.stopPullDownRefresh();
  }
});
