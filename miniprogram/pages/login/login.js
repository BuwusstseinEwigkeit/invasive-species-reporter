var api = require("../../utils/api");

Page({
  data: {
    username: "",
    password: "",
    error: "",
    submitting: false,
    showPassword: true
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  async onLogin() {
    var username = this.data.username.trim();
    var password = this.data.password.trim();

    if (!username || !password) {
      this.setData({ error: "请填写用户名和密码" });
      return;
    }

    this.setData({ submitting: true, error: "" });

    try {
      await api.login(username, password);
      wx.showToast({ title: "登录成功", icon: "success" });
      wx.navigateBack();
    } catch (err) {
      this.setData({
        error: "登录失败：" + (err.message || "用户名或密码错误"),
        submitting: false
      });
    }
  },

  async onRegister() {
    var username = this.data.username.trim();
    var password = this.data.password.trim();

    if (!username || !password) {
      this.setData({ error: "请填写用户名和密码" });
      return;
    }

    if (username.length < 3) {
      this.setData({ error: "用户名至少3位" });
      return;
    }

    if (password.length < 4) {
      this.setData({ error: "密码至少4位" });
      return;
    }

    this.setData({ submitting: true, error: "" });

    try {
      // Register endpoint returns token directly, same shape as login
      await api.register(username, password);
      wx.showToast({ title: "注册成功", icon: "success" });
      wx.navigateBack();
    } catch (err) {
      this.setData({
        error: "注册失败：" + (err.message || "请稍后重试"),
        submitting: false
      });
    }
  },

  async onWxLogin() {
    this.setData({ submitting: true, error: "" });

    try {
      const result = await new Promise(function (resolve, reject) {
        wx.login({
          success: function (res) {
            if (res.code) {
              resolve(res.code);
            } else {
              reject(new Error("获取微信登录码失败"));
            }
          },
          fail: function () {
            reject(new Error("调用 wx.login 失败"));
          }
        });
      });

      await api.wxLogin(result);
      wx.showToast({ title: "微信登录成功", icon: "success" });
      wx.navigateBack();
    } catch (err) {
      this.setData({
        error: "微信登录失败：" + (err.message || "请稍后重试"),
        submitting: false
      });
    }
  }
});
