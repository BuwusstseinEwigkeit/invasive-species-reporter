var api = require("../../utils/api");

Page({
  data: {
    products: [],
    categories: [],
    productLocalImages: {},
    points: 0,
    loading: true,
    buying: false,
    loggedIn: false,
    shippingModalVisible: false,
    shippingProduct: null,
    shippingForm: { name: "", phone: "", address: "" }
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
      var products = productsRes.items || [];
      var categories = productsRes.categories || [];

      // Download product images locally to avoid HTTP image restriction in WeChat
      var localImages = {};
      for (var i = 0; i < products.length; i++) {
        var p = products[i];
        if (p.imageUrl) {
          var localPath = await api.downloadImage(p.imageUrl);
          if (localPath) {
            localImages[p.id] = localPath;
          }
        }
      }

      this.setData({
        products: products,
        categories: categories,
        productLocalImages: localImages,
        points: results.length > 1 ? (results[1].item.total || 0) : 0,
        loading: false
      });
    } catch (_e) {
      this.setData({
        products: [],
        categories: [],
        loading: false
      });
      wx.showToast({ title: "加载失败", icon: "none" });
    }
  },

  showShippingForm(e) {
    var productId = e.currentTarget.dataset.id;
    var product = this.data.products.find(function(p) { return p.id === productId; });
    if (!product) return;
    this.setData({
      shippingModalVisible: true,
      shippingProduct: product,
      shippingForm: { name: "", phone: "", address: "" }
    });
  },

  hideShippingForm() {
    this.setData({ shippingModalVisible: false, shippingProduct: null });
  },

  onShippingNameInput(e) {
    var form = this.data.shippingForm;
    form.name = e.detail.value;
    this.setData({ shippingForm: form });
  },

  onShippingPhoneInput(e) {
    var form = this.data.shippingForm;
    form.phone = e.detail.value;
    this.setData({ shippingForm: form });
  },

  onShippingAddressInput(e) {
    var form = this.data.shippingForm;
    form.address = e.detail.value;
    this.setData({ shippingForm: form });
  },

  async buyProduct(e) {
    var productId = e.currentTarget.dataset.id;
    if (!productId) return;

    var token = api.getToken();
    if (!token) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    var product = this.data.products.find(function(p) { return p.id === productId; });
    if (!product) return;

    // Virtual product → direct purchase
    if (product.isVirtual) {
      this.directPurchase(productId);
      return;
    }

    // Physical product → show shipping form
    this.showShippingForm(e);
  },

  async directPurchase(productId) {
    var self = this;
    var product = this.data.products.find(function(p) { return p.id === productId; });
    if (!product) return;
    wx.showModal({
      title: "确认兑换",
      content: "确定要兑换「" + product.name + "」吗？将消耗 " + product.pointsCost + " 积分。",
      success: async function(res) {
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

  async submitShippingPurchase() {
    var product = this.data.shippingProduct;
    var form = this.data.shippingForm;
    if (!form.name || !form.phone || !form.address) {
      wx.showToast({ title: "请填写完整收货信息", icon: "none" });
      return;
    }

    var self = this;
    wx.showModal({
      title: "确认兑换",
      content: "确定要兑换「" + product.name + "」吗？将消耗 " + product.pointsCost + " 积分。收货地址： " + form.address,
      success: async function(res) {
        if (!res.confirm) return;
        self.setData({ buying: true });
        try {
          var result = await api.purchaseProduct(product.id, form);
          wx.showToast({ title: "兑换成功", icon: "success" });
          self.setData({
            points: result.item.newTotal || 0,
            buying: false,
            shippingModalVisible: false,
            shippingProduct: null
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
