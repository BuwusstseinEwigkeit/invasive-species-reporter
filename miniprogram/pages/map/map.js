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

    this.updateHeatmap(reports);
  },

  buildHeatmapPoints(reports) {
    // Count reports per coordinate cluster (within ~0.001 deg ~= 100m)
    var coordMap = {};
    reports.forEach(function (item) {
      var lat = Number(item.latitude);
      var lng = Number(item.longitude);
      if (!lat || !lng) return;
      // Round to ~0.01 deg (~1km grid) for heatmap aggregation
      var key = lat.toFixed(2) + "," + lng.toFixed(2);
      if (coordMap[key]) {
        coordMap[key].weight += 1;
      } else {
        coordMap[key] = {
          latitude: lat,
          longitude: lng,
          weight: 1
        };
      }
    });

    return Object.keys(coordMap).map(function (key) { return coordMap[key]; });
  },

  updateHeatmap(reports) {
    var points = this.buildHeatmapPoints(reports);
    if (points.length === 0) return;

    try {
      var mapCtx = wx.createMapContext("risk-map");
      mapCtx.addHeatMap({
        points: points,
        radius: 40,
        opacity: 0.5,
        colorGradient: {
          "0.0": "#7fc8a9",
          "0.3": "#6abf8b",
          "0.5": "#e8b435",
          "0.7": "#e06c3a",
          "1.0": "#c0392b"
        },
        success: function () {
          console.log("[heatmap] addHeatMap success, points=" + points.length);
        },
        fail: function (err) {
          console.log("[heatmap] addHeatMap not supported, err=" + JSON.stringify(err));
        }
      });
    } catch (_e) {
      console.log("[heatmap] addHeatMap unavailable in this environment");
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
