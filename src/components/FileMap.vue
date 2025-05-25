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
    const gltfColor = ref('#ffffff');
    const tilesColor = ref('#ffffff');
    const geoJsonColor = ref('#ff0000');
    const heightFactor = ref(1.0); // 高度系数
    let gltfEntity = null;
    let tileset = null;
    // 将 geoJsonDataSource 改为响应式变量
    const geoJsonDataSource = ref(null);
    const gltfFileName = ref('');
    const geoJsonFileName = ref('');

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
      { name: '彩虹渐变', colors: [Cesium.Color.BLUE, Cesium.Color.CYAN, Cesium.Color.GREEN, Cesium.Color.YELLOW, Cesium.Color.RED] },
      { name: '地形色带', colors: [Cesium.Color.DARKGREEN, Cesium.Color.YELLOW, Cesium.Color.BROWN, Cesium.Color.WHITE] },
      { name: '热力图', colors: [Cesium.Color.BLUE, Cesium.Color.CYAN, Cesium.Color.GREEN, Cesium.Color.YELLOW, Cesium.Color.RED] },
    ]);
    const selectedColorBand = ref(colorBands.value[0]);

    // 生成渐变样式
    const getGradientStyle = () => {
      const colors = selectedColorBand.value.colors;
      if (colors.length === 2) {
        return `linear-gradient(to right, ${colors[0].toCssColorString()}, ${colors[1].toCssColorString()})`;
      }
      
      // 处理多色带
      const stops = colors.map((color, index) => {
        const percent = (index / (colors.length - 1)) * 100;
        return `${color.toCssColorString()} ${percent}%`;
      }).join(', ');
      
      return `linear-gradient(to right, ${stops})`;
    };

    // 设置 Cesium ion 访问令牌 - 统一使用CesiumView.vue中的令牌
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4Njg5NmJkZS03ZjgwLTRhNWYtYWU5OC01NDRmZTYxNmQ3YmIiLCJpZCI6MjkzOTI4LCJpYXQiOjE3NDQ2MjcyMDB9.pQM7IkMb643M1hF5XHklTSAYMhjmHQDHlei0X8hsokk';

    // 验证位置
    const validateLocation = () => {
      const { longitude, latitude } = props.currentLocation;
      if (typeof longitude !== 'number' || typeof latitude !== 'number' || isNaN(longitude) || isNaN(latitude)) {
        console.error('Invalid location:', props.currentLocation);
        return false;
      }
      return true;
    };

    // 清理无效实体和数据源 - 修改为只清理指定类型
    const cleanEntities = (type = null) => {
      if (!props.viewer) return;
      
      if (type === null || type === 'all') {
        // 清除所有实体
        props.viewer.entities.removeAll();
        console.log('已清除所有实体');
        
        // 清除所有数据源
        const dataSources = props.viewer.dataSources;
        for (let i = dataSources.length - 1; i >= 0; i--) {
          const ds = dataSources.get(i);
          dataSources.remove(ds);
          console.log('已移除数据源:', ds.name || 'unnamed');
        }
      } else if (type === 'gltf') {
        // 仅清除之前的GLTF模型
        clearGltf();
      } else if (type === '3dtiles') {
        // 仅清除之前的3DTiles
        clear3DTiles();
      } else if (type === 'geojson') {
        // 仅清除之前的GeoJSON
        clearGeoJson();
      }
    };

    // 加载 glTF 模型（Entity 方法）- 修改为不清除其他实体
    const loadGltf = async (event) => {
      if (!props.viewer) {
        console.error('Viewer未初始化');
        return;
      }

      const file = event.target.files[0];
      if (!file || !file.name.match(/\.glb$/i)) {
        console.error('请选择.glb文件');
        return;
      }
      
      gltfFileName.value = file.name;

      if (!validateLocation()) {
        console.error('无法加载glTF：位置无效');
        return;
      }

      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const arrayBuffer = reader.result;
          const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);

          // 只清除先前的glTF，保留其他实体
          clearGltf();

          const position = Cesium.Cartesian3.fromDegrees(
            props.currentLocation.longitude,
            props.currentLocation.latitude,
            100
          );
          const heading = Cesium.Math.toRadians(0);
          const pitch = Cesium.Math.toRadians(0);
          const roll = 0;
          const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
          const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

          const entityId = `gltf_${Cesium.createGuid()}`;
          
          gltfEntity = await props.viewer.entities.add({
            id: entityId,
            name: file.name,
            position: position,
            orientation: orientation,
            model: {
              uri: url,
              scale: 100,
              minimumPixelSize: 64,
              maximumScale: 20000,
              color: gltfColor.value ? Cesium.Color.fromCssColorString(gltfColor.value) : Cesium.Color.WHITE,
              incrementallyLoadTextures: true,
              runAnimations: true,
              clampAnimations: true,
              shadows: Cesium.ShadowMode.ENABLED,
              heightReference: Cesium.HeightReference.NONE,
            },
          });

          // 添加到图层管理器
          emit('add-layer', {
            id: entityId,
            name: file.name,
            type: 'GLTF',
            entity: gltfEntity,
            visible: true
          });

          console.log('glTF 加载成功:', file.name, '位置:', position);

          try {
            props.viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(
                props.currentLocation.longitude,
                props.currentLocation.latitude,
                1000
              ),
              orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-45),
                roll: 0
              },
              duration: 2
            });
          } catch (flyError) {
            console.warn('飞行到glTF位置失败:', flyError.message);
          }

          emit('update-location', {
            longitude: props.currentLocation.longitude,
            latitude: props.currentLocation.latitude,
            height: 1000,
          });

          setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error('glTF 加载失败:', error.message);
      }
    };

    // 更新 glTF 颜色
    const updateGltfColor = () => {
      if (gltfEntity && gltfEntity.model) {
        gltfEntity.model.color = gltfColor.value ? Cesium.Color.fromCssColorString(gltfColor.value) : Cesium.Color.WHITE;
        console.log('glTF 颜色更新:', gltfColor.value);
      }
    };

    // 清除 glTF 模型
    const clearGltf = () => {
      if (gltfEntity && props.viewer.entities.contains(gltfEntity)) {
        props.viewer.entities.remove(gltfEntity);
        gltfEntity = null;
        gltfFileName.value = '';
        console.log('glTF 已清除');
      }
    };

    // 加载 3D Tiles（从选择的资产）- 修改为不清除其他实体
    const load3DTiles = async () => {
      if (!props.viewer) {
        console.error('Viewer未初始化');
        return;
      }

      try {
        // 只清除现有的3DTiles，保留其他实体
        clear3DTiles();

        // 使用选择的 Cesium Ion 资产ID加载 3D Tiles
        const assetId = selectedTilesetAsset.value.id;
        console.log(`加载3D Tiles资产: ${selectedTilesetAsset.value.name} (ID: ${assetId})`);
        
        try {
          tileset = await Cesium.Cesium3DTileset.fromIonAssetId(assetId, {
            maximumScreenSpaceError: 8, // 较低的值以提高加载速度
            maximumMemoryUsage: 512,     // 限制内存使用
            immediatelyLoadDesiredLevelOfDetail: false,
            loadSiblings: false,
            skipLevelOfDetail: true,
            preloadFlightDestinations: true,
            preferLeaves: true
          });
          
          props.viewer.scene.primitives.add(tileset);
          console.log(`3D Tiles 资产加载成功: ${selectedTilesetAsset.value.name}`);
          
          // 确保在tileset加载后才尝试操作
          await tileset.readyPromise;

          // 添加到图层管理器
          const tilesetId = `3dtiles_${selectedTilesetAsset.value.id}_${Date.now()}`;
          emit('add-layer', {
            id: tilesetId,
            name: selectedTilesetAsset.value.name,
            type: '3DTILES',
            tileset: tileset,
            visible: true
          });
          
          // 获取3D Tiles的包围球，计算合适的视点
          setTimeout(() => {
            try {
              // 异步等待Tiles准备完毕
              if (tileset && tileset.ready && tileset.boundingSphere) {
                const boundingSphere = tileset.boundingSphere;
                if (boundingSphere && boundingSphere.radius > 0) {
                  const center = boundingSphere.center;
                  const cartographic = Cesium.Cartographic.fromCartesian(center);
                  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
                  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                  const height = cartographic.height + (boundingSphere.radius * 2);
                  
                  // 使用flyTo移动相机
                  props.viewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
                    orientation: {
                      heading: Cesium.Math.toRadians(0),
                      pitch: Cesium.Math.toRadians(-45),
                      roll: 0
                    },
                    duration: 3
                  });
                  
                  // 应用颜色
                  update3DTilesColor();
                } else {
                  // 边界球无效，直接缩放到资产
                  zoomToTileset();
                }
              } else {
                // tileset未准备好，尝试直接缩放
                zoomToTileset();
              }
            } catch (error) {
              console.warn('3D Tiles 视点计算失败:', error.message);
              zoomToTileset();
            }
          }, 1500); // 延长等待时间，确保加载
        } catch (error) {
          console.error('3D Tiles 加载失败:', error);
        }
      } catch (error) {
        console.error('3D Tiles 操作失败:', error);
      }
    };

    // 缩放到 Tileset 的备用方法
    const zoomToTileset = () => {
      try {
        if (tileset) {
          props.viewer.zoomTo(tileset);
        } else {
          // 如果连tileset都不可用，回退到默认视点
          props.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              props.currentLocation.longitude, 
              props.currentLocation.latitude, 
              3000
            ),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-45),
              roll: 0
            },
            duration: 2
          });
        }
      } catch (error) {
        console.warn('缩放到 3D Tiles 失败:', error.message);
        // 最后的回退方案
        props.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            props.currentLocation.longitude, 
            props.currentLocation.latitude, 
            5000
          ),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0
          }
        });
      }
    };

    // 更新 3D Tiles 颜色
    const update3DTilesColor = () => {
      if (tileset) {
        try {
          tileset.style = new Cesium.Cesium3DTileStyle({
            color: `color("${tilesColor.value}")`,
          });
          console.log('3D Tiles 颜色更新:', tilesColor.value);
        } catch (error) {
          console.warn('3D Tiles 颜色更新失败:', error.message);
        }
      }
    };

    // 清除 3D Tiles
    const clear3DTiles = () => {
      if (tileset && props.viewer.scene.primitives.contains(tileset)) {
        props.viewer.scene.primitives.remove(tileset);
        tileset = null;
        console.log('3D Tiles 已清除');
      }
    };

    // 修复 GeoJSON 加载逻辑 - 修改为不清除其他实体
    const loadGeoJson = async (event) => {
      if (!props.viewer) {
        console.error('Viewer未初始化');
        return;
      }

      const file = event.target.files[0];
      if (!file) return;
      
      geoJsonFileName.value = file.name;

      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const geoJsonText = reader.result;
          let geoJsonData;
          
          try {
            geoJsonData = JSON.parse(geoJsonText);
          } catch (parseError) {
            console.error('GeoJSON 解析失败:', parseError.message);
            return;
          }

          // 只清除先前的GeoJSON，保留其他实体
          clearGeoJson();

          try {
            // 使用 .value 来设置响应式变量
            geoJsonDataSource.value = await Cesium.GeoJsonDataSource.load(geoJsonData, {
              stroke: Cesium.Color.BLACK,
              fill: Cesium.Color.fromCssColorString(geoJsonColor.value).withAlpha(0.5),
              markerColor: Cesium.Color.fromCssColorString(geoJsonColor.value),
              clampToGround: true,
            });

            // 添加到viewer时使用 .value
            props.viewer.dataSources.add(geoJsonDataSource.value);
            console.log('GeoJSON 加载成功:', file.name);

            // 提取字段供用户选择 - 使用 .value
            extractGeoJsonFields(geoJsonDataSource.value);

            // 生成唯一ID并设置到dataSource
            const geoJsonId = `geojson_${Date.now()}`;
            geoJsonDataSource.value.id = geoJsonId;
            geoJsonDataSource.value.name = file.name;

            // 添加到图层管理器
            emit('add-layer', {
              id: geoJsonId,
              name: file.name,
              type: 'GEOJSON',
              dataSource: geoJsonDataSource.value,
              visible: true
            });

            try {
              // 飞行到 GeoJSON 数据范围
              props.viewer.flyTo(geoJsonDataSource.value);
            } catch (flyError) {
              console.warn('飞行到 GeoJSON 数据范围失败:', flyError.message);
            }
          } catch (loadError) {
            console.error('GeoJSON 加载失败:', loadError.message);
          }
        };
        reader.readAsText(file);
      } catch (error) {
        console.error('GeoJSON 文件读取失败:', error.message);
      }
    };

    // 提取 GeoJSON 数值字段 - 修复 getValue 错误
    const extractGeoJsonFields = (dataSource) => {
      if (!dataSource || !dataSource.entities || dataSource.entities.values.length === 0) {
        geoJsonFields.value = [];
        return;
      }
      
      const sampleEntity = dataSource.entities.values[0];
      if (!sampleEntity || !sampleEntity.properties) {
        geoJsonFields.value = [];
        return;
      }
      
      // 安全获取属性值
      const safeGetValue = (property) => {
        try {
          if (typeof property.getValue === 'function') {
            return property.getValue();
          } else if (property !== null && property !== undefined) {
            return property;
          }
          return undefined;
        } catch (e) {
          return undefined;
        }
      };
      
      // 检查属性是否为数值类型
      const isNumeric = (value) => {
        return !isNaN(parseFloat(value)) && isFinite(value);
      };
      
      // 收集所有属性
      const propertyNames = Object.keys(sampleEntity.properties);
      
      // 筛选出数值类型的属性
      const numericFields = propertyNames.filter(key => {
        const value = safeGetValue(sampleEntity.properties[key]);
        return isNumeric(value);
      });
      
      console.log('找到数值字段:', numericFields);
      geoJsonFields.value = numericFields;
      selectedGeoJsonField.value = numericFields.length > 0 ? numericFields[0] : null;
    };

    // 仅应用 GeoJSON 颜色，不改变高度
    const applyGeoJsonColors = () => {
      if (!geoJsonDataSource.value) {
        console.warn('GeoJSON 数据未加载');
        return;
      }

      const colors = selectedColorBand.value.colors;
      const colorCount = colors.length;
      const entities = geoJsonDataSource.value.entities.values;
      const entityCount = entities.length;
      
      // 如果选择了字段，找出最大最小值用于归一化
      let minValue = Infinity;
      let maxValue = -Infinity;
      
      // 安全获取属性值
      const safeGetValue = (property) => {
        try {
          if (typeof property.getValue === 'function') {
            return property.getValue();
          } else if (property !== null && property !== undefined) {
            return property;
          }
          return undefined;
        } catch (e) {
          return undefined;
        }
      };
      
      if (selectedGeoJsonField.value) {
        entities.forEach(entity => {
          if (entity.properties && entity.properties[selectedGeoJsonField.value]) {
            const value = parseFloat(safeGetValue(entity.properties[selectedGeoJsonField.value]));
            if (!isNaN(value)) {
              minValue = Math.min(minValue, value);
              maxValue = Math.max(maxValue, value);
            }
          }
        });
      }
      
      // 值范围
      const valueRange = maxValue - minValue;
      
      // 应用颜色但不改变高度
      entities.forEach((entity, index) => {
        if (entity.polygon) {
          // 根据索引或字段值计算颜色位置
          let colorPosition;
          
          if (selectedGeoJsonField.value && entity.properties && entity.properties[selectedGeoJsonField.value]) {
            const value = parseFloat(safeGetValue(entity.properties[selectedGeoJsonField.value]));
            if (!isNaN(value) && valueRange > 0) {
              // 根据字段值生成颜色
              colorPosition = (value - minValue) / valueRange;
            } else {
              // 回退到索引
              colorPosition = index / (entityCount - 1 || 1);
            }
          } else {
            // 根据索引生成颜色
            colorPosition = index / (entityCount - 1 || 1);
          }
          
          // 计算颜色
          let finalColor;
          if (colorCount > 2) {
            // 多色带 - 找到对应的区间和颜色
            const segment = colorPosition * (colorCount - 1);
            const segmentIndex = Math.floor(segment);
            const segmentPosition = segment - segmentIndex;
            
            if (segmentIndex >= colorCount - 1) {
              finalColor = colors[colorCount - 1];
            } else {
              finalColor = Cesium.Color.lerp(
                colors[segmentIndex],
                colors[segmentIndex + 1],
                segmentPosition,
                new Cesium.Color()
              );
            }
          } else {
            // 双色带
            finalColor = Cesium.Color.lerp(
              colors[0],
              colors[1],
              colorPosition,
              new Cesium.Color()
            );
          }
          
          // 仅更新颜色，保留现有高度
          entity.polygon.material = finalColor;
        }
      });
      
      console.log('已更新 GeoJSON 颜色，使用色带:', selectedColorBand.value.name);
    };

    // 单独的高度渲染函数
    const applyGeoJsonHeight = () => {
      if (!geoJsonDataSource.value) {
        console.warn('GeoJSON 数据未加载');
        return;
      }

      if (!selectedGeoJsonField.value) {
        console.warn('未选择高度字段');
        return;
      }
      
      const entities = geoJsonDataSource.value.entities.values;
      
      // 安全获取属性值
      const safeGetValue = (property) => {
        try {
          if (typeof property.getValue === 'function') {
            return property.getValue();
          } else if (property !== null && property !== undefined) {
            return property;
          }
          return undefined;
        } catch (e) {
          return undefined;
        }
      };
      
      // 应用高度 - 使用字段值和高度系数
      entities.forEach(entity => {
        if (entity.polygon && entity.properties && entity.properties[selectedGeoJsonField.value]) {
          const value = parseFloat(safeGetValue(entity.properties[selectedGeoJsonField.value]));
          if (!isNaN(value)) {
            entity.polygon.extrudedHeight = value * parseFloat(heightFactor.value);
            entity.polygon.outline = true;
            entity.polygon.outlineColor = Cesium.Color.BLACK;
          }
        }
      });
      
      console.log('已应用 GeoJSON 高度渲染，使用字段:', selectedGeoJsonField.value, '高度系数:', heightFactor.value);
    };

    // 重置 GeoJSON 高度
    const resetGeoJsonHeight = () => {
      if (!geoJsonDataSource.value) return;
      
      geoJsonDataSource.value.entities.values.forEach(entity => {
        if (entity.polygon) {
          entity.polygon.extrudedHeight = undefined;
        }
      });
      
      console.log('已重置 GeoJSON 高度');
    };

    // 清除 GeoJSON 数据
    const clearGeoJson = () => {
      if (geoJsonDataSource.value && props.viewer.dataSources.contains(geoJsonDataSource.value)) {
        props.viewer.dataSources.remove(geoJsonDataSource.value);
        geoJsonDataSource.value = null;
        geoJsonFields.value = [];
        selectedGeoJsonField.value = null;
        geoJsonFileName.value = '';
        console.log('GeoJSON 已清除');
      }
    };

    // 激活的标签页
    const activeTab = ref('gltf');

    // 拖动功能
    const isDragging = ref(false);
    const dragOffset = ref({ x: 0, y: 0 });

    const startDrag = (event) => {
      // 只在面板头部拖动
      if (!event.target.closest('.panel-header, .drag-handle')) return;
      
      isDragging.value = true;
      dragOffset.value = {
        x: event.clientX - event.currentTarget.getBoundingClientRect().left,
        y: event.clientY - event.currentTarget.getBoundingClientRect().top,
      };
      
      // 防止文本选择
      event.preventDefault();
    };

    const onDrag = (event) => {
      if (isDragging.value) {
        const panel = document.querySelector('.file-map-panel');
        panel.style.left = `${event.clientX - dragOffset.value.x}px`;
        panel.style.top = `${event.clientY - dragOffset.value.y}px`;
      }
    };

    const endDrag = () => {
      isDragging.value = false;
    };

    // GeoJSON 字段列表和选择的字段
    const geoJsonFields = ref([]);
    const selectedGeoJsonField = ref(null);

    return {
      gltfColor,
      tilesColor,
      geoJsonColor,
      colorBands,
      selectedColorBand,
      tilesetAssets,
      selectedTilesetAsset,
      loadGltf,
      updateGltfColor,
      clearGltf,
      load3DTiles,
      update3DTilesColor,
      clear3DTiles,
      loadGeoJson,
      applyGeoJsonColors, // 新增：仅应用颜色
      applyGeoJsonHeight, // 新增：仅应用高度
      resetGeoJsonHeight,
      clearGeoJson,
      activeTab,
      startDrag,
      onDrag,
      endDrag,
      geoJsonFields,
      selectedGeoJsonField,
      heightFactor,
      gltfFileName,
      geoJsonFileName,
      getGradientStyle,
      // 这里需要返回 geoJsonDataSource 给模板使用
      geoJsonDataSource
    };
  },
});
</script>

<style scoped>
.file-map-panel {
  position: absolute;
  top: 60px; /* 调整位置，放在导航栏下方 */
  left: 10px;
  z-index: 1000;
  background-color: rgba(248, 249, 250, 0.95);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 320px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
  cursor: default;
}

.file-map-panel:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.panel-header {
  background-color: #f0f0f0;
  border-bottom: 1px solid #ddd;
  padding: 8px;
  cursor: move;
  user-select: none;
}

.panel-title {
  font-weight: bold;
  font-size: 14px;
  display: block;
  text-align: center;
  margin-bottom: 6px;
  color: #333;
}

.tabs {
  display: flex;
  justify-content: space-around;
}

.tabs button {
  flex: 1;
  padding: 6px 4px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.tabs button.active {
  background-color: #4285f4;
  color: white;
  font-weight: bold;
  border-color: #3367d6;
}

.tab-content {
  padding: 10px;
  max-height: 500px;
  overflow-y: auto;
}

.file-map-section {
  margin-bottom: 10px;
}

.file-section-title {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 8px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 4px;
}

.file-input-container {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.file-label {
  background-color: #e9ecef;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.file-name {
  padding: 0 10px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

input[type="file"] {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

button:disabled,
select:disabled,
input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-color: #f8f9fa;
  border-radius: 5px;
  padding: 10px;
  border: 1px solid #eee;
  margin-top: 10px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.color-picker {
  display: flex;
  align-items: center;
  gap: 5px;
}

.color-picker label {
  font-size: 13px;
  white-space: nowrap;
}

.color-picker input[type="color"] {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}

.select-control {
  flex: 1;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  background-color: white;
}

.gradient-preview {
  height: 24px;
  width: 100%;
  border-radius: 4px;
  border: 1px solid #ddd;
  margin: 5px 0;
}

.height-factor {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
}

.height-factor label {
  font-size: 13px;
  white-space: nowrap;
}

.height-factor span {
  font-size: 12px;
  width: 30px;
  text-align: center;
}

.range-slider {
  flex: 1;
}

.control-buttons {
  display: flex;
  gap: 5px;
  margin-bottom: 5px;
}

.dual-buttons {
  justify-content: space-between;
}

button {
  padding: 6px 10px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

button:hover {
  background-color: #e9e9e9;
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
  background-color: #f8f9fa;
  color: #d73a49;
  border-color: #d73a49;
}

.btn-danger:hover {
  background-color: #f8d7da;
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