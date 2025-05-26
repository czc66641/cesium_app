<template>
  <div class="layer-manager-panel">
    <div class="panel-header">
      <h3>图层管理</h3>
      <button @click="togglePanel" class="toggle-btn">
        {{ isCollapsed ? '展开' : '收起' }}
      </button>
    </div>
    
    <div v-if="!isCollapsed" class="panel-content">
      <!-- 图层列表 -->
      <div class="layer-list">
        <div 
          v-for="(layer, index) in layers" 
          :key="layer.id" 
          class="layer-item"
          :class="{ active: layer.visible }"
        >
          <div class="layer-info">
            <div class="layer-name" :title="layer.name">{{ layer.name }}</div>
            <div class="layer-type">{{ layer.type }}</div>
          </div>
          
          <div class="layer-controls">
            <!-- 图层顺序控制 -->
            <div class="order-controls">
              <button 
                @click="moveLayerUp(index)"
                class="order-btn"
                :disabled="index === 0"
                title="上移图层"
              >
                <i class="fas fa-chevron-up"></i>
              </button>
              <button 
                @click="moveLayerDown(index)"
                class="order-btn"
                :disabled="index === layers.length - 1"
                title="下移图层"
              >
                <i class="fas fa-chevron-down"></i>
              </button>
            </div>
            
            <button 
              @click="toggleLayerVisibility(layer)"
              :class="['visibility-btn', layer.visible ? 'visible' : 'hidden']"
              :title="layer.visible ? '隐藏图层' : '显示图层'"
            >
              <i :class="layer.visible ? 'fas fa-eye' : 'fas fa-eye-slash'"></i>
            </button>
            
            <button 
              @click="flyToLayer(layer)"
              class="locate-btn"
              title="定位到图层"
            >
              <i class="fas fa-crosshairs"></i>
            </button>
            
            <button 
              @click="removeLayer(layer)"
              class="remove-btn"
              title="移除图层"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        
        <div v-if="layers.length === 0" class="no-layers">
          暂无图层
        </div>
      </div>

      <!-- 图层统计 -->
      <div class="layer-stats">
        <div class="stat-item">
          <span>总图层数:</span>
          <span>{{ layers.length }}</span>
        </div>
        <div class="stat-item">
          <span>可见图层:</span>
          <span>{{ visibleLayersCount }}</span>
        </div>
      </div>

      <!-- 批量操作 -->
      <div class="batch-operations">
        <button @click="showAllLayers" class="batch-btn">显示所有</button>
        <button @click="hideAllLayers" class="batch-btn">隐藏所有</button>
        <button @click="removeAllLayers" class="batch-btn danger">清除所有</button>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, computed, onMounted, onBeforeUnmount } from 'vue';

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
    const isCollapsed = ref(false);
    const layers = ref([]);

    // 计算可见图层数量
    const visibleLayersCount = computed(() => {
      return layers.value.filter(layer => layer.visible).length;
    });

    // 添加图层到管理器
    const addLayer = (layer) => {
      // 检查是否已存在
      const existingIndex = layers.value.findIndex(l => l.id === layer.id);
      if (existingIndex >= 0) {
        // 更新现有图层
        layers.value[existingIndex] = { ...layers.value[existingIndex], ...layer };
      } else {
        // 添加新图层
        layers.value.push({
          id: layer.id || Date.now().toString(),
          name: layer.name || '未命名图层',
          type: layer.type || 'UNKNOWN',
          visible: layer.visible !== false,
          entity: layer.entity || null,
          tileset: layer.tileset || null,
          dataSource: layer.dataSource || null,
          zIndex: layer.zIndex || layers.value.length,
          ...layer
        });
        
        // 重新排序图层以确保新图层在顶部
        updateLayerOrder();
      }
      console.log('图层已添加到管理器:', layer.name);
    };

    // 移除图层
    const removeLayer = (layer) => {
      try {
        const index = layers.value.findIndex(l => l.id === layer.id);
        if (index >= 0) {
          // 从场景中移除图层
          removeLayerFromScene(layer);
          
          // 从管理器中移除
          layers.value.splice(index, 1);
          emit('remove-layer', layer);
          
          console.log('图层已移除:', layer.name);
        }
      } catch (error) {
        console.error('移除图层失败:', error);
      }
    };

    // 上移图层
    const moveLayerUp = (index) => {
      if (index > 0) {
        const temp = layers.value[index];
        layers.value[index] = layers.value[index - 1];
        layers.value[index - 1] = temp;
        updateLayerOrder();
      }
    };

    // 下移图层
    const moveLayerDown = (index) => {
      if (index < layers.value.length - 1) {
        const temp = layers.value[index];
        layers.value[index] = layers.value[index + 1];
        layers.value[index + 1] = temp;
        updateLayerOrder();
      }
    };

    // 显示所有图层
    const showAllLayers = () => {
      layers.value.forEach(layer => {
        if (!layer.visible) {
          toggleLayerVisibility(layer);
        }
      });
    };

    // 隐藏所有图层
    const hideAllLayers = () => {
      layers.value.forEach(layer => {
        if (layer.visible) {
          toggleLayerVisibility(layer);
        }
      });
    };

    // 移除所有图层
    const removeAllLayers = () => {
      // 从后往前移除，避免索引问题
      for (let i = layers.value.length - 1; i >= 0; i--) {
        removeLayer(layers.value[i]);
      }
    };

    // 切换面板显示状态
    const togglePanel = () => {
      isCollapsed.value = !isCollapsed.value;
    };

    // 飞行到图层 - 增强版本
    const flyToLayer = (layer) => {
      try {
        console.log('飞行到图层:', layer.name, '类型:', layer.type);
        
        switch (layer.type) {
          case 'GLTF':
            if (layer.entity && props.viewer.entities.contains(layer.entity)) {
              // 对于GLTF模型，使用更好的视角
              props.viewer.flyTo(layer.entity, {
                duration: 2.0,
                offset: new Cesium.HeadingPitchRange(
                  Cesium.Math.toRadians(0), 
                  Cesium.Math.toRadians(-45), 
                  layer.boundingSphere ? layer.boundingSphere.radius * 3 : 500
                )
              });
            } else if (layer.position) {
              // 如果实体不存在但有位置信息，飞行到位置
              props.viewer.camera.flyTo({
                destination: layer.position,
                orientation: {
                  heading: 0,
                  pitch: Cesium.Math.toRadians(-45),
                  roll: 0
                },
                duration: 2.0
              });
            }
            break;
            
          case '3DTILES':
            if (layer.tileset && props.viewer.scene.primitives.contains(layer.tileset)) {
              props.viewer.flyTo(layer.tileset, {
                duration: 2.0
              });
            }
            break;
            
          case 'GEOJSON':
            if (layer.dataSource && props.viewer.dataSources.contains(layer.dataSource)) {
              props.viewer.flyTo(layer.dataSource, {
                duration: 2.0
              });
            }
            break;
            
          default:
            console.warn('未知的图层类型:', layer.type);
        }
        
      } catch (error) {
        console.error('飞行到图层失败:', error);
        
        // 尝试使用通用方法
        if (layer.position) {
          try {
            props.viewer.camera.flyTo({
              destination: layer.position,
              duration: 2.0
            });
          } catch (fallbackError) {
            console.error('通用飞行方法也失败:', fallbackError);
          }
        }
      }
    };

    // 切换图层可见性 - 增强版本
    const toggleLayerVisibility = (layer) => {
      try {
        const newVisibility = !layer.visible;
        layer.visible = newVisibility;
        
        console.log(`切换图层 ${layer.name} 可见性为: ${newVisibility}`);
        
        switch (layer.type) {
          case 'GLTF':
            if (layer.entity && props.viewer.entities.contains(layer.entity)) {
              layer.entity.show = newVisibility;
              console.log('GLTF实体可见性已更新');
            } else {
              console.warn('GLTF实体不存在或已被移除');
            }
            break;
            
          case '3DTILES':
            if (layer.tileset && props.viewer.scene.primitives.contains(layer.tileset)) {
              layer.tileset.show = newVisibility;
              console.log('3D Tiles可见性已更新');
            } else {
              console.warn('3D Tiles不存在或已被移除');
            }
            break;
            
          case 'GEOJSON':
            if (layer.dataSource && props.viewer.dataSources.contains(layer.dataSource)) {
              layer.dataSource.show = newVisibility;
              console.log('GeoJSON数据源可见性已更新');
            } else {
              console.warn('GeoJSON数据源不存在或已被移除');
            }
            break;
            
          default:
            console.warn('未知的图层类型:', layer.type);
        }
        
      } catch (error) {
        console.error('切换图层可见性失败:', error);
        // 回滚状态
        layer.visible = !layer.visible;
      }
    };

    // 从场景移除图层对象 - 增强版本
    const removeLayerFromScene = (layer) => {
      try {
        console.log('从场景移除图层:', layer.name, '类型:', layer.type);
        
        switch (layer.type) {
          case 'GLTF':
            if (layer.entity) {
              if (props.viewer.entities.contains(layer.entity)) {
                props.viewer.entities.remove(layer.entity);
                console.log('GLTF实体已从场景移除');
              } else {
                console.warn('GLTF实体不在场景中');
              }
            }
            break;
            
          case '3DTILES':
            if (layer.tileset) {
              if (props.viewer.scene.primitives.contains(layer.tileset)) {
                props.viewer.scene.primitives.remove(layer.tileset);
                console.log('3D Tiles已从场景移除');
              } else {
                console.warn('3D Tiles不在场景中');
              }
            }
            break;
            
          case 'GEOJSON':
            if (layer.dataSource) {
              if (props.viewer.dataSources.contains(layer.dataSource)) {
                props.viewer.dataSources.remove(layer.dataSource);
                console.log('GeoJSON数据源已从场景移除');
              } else {
                console.warn('GeoJSON数据源不在场景中');
              }
            }
            break;
            
          default:
            console.warn('未知的图层类型，无法移除:', layer.type);
        }
        
      } catch (error) {
        console.error('从场景移除图层失败:', error);
      }
    };

    // 更新图层顺序 - 增强版本
    const updateLayerOrder = () => {
      layers.value.forEach((layer, index) => {
        layer.zIndex = layers.value.length - index; // 越靠前的图层zIndex越大
        
        try {
          // 对于3D Tiles，调整在primitives集合中的顺序
          if (layer.type === '3DTILES' && layer.tileset) {
            const primitives = props.viewer.scene.primitives;
            if (primitives.contains(layer.tileset)) {
              primitives.remove(layer.tileset, false);
              primitives.add(layer.tileset);
              console.log(`3D Tiles图层 ${layer.name} 顺序已调整`);
            }
          }
          
          // 对于Entity，可以通过调整添加顺序来影响渲染顺序
          if (layer.type === 'GLTF' && layer.entity) {
            const entities = props.viewer.entities;
            if (entities.contains(layer.entity)) {
              entities.remove(layer.entity);
              entities.add(layer.entity);
              console.log(`GLTF图层 ${layer.name} 顺序已调整`);
            }
          }
          
          // 对于DataSource，调整在dataSources集合中的顺序
          if (layer.type === 'GEOJSON' && layer.dataSource) {
            const dataSources = props.viewer.dataSources;
            if (dataSources.contains(layer.dataSource)) {
              dataSources.remove(layer.dataSource, false);
              dataSources.add(layer.dataSource);
              console.log(`GeoJSON图层 ${layer.name} 顺序已调整`);
            }
          }
          
        } catch (error) {
          console.warn(`调整图层 ${layer.name} 顺序失败:`, error);
        }
      });
    };

    // 验证图层状态 - 新增功能
    const validateLayerStatus = (layer) => {
      try {
        switch (layer.type) {
          case 'GLTF':
            return layer.entity && props.viewer.entities.contains(layer.entity);
          case '3DTILES':
            return layer.tileset && props.viewer.scene.primitives.contains(layer.tileset);
          case 'GEOJSON':
            return layer.dataSource && props.viewer.dataSources.contains(layer.dataSource);
          default:
            return false;
        }
      } catch (error) {
        console.error('验证图层状态失败:', error);
        return false;
      }
    };

    // 修复图层引用 - 新增功能
    const repairLayerReference = (layer) => {
      try {
        console.log('尝试修复图层引用:', layer.name);
        
        switch (layer.type) {
          case 'GLTF':
            // 查找匹配的entity
            const matchingEntity = props.viewer.entities.getById(layer.id);
            if (matchingEntity) {
              layer.entity = matchingEntity;
              console.log('GLTF图层引用已修复');
              return true;
            }
            break;
            
          case '3DTILES':
            // 遍历primitives查找匹配的tileset
            for (let i = 0; i < props.viewer.scene.primitives.length; i++) {
              const primitive = props.viewer.scene.primitives.get(i);
              if (primitive instanceof Cesium.Cesium3DTileset && primitive.name === layer.name) {
                layer.tileset = primitive;
                console.log('3D Tiles图层引用已修复');
                return true;
              }
            }
            break;
            
          case 'GEOJSON':
            // 遍历dataSources查找匹配的数据源
            for (let i = 0; i < props.viewer.dataSources.length; i++) {
              const dataSource = props.viewer.dataSources.get(i);
              if (dataSource.name === layer.name) {
                layer.dataSource = dataSource;
                console.log('GeoJSON图层引用已修复');
                return true;
              }
            }
            break;
        }
        
        console.warn('无法修复图层引用:', layer.name);
        return false;
      } catch (error) {
        console.error('修复图层引用失败:', error);
        return false;
      }
    };

    // 定期检查图层状态 - 新增功能
    const checkLayersHealth = () => {
      layers.value.forEach(layer => {
        if (!validateLayerStatus(layer)) {
          console.warn(`图层 ${layer.name} 状态异常，尝试修复...`);
          if (!repairLayerReference(layer)) {
            console.error(`图层 ${layer.name} 修复失败，可能已被外部删除`);
            // 可以选择自动从列表中移除
            // removeLayer(layer);
          }
        }
      });
    };

    // 清理函数
    const cleanup = () => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }
    };

    // 初始化健康检查定时器
    let healthCheckInterval = null;
    
    onMounted(() => {
      console.log('图层管理器已初始化');
      
      // 每10秒检查一次图层健康状态
      healthCheckInterval = setInterval(checkLayersHealth, 10000);
    });

    // 组件卸载时的清理工作
    onBeforeUnmount(() => {
      // 清理图层管理器
      cleanup();
      
      // 清理所有图层
      removeAllLayers();
    });

    return {
      // 响应式数据
      isCollapsed,
      layers,
      visibleLayersCount,
      
      // 图层管理方法
      addLayer,
      removeLayer,
      toggleLayerVisibility,
      flyToLayer,
      moveLayerUp,
      moveLayerDown,
      
      // 批量操作方法
      showAllLayers,
      hideAllLayers,
      removeAllLayers,
      
      // 面板控制方法
      togglePanel,
      
      // 健康检查和维护方法
      validateLayerStatus,
      repairLayerReference,
      checkLayersHealth,
      cleanup
    };
  }
});
</script>

<style scoped>
.layer-manager-panel {
  position: fixed;
  top: 60px;
  left: 10px;
  width: 300px;
  max-height: 70vh;
  background: rgba(42, 42, 42, 0.95);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  color: white;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: white;
}

.toggle-btn {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 12px;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.panel-content {
  padding: 10px;
  max-height: 60vh;
  overflow-y: auto;
}

.layer-list {
  margin-bottom: 15px;
}

.layer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  margin-bottom: 5px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}

.layer-item.active {
  border-left-color: #4CAF50;
  background: rgba(76, 175, 80, 0.1);
}

.layer-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.layer-info {
  flex: 1;
  min-width: 0;
}

.layer-name {
  font-weight: bold;
  font-size: 13px;
  color: white;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-type {
  font-size: 11px;
  color: #bbb;
  text-transform: uppercase;
}

.layer-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.order-controls {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-right: 5px;
}

.order-btn {
  width: 20px;
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

.order-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.order-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.visibility-btn,
.locate-btn,
.remove-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.visibility-btn.visible {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
}

.visibility-btn.hidden {
  background: rgba(158, 158, 158, 0.2);
  color: #9e9e9e;
}

.locate-btn {
  background: rgba(33, 150, 243, 0.2);
  color: #2196F3;
}

.remove-btn {
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
}

.visibility-btn:hover,
.locate-btn:hover,
.remove-btn:hover {
  transform: scale(1.1);
}

.no-layers {
  text-align: center;
  color: #999;
  font-style: italic;
  padding: 20px;
}

.layer-stats {
  background: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 12px;
}

.stat-item:last-child {
  margin-bottom: 0;
}

.batch-operations {
  display: flex;
  gap: 5px;
}

.batch-btn {
  flex: 1;
  padding: 6px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 11px;
  transition: background 0.2s;
}

.batch-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.batch-btn.danger {
  background: rgba(244, 67, 54, 0.2);
  border-color: rgba(244, 67, 54, 0.4);
}

.batch-btn.danger:hover {
  background: rgba(244, 67, 54, 0.3);
}

/* 滚动条样式 */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>
