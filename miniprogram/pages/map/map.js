const api = require("../../utils/api");

Page({
  data: {
    latitude: 32.06,
    longitude: 118.78,
    markers: [],
    reports: [],
    allReports: [],
    speciesOptions: [],
    speciesNames: ["全部物种"],
    selectedSpeciesIndex: 0,
    panelCollapsed: false
  },

  togglePanel() {
    this.setData({ panelCollapsed: !this.data.panelCollapsed });
  },

  onShow() {
    this.loadMapData();
  },

  async loadMapData() {
    try {
      const [reportsRes, speciesRes] = await Promise.all([
        api.getReports("approved"),
        api.getSpecies()
      ]);

      this.setData({
        allReports: reportsRes.items,
        speciesOptions: speciesRes.items,
        speciesNames: ["全部物种"].concat(speciesRes.items.map((item) => item.chineseName))
      });

      this.applyFilter(0);
    } catch (error) {
      wx.showToast({
        title: "地图数据加载失败",
        icon: "none"
      });
    }
  },

  onSpeciesChange(event) {
    const selectedSpeciesIndex = Number(event.detail.value);
    this.setData({
      selectedSpeciesIndex
    });
    this.applyFilter(selectedSpeciesIndex);
  },

  applyFilter(selectedSpeciesIndex) {
    const selectedSpecies =
      selectedSpeciesIndex > 0 ? this.data.speciesOptions[selectedSpeciesIndex - 1] : null;

    const reports = selectedSpecies
      ? this.data.allReports.filter((item) => item.speciesId === selectedSpecies.id)
      : this.data.allReports.slice();

    const markers = reports.map((item, index) => ({
      id: index,
      latitude: item.latitude,
      longitude: item.longitude,
      width: 32,
      height: 32,
      title: item.speciesId,
      label: {
        content: item.aiTop1,
        fontSize: 12,
        borderWidth: 1,
        borderColor: "#305d3c",
        borderRadius: 8,
        padding: 4,
        bgColor: "#ffffff",
        textAlign: "center"
      }
    }));

    this.setData({
      reports,
      markers
    });
  },

  onMarkerTap(event) {
    const markerId = event.detail.markerId;
    if (markerId === undefined) return;
    const report = this.data.reports[markerId];
    if (report && report.speciesId) {
      wx.navigateTo({
        url: `/pages/detail/detail?id=${report.speciesId}`
      });
    }
  },

  openDetail(event) {
    const { id } = event.currentTarget.dataset;
    if (!id || id === "null" || id === "undefined") return;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  }
});
