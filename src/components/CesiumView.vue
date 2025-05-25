<!-- CesiumView.vue -->
<template>
  <div id="cesiumContainer" class="cesium-container"></div>
  
  <!-- 顶部导航栏 -->
  <NavBar
    :active-panels="activePanels"
    v-model:selectedMap="currentMap"
    @toggle-panel="togglePanel"
    @reset-view="resetView"
  />

  <!-- 视角控制面板 - 可切换显示 -->
  <ViewTranference
    v-if="viewer && isPanelActive('viewControl')"
    :viewer="viewer"
    :current-location="currentLocation"
    @update-location="updateLocation"
    class="toggleable-panel"
  />

  <!-- 数据加载面板 - 可切换显示 -->
  <FileMap
    v-if="viewer && isPanelActive('dataLoad')"
    :viewer="viewer"
    :current-location="currentLocation"
    @update-location="updateLocation"
    @add-layer="addLayerToManager"
    class="toggleable-panel"
  />
  
  <!-- 图层管理组件 - 始终显示 -->
  <LayerManager
    v-if="viewer"
    ref="layerManagerRef"
    :viewer="viewer"
    @remove-layer="handleLayerRemoved"
    class="fixed-panel"
  />

  <!-- 空间分析组件 - 可切换显示 -->
  <Analysis
    v-if="viewer && isPanelActive('analysis')"
    :viewer="viewer"
    :current-location="currentLocation"
    @update-location="updateLocation"
    class="toggleable-panel"
  />

  <!-- 鼠标事件组件 - 始终显示 -->
  <MouseEvent
    v-if="viewer"
    :viewer="viewer"
    :current-location="currentLocation"
    @update-location="updateLocation"
    class="fixed-panel"
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

export default defineComponent({
  name: 'CesiumView',
  components: {
    ViewTranference,
    FileMap,
    MouseEvent,
    Analysis,
    LayerManager,
    NavBar
  },
  props: {
    selectedMap: {
      type: String,
      default: 'cesiumTerrain1'
    }
  },
  // 添加emits选项，声明组件可以触发的事件
  emits: ['update-location', 'update:selectedMap'],
  setup(props, { emit }) {
    const viewer = ref(null);
    const currentMap = ref('googleEarth');
    const layerManagerRef = ref(null);
    
    // 活动面板状态
    const activePanels = ref([]);
    
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

    // 重置视图
    const resetView = () => {
      if (!viewer.value) return;
      flyToLocation(116.4074, 39.9042, 15000000);
    };

    // 飞行到指定位置
    const flyToLocation = (longitude, latitude, height) => {
      if (!viewer.value) return;

      currentLocation.value.longitude = longitude;
      currentLocation.value.latitude = latitude;
      currentLocation.value.height = height;

      viewer.value.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: {
          heading: Cesium.Math.toRadians(currentLocation.value.heading),
          pitch: Cesium.Math.toRadians(currentLocation.value.pitch),
          roll: Cesium.Math.toRadians(currentLocation.value.roll),
        },
      });
    };

    // 只修改updateLocation函数，使其支持更灵活的相机控制
    const updateLocation = (newLocation, shouldFly = true) => {
      // 更新当前位置
      Object.assign(currentLocation.value, newLocation);
      
      // 仅在需要时才执行相机飞行
      if (shouldFly) {
        // 检查是否提供了完整的相机方向信息
        if (newLocation.hasOwnProperty('heading') && 
            newLocation.hasOwnProperty('pitch') && 
            newLocation.hasOwnProperty('roll')) {
          // 使用完整的相机信息执行飞行
          viewer.value.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              currentLocation.value.longitude,
              currentLocation.value.latitude,
              currentLocation.value.height
            ),
            orientation: {
              heading: Cesium.Math.toRadians(currentLocation.value.heading),
              pitch: Cesium.Math.toRadians(currentLocation.value.pitch),
              roll: Cesium.Math.toRadians(currentLocation.value.roll)
            },
            duration: 1.5
          });
        } else {
          // 使用简化的飞行（仅位置）
          flyToLocation(
            currentLocation.value.longitude,
            currentLocation.value.latitude,
            currentLocation.value.height
          );
        }
      }
    };

    // 确保地图类型变化会通过v-model双向绑定
    watch(() => currentMap.value, (newMapType) => {
      console.log(`地图类型变更为: ${newMapType}`);
      emit('update:selectedMap', newMapType);
      if (viewer.value) {
        try {
          changeMap();
        } catch (error) {
          console.error('切换地图失败:', error);
        }
      }
    });

    onMounted(async () => {
      try {
        // 更新 Cesium Ion 密钥
        Cesium.Ion.defaultAccessToken =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4Njg5NmJkZS03ZjgwLTRhNWYtYWU5OC01NDRmZTYxNmQ3YmIiLCJpZCI6MjkzOTI4LCJpYXQiOjE3NDQ2MjcyMDB9.pQM7IkMb643M1hF5XHklTSAYMhjmHQDHlei0X8hsokk';
        
        // 创建不依赖任何在线资源的基础地球
        viewer.value = new Cesium.Viewer('cesiumContainer', {
          imageryProvider: new Cesium.TileMapServiceImageryProvider({
            url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
          }),
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
        });

        viewer.value._cesiumWidget._creditContainer.style.display = 'none';

        try {
          await changeMap();
        } catch (error) {
          console.error('切换地图失败，使用默认地图:', error);
        }
        
        resetView();
        
        console.log('Cesium 地球创建成功');
      } catch (error) {
        console.error('Cesium 地球创建失败:', error);
        alert('地球加载失败，请检查网络连接或刷新页面重试');
      }
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
      currentLocation,
      layerManagerRef,
      activePanels,
      isPanelActive,
      togglePanel,
      changeMap,
      resetView,
      flyToLocation,
      updateLocation,
      addLayerToManager,
      handleLayerRemoved,
    };
  },
});
</script>

<style>
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.cesium-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* 可切换面板的样式 */
.toggleable-panel {
  animation: fade-in 0.3s ease;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 固定面板样式调整 */
.fixed-panel {
  animation: fade-in 0.3s ease;
}

/* 移除Cesium默认控件 */
.cesium-viewer-toolbar,
.cesium-viewer-animationContainer,
.cesium-viewer-timelineContainer,
.cesium-viewer-bottom {
  display: none !important;
}
</style>