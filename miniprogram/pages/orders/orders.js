var api = require("../../utils/api");

var STATUS_TEXT = {
  pending: "待处理",
  processing: "处理中",
  shipped: "已发货",
  completed: "已完成",
  cancelled: "已取消"
};

function decorateOrders(items, productMap) {
  return (items || []).map(function (item) {
    var product = productMap[item.productId] || {};
    return Object.assign({}, item, {
      productName: product.name || item.productId,
      statusText: STATUS_TEXT[item.status] || item.status
    });
  });
}

Page({
  data: {
    purchases: [],
    orders: [],
    adminOrders: [],
    isAdmin: false,
    updatingOrderId: "",
    loading: true,
    loadError: ""
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(function () {
      wx.stopPullDownRefresh();
    });
  },

  retryLoad() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true, loadError: "" });
    try {
      var userId = api.getMyUserId();
      if (!userId) {
        wx.navigateTo({ url: "/pages/login/login" });
        this.setData({ loading: false });
        return;
      }

      var isAdmin = api.getMyRole() === "admin";
      var requests = [
        api.getProducts(),
        api.getPurchases(userId),
        api.getOrders(userId)
      ];
      if (isAdmin) requests.push(api.getAdminOrders());

      var results = await Promise.all(requests);
      var products = results[0].items || [];
      var productMap = {};
      products.forEach(function (item) {
        productMap[item.id] = item;
      });

      var purchases = (results[1].items || []).map(function (item) {
        var product = productMap[item.productId] || {};
        return Object.assign({}, item, {
          productName: product.name || item.productId,
          isVirtual: !!product.isVirtual
        });
      });

      this.setData({
        purchases: purchases,
        orders: decorateOrders(results[2].items, productMap),
        adminOrders: isAdmin ? decorateOrders(results[3].items, productMap) : [],
        isAdmin: isAdmin,
        loading: false,
        loadError: ""
      });
    } catch (error) {
      this.setData({
        loading: false,
        loadError: error.message || "兑换记录加载失败"
      });
    }
  },

  changeOrderStatus(e) {
    var orderId = e.currentTarget.dataset.id;
    var status = e.currentTarget.dataset.status;
    if (!orderId || !status || this.data.updatingOrderId) return;

    this.setData({ updatingOrderId: orderId });
    api.updateOrderStatus(orderId, status)
      .then(function () {
        wx.showToast({ title: "订单状态已更新", icon: "success" });
        return this.loadData();
      }.bind(this))
      .catch(function (error) {
        wx.showToast({ title: error.message || "更新失败", icon: "none" });
      })
      .finally(function () {
        this.setData({ updatingOrderId: "" });
      }.bind(this));
  }
});
