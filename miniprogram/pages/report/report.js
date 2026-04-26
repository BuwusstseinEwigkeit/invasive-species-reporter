const api = require("../../utils/api");

Page({
  data: {
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
    speciesOptions: [],
    speciesNames: ["暂不选择"],
    selectedSpeciesIndex: 0,
    isUploading: false,
    isRecognizing: false,
    submitSuccess: false,
    searchKeyword: "",
    filteredSpeciesNames: ["暂不选择"],
    filteredSpeciesIndexes: [0],
    candidatesCollapsed: false,
    compressQuality: 60,
    compressLevels: [
      { value: 90, label: "高清 (体积较大)" },
      { value: 60, label: "标准 (推荐)" },
      { value: 30, label: "极限 (最小体积)" }
    ],
    compressLevelIndex: 1,
    stopPolling: false
  },

  toggleCandidates() {
    this.setData({ candidatesCollapsed: !this.data.candidatesCollapsed });
  },

  onShow() {
    this.loadSpecies();
  },

  onUnload() {
    this.setData({ stopPolling: true });
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  },

  async loadSpecies() {
    try {
      const res = await api.getSpecies();
      this.setData({
        speciesOptions: res.items,
        speciesNames: ["暂不选择"].concat(res.items.map((item) => item.chineseName)),
        filteredSpeciesNames: ["暂不选择"].concat(res.items.map((item) => item.chineseName)),
        filteredSpeciesIndexes: [0].concat(res.items.map((_item, index) => index + 1))
      });
    } catch (error) {
      wx.showToast({
        title: "物种列表加载失败",
        icon: "none"
      });
    }
  },

  async chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      success: async (res) => {
        const file = res.tempFiles[0];
        const compressedPath = await this.compressSelectedImage(file.tempFilePath);

        this.setData({
          localImageUrl: compressedPath,
          uploadedImageUrl: "",
          uploadedFileId: "",
          recognitionJobId: "",
          aiTop1: "上传后开始识别",
          aiScore: "",
          aiSummary: "",
          aiCandidates: [],
          selectedSpeciesIndex: 0
        });

        await this.uploadAndRecognize(compressedPath);
      }
    });
  },

  onCompressChange(event) {
    var index = Number(event.detail.value);
    this.setData({
      compressLevelIndex: index,
      compressQuality: this.data.compressLevels[index].value
    });
  },

  compressSelectedImage(filePath) {
    var quality = this.data.compressQuality;
    return new Promise((resolve) => {
      wx.compressImage({
        src: filePath,
        quality: quality,
        success: (res) => resolve(res.tempFilePath),
        fail: () => resolve(filePath)
      });
    });
  },

  async uploadAndRecognize(filePath) {
    this.setData({
      isUploading: true
    });

    wx.showLoading({
      title: "上传图片中",
      mask: true
    });

    try {
      const uploadRes = await api.uploadImage(filePath);
      const uploadItem = uploadRes.item;

      this.setData({
        isUploading: false,
        isRecognizing: true,
        uploadedImageUrl: uploadItem.imageUrl,
        uploadedFileId: uploadItem.fileId,
        aiTop1: "识别排队中",
        aiSummary: "图片已上传，后台正在识别。你也可以直接提交给管理员人工审核。"
      });

      wx.hideLoading();

      const startRes = await api.startRecognition(uploadItem.fileId);
      const jobId = startRes.item.jobId;

      this.setData({
        recognitionJobId: jobId
      });

      this.pollRecognition(jobId, 0);
    } catch (error) {
      this.setData({
        isUploading: false,
        isRecognizing: false,
        aiTop1: "上传或识别失败",
        aiScore: "",
        aiSummary: error.message || "请稍后重试",
        aiCandidates: []
      });

      wx.hideLoading();
      wx.showToast({
        title: "上传或识别失败",
        icon: "none"
      });
    }
  },

  async pollRecognition(jobId, attempt) {
    if (this.data.stopPolling) return;

    if (attempt > 40) {
      this.setData({
        isRecognizing: false,
        aiTop1: "识别耗时较长",
        aiSummary: "后台识别仍未完成。建议直接提交给管理员人工审核。"
      });
      return;
    }

    try {
      const res = await api.getRecognition(jobId);
      const job = res.item;

      if (job.status === "queued" || job.status === "processing") {
        if (this.data.stopPolling) return;
        this.pollTimer = setTimeout(() => {
          this.pollRecognition(jobId, attempt + 1);
        }, 2000);
        return;
      }

      if (job.status === "failed") {
        this.setData({
          isRecognizing: false,
          aiTop1: "识别失败",
          aiSummary: job.error || "请直接提交人工审核",
          aiScore: "",
          aiCandidates: []
        });
        return;
      }

      const recognition = job.result || {};
      const matchedIndex = this.data.speciesOptions.findIndex(
        (item) => item.id === recognition.matchedSpeciesId
      );

      this.setData({
        isRecognizing: false,
        aiTop1: recognition.matchedSpeciesName || "未能可靠识别",
        aiScore: recognition.confidence ? recognition.confidence.toFixed(2) : "",
        aiSummary: recognition.summary || "",
        aiCandidates: recognition.topCandidates || [],
        selectedSpeciesIndex: matchedIndex >= 0 ? matchedIndex + 1 : 0
      });
      this.syncFilteredSelection(matchedIndex >= 0 ? matchedIndex + 1 : 0);
    } catch (error) {
      this.setData({
        isRecognizing: false,
        aiTop1: "识别状态查询失败",
        aiSummary: "图片已上传，但状态查询失败。你可以直接提交人工审核。"
      });
    }
  },

  async retryRecognition() {
    if (!this.data.uploadedFileId) {
      wx.showToast({
        title: "请先上传图片",
        icon: "none"
      });
      return;
    }

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

      this.setData({
        recognitionJobId: jobId
      });

      this.pollRecognition(jobId, 0);
    } catch (error) {
      this.setData({
        isRecognizing: false,
        aiTop1: "重新识别失败",
        aiSummary: error.message || "请稍后再试"
      });
    }
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          address: res.address || res.name
        });
      }
    });
  },

  onRemarkInput(event) {
    this.setData({
      remark: event.detail.value
    });
  },

  onSpeciesChange(event) {
    const filteredIndex = Number(event.detail.value);
    const actualIndex = this.data.filteredSpeciesIndexes[filteredIndex] || 0;
    this.setData({
      selectedSpeciesIndex: actualIndex
    });
  },

  onSearchInput(event) {
    const keyword = (event.detail.value || "").trim().toLowerCase();
    const filtered = this.data.speciesOptions
      .map((item, index) => ({
        item,
        actualIndex: index + 1
      }))
      .filter(({ item }) => {
        if (!keyword) {
          return true;
        }

        return (
          item.chineseName.toLowerCase().includes(keyword) ||
          item.latinName.toLowerCase().includes(keyword) ||
          item.category.toLowerCase().includes(keyword)
        );
      });

    this.setData({
      searchKeyword: event.detail.value || "",
      filteredSpeciesNames: ["暂不选择"].concat(filtered.map(({ item }) => item.chineseName)),
      filteredSpeciesIndexes: [0].concat(filtered.map(({ actualIndex }) => actualIndex))
    });
  },

  syncFilteredSelection(actualIndex) {
    const foundIndex = this.data.filteredSpeciesIndexes.findIndex((item) => item === actualIndex);

    if (foundIndex === -1) {
      this.setData({
        filteredSpeciesNames: ["暂不选择"].concat(this.data.speciesOptions.map((item) => item.chineseName)),
        filteredSpeciesIndexes: [0].concat(this.data.speciesOptions.map((_item, index) => index + 1))
      });
    }
  },

  async submitReport() {
    if (!this.data.uploadedImageUrl || !this.data.latitude) {
      wx.showToast({
        title: "请先完成上传并补全位置",
        icon: "none"
      });
      return;
    }

    const selectedSpecies =
      this.data.selectedSpeciesIndex > 0
        ? this.data.speciesOptions[this.data.selectedSpeciesIndex - 1]
        : null;

    try {
      await api.createReport({
        imageUrl: this.data.uploadedImageUrl,
        latitude: this.data.latitude,
        longitude: this.data.longitude,
        address: this.data.address,
        remark: this.data.remark,
        speciesId: selectedSpecies ? selectedSpecies.id : null,
        aiTop1: this.data.aiTop1,
        aiScore: this.data.aiScore ? Number(this.data.aiScore) : 0,
        aiCandidates: this.data.aiCandidates
      });

      wx.showToast({
        title: "已提交审核",
        icon: "success"
      });

      setTimeout(() => {
        this.setData({ submitSuccess: true });
      }, 700);
    } catch (error) {
      var msg = error.message || "";
      if (msg.includes("上报已达上限")) {
        wx.showModal({
          title: "今日上报已达上限",
          content: "今日提交次数已用完（每日最多5次）。\n\n提升信用分可增加次数：\n• 审核通过每次 +2 分\n• 保持良好记录\n\n信用分 < 60：每日限2次\n信用分 ≥ 60：每日限5次",
          showCancel: false,
          confirmText: "我知道了"
        });
      } else {
        wx.showToast({
          title: msg || "提交失败",
          icon: "none",
          duration: 2500
        });
      }
    }
  },

  goHome() {
    this.setData({ submitSuccess: false });
    wx.switchTab({ url: "/pages/home/home" });
  }
});
