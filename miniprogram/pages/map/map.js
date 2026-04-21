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
    selectedSpeciesIndex: 0
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
      id: index + 1,
      latitude: item.latitude,
      longitude: item.longitude,
      width: 28,
      height: 28,
      title: item.aiTop1,
      callout: {
        content: item.aiTop1,
        display: "BYCLICK",
        borderRadius: 12,
        padding: 8
      }
    }));

    this.setData({
      reports,
      markers
    });
  },

  openDetail(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  }
});
