const api = require("../../utils/api");

Page({
  data: {
    latitude: 32.06,
    longitude: 118.78,
    markers: [],
    markerReportIds: [],
    reports: [],
    allReports: [],
    speciesOptions: [],
    speciesNames: ["全部物种"],
    selectedSpeciesIndex: 0,
    panelCollapsed: false,
    heatmapEnabled: true,
    loading: true,
    loadError: ""
  },

  togglePanel() {
    this.setData({ panelCollapsed: !this.data.panelCollapsed });
  },

  onShow() {
    this.loadMapData();
  },

  onPullDownRefresh() {
    this.loadMapData().finally(function () {
      wx.stopPullDownRefresh();
    });
  },

  retryLoad() {
    this.loadMapData();
  },

  onMapLoaded() {
    if (this.data.heatmapEnabled && this.data.reports.length) {
      this.updateHeatmap(this.data.reports);
    }
  },

  async fetchAllApprovedReports() {
    var page = 1;
    var totalPages = 1;
    var items = [];
    do {
      var res = await api.getReports("approved", page, 100);
      items = items.concat(res.items || []);
      totalPages = Number(res.totalPages || 1);
      page += 1;
    } while (page <= totalPages);
    return items;
  },

  async loadMapData() {
    this.setData({ loading: true, loadError: "" });
    try {
      const results = await Promise.all([
        this.fetchAllApprovedReports(),
        api.getSpecies()
      ]);
      const reports = results[0];
      const speciesItems = results[1].items || [];

      this.setData({
        allReports: reports,
        speciesOptions: speciesItems,
        speciesNames: ["全部物种"].concat(speciesItems.map((item) => item.chineseName)),
        loading: false,
        loadError: ""
      });
      this.applyFilter(this.data.selectedSpeciesIndex);

      const firstValid = reports.find((item) => this.validCoordinate(item));
      if (firstValid) {
        this.setData({
          latitude: Number(firstValid.latitude),
          longitude: Number(firstValid.longitude)
        });
      }

      wx.getLocation({
        type: "gcj02",
        success: (location) => {
          this.setData({
            latitude: location.latitude,
            longitude: location.longitude
          });
        }
      });
    } catch (error) {
      this.setData({
        loading: false,
        loadError: error.message || "地图数据加载失败"
      });
    }
  },

  validCoordinate(item) {
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  },

  onSpeciesChange(event) {
    const selectedSpeciesIndex = Number(event.detail.value);
    this.setData({ selectedSpeciesIndex });
    this.applyFilter(selectedSpeciesIndex);
  },

  applyFilter(selectedSpeciesIndex) {
    const selectedSpecies =
      selectedSpeciesIndex > 0 ? this.data.speciesOptions[selectedSpeciesIndex - 1] : null;

    const reports = selectedSpecies
      ? this.data.allReports.filter((item) => item.speciesId === selectedSpecies.id)
      : this.data.allReports.slice();

    const markerReports = reports.filter((item) => this.validCoordinate(item));
    const markerReportIds = markerReports.map((item) => item.id);
    const markers = markerReports.map((item, index) => ({
      id: index,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      width: 36,
      height: 36,
      title: item.aiTop1,
      callout: {
        content: item.aiTop1 + "\n" + (item.address || ""),
        fontSize: 12,
        borderWidth: 1,
        borderColor: "#305d3c",
        borderRadius: 8,
        padding: 8,
        bgColor: "#ffffff",
        textAlign: "left",
        display: "BYCLICK"
      }
    }));

    this.setData({ reports, markers, markerReportIds });

    if (this.data.heatmapEnabled) {
      this.updateHeatmap(reports);
    } else {
      this.removeHeatmap();
    }
  },

  buildHeatmapPoints(reports) {
    var coordMap = {};
    reports.forEach((item) => {
      if (!this.validCoordinate(item)) return;
      var lat = Number(item.latitude);
      var lng = Number(item.longitude);
      var key = lat.toFixed(3) + "," + lng.toFixed(3);
      if (coordMap[key]) {
        coordMap[key].weight += 1;
      } else {
        coordMap[key] = { latitude: lat, longitude: lng, weight: 1 };
      }
    });
    return Object.keys(coordMap).map(function (key) {
      return coordMap[key];
    });
  },

  removeHeatmap() {
    try {
      var mapCtx = wx.createMapContext("risk-map");
      mapCtx.removeHeatMap({
        fail: function () { /* unsupported runtime: ignore */ }
      });
    } catch (_e) { /* ignore */ }
  },

  updateHeatmap(reports) {
    if (!this.data.heatmapEnabled) {
      this.removeHeatmap();
      return;
    }
    var points = this.buildHeatmapPoints(reports);
    if (!points.length) {
      this.removeHeatmap();
      return;
    }

    try {
      var mapCtx = wx.createMapContext("risk-map");
      mapCtx.removeHeatMap({
        complete: function () {
          mapCtx.addHeatMap({
            points: points,
            radius: 30,
            opacity: 0.7,
            colorGradient: {
              points: [0, 0.3, 0.5, 0.7, 1],
              colors: ["#7fc8a9", "#6abf8b", "#e8b435", "#e06c3a", "#c0392b"]
            }
          });
        }
      });
    } catch (_e) { /* heatmap unsupported */ }
  },

  toggleHeatmap() {
    var enabled = !this.data.heatmapEnabled;
    this.setData({ heatmapEnabled: enabled });
    if (enabled) {
      this.updateHeatmap(this.data.reports);
    } else {
      this.removeHeatmap();
    }
  },

  onMarkerTap(event) {
    const markerId = Number(event.detail.markerId);
    const reportId = this.data.markerReportIds[markerId];
    this.openReport(reportId);
  },

  openDetail(event) {
    this.openReport(event.currentTarget.dataset.id);
  },

  openReport(id) {
    if (!id) return;
    wx.navigateTo({
      url: "/pages/report-detail/report-detail?id=" + encodeURIComponent(id)
    });
  }
});
