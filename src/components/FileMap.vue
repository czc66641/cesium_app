<!-- FileMap.vue -->
<template>
  <div class="file-map-panel" @mousedown="startDrag" @mousemove="onDrag" @mouseup="endDrag" @mouseleave="endDrag">
    <div class="panel-header">
      <span class="panel-title">数据加载控制面板</span>
      <div class="tabs">
        <button :class="{ active: activeTab === 'gltf' }" @click="activeTab = 'gltf'">glTF 模型</button>
        <button :class="{ active: activeTab === '3dtiles' }" @click="activeTab = '3dtiles'">3D Tiles</button>
        <button :class="{ active: activeTab === 'geojson' }" @click="activeTab = 'geojson'">GeoJSON</button>
      </div>
    </div>

    <div v-if="activeTab === 'gltf'" class="tab-content">
      <!-- glTF 模型加载 -->
      <div class="file-map-section">
        <div class="file-section-title">glTF 模型</div>
        <div class="file-input-container">
          <label for="gltf-file" class="file-label">选择文件</label>
          <input id="gltf-file" type="file" accept=".glb" @change="loadGltf" />
          <span class="file-name">{{ gltfFileName || '未选择文件' }}</span>
        </div>
        <div class="control-row">
          <div class="color-picker">
            <label>颜色: </label>
            <input type="color" v-model="gltfColor" @change="updateGltfColor" />
          </div>
          <div class="control-buttons">
            <button @click="clearGltf" class="btn-danger">清除</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === '3dtiles'" class="tab-content">
      <!-- 3D Tiles 加载 -->
      <div class="file-map-section">
        <div class="file-section-title">3D Tiles</div>
        <div class="control-row">
          <label>选择资产: </label>
          <select v-model="selectedTilesetAsset" class="select-control">
            <option v-for="asset in tilesetAssets" :key="asset.id" :value="asset">
              {{ asset.name }}
            </option>
          </select>
        </div>
        <div class="control-row">
          <div class="color-picker">
            <label>颜色: </label>
            <input type="color" v-model="tilesColor" @change="update3DTilesColor" />
          </div>
          <div class="control-buttons">
            <button @click="load3DTiles" class="btn-primary">加载资产</button>
            <button @click="clear3DTiles" class="btn-danger">清除</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'geojson'" class="tab-content">
      <!-- GeoJSON 加载 -->
      <div class="file-map-section">
        <div class="file-section-title">GeoJSON 数据</div>
        <!-- 1. 选择文件 -->
        <div class="file-input-container">
          <label for="geojson-file" class="file-label">选择文件</label>
          <input id="geojson-file" type="file" accept=".geojson,.json" @change="loadGeoJson" />
          <span class="file-name">{{ geoJsonFileName || '未选择文件' }}</span>
        </div>
        
        <div class="control-section">
          <!-- 2. 色带选择 -->
          <div class="control-row">
            <label>色带选择: </label>
            <select v-model="selectedColorBand" class="select-control" :disabled="!geoJsonDataSource">
              <option v-for="band in colorBands" :key="band.name" :value="band">
                {{ band.name }}
              </option>
            </select>
          </div>
          
          <!-- 渐变色带预览 -->
          <div class="gradient-preview" :style="{ 
            background: getGradientStyle()
          }"></div>
          
          <div class="control-buttons">
            <button @click="applyGeoJsonColors" class="btn-secondary" :disabled="!geoJsonDataSource">应用色带</button>
          </div>

          <!-- 3. 字段选择 -->
          <div class="control-row" v-if="geoJsonFields.length > 0">
            <label>高度字段: </label>
            <select v-model="selectedGeoJsonField" class="select-control">
              <option v-for="field in geoJsonFields" :key="field" :value="field">{{ field }}</option>
            </select>
          </div>
          <div class="control-row" v-else>
            <label>高度字段: </label>
            <select class="select-control" disabled>
              <option>未加载数据或无数值字段</option>
            </select>
          </div>

          <!-- 4. 高度渲染 -->
          <div class="control-row">
            <div class="height-factor">
              <label>高度系数: </label>
              <input type="range" min="0.1" max="10" step="0.1" v-model="heightFactor" class="range-slider" :disabled="!geoJsonDataSource"/>
              <span>{{ heightFactor }}x</span>
            </div>
          </div>
          
          <div class="control-buttons dual-buttons">
            <button @click="applyGeoJsonHeight" class="btn-primary" :disabled="!geoJsonDataSource || geoJsonFields.length === 0">渲染高度</button>
            <button @click="resetGeoJsonHeight" class="btn-secondary" :disabled="!geoJsonDataSource">重置高度</button>
          </div>
          
          <!-- 5. 清除 -->
          <div class="control-buttons">
            <button @click="clearGeoJson" class="btn-danger" :disabled="!geoJsonDataSource">清除数据</button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="drag-handle"></div>
  </div>
</template>

<script>
import { defineComponent, ref, watch, inject } from 'vue';
import * as Cesium from 'cesium';

export default defineComponent({
  name: 'FileMap',
  props: {
    viewer: {
      type: Object,
      required: true,
    },
    currentLocation: {
      type: Object,
      required: true,
    },
  },
  emits: ['update-location', 'add-layer'],
  setup(props, { emit }) {
    // 基础状态
    const activeTab = ref('gltf');
    const isDragging = ref(false);
    const dragOffset = ref({ x: 0, y: 0 });
    
    // glTF相关状态
    const gltfColor = ref('#ffffff');
    const gltfFileName = ref('');
    let gltfEntity = null;
    
    // 3D Tiles相关状态
    const tilesColor = ref('#ffffff');
    let tileset = null;
    
    // GeoJSON相关状态
    const geoJsonColor = ref('#ff0000');
    const heightFactor = ref(1.0);
    const geoJsonDataSource = ref(null);
    const geoJsonFileName = ref('');
    const geoJsonFields = ref([]);
    const selectedGeoJsonField = ref('');
    
    // 3D Tiles 资产列表
    const tilesetAssets = ref([
      { id: 75343, name: "纽约" },
      { id: 96188, name: "Natural Earth" },
      { id: 57588, name: "华盛顿" },
      { id: 2275207, name: "谷歌3d地形瓦片" },
      { id: 69380, name: "San Francisco" },
      { id: 1415196, name: "旧金山" },
      { id: 2521176, name: "OSM建筑" },
      { id: 16421, name: "Historical St. Peter's Basilica" },
    ]);
    const selectedTilesetAsset = ref(tilesetAssets.value[0]);

    // 色带设置
    const colorBands = ref([
      { name: '红色到黄色', colors: [Cesium.Color.RED, Cesium.Color.YELLOW] },
      { name: '蓝色到青色', colors: [Cesium.Color.BLUE, Cesium.Color.CYAN] },
      { name: '热力图', colors: [Cesium.Color.BLUE, Cesium.Color.CYAN, Cesium.Color.GREEN, Cesium.Color.YELLOW, Cesium.Color.RED] },
    ]);
    const selectedColorBand = ref(colorBands.value[0]);

    // 生成渐变样式
    const getGradientStyle = () => {
      const colors = selectedColorBand.value.colors;
      const colorStops = colors.map((color, index) => {
        const percent = (index / (colors.length - 1)) * 100;
        return `${color.toCssColorString()} ${percent}%`;
      }).join(', ');
      
      return `linear-gradient(to right, ${colorStops})`;
    };

    // 拖动功能
    const startDrag = (event) => {
      if (!event.target.closest('.panel-header, .drag-handle')) return;
      
      isDragging.value = true;
      dragOffset.value = {
        x: event.clientX - event.currentTarget.getBoundingClientRect().left,
        y: event.clientY - event.currentTarget.getBoundingClientRect().top,
      };
      
      event.preventDefault();
    };

    const onDrag = (event) => {
      if (isDragging.value) {
        const panel = document.querySelector('.file-map-panel');
        if (panel) {
          panel.style.left = `${event.clientX - dragOffset.value.x}px`;
          panel.style.top = `${event.clientY - dragOffset.value.y}px`;
        }
      }
    };

    const endDrag = () => {
      isDragging.value = false;
    };

    // glTF 加载
    const loadGltf = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      gltfFileName.value = file.name;

      try {
        // 创建对象URL
        const url = URL.createObjectURL(file);
        
        // 计算模型位置
        const position = Cesium.Cartesian3.fromDegrees(
          props.currentLocation.longitude,
          props.currentLocation.latitude,
          0
        );

        // 移除现有模型
        if (gltfEntity && props.viewer.entities.contains(gltfEntity)) {
          props.viewer.entities.remove(gltfEntity);
        }

        // 添加新模型
        gltfEntity = props.viewer.entities.add({
          name: file.name,
          position: position,
          model: {
            uri: url,
            minimumPixelSize: 128,
            maximumScale: 20000,
            color: Cesium.Color.fromCssColorString(gltfColor.value)
          }
        });

        // 添加到图层管理器
        emit('add-layer', {
          id: `gltf_${Date.now()}`,
          name: file.name,
          type: 'GLTF',
          visible: true,
          entity: gltfEntity,
          position: position
        });

        // 飞向模型
        props.viewer.flyTo(gltfEntity);

        console.log('glTF模型加载成功');
      } catch (error) {
        console.error('glTF模型加载失败:', error);
      }
    };

    // 更新glTF颜色
    const updateGltfColor = () => {
      if (gltfEntity && gltfEntity.model) {
        gltfEntity.model.color = Cesium.Color.fromCssColorString(gltfColor.value);
      }
    };

    // 清除glTF
    const clearGltf = () => {
      if (gltfEntity && props.viewer.entities.contains(gltfEntity)) {
        props.viewer.entities.remove(gltfEntity);
        gltfEntity = null;
      }
      gltfFileName.value = '';
    };

    // 加载3D Tiles
    const load3DTiles = async () => {
      try {
        if (!selectedTilesetAsset.value || !selectedTilesetAsset.value.id) {
          console.error('未选择有效的3D Tiles资产');
          return;
        }

        // 移除现有tileset
        if (tileset && props.viewer.scene.primitives.contains(tileset)) {
          props.viewer.scene.primitives.remove(tileset);
        }

        // 加载新的tileset
        tileset = await Cesium.Cesium3DTileset.fromIonAssetId(selectedTilesetAsset.value.id);
        
        // 设置颜色
        tileset.style = new Cesium.Cesium3DTileStyle({
          color: `color('${tilesColor.value}')`
        });

        props.viewer.scene.primitives.add(tileset);

        // 添加到图层管理器
        emit('add-layer', {
          id: `3dtiles_${selectedTilesetAsset.value.id}`,
          name: selectedTilesetAsset.value.name,
          type: '3DTILES',
          visible: true,
          tileset: tileset
        });

        // 飞向tileset
        props.viewer.flyTo(tileset);

        console.log('3D Tiles加载成功:', selectedTilesetAsset.value.name);
      } catch (error) {
        console.error('3D Tiles加载失败:', error);
      }
    };

    // 更新3D Tiles颜色
    const update3DTilesColor = () => {
      if (tileset) {
        tileset.style = new Cesium.Cesium3DTileStyle({
          color: `color('${tilesColor.value}')`
        });
      }
    };

    // 清除3D Tiles
    const clear3DTiles = () => {
      if (tileset && props.viewer.scene.primitives.contains(tileset)) {
        props.viewer.scene.primitives.remove(tileset);
        tileset = null;
      }
    };

    // GeoJSON 加载
    const loadGeoJson = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      geoJsonFileName.value = file.name;

      try {
        const text = await file.text();
        const geojsonData = JSON.parse(text);

        // 移除现有数据源
        if (geoJsonDataSource.value && props.viewer.dataSources.contains(geoJsonDataSource.value)) {
          props.viewer.dataSources.remove(geoJsonDataSource.value);
        }

        // 加载新数据源
        geoJsonDataSource.value = await Cesium.GeoJsonDataSource.load(geojsonData, {
          stroke: Cesium.Color.fromCssColorString(geoJsonColor.value),
          fill: Cesium.Color.fromCssColorString(geoJsonColor.value).withAlpha(0.5),
          strokeWidth: 3,
          clampToGround: true
        });

        props.viewer.dataSources.add(geoJsonDataSource.value);

        // 分析字段
        analyzeGeoJsonFields(geojsonData);

        // 添加到图层管理器
        emit('add-layer', {
          id: `geojson_${Date.now()}`,
          name: file.name,
          type: 'GEOJSON',
          visible: true,
          dataSource: geoJsonDataSource.value
        });

        // 飞向数据
        props.viewer.flyTo(geoJsonDataSource.value);

        console.log('GeoJSON数据加载成功');
      } catch (error) {
        console.error('GeoJSON加载失败:', error);
      }
    };

    // 分析GeoJSON字段
    const analyzeGeoJsonFields = (geojsonData) => {
      const fields = new Set();
      
      if (geojsonData.features && geojsonData.features.length > 0) {
        geojsonData.features.forEach(feature => {
          if (feature.properties) {
            Object.keys(feature.properties).forEach(key => {
              const value = feature.properties[key];
              if (typeof value === 'number') {
                fields.add(key);
              }
            });
          }
        });
      }
      
      geoJsonFields.value = Array.from(fields);
      if (geoJsonFields.value.length > 0) {
        selectedGeoJsonField.value = geoJsonFields.value[0];
      }
    };

    // 应用GeoJSON颜色
    const applyGeoJsonColors = () => {
      if (!geoJsonDataSource.value) return;

      const colors = selectedColorBand.value.colors;
      geoJsonDataSource.value.entities.values.forEach((entity, index) => {
        const colorIndex = index % colors.length;
        const color = colors[colorIndex];
        
        if (entity.polygon) {
          entity.polygon.material = color.withAlpha(0.7);
          entity.polygon.outline = true;
          entity.polygon.outlineColor = color;
        }
        if (entity.polyline) {
          entity.polyline.material = color;
        }
      });
    };

    // 应用GeoJSON高度
    const applyGeoJsonHeight = () => {
      if (!geoJsonDataSource.value || !selectedGeoJsonField.value) return;

      geoJsonDataSource.value.entities.values.forEach(entity => {
        const properties = entity.properties;
        if (properties && properties[selectedGeoJsonField.value]) {
          const height = properties[selectedGeoJsonField.value].getValue() * heightFactor.value;
          
          if (entity.polygon) {
            entity.polygon.extrudedHeight = height;
          }
        }
      });
    };

    // 重置GeoJSON高度
    const resetGeoJsonHeight = () => {
      if (!geoJsonDataSource.value) return;

      geoJsonDataSource.value.entities.values.forEach(entity => {
        if (entity.polygon) {
          entity.polygon.extrudedHeight = 0;
        }
      });
    };

    // 清除GeoJSON
    const clearGeoJson = () => {
      if (geoJsonDataSource.value && props.viewer.dataSources.contains(geoJsonDataSource.value)) {
        props.viewer.dataSources.remove(geoJsonDataSource.value);
        geoJsonDataSource.value = null;
      }
      geoJsonFileName.value = '';
      geoJsonFields.value = [];
      selectedGeoJsonField.value = '';
    };

    return {
      // 基础状态
      activeTab,
      isDragging,
      dragOffset,
      
      // glTF相关
      gltfColor,
      gltfFileName,
      loadGltf,
      updateGltfColor,
      clearGltf,
      
      // 3D Tiles相关
      tilesColor,
      tilesetAssets,
      selectedTilesetAsset,
      load3DTiles,
      update3DTilesColor,
      clear3DTiles,
      
      // GeoJSON相关
      geoJsonColor,
      geoJsonDataSource,
      geoJsonFileName,
      geoJsonFields,
      selectedGeoJsonField,
      heightFactor,
      colorBands,
      selectedColorBand,
      getGradientStyle,
      loadGeoJson,
      applyGeoJsonColors,
      applyGeoJsonHeight,
      resetGeoJsonHeight,
      clearGeoJson,
      
      // 拖动功能
      startDrag,
      onDrag,
      endDrag
    };
  }
});
</script>

<style scoped>
.file-map-panel {
  position: absolute;
  top: 60px;
  left: 20px;
  z-index: 1000;
  background-color: rgba(248, 249, 250, 0.95);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 320px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
}

.file-map-panel:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.panel-header {
  background-color: #f0f0f0;
  border-bottom: 1px solid #ddd;
  padding: 10px;
  cursor: move;
  user-select: none;
}

.panel-title {
  font-weight: bold;
  font-size: 14px;
  color: #333;
  display: block;
  text-align: center;
  margin-bottom: 10px;
}

.tabs {
  display: flex;
  justify-content: space-around;
}

.tabs button {
  flex: 1;
  padding: 6px 8px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin: 0 2px;
  transition: all 0.2s ease;
}

.tabs button.active {
  background-color: #4285f4;
  color: white;
  font-weight: bold;
  border-color: #3367d6;
}

.tab-content {
  padding: 15px;
  max-height: 500px;
  overflow-y: auto;
}

.file-map-section {
  margin-bottom: 20px;
}

.file-section-title {
  font-weight: bold;
  font-size: 13px;
  margin-bottom: 10px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}

.file-input-container {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.file-label {
  background-color: #4285f4;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.file-label:hover {
  background-color: #3367d6;
}

input[type="file"] {
  display: none;
}

.file-name {
  font-size: 12px;
  color: #666;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.control-row label {
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
}

.select-control {
  flex: 1;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.color-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-picker input[type="color"] {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.control-buttons {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.control-buttons button {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: #4285f4;
  color: white;
  border-color: #3367d6;
}

.btn-primary:hover {
  background-color: #3367d6;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border-color: #5a6268;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
  border-color: #c82333;
}

.btn-danger:hover {
  background-color: #c82333;
}

.control-section {
  margin-top: 15px;
}

.gradient-preview {
  height: 20px;
  border-radius: 4px;
  margin: 5px 0;
  border: 1px solid #ddd;
}

.height-factor {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.height-factor label {
  font-size: 13px;
  white-space: nowrap;
}

.range-slider {
  flex: 1;
}

.height-factor span {
  font-size: 12px;
  font-weight: bold;
  min-width: 30px;
}

.dual-buttons {
  display: flex;
  gap: 5px;
}

.dual-buttons button {
  flex: 1;
  font-size: 11px;
}

.drag-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, #ccc 50%, #ccc 100%);
  border-bottom-right-radius: 8px;
}
</style>