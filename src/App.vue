<template>
  <div id="app">
    <!-- 导航栏 -->
    <NavBar 
      :activePanels="activePanels"
      :selectedMap="selectedMap" 
      @update:selectedMap="updateSelectedMap"
      @toggle-panel="togglePanel"
      @reset-view="resetView"
      :showAnalysisPanel="showAnalysisPanel"
      @toggle-analysis-panel="toggleAnalysisPanel"
      :showEarthquakeDashboard="showEarthquakeDashboard"
      @toggle-earthquake-dashboard="toggleEarthquakeDashboard"
    />

    <!-- 地图容器 -->
    <div ref="cesiumContainer" id="cesiumContainer"></div>

    <!-- 控制面板 -->
    <ViewTranference v-if="activePanels.includes('viewControl')" :viewer="viewer" :currentLocation="currentLocation" @update-location="updateLocation" />
    <FileMap v-if="activePanels.includes('dataLoad')" :viewer="viewer" />
    <Analysis v-if="activePanels.includes('analysis')" :viewer="viewer" :currentLocation="currentLocation" @update-location="updateLocation" />

    <!-- 综合分析面板 -->
    <AnalysisPanel 
      v-if="showAnalysisPanel"
      :visible="showAnalysisPanel"
      :viewer="viewer"
      :current-location="currentLocation"
      @close="showAnalysisPanel = false"
      @earthquake-data-loaded="handleEarthquakeDataLoaded"
    />

    <!-- 地震数据看板 -->
    <EarthquakeDashboard
      v-if="showEarthquakeDashboard"
      :visible="showEarthquakeDashboard"
      :earthquakeData="earthquakeData"
      :viewer="viewer"
      @close="showEarthquakeDashboard = false"
      @open-earthquake-analysis="openEarthquakeAnalysis"
      @locate-earthquake="locateEarthquake"
      @generate-heatmap="generateEarthquakeHeatmap"
      @clear-heatmap="clearEarthquakeHeatmap"
    />
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, computed } from 'vue';
import * as Cesium from 'cesium';
import NavBar from './components/NavBar.vue';
import ViewTranference from './components/ViewTranference.vue';
import FileMap from './components/FileMap.vue';
import Analysis from './components/Analysis/index.vue';
import AnalysisPanel from './components/Analysis/AnalysisPanel.vue';
import EarthquakeDashboard from './components/Dashboard/EarthquakeDashboard.vue';

export default defineComponent({
  name: 'App',
  components: {
    NavBar,
    ViewTranference,
    FileMap,
    Analysis,
    AnalysisPanel,
    EarthquakeDashboard
  },
  setup() {
    // 基础状态
    const cesiumContainer = ref(null);
    const viewer = ref(null);
    const activePanels = ref([]);
    
    // 当前位置状态
    const currentLocation = ref({
      longitude: 116.3912757,
      latitude: 39.906217,
      height: 15000000,
      heading: 0,
      pitch: -90,
      roll: 0
    });
    
    // 地图类型状态
    const selectedMap = ref('cesiumTerrain1');
    
    // 分析面板显示状态
    const showAnalysisPanel = ref(false);
    const showEarthquakeDashboard = ref(false);
    const earthquakeData = ref([]);
    let heatmapDataSource = null;

    // 初始化Cesium
    const initCesium = async () => {
      try {
        // 设置Cesium基础配置
        Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmMzQ5NjA3Ny1iYzdkLTRhYWQtODhjOS0xMDM5ZDU2MDc5NWYiLCJpZCI6MjkzOTI4LCJpYXQiOjE3NDQ2Mjc0MzJ9.5B7kUdXIlR3RrzCEs58kNEFzEgihL6ezYuCjsU6WvXw';

        // 创建Cesium Viewer
        viewer.value = new Cesium.Viewer(cesiumContainer.value, {
          homeButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          geocoder: false,
          infoBox: false,
          selectionIndicator: false,
          creditContainer: document.createElement('div'), // 隐藏版权信息
        });

        // 设置初始视角
        viewer.value.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            currentLocation.value.longitude,
            currentLocation.value.latitude,
            currentLocation.value.height
          ),
          orientation: {
            heading: Cesium.Math.toRadians(currentLocation.value.heading),
            pitch: Cesium.Math.toRadians(currentLocation.value.pitch),
            roll: Cesium.Math.toRadians(currentLocation.value.roll)
          }
        });

        // 设置地形
        await changeMap();

        // 添加相机移动监听
        viewer.value.camera.moveEnd.addEventListener(() => {
          updateCurrentLocation();
        });

        console.log('Cesium初始化完成');
      } catch (error) {
        console.error('Cesium初始化失败:', error);
      }
    };

    // 更新当前位置
    const updateCurrentLocation = () => {
      if (!viewer.value) return;
      
      const position = viewer.value.camera.positionCartographic;
      currentLocation.value = {
        longitude: Cesium.Math.toDegrees(position.longitude),
        latitude: Cesium.Math.toDegrees(position.latitude),
        height: position.height,
        heading: Cesium.Math.toDegrees(viewer.value.camera.heading),
        pitch: Cesium.Math.toDegrees(viewer.value.camera.pitch),
        roll: Cesium.Math.toDegrees(viewer.value.camera.roll)
      };
    };

    // 切换面板显示状态
    const togglePanel = (panelId) => {
      const index = activePanels.value.indexOf(panelId);
      if (index >= 0) {
        activePanels.value.splice(index, 1);
      } else {
        activePanels.value.push(panelId);
      }
    };

    // 更新选中的地图
    const updateSelectedMap = (mapType) => {
      selectedMap.value = mapType;
      changeMap();
    };

    // 切换地图
    const changeMap = async () => {
      if (!viewer.value) return;

      viewer.value.imageryLayers.removeAll();
      
      try {
        switch (selectedMap.value) {
          case 'tiandituVec':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.WebMapTileServiceImageryProvider({
                url: 'https://t{s}.tianditu.gov.cn/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=vec&style=default&tileMatrixSet=w&format=tiles&tilematrixset=w&tilematrix={TileMatrix}&tilerow={TileRow}&tilecol={TileCol}&tk=0db7541916206bdde921c955473b4ad9',
                layer: 'vec',
                style: 'default',
                format: 'tiles',
                tileMatrixSetID: 'w',
                subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
                maximumLevel: 18,
              })
            );
            break;

          case 'arcgisTerrain':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.ArcGisMapServerImageryProvider({
                url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',
              })
            );
            viewer.value.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(3956);
            break;

          case 'cesiumTerrain1':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                maximumLevel: 19,
              })
            );
            viewer.value.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(3956);
            break;

          case 'cesiumTerrain2':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.OpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/'
              })
            );
            viewer.value.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
            break;

          case 'bingAerial':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.BingMapsImageryProvider({
                url: 'https://dev.virtualearth.net',
                key: 'AqTGBsziZHIJYYxgivLBf0hVdrAk9mWO5cQcb8Yux8sW5M8c8opEC2lZqKR1ZZXf',
                mapStyle: Cesium.BingMapsStyle.AERIAL
              })
            );
            break;

          case 'bingRoad':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.BingMapsImageryProvider({
                url: 'https://dev.virtualearth.net',
                key: 'AqTGBsziZHIJYYxgivLBf0hVdrAk9mWO5cQcb8Yux8sW5M8c8opEC2lZqKR1ZZXf',
                mapStyle: Cesium.BingMapsStyle.ROAD
              })
            );
            break;

          case 'gaodeMap':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: 'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
                maximumLevel: 18,
              })
            );
            break;

          case 'gaodeSatellite':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: 'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
                maximumLevel: 18,
              })
            );
            break;

          case 'osm':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.OpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/'
              })
            );
            break;

          default:
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                maximumLevel: 19,
              })
            );
        }
      } catch (error) {
        console.error('切换地图失败:', error);
      }
    };

    // 重置视图
    const resetView = () => {
      if (!viewer.value) return;
      
      viewer.value.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          116.3912757,
          39.906217,
          15000000
        ),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0
        },
        duration: 2
      });
    };

    // 更新位置
    const updateLocation = (location) => {
      currentLocation.value = { ...location };
      
      if (viewer.value) {
        viewer.value.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            location.longitude,
            location.latitude,
            location.height
          ),
          orientation: {
            heading: Cesium.Math.toRadians(location.heading || 0),
            pitch: Cesium.Math.toRadians(location.pitch || -90),
            roll: Cesium.Math.toRadians(location.roll || 0)
          },
          duration: 1.5
        });
      }
    };

    // 切换分析面板显示
    const toggleAnalysisPanel = () => {
      showAnalysisPanel.value = !showAnalysisPanel.value;
    };
    
    // 切换地震数据看板
    const toggleEarthquakeDashboard = () => {
      showEarthquakeDashboard.value = !showEarthquakeDashboard.value;
    };

    // 处理地震数据加载
    const handleEarthquakeDataLoaded = (data) => {
      earthquakeData.value = data;
      console.log('地震数据已加载到看板:', data.length, '条记录');
    };

    // 打开地震分析
    const openEarthquakeAnalysis = () => {
      showEarthquakeDashboard.value = false;
      showAnalysisPanel.value = true;
    };

    // 定位到指定地震 - 移动到地震工具类
    const locateEarthquake = (earthquake) => {
      if (!viewer.value) return;
      
      const position = Cesium.Cartesian3.fromDegrees(
        earthquake.longitude,
        earthquake.latitude,
        earthquake.depth * 1000
      );
      
      viewer.value.camera.flyTo({
        destination: position,
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-45.0),
          roll: 0.0
        },
        duration: 2.0
      });
      
      // 添加临时标记
      const entity = viewer.value.entities.add({
        position: position,
        point: {
          pixelSize: 15,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        label: {
          text: `M${earthquake.magnitude.toFixed(1)} ${earthquake.location || ''}`,
          font: '14pt sans-serif',
          fillColor: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -50)
        }
      });
      
      // 3秒后移除标记
      setTimeout(() => {
        if (viewer.value && viewer.value.entities.contains(entity)) {
          viewer.value.entities.remove(entity);
        }
      }, 3000);
    };

    // 生成地震热力图 - 使用核密度分析工具类
    const generateEarthquakeHeatmap = async (data) => {
      if (!viewer.value || !data.length) return;
      
      console.log('开始生成地震核密度分析热力图，数据量:', data.length);
      
      try {
        // 动态导入核密度分析工具
        const { EarthquakeKernelDensityAnalysis } = await import('./utils/earthquakeKernelDensity.js');
        
        // 创建核密度分析实例
        const kernelDensityAnalysis = new EarthquakeKernelDensityAnalysis(viewer.value);
        
        // 生成核密度热力图
        await kernelDensityAnalysis.generateKernelDensityHeatmap(data);
        
        // 保存实例引用以便清除
        heatmapDataSource = kernelDensityAnalysis;
        
        console.log('地震核密度分析热力图生成完成');
      } catch (error) {
        console.error('生成地震核密度热力图失败:', error);
        // 降级到简单热力图
        await generateSimpleHeatmap(data);
      }
    };

    // 简单热力图作为备选方案
    const generateSimpleHeatmap = async (data) => {
      try {
        const { CesiumHeatmap } = await import('./utils/cesiumHeatmap.js');
        
        const heatmap = new CesiumHeatmap(viewer.value, {
          radius: 60,
          maxOpacity: 0.8,
          gradient: {
            0.25: "rgb(0,0,255)",
            0.55: "rgb(0,255,0)",
            0.85: "rgb(255,255,0)",
            1.0: "rgb(255,0,0)"
          }
        });
        
        const heatmapPoints = data.map(eq => ({
          x: eq.longitude,
          y: eq.latitude,
          value: eq.magnitude / 10
        }));
        
        heatmap.setData(heatmapPoints);
        heatmapDataSource = heatmap;
        
        console.log('简单热力图生成完成');
      } catch (error) {
        console.error('生成简单热力图也失败:', error);
      }
    };

    // 清除地震热力图
    const clearEarthquakeHeatmap = () => {
      if (!viewer.value) return;
      
      if (heatmapDataSource) {
        if (typeof heatmapDataSource.remove === 'function') {
          heatmapDataSource.remove();
        } else if (typeof heatmapDataSource.clear === 'function') {
          heatmapDataSource.clear();
        }
        heatmapDataSource = null;
      }
      
      console.log('地震热力图已清除');
    };

    // 生命周期钩子
    onMounted(() => {
      initCesium();
    });

    onBeforeUnmount(() => {
      if (viewer.value) {
        viewer.value.destroy();
        viewer.value = null;
      }
    });

    return {
      cesiumContainer,
      viewer,
      activePanels,
      currentLocation,
      selectedMap,
      showAnalysisPanel,
      showEarthquakeDashboard,
      earthquakeData,
      togglePanel,
      updateSelectedMap,
      resetView,
      updateLocation,
      toggleAnalysisPanel,
      toggleEarthquakeDashboard,
      handleEarthquakeDataLoaded,
      openEarthquakeAnalysis,
      locateEarthquake,
      generateEarthquakeHeatmap,
      clearEarthquakeHeatmap
    };
  }
});
</script>

<style>
html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: Arial, sans-serif;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.cesium-widget-credits {
  display: none !important;
}
</style>