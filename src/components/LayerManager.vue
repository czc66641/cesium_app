<template>
  <div class="layer-manager-panel" @mousedown="startDrag" @mousemove="onDrag" @mouseup="endDrag" @mouseleave="endDrag">
    <div class="panel-header">
      <span class="panel-title">图层管理</span>
    </div>
    
    <div class="panel-content">
      <div v-if="layers.length === 0" class="empty-message">
        <span>暂无图层，请加载数据</span>
      </div>
      
      <div v-else class="layer-list">
        <div 
          v-for="(layer, index) in layers" 
          :key="layer.id" 
          :class="['layer-item', layer.visible ? '' : 'layer-hidden']"
        >
          <div class="layer-controls">
            <div class="visibility-control">
              <input type="checkbox" v-model="layer.visible" @change="toggleVisibility(layer)" />
            </div>
            <div class="layer-name-type">
              <span class="layer-name" :title="layer.name">{{ layer.name }}</span>
              <span class="layer-type" :class="`layer-type-${layer.type.toLowerCase()}`">{{ getTypeLabel(layer.type) }}</span>
            </div>
            <div class="layer-actions">
              <button @click="flyToLayer(layer)" title="飞到此图层" class="fly-btn">
                <i class="icon-fly">🔍</i>
              </button>
              <button @click="moveLayerUp(index)" :disabled="index === 0" title="上移图层">
                ↑
              </button>
              <button @click="moveLayerDown(index)" :disabled="index === layers.length - 1" title="下移图层">
                ↓
              </button>
              <button @click="removeLayer(layer)" class="remove-btn" title="移除图层">
                ×
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="drag-handle"></div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted } from 'vue';
import * as Cesium from 'cesium';

export default defineComponent({
  name: 'LayerManager',
  props: {
    viewer: {
      type: Object,
      required: true
    }
  },
  emits: ['remove-layer'],
  setup(props, { emit }) {
    // 图层列表 - 注意我们将其设置为数组而非对象，使其有顺序
    const layers = ref([]);
    
    // 添加图层
    const addLayer = (layer) => {
      if (!layer || !layer.id) {
        console.warn('尝试添加无效图层', layer);
        return;
      }
      
      const existingLayerIndex = layers.value.findIndex(l => l.id === layer.id);
      if (existingLayerIndex >= 0) {
        console.log(`更新已存在的图层: ${layer.name}`);
        // 更新现有图层
        layers.value[existingLayerIndex] = { ...layer };
      } else {
        console.log(`添加新图层: ${layer.name} (${layer.type})`);
        // 添加新图层到顶部（最新添加的显示在最上面）
        layers.value.unshift({ 
          ...layer, 
          visible: true 
        });
      }
    };
    
    // 移除图层
    const removeLayer = (layer) => {
      const index = layers.value.findIndex(l => l.id === layer.id);
      if (index >= 0) {
        console.log(`从图层管理器中移除: ${layer.name}`);
        layers.value.splice(index, 1);
        emit('remove-layer', layer);
      }
    };
    
    // 切换图层可见性
    const toggleVisibility = (layer) => {
      console.log(`切换图层可见性: ${layer.name} - ${layer.visible}`);
      
      // 更新图层实体的可见性
      try {
        switch (layer.type) {
          case 'GLTF':
            if (layer.entity) {
              layer.entity.show = layer.visible;
            }
            break;
          case '3DTILES':
            if (layer.tileset) {
              layer.tileset.show = layer.visible;
            }
            break;
          case 'GEOJSON':
            if (layer.dataSource) {
              layer.dataSource.show = layer.visible;
            }
            break;
        }
      } catch (error) {
        console.error(`切换图层可见性失败: ${layer.name}`, error);
      }
    };
    
    // 获取图层类型标签
    const getTypeLabel = (type) => {
      const labels = {
        'GLTF': 'GLTF模型',
        '3DTILES': '3D Tiles',
        'GEOJSON': 'GeoJSON'
      };
      return labels[type] || type;
    };
    
    // 彻底重写飞到图层方法，确保正常工作
    const flyToLayer = (layer) => {
      if (!props.viewer) {
        console.error('Viewer未初始化，无法飞到图层');
        return;
      }
      
      console.log(`尝试飞到图层: ${layer.name} (${layer.type})`);
      
      try {
        switch (layer.type) {
          case 'GLTF':
            if (layer.entity && layer.entity.position) {
              console.log('飞到GLTF实体 - 使用直接坐标方法');
              
              // 获取实体位置
              const entityPosition = layer.entity.position.getValue(props.viewer.clock.currentTime);
              if (!entityPosition) {
                throw new Error('无法获取实体位置');
              }
              
              // 获取地球表面位置
              const cartographic = Cesium.Cartographic.fromCartesian(entityPosition);
              const longitude = Cesium.Math.toDegrees(cartographic.longitude);
              const latitude = Cesium.Math.toDegrees(cartographic.latitude);
              const height = cartographic.height;
              
              // 计算适当的相机高度
              const cameraHeight = height + 500;
              
              // 使用相机直接飞行到位置
              props.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, cameraHeight),
                orientation: {
                  heading: Cesium.Math.toRadians(0),
                  pitch: Cesium.Math.toRadians(-30),
                  roll: 0
                },
                duration: 1.5,
                complete: () => console.log('飞行到GLTF实体完成')
              });
            }
            break;
            
          case '3DTILES':
            if (layer.tileset) {
              console.log('飞到3D Tiles图层 - 使用边界球方法');
              
              // 使用tileset的边界计算位置
              if (layer.tileset.boundingSphere) {
                const center = layer.tileset.boundingSphere.center;
                const radius = layer.tileset.boundingSphere.radius;
                
                const cartographic = Cesium.Cartographic.fromCartesian(center);
                const longitude = Cesium.Math.toDegrees(cartographic.longitude);
                const latitude = Cesium.Math.toDegrees(cartographic.latitude);
                const height = cartographic.height;
                
                // 计算适当的相机高度 (考虑半径)
                const cameraHeight = height + Math.max(500, radius * 2);
                
                props.viewer.camera.flyTo({
                  destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, cameraHeight),
                  orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-45),
                    roll: 0
                  },
                  duration: 1.5,
                  complete: () => console.log('飞行到3D Tiles完成')
                });
              } else {
                // 如果没有边界球，尝试标准方法
                console.log('3D Tiles没有边界球，尝试标准方法');
                props.viewer.zoomTo(layer.tileset);
              }
            }
            break;
            
          case 'GEOJSON':
            if (layer.dataSource) {
              console.log('飞到GeoJSON数据 - 使用实体边界计算');
              
              // 获取数据源中所有实体
              const entities = layer.dataSource.entities.values;
              if (entities.length === 0) {
                throw new Error('GeoJSON数据源没有实体');
              }
              
              // 计算所有实体的边界框
              const rectangle = new Cesium.Rectangle(
                Number.POSITIVE_INFINITY, 
                Number.POSITIVE_INFINITY, 
                Number.NEGATIVE_INFINITY, 
                Number.NEGATIVE_INFINITY
              );
              
              let hasValidPositions = false;
              
              // 收集所有实体的位置
              for (let i = 0; i < entities.length; i++) {
                const entity = entities[i];
                
                // 处理点实体
                if (entity.position) {
                  try {
                    const position = entity.position.getValue(props.viewer.clock.currentTime);
                    if (position) {
                      const cartographic = Cesium.Cartographic.fromCartesian(position);
                      Cesium.Rectangle.expand(rectangle, cartographic, rectangle);
                      hasValidPositions = true;
                    }
                  } catch (e) {
                    console.warn('无法获取点实体位置');
                  }
                }
                
                // 处理多边形实体
                if (entity.polygon && entity.polygon.hierarchy) {
                  try {
                    const hierarchy = entity.polygon.hierarchy.getValue(props.viewer.clock.currentTime);
                    if (hierarchy && hierarchy.positions) {
                      for (let j = 0; j < hierarchy.positions.length; j++) {
                        const cartographic = Cesium.Cartographic.fromCartesian(hierarchy.positions[j]);
                        Cesium.Rectangle.expand(rectangle, cartographic, rectangle);
                        hasValidPositions = true;
                      }
                    }
                  } catch (e) {
                    console.warn('无法获取多边形位置');
                  }
                }
              }
              
              if (hasValidPositions) {
                // 计算边界中心
                const center = Cesium.Rectangle.center(rectangle);
                const centerLong = Cesium.Math.toDegrees(center.longitude);
                const centerLat = Cesium.Math.toDegrees(center.latitude);
                
                // 计算边界大小和适当的相机高度
                const width = Cesium.Math.toDegrees(rectangle.width);
                const height = Cesium.Math.toDegrees(rectangle.height);
                const viewHeight = Math.max(500, Math.max(width, height) * 111000 * 0.5);
                
                console.log(`飞行到GeoJSON边界中心: ${centerLong}, ${centerLat}, 高度: ${viewHeight}`);
                
                // 直接使用相机飞到计算的位置
                props.viewer.camera.flyTo({
                  destination: Cesium.Cartesian3.fromDegrees(centerLong, centerLat, viewHeight),
                  orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-60),
                    roll: 0
                  },
                  duration: 1.5,
                  complete: () => console.log('飞行到GeoJSON完成')
                });
              } else {
                console.warn('无法计算有效的GeoJSON边界，尝试标准方法');
                props.viewer.zoomTo(layer.dataSource);
              }
            }
            break;
            
          default:
            console.warn('未知的图层类型:', layer.type);
            break;
        }
      } catch (error) {
        console.error(`飞到图层${layer.name}失败:`, error);
        
        // 终极备用方法 - 针对所有失败情况
        try {
          console.log('尝试通用备用方法...');
          if (layer.entity) {
            props.viewer.zoomTo(layer.entity);
          } else if (layer.tileset) {
            props.viewer.zoomTo(layer.tileset);
          } else if (layer.dataSource) {
            props.viewer.zoomTo(layer.dataSource);
          }
        } catch (backupError) {
          console.error('所有飞行方法都失败了:', backupError);
          alert(`无法定位到图层 ${layer.name}，请尝试其他方法。`);
        }
      }
    };
    
    // 移动图层 - 向上移（在列表中向上移）
    const moveLayerUp = (index) => {
      if (index > 0) {
        // 交换图层位置
        const temp = layers.value[index];
        layers.value[index] = layers.value[index - 1];
        layers.value[index - 1] = temp;
        
        // 更新显示顺序
        updateLayerOrder();
      }
    };
    
    // 移动图层 - 向下移（在列表中向下移）
    const moveLayerDown = (index) => {
      if (index < layers.value.length - 1) {
        // 交换图层位置
        const temp = layers.value[index];
        layers.value[index] = layers.value[index + 1];
        layers.value[index + 1] = temp;
        
        // 更新显示顺序
        updateLayerOrder();
      }
    };
    
    // 更新图层显示顺序
    const updateLayerOrder = () => {
      console.log('更新图层显示顺序');
      
      // 尝试使用Cesium的API设置图层顺序
      try {
        // 为不同类型的数据设置不同的顺序控制
        layers.value.forEach((layer, index) => {
          const zIndex = layers.value.length - index; // 越大显示越靠前
          
          if (layer.type === 'GLTF' && layer.entity) {
            // GLTF模型可以使用eyeOffset控制视觉优先级
            if (layer.entity.model) {
              layer.entity.model.eyeOffset = new Cesium.Cartesian3(0, 0, -zIndex);
            }
          }
          else if (layer.type === '3DTILES' && layer.tileset) {
            // 3D Tiles目前没有直接的z-index控制方式
            // 这里我们可以尝试一些变通方法，比如设置不同的screenSpaceError
            try {
              // 设置一个微小的高度偏移以影响视觉顺序
              layer.tileset._zIndex = zIndex;
              // 对于优先级高的tileset，可以降低screenSpaceError使其更清晰
              if (layer.tileset.maximumScreenSpaceError) {
                layer.tileset.maximumScreenSpaceError = Math.max(8, 16 - zIndex * 0.5);
              }
            } catch (e) {
              console.warn('设置3DTiles顺序失败', e);
            }
          }
          else if (layer.type === 'GEOJSON' && layer.dataSource) {
            // GeoJSON也没有直接的z-index控制
            // 尝试为每个实体设置高度偏移
            try {
              layer.dataSource._zIndex = zIndex;
              
              const entities = layer.dataSource.entities.values;
              for (let i = 0; i < entities.length; i++) {
                const entity = entities[i];
                if (entity.polygon) {
                  // 设置多边形的extrudedHeight来影响高度顺序
                  // 注意：如果已经设置了extrudedHeight，这可能会干扰期望的可视化效果
                  const currentHeight = entity.polygon.extrudedHeight ? 
                    entity.polygon.extrudedHeight._value : 0;
                  
                  // 我们可以尝试设置一个很小的属性来标记优先级
                  entity.polygon.zIndex = zIndex;
                }
                if (entity.polyline) {
                  entity.polyline.zIndex = zIndex;
                }
                if (entity.billboard) {
                  entity.billboard.eyeOffset = new Cesium.Cartesian3(0, 0, -zIndex);
                }
              }
            } catch (e) {
              console.warn('设置GeoJSON顺序失败', e);
            }
          }
        });
        
        // 强制刷新Cesium场景
        if (props.viewer) {
          props.viewer.scene.requestRender();
        }
        
      } catch (error) {
        console.error('更新图层顺序失败', error);
      }
    };
    
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
        const panel = document.querySelector('.layer-manager-panel');
        panel.style.left = `${event.clientX - dragOffset.value.x}px`;
        panel.style.top = `${event.clientY - dragOffset.value.y}px`;
      }
    };

    const endDrag = () => {
      isDragging.value = false;
    };

    // 初始化
    onMounted(() => {
      console.log('图层管理器已初始化');
    });

    return {
      layers,
      addLayer,
      removeLayer,
      toggleVisibility,
      moveLayerUp,
      moveLayerDown,
      getTypeLabel,
      flyToLayer,
      startDrag,
      onDrag,
      endDrag,
      updateLayerOrder,
      isDragging,
      dragOffset
    };
  }
});
</script>

<style scoped>
.layer-manager-panel {
  position: absolute;
  top: 60px; /* 调整位置，放在导航栏下方 */
  right: 10px;
  z-index: 1000;
  background-color: rgba(248, 249, 250, 0.95);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 300px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
  cursor: default;
}

.layer-manager-panel:hover {
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
  color: #333;
}

.panel-content {
  padding: 10px;
  max-height: 300px;
  overflow-y: auto;
}

.empty-message {
  text-align: center;
  color: #999;
  padding: 20px 0;
  font-style: italic;
  font-size: 13px;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.layer-item {
  background-color: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 8px;
  transition: all 0.2s;
}

.layer-item:hover {
  background-color: #f0f0f0;
}

.layer-hidden {
  opacity: 0.6;
  background-color: #f0f0f0;
  border-style: dashed;
}

.layer-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.visibility-control {
  flex: 0 0 20px;
}

.visibility-control input {
  cursor: pointer;
}

.layer-name-type {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.layer-name {
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-type {
  font-size: 11px;
  border-radius: 10px;
  padding: 1px 6px;
  margin-top: 3px;
  display: inline-block;
  width: fit-content;
}

.layer-type-gltf {
  background-color: #e3f2fd;
  color: #1976d2;
}

.layer-type-3dtiles {
  background-color: #e8f5e9;
  color: #388e3c;
}

.layer-type-geojson {
  background-color: #fff3e0;
  color: #e65100;
}

.layer-actions {
  display: flex;
  gap: 2px;
}

.layer-actions button {
  width: 24px;
  height: 24px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.layer-actions button:hover {
  background-color: #f0f0f0;
}

.layer-actions button:disabled {
  color: #ccc;
  background-color: #f9f9f9;
  cursor: not-allowed;
}

.fly-btn {
  color: #1976d2;
}

.fly-btn:hover {
  background-color: #e3f2fd !important;
}

.icon-fly {
  font-size: 14px;
  line-height: 1;
  display: block;
}

.remove-btn {
  color: #d32f2f;
  font-weight: bold;
}

.remove-btn:hover {
  background-color: #ffebee !important;
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
