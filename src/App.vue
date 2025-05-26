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

    // 定位到指定地震
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

    // 生成地震热力图
    const generateEarthquakeHeatmap = (data) => {
      if (!viewer.value || !data.length) return;
      
      console.log('开始生成地震热力图，数据量:', data.length);
      
      // 清除现有热力图
      clearEarthquakeHeatmap();
      
      // 创建热力图数据源
      heatmapDataSource = new Cesium.CustomDataSource('earthquakeHeatmap');
      viewer.value.dataSources.add(heatmapDataSource);
      
      // 为了更好的视觉效果，按震级分层显示
      const layers = [
        { minMag: 7.0, maxMag: 10.0, color: Cesium.Color.DARKRED, radius: 80000, alpha: 0.7 },
        { minMag: 6.0, maxMag: 7.0, color: Cesium.Color.RED, radius: 60000, alpha: 0.6 },
        { minMag: 5.0, maxMag: 6.0, color: Cesium.Color.ORANGE, radius: 40000, alpha: 0.5 },
        { minMag: 4.0, maxMag: 5.0, color: Cesium.Color.YELLOW, radius: 25000, alpha: 0.4 },
        { minMag: 0.0, maxMag: 4.0, color: Cesium.Color.GREEN, radius: 15000, alpha: 0.3 }
      ];
      
      let heatmapCount = 0;
      
      // 为每个地震事件创建热力图点
      data.forEach((earthquake, index) => {
        if (!earthquake.longitude || !earthquake.latitude || !earthquake.magnitude) {
          console.warn('地震数据不完整，跳过:', earthquake);
          return;
        }
        
        // 确保坐标有效
        const lng = parseFloat(earthquake.longitude);
        const lat = parseFloat(earthquake.latitude);
        const mag = parseFloat(earthquake.magnitude);
        
        if (isNaN(lng) || isNaN(lat) || isNaN(mag)) {
          console.warn('地震坐标或震级无效，跳过:', earthquake);
          return;
        }
        
        // 检查坐标范围
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          console.warn('地震坐标超出有效范围，跳过:', earthquake);
          return;
        }
        
        // 根据震级确定层级
        const layer = layers.find(l => mag >= l.minMag && mag < l.maxMag) || layers[layers.length - 1];
        
        try {
          const position = Cesium.Cartesian3.fromDegrees(lng, lat, 0);
          
          // 创建热力图圆圈 - 修复高度相关警告
          const heatmapEntity = heatmapDataSource.entities.add({
            id: `heatmap_${index}_${Date.now()}`,
            position: position,
            ellipse: {
              semiMajorAxis: layer.radius,
              semiMinorAxis: layer.radius,
              material: layer.color.withAlpha(layer.alpha),
              outline: false,
              height: 0, // 明确设置高度为0，避免警告
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            properties: {
              magnitude: mag,
              location: earthquake.location || '未知位置',
              date: earthquake.date || '未知时间'
            }
          });
          
          heatmapCount++;
          
          // 为重要地震添加标记点
          if (mag >= 6.0) {
            heatmapDataSource.entities.add({
              id: `heatmap_marker_${index}_${Date.now()}`,
              position: position,
              point: {
                pixelSize: Math.min(15, mag * 2),
                color: Cesium.Color.WHITE,
                outlineColor: layer.color,
                outlineWidth: 3,
                height: 0, // 明确设置高度
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              },
              label: {
                text: `M${mag.toFixed(1)}`,
                font: '12px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -8),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
              }
            });
          }
        } catch (error) {
          console.error('创建热力图点失败:', error, earthquake);
        }
      });
      
      console.log(`地震热力图生成完成! 成功创建 ${heatmapCount} 个热力图点`);
      
      if (heatmapCount === 0) {
        console.warn('没有创建任何热力图点，请检查数据格式');
      }
      
      // 飞行到显示所有热力图的最佳视角
      if (heatmapCount > 0) {
        setTimeout(() => {
          try {
            viewer.value.flyTo(heatmapDataSource, {
              duration: 2.0,
              offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 0)
            });
          } catch (flyError) {
            console.warn('飞行到热力图失败:', flyError);
          }
        }, 500);
      }
    };

    // 清除地震热力图
    const clearEarthquakeHeatmap = () => {
      if (!viewer.value) return;
      
      if (heatmapDataSource) {
        viewer.value.dataSources.remove(heatmapDataSource);
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