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
    panelCollapsed: false,
    heatmapEnabled: true
  },

  togglePanel() {
    this.setData({ panelCollapsed: !this.data.panelCollapsed });
  },

  onShow() {
    this.loadMapData();
  },

  onMapLoaded() {
    // Map is ready — now apply heatmap if there are cached reports
    if (this.data.reports && this.data.reports.length > 0) {
      this.updateHeatmap(this.data.reports);
    }
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

    this.setData({
      reports,
      markers
    });

    this.updateHeatmap(reports);
  },

  buildHeatmapPoints(reports) {
    var coordMap = {};
    reports.forEach(function (item) {
      var lat = Number(item.latitude);
      var lng = Number(item.longitude);
      // Skip invalid coords (0,0 is ocean — outside valid China range)
      if (!lat || lat < 20 || lat > 60 || !lng || lng < 70 || lng > 140) return;
      var key = lat.toFixed(2) + "," + lng.toFixed(2);
      if (coordMap[key]) {
        coordMap[key].weight += 1;
      } else {
        coordMap[key] = { latitude: lat, longitude: lng, weight: 1 };
      }
    });
    return Object.keys(coordMap).map(function (key) { return coordMap[key]; });
  },

  updateHeatmap(reports) {
    var points = this.buildHeatmapPoints(reports);
    if (points.length === 0) {
      wx.showToast({ title: "暂无有效坐标用于热力图", icon: "none", duration: 1500 });
      return;
    }

    try {
      var mapCtx = wx.createMapContext("risk-map");
      mapCtx.addHeatMap({
        points: points,
        radius: 30,
        opacity: 0.7,
        colorGradient: {
          points: [0, 0.3, 0.5, 0.7, 1.0],
          colors: ["#7fc8a9", "#6abf8b", "#e8b435", "#e06c3a", "#c0392b"]
        },
        success: function () {
          console.log("[heatmap] addHeatMap success, points=" + points.length);
        },
        fail: function (err) {
          console.log("[heatmap] addHeatMap fail:", JSON.stringify(err));
        }
      });
    } catch (_e) {
      console.log("[heatmap] addHeatMap unavailable");
    }
  },

  toggleHeatmap() {
    var enabled = !this.data.heatmapEnabled;
    this.setData({ heatmapEnabled: enabled });

    if (enabled) {
      this.updateHeatmap(this.data.reports);
    } else {
      try {
        var mapCtx = wx.createMapContext("risk-map");
        mapCtx.removeHeatMap({
          success: function () { console.log("[heatmap] removed"); },
          fail: function () { console.log("[heatmap] remove failed"); }
        });
      } catch (_e) { /* ignore */ }
    }
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
