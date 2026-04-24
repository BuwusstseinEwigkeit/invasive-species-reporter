var api = require("../../utils/api");

Page({
  data: {
    products: [],
    points: 0,
    loading: true,
    buying: false,
    loggedIn: false
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      var token = api.getToken();
      var userId = token ? api.getMyUserId() : "";

      this.setData({ loggedIn: !!token });

      var promises = [api.getProducts()];
      if (userId) {
        promises.push(api.getPoints(userId));
      }

      var results = await Promise.all(promises);
      var productsRes = results[0];

      this.setData({
        products: productsRes.items || [],
        points: results.length > 1 ? (results[1].item.total || 0) : 0,
        loading: false
      });
    } catch (_e) {
      this.setData({
        products: [],
        loading: false
      });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  async buyProduct(e) {
    var productId = e.currentTarget.dataset.id;
    if (!productId) return;

    var token = api.getToken();
    if (!token) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    var product = this.data.products.find(function (p) { return p.id === productId; });
    if (!product) return;

    var self = this;
    wx.showModal({
      title: "确认兑换",
      content: "确定要兑换「" + product.name + "」吗？将消耗 " + product.pointsCost + " 积分。",
      success: async function (res) {
        if (!res.confirm) return;
        self.setData({ buying: true });
        try {
          var result = await api.purchaseProduct(productId);
          wx.showToast({ title: "兑换成功", icon: "success" });
          self.setData({
            points: result.item.newTotal || 0,
            buying: false
          });
          self.loadData();
        } catch (error) {
          self.setData({ buying: false });
          wx.showToast({ title: error.message || "兑换失败", icon: "none" });
        }
      }
    });
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" });
  }
});
