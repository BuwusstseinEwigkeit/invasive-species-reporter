var api = require("../../utils/api");

Page({
  data: {
    products: [],
    categories: [],
    productLocalImages: {},
    points: 0,
    loading: true,
    loadError: "",
    buying: false,
    confirmingProductId: "",
    loggedIn: false,
    shippingModalVisible: false,
    shippingProduct: null,
    shippingForm: { name: "", phone: "", address: "" }
  },

  onShow() {
    this.loadData();
  },

  retryLoad() {
    this.loadData();
  },

  loadProductImages(products, generation) {
    var self = this;
    Promise.all((products || []).map(async function (product) {
      if (!product.imageUrl) return null;
      var localPath = await api.downloadImage(product.imageUrl);
      return localPath ? { id: product.id, path: localPath } : null;
    })).then(function (items) {
      if (self.loadGeneration !== generation) return;
      var localImages = {};
      items.forEach(function (item) {
        if (item) localImages[item.id] = item.path;
      });
      self.setData({ productLocalImages: localImages });
    }).catch(function () { /* image failures keep placeholders */ });
  },

  async loadData() {
    var generation = (this.loadGeneration || 0) + 1;
    this.loadGeneration = generation;
    this.setData({ loading: true, loadError: "" });
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
      var products = (productsRes.items || []).map(function(product) {
        return Object.assign({}, product, {
          placeholderInitial: String(product.name || "?").substring(0, 1)
        });
      });
      var categories = productsRes.categories || [];

      this.setData({
        products: products,
        categories: categories,
        productLocalImages: {},
        points: results.length > 1 ? (results[1].item.total || 0) : 0,
        loading: false,
        loadError: ""
      });
      this.loadProductImages(products, generation);
    } catch (error) {
      this.setData({
        products: [],
        categories: [],
        loading: false,
        loadError: error.message || "商城数据加载失败"
      });
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
    if (this.data.buying) return;
    this.setData({ shippingModalVisible: false, shippingProduct: null });
  },

  onShippingNameInput(e) {
    this.setData({ "shippingForm.name": e.detail.value });
  },

  onShippingPhoneInput(e) {
    this.setData({ "shippingForm.phone": e.detail.value });
  },

  onShippingAddressInput(e) {
    this.setData({ "shippingForm.address": e.detail.value });
  },

  async buyProduct(e) {
    var productId = e.currentTarget.dataset.id;
    if (!productId || this.data.buying || this.data.confirmingProductId) return;

    var token = api.getToken();
    if (!token) {
      wx.navigateTo({ url: "/pages/login/login" });
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
    this.setData({ confirmingProductId: productId });
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
      },
      complete: function () {
        self.setData({ confirmingProductId: "" });
      }
    });
  },

  async submitShippingPurchase() {
    var product = this.data.shippingProduct;
    var form = this.data.shippingForm;
    if (!product || this.data.buying || this.data.confirmingProductId) return;
    if (!form.name || !form.phone || !form.address) {
      wx.showToast({ title: "请填写完整收货信息", icon: "none" });
      return;
    }

    var self = this;
    this.setData({ confirmingProductId: product.id });
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
      },
      complete: function () {
        self.setData({ confirmingProductId: "" });
      }
    });
  },

  onPullDownRefresh() {
    this.loadData().finally(function() {
      wx.stopPullDownRefresh();
    });
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" });
  }
});
