<!-- CesiumView.vue -->
<template>
  <div id="cesiumContainer" class="cesium-container"></div>
  
  <!-- 顶部导航栏 -->
  <NavBar
    :active-panels="activePanels"
    v-model:selectedMap="currentMap"
    @toggle-panel="togglePanel"
    @reset-view="resetView"
    :showAnalysisPanel="showAnalysisPanel"
    @toggle-analysis-panel="toggleAnalysisPanel"
    :showEarthquakeDashboard="showEarthquakeDashboard"
    @toggle-earthquake-dashboard="toggleEarthquakeDashboard"
  />

  <!-- 视角控制面板 - 可切换显示 -->
  <ViewTranference
    v-if="viewer && isPanelActive('viewControl')"
    :viewer="viewer"
    :current-location="currentLocation"
    @update-location="updateLocation"
  />

  <!-- 数据加载面板 - 可切换显示 -->
  <FileMap
    v-if="viewer && isPanelActive('dataLoad')"
    :viewer="viewer"
    :current-location="currentLocation"
    @update-location="updateLocation"
    @add-layer="addLayerToManager"
  />
  
  <!-- 图层管理组件 - 始终显示 -->
  <LayerManager
    v-if="viewer"
    ref="layerManagerRef"
    :viewer="viewer"
    @remove-layer="handleLayerRemoved"
  />

  <!-- 空间分析组件 - 可切换显示 -->
  <Analysis
    v-if="viewer && isPanelActive('analysis')"
    :viewer="viewer"
    :current-location="currentLocation"
    @update-location="updateLocation"
  />

  <!-- 鼠标事件组件 - 始终显示 -->
  <MouseEvent
    v-if="viewer"
    :viewer="viewer"
    :current-location="currentLocation"
    @update-location="updateLocation"
  />

  <!-- 综合分析面板 -->
  <AnalysisPanel 
    v-if="showAnalysisPanel"
    :visible="showAnalysisPanel"
    :viewer="viewer"
    :current-location="currentLocation"
    @close="closeAnalysisPanel"
    @earthquake-data-loaded="handleEarthquakeDataLoaded"
  />

  <!-- 地震数据看板 -->
  <EarthquakeDashboard
    v-if="showEarthquakeDashboard"
    :visible="showEarthquakeDashboard"
    :earthquakeData="earthquakeData"
    :viewer="viewer"
    @close="closeEarthquakeDashboard"
    @open-earthquake-analysis="openEarthquakeAnalysis"
    @locate-earthquake="locateEarthquake"
    @generate-heatmap="generateEarthquakeHeatmap"
    @clear-heatmap="clearEarthquakeHeatmap"
  />
</template>

<script>
import { defineComponent, onMounted, onBeforeUnmount, ref, watch, provide } from 'vue';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import ViewTranference from './ViewTranference.vue';
import FileMap from './FileMap.vue';
import MouseEvent from './MouseEvent.vue';
import Analysis from './Analysis/index.vue';
import LayerManager from './LayerManager.vue';
import NavBar from './NavBar.vue';
import AnalysisPanel from './Analysis/AnalysisPanel.vue';
import EarthquakeDashboard from './Dashboard/EarthquakeDashboard.vue';

export default defineComponent({
  name: 'CesiumView',
  components: {
    ViewTranference,
    FileMap,
    MouseEvent,
    Analysis,
    LayerManager,
    NavBar,
    AnalysisPanel,
    EarthquakeDashboard
  },
  props: {
    selectedMap: {
      type: String,
      default: 'cesiumTerrain1'
    }
  },
  emits: ['update-location', 'update:selectedMap'],
  setup(props, { emit }) {
    const viewer = ref(null);
    const currentMap = ref('googleEarth');
    const layerManagerRef = ref(null);
    
    // 活动面板状态
    const activePanels = ref([]);
    
    // 分析面板和看板状态
    const showAnalysisPanel = ref(false);
    const showEarthquakeDashboard = ref(false);
    const earthquakeData = ref([]);
    let heatmapDataSource = null;
    
    // 检查面板是否激活
    const isPanelActive = (panelId) => {
      return activePanels.value.includes(panelId);
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

    // 保存当前相机位置状态
    const currentLocation = ref({
      longitude: 116.4074,
      latitude: 39.9042,
      height: 15000000,
      heading: 0,
      pitch: -90,
      roll: 0,
    });

    // 提供图层管理器给子组件
    provide('layerManager', layerManagerRef);
    
    // 添加图层到图层管理器
    const addLayerToManager = (layer) => {
      if (layerManagerRef.value) {
        layerManagerRef.value.addLayer(layer);
      }
    };
    
    // 处理图层管理器中移除图层事件
    const handleLayerRemoved = (layer) => {
      if (!viewer.value) return;
      
      console.log(`处理图层移除: ${layer.name} (${layer.type})`);
      
      try {
        // 根据图层类型执行不同的移除操作
        if (layer.type === 'GLTF' && layer.entity) {
          if (viewer.value.entities.contains(layer.entity)) {
            viewer.value.entities.remove(layer.entity);
            console.log('已移除GLTF实体');
          } else {
            console.warn('找不到要移除的GLTF实体');
          }
        } 
        else if (layer.type === '3DTILES' && layer.tileset) {
          if (viewer.value.scene.primitives.contains(layer.tileset)) {
            viewer.value.scene.primitives.remove(layer.tileset);
            console.log('已移除3D Tiles图层');
          } else {
            console.warn('找不到要移除的3D Tiles图层');
          }
        }
        else if (layer.type === 'GEOJSON' && layer.dataSource) {
          if (viewer.value.dataSources.contains(layer.dataSource)) {
            viewer.value.dataSources.remove(layer.dataSource);
            console.log('已移除GeoJSON数据源');
          } else {
            console.warn('找不到要移除的GeoJSON数据源');
          }
        }
      } catch (error) {
        console.error(`移除图层 ${layer.name} 时出错:`, error);
      }
    };

    // 切换地图的方法
    const changeMap = async () => {
      if (!viewer.value) return;

      viewer.value.imageryLayers.removeAll();
      
      // 默认恢复为平坦地形
      viewer.value.scene.setTerrain(
        new Cesium.Terrain(
          new Cesium.EllipsoidTerrainProvider()
        )
      );

      const gaodeKey = 'b38b391e7fbaa0cbaf84566f941985ca'; // 高德 API 密钥

      try {
        switch (currentMap.value) {
          case 'googleEarth':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                minimumLevel: 0,
                maximumLevel: 19,
              })
            );
            break;

          case 'tiandituImg':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.WebMapTileServiceImageryProvider({
                url: 'https://t{s}.tianditu.gov.cn/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=img&style=default&tileMatrixSet=w&format=tiles&tilematrixset=w&tilematrix={TileMatrix}&tilerow={TileRow}&tilecol={TileCol}&tk=0db7541916206bdde921c955473b4ad9',
                layer: 'img',
                style: 'default',
                format: 'tiles',
                tileMatrixSetID: 'w',
                subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
                maximumLevel: 18,
              })
            );
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.WebMapTileServiceImageryProvider({
                url: 'https://t{s}.tianditu.gov.cn/cia_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=cia&style=default&tileMatrixSet=w&format=tiles&tilematrixset=w&tilematrix={TileMatrix}&tilerow={TileRow}&tilecol={TileCol}&tk=0db7541916206bdde921c955473b4ad9',
                layer: 'cia',
                style: 'default',
                format: 'tiles',
                tileMatrixSetID: 'w',
                subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
                maximumLevel: 18,
              })
            );
            break;

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
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.WebMapTileServiceImageryProvider({
                url: 'https://t{s}.tianditu.gov.cn/cva_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=cva&style=default&tileMatrixSet=w&format=tiles&tilematrixset=w&tilematrix={TileMatrix}&tilerow={TileRow}&tilecol={TileCol}&tk=0db7541916206bdde921c955473b4ad9',
                layer: 'cva',
                style: 'default',
                format: 'tiles',
                tileMatrixSetID: 'w',
                subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
                maximumLevel: 18,
              })
            );
            break;

          case 'arcgisTerrain':
            // 添加ARCGIS地图服务作为图层
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.ArcGisMapServerImageryProvider({
                url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',
              })
            );
            
            // 设置Cesium全球地形
            viewer.value.scene.setTerrain(
              new Cesium.Terrain(
                await Cesium.CesiumTerrainProvider.fromIonAssetId(3956),
              ),
            );
            break;

          case 'cesiumTerrain1':
            // 添加谷歌地图作为底图
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                minimumLevel: 0,
                maximumLevel: 19,
              })
            );
            // 设置Cesium全球地形1
            viewer.value.scene.setTerrain(
              new Cesium.Terrain(
                await Cesium.CesiumTerrainProvider.fromIonAssetId(3956),
              ),
            );
            break;
            
          case 'cesiumTerrain2':
            // 添加OpenStreetMap作为底图
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.OpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/',
              })
            );
            
            // 设置Cesium全球地形2
            viewer.value.scene.setTerrain(
              new Cesium.Terrain(
                await Cesium.CesiumTerrainProvider.fromIonAssetId(3956),
              ),
            );
            break;

          case 'bingAerial':
            viewer.value.imageryLayers.addImageryProvider(
              await Cesium.IonImageryProvider.fromAssetId(3)
            );
            break;

          case 'bingRoad':
            viewer.value.imageryLayers.addImageryProvider(
              await Cesium.IonImageryProvider.fromAssetId(4)
            );
            break;

          case 'gaodeMap':
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: `https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}&key=${gaodeKey}`,
                subdomains: ['1', '2', '3', '4'],
                minimumLevel: 3,
                maximumLevel: 18,
              })
            );
            break;

          case 'gaodeSatellite':
            // 添加卫星影像
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: `https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}&key=${gaodeKey}`,
                subdomains: ['1', '2', '3', '4'],
                minimumLevel: 3,
                maximumLevel: 18,
              })
            );
            // 添加道路网标注
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.UrlTemplateImageryProvider({
                url: `https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}&key=${gaodeKey}`,
                subdomains: ['1', '2', '3', '4'],
                minimumLevel: 3,
                maximumLevel: 18,
              })
            );
            break;

          case 'osm':
          default:
            viewer.value.imageryLayers.addImageryProvider(
              new Cesium.OpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/',
              })
            );
            break;
        }
      } catch (error) {
        console.error(`加载地图 ${currentMap.value} 失败:`, error.message);
        console.warn('fallback 到 OpenStreetMap');
        currentMap.value = 'osm';
        await changeMap();
      }
    };

    // 初始化Cesium
    const initCesium = async () => {
      try {
        // 设置访问令牌
        Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4Njg5NmJkZS03ZjgwLTRhNWYtYWU5OC01NDRmZTYxNmQ3YmIiLCJpZCI6MjkzOTI4LCJpYXQiOjE3NDQ2MjcyMDB9.pQM7IkMb643M1hF5XHklTSAYMhjmHQDHlei0X8hsokk';

        // 创建Cesium Viewer
        viewer.value = new Cesium.Viewer('cesiumContainer', {
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
          creditContainer: document.createElement('div'),
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

        console.log('Cesium初始化完成');
      } catch (error) {
        console.error('Cesium初始化失败:', error);
      }
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

    // 重置视图
    const resetView = () => {
      if (!viewer.value) return;
      
      viewer.value.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.4074, 39.9042, 15000000),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0
        },
        duration: 2
      });
    };

    // 分析面板相关方法
    const toggleAnalysisPanel = () => {
      showAnalysisPanel.value = !showAnalysisPanel.value;
    };

    const closeAnalysisPanel = () => {
      showAnalysisPanel.value = false;
    };

    // 地震看板相关方法
    const toggleEarthquakeDashboard = () => {
      showEarthquakeDashboard.value = !showEarthquakeDashboard.value;
    };

    const closeEarthquakeDashboard = () => {
      showEarthquakeDashboard.value = false;
    };

    const handleEarthquakeDataLoaded = (data) => {
      earthquakeData.value = data;
      console.log('地震数据已加载到看板:', data.length, '条记录');
    };

    const openEarthquakeAnalysis = () => {
      showEarthquakeDashboard.value = false;
      showAnalysisPanel.value = true;
    };

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
    };

    const generateEarthquakeHeatmap = async (data) => {
      // ...existing heatmap code...
    };

    const clearEarthquakeHeatmap = () => {
      // ...existing heatmap clearing code...
    };

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
      viewer,
      currentMap,
      layerManagerRef,
      activePanels,
      currentLocation,
      showAnalysisPanel,
      showEarthquakeDashboard,
      earthquakeData,
      isPanelActive,
      togglePanel,
      addLayerToManager,
      handleLayerRemoved,
      updateLocation,
      resetView,
      toggleAnalysisPanel,
      closeAnalysisPanel,
      toggleEarthquakeDashboard,
      closeEarthquakeDashboard,
      handleEarthquakeDataLoaded,
      openEarthquakeAnalysis,
      locateEarthquake,
      generateEarthquakeHeatmap,
      clearEarthquakeHeatmap
    };
  }
});
</script>

<style scoped>
.cesium-container {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* 确保Cesium控件不被覆盖 */
:deep(.cesium-widget-credits) {
  display: none !important;
}

:deep(.cesium-viewer-toolbar) {
  display: none;
}
</style>