var api = require("../../utils/api");

Page({
  data: {
    item: null,
    reports: [],
    coverImage: "",
    accordion: {
      summary: true,
      harm: false,
      suggestion: false
    }
  },

  toggleAccordion(e) {
    var key = e.currentTarget.dataset.key;
    if (!key) return;
    var accordion = {};
    // Close all, then open only the tapped one (accordion: only one open at a time)
    for (var k in this.data.accordion) {
      accordion[k] = false;
    }
    accordion[key] = !this.data.accordion[key];
    this.setData({ accordion: accordion });
  },

  onLoad(options) {
    var id = options.id;
    if (id && id !== "null" && id !== "undefined") {
      this.loadDetail(id);
    }
  },

  async loadDetail(id) {
    if (!id || id === "null" || id === "undefined") {
      wx.showToast({ title: "无效的物种ID", icon: "none" });
      return;
    }
    try {
      var res = await api.getSpeciesDetail(id);
      var species = res.item;

      // Set data immediately so the page renders, then try cover image async
      this.setData({
        item: species,
        reports: res.reports || [],
        coverImage: ""
      });

      // Try to download cover image asynchronously — don't block rendering on 真机调试
      if (species && species.avatar) {
        api.downloadImage(species.avatar).then(function (cover) {
          if (cover) {
            this.setData({ coverImage: cover });
          }
        }.bind(this));
      }
    } catch (error) {
      wx.showToast({
        title: "详情加载失败",
        icon: "none"
      });
    }
  }
});