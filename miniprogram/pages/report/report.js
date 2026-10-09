const api = require("../../utils/api");

function initialFormState() {
  return {
    localImageUrl: "",
    uploadedImageUrl: "",
    uploadedFileId: "",
    recognitionJobId: "",
    latitude: "",
    longitude: "",
    address: "",
    remark: "",
    aiTop1: "尚未识别",
    aiScore: "",
    aiSummary: "",
    aiCandidates: [],
    selectedSpeciesIndex: 0,
    selectedFilteredIndex: 0,
    isUploading: false,
    isRecognizing: false,
    isSubmitting: false,
    submitSuccess: false,
    searchKeyword: "",
    candidatesCollapsed: false,
    compressQuality: 60,
    stopPolling: false
  };
}

Page({
  data: Object.assign(initialFormState(), {
    speciesOptions: [],
    speciesNames: ["暂不选择"],
    filteredSpeciesNames: ["暂不选择"],
    filteredSpeciesIndexes: [0]
  }),

  onShow() {
    this.setData({ stopPolling: false });
    if (!api.getToken()) {
      wx.showModal({
        title: "请先登录",
        content: "上报外来物种需要登录账号",
        confirmText: "去登录",
        cancelText: "返回",
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: "/pages/login/login" });
          } else {
            wx.switchTab({ url: "/pages/home/home" });
          }
        }
      });
      return;
    }
    if (!this.data.speciesOptions.length) {
      this.loadSpecies();
    }
  },

  onUnload() {
    this.cancelPolling(true);
  },

  cancelPolling(stopAll) {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (stopAll) {
      this.setData({ stopPolling: true });
    }
  },

  toggleCandidates() {
    this.setData({ candidatesCollapsed: !this.data.candidatesCollapsed });
  },

  async loadSpecies() {
    try {
      const res = await api.getSpecies();
      const items = res.items || [];
      this.setData({
        speciesOptions: items,
        speciesNames: ["暂不选择"].concat(items.map((item) => item.chineseName)),
        filteredSpeciesNames: ["暂不选择"].concat(items.map((item) => item.chineseName)),
        filteredSpeciesIndexes: [0].concat(items.map((_item, index) => index + 1))
      });
    } catch (_error) {
      wx.showToast({ title: "物种列表加载失败", icon: "none" });
    }
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      success: async (res) => {
        const generation = (this.imageGeneration || 0) + 1;
        this.imageGeneration = generation;
        this.cancelPolling(false);

        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.tempFilePath) return;
        const compressedPath = await this.compressSelectedImage(file.tempFilePath);
        if (generation !== this.imageGeneration) return;

        this.setData({
          localImageUrl: compressedPath,
          uploadedImageUrl: "",
          uploadedFileId: "",
          recognitionJobId: "",
          aiTop1: "上传后开始识别",
          aiScore: "",
          aiSummary: "",
          aiCandidates: [],
          selectedSpeciesIndex: 0,
          selectedFilteredIndex: 0,
          candidatesCollapsed: false
        });

        await this.uploadAndRecognize(compressedPath, generation);
      }
    });
  },

  compressSelectedImage(filePath) {
    return new Promise((resolve) => {
      wx.compressImage({
        src: filePath,
        quality: this.data.compressQuality,
        success: (res) => resolve(res.tempFilePath),
        fail: () => resolve(filePath)
      });
    });
  },

  async uploadAndRecognize(filePath, generation) {
    this.setData({ isUploading: true, isRecognizing: false });
    wx.showLoading({ title: "上传图片中", mask: true });

    try {
      const uploadRes = await api.uploadImage(filePath);
      if (generation !== this.imageGeneration) return;
      const uploadItem = uploadRes.item;

      this.setData({
        isUploading: false,
        isRecognizing: true,
        uploadedImageUrl: uploadItem.imageUrl,
        uploadedFileId: uploadItem.fileId,
        aiTop1: "识别排队中",
        aiSummary: "图片已安全上传，后台正在识别。识别未完成时也可提交人工审核。"
      });
      wx.hideLoading();

      const startRes = await api.startRecognition(uploadItem.fileId);
      if (generation !== this.imageGeneration) return;
      const jobId = startRes.item.jobId;
      this.setData({ recognitionJobId: jobId });
      this.pollRecognition(jobId, 0);
    } catch (error) {
      if (generation !== this.imageGeneration) return;
      this.setData({
        isUploading: false,
        isRecognizing: false,
        aiTop1: "上传或识别失败",
        aiScore: "",
        aiSummary: error.message || "请稍后重试",
        aiCandidates: []
      });
      wx.hideLoading();
      wx.showToast({ title: "上传或识别失败", icon: "none" });
    }
  },

  schedulePoll(jobId, attempt, delay) {
    if (this.data.stopPolling || jobId !== this.data.recognitionJobId) return;
    this.pollTimer = setTimeout(() => {
      this.pollRecognition(jobId, attempt + 1);
    }, delay);
  },

  async pollRecognition(jobId, attempt) {
    if (this.data.stopPolling || jobId !== this.data.recognitionJobId) return;

    if (attempt > 40) {
      this.setData({
        isRecognizing: false,
        aiTop1: "识别耗时较长",
        aiSummary: "后台识别仍未完成，可直接提交人工审核。"
      });
      return;
    }

    try {
      const res = await api.getRecognition(jobId);
      if (this.data.stopPolling || jobId !== this.data.recognitionJobId) return;
      const job = res.item;

      if (job.status === "queued" || job.status === "processing") {
        this.schedulePoll(jobId, attempt, 2000);
        return;
      }

      if (job.status === "failed") {
        this.setData({
          isRecognizing: false,
          aiTop1: "识别失败",
          aiSummary: job.error || "可直接提交人工审核",
          aiScore: "",
          aiCandidates: []
        });
        return;
      }

      const recognition = job.result || {};
      const matchedIndex = this.data.speciesOptions.findIndex(
        (item) => item.id === recognition.matchedSpeciesId
      );
      const mockPrefix = recognition.isMock ? "模拟识别，仅供开发调试。 " : "";

      this.setData({
        isRecognizing: false,
        aiTop1: recognition.matchedSpeciesName || "未能可靠识别",
        aiScore: recognition.confidence ? Number(recognition.confidence).toFixed(2) : "",
        aiSummary: mockPrefix + (recognition.summary || ""),
        aiCandidates: recognition.topCandidates || [],
        selectedSpeciesIndex: matchedIndex >= 0 ? matchedIndex + 1 : 0
      });
      this.syncFilteredSelection(matchedIndex >= 0 ? matchedIndex + 1 : 0);
    } catch (_error) {
      if (this.data.stopPolling || jobId !== this.data.recognitionJobId) return;
      this.setData({
        aiSummary: "网络波动，正在继续查询识别结果…"
      });
      this.schedulePoll(jobId, attempt, Math.min(5000, 2000 + attempt * 100));
    }
  },

  async retryRecognition() {
    if (!this.data.uploadedFileId || this.data.isRecognizing) {
      if (!this.data.uploadedFileId) {
        wx.showToast({ title: "请先上传图片", icon: "none" });
      }
      return;
    }

    this.cancelPolling(false);
    this.setData({
      isRecognizing: true,
      aiTop1: "重新识别中",
      aiSummary: "后台正在重新识别，请稍候。",
      aiScore: "",
      aiCandidates: []
    });

    try {
      const startRes = await api.startRecognition(this.data.uploadedFileId);
      const jobId = startRes.item.jobId;
      this.setData({ recognitionJobId: jobId });
      this.pollRecognition(jobId, 0);
    } catch (error) {
      this.setData({
        isRecognizing: false,
        aiTop1: "重新识别失败",
        aiSummary: error.message || "请稍后再试"
      });
    }
  },

  useCurrentLocation() {
    wx.getLocation({
      type: "gcj02",
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          address: ""
        });
        wx.showToast({ title: "已定位到当前位置", icon: "success" });
      },
      fail: () => {
        wx.showToast({ title: "定位失败，请检查权限", icon: "none" });
      }
    });
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          address: res.address || res.name || ""
        });
      }
    });
  },

  onRemarkInput(event) {
    this.setData({ remark: event.detail.value });
  },

  onSpeciesChange(event) {
    const filteredIndex = Number(event.detail.value);
    const actualIndex = this.data.filteredSpeciesIndexes[filteredIndex] || 0;
    this.setData({
      selectedSpeciesIndex: actualIndex,
      selectedFilteredIndex: filteredIndex
    });
  },

  onSearchInput(event) {
    const rawKeyword = event.detail.value || "";
    const keyword = rawKeyword.trim().toLowerCase();
    const filtered = this.data.speciesOptions
      .map((item, index) => ({ item, actualIndex: index + 1 }))
      .filter(({ item }) => {
        if (!keyword) return true;
        return (
          String(item.chineseName || "").toLowerCase().includes(keyword) ||
          String(item.latinName || "").toLowerCase().includes(keyword) ||
          String(item.category || "").toLowerCase().includes(keyword)
        );
      });

    const filteredIndexes = [0].concat(filtered.map(({ actualIndex }) => actualIndex));
    const selectedFilteredIndex = filteredIndexes.indexOf(this.data.selectedSpeciesIndex);
    this.setData({
      searchKeyword: rawKeyword,
      filteredSpeciesNames: ["暂不选择"].concat(filtered.map(({ item }) => item.chineseName)),
      filteredSpeciesIndexes: filteredIndexes,
      selectedFilteredIndex: selectedFilteredIndex >= 0 ? selectedFilteredIndex : 0
    });
  },

  syncFilteredSelection(actualIndex) {
    const foundIndex = this.data.filteredSpeciesIndexes.findIndex((item) => item === actualIndex);
    if (foundIndex === -1) {
      this.setData({
        filteredSpeciesNames: ["暂不选择"].concat(this.data.speciesOptions.map((item) => item.chineseName)),
        filteredSpeciesIndexes: [0].concat(this.data.speciesOptions.map((_item, index) => index + 1)),
        searchKeyword: "",
        selectedFilteredIndex: actualIndex
      });
      return;
    }
    this.setData({ selectedFilteredIndex: foundIndex });
  },

  async submitReport() {
    if (this.data.isSubmitting) return;
    if (!this.data.uploadedFileId || this.data.latitude === "" || this.data.longitude === "") {
      wx.showToast({ title: "请先完成上传并补全位置", icon: "none" });
      return;
    }

    const selectedSpecies =
      this.data.selectedSpeciesIndex > 0
        ? this.data.speciesOptions[this.data.selectedSpeciesIndex - 1]
        : null;

    this.setData({ isSubmitting: true });
    try {
      await api.createReport({
        fileId: this.data.uploadedFileId,
        recognitionJobId: this.data.recognitionJobId || "",
        latitude: this.data.latitude,
        longitude: this.data.longitude,
        address: this.data.address,
        remark: this.data.remark,
        speciesId: selectedSpecies ? selectedSpecies.id : null
      });

      this.cancelPolling(false);
      wx.showToast({ title: "已提交审核", icon: "success" });
      this.resetForm(true);
    } catch (error) {
      const msg = error.message || "";
      if (msg.includes("上报已达上限")) {
        wx.showModal({
          title: "今日上报已达上限",
          content: msg + "\n可在“我的”页面查看信用分和徽章带来的每日额度。",
          showCancel: false,
          confirmText: "我知道了"
        });
      } else {
        wx.showToast({ title: msg || "提交失败", icon: "none", duration: 2500 });
      }
    } finally {
      if (!this.data.submitSuccess) {
        this.setData({ isSubmitting: false });
      }
    }
  },

  resetForm(keepSuccess) {
    this.imageGeneration = (this.imageGeneration || 0) + 1;
    this.cancelPolling(false);
    this.setData(Object.assign(initialFormState(), {
      submitSuccess: !!keepSuccess,
      speciesOptions: this.data.speciesOptions,
      speciesNames: this.data.speciesNames,
      filteredSpeciesNames: this.data.speciesNames,
      filteredSpeciesIndexes: [0].concat(this.data.speciesOptions.map((_item, index) => index + 1))
    }));
  },

  goHome() {
    this.resetForm(false);
    wx.switchTab({ url: "/pages/home/home" });
  }
});
