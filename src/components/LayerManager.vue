<template>
  <div class="layer-manager-panel">
    <div class="panel-header">
      <h3>图层管理</h3>
    </div>
    
    <div v-if="layers.length === 0" class="empty-state">
      暂无图层
    </div>
    
    <div v-else class="layer-list">
      <div 
        v-for="layer in layers" 
        :key="layer.id" 
        class="layer-item"
      >
        <div class="layer-info">
          <div class="layer-name">{{ layer.name }}</div>
          <div class="layer-type">{{ layer.type }}</div>
        </div>
        
        <div class="layer-controls">
          <button 
            @click="toggleLayerVisibility(layer)" 
            :class="['visibility-btn', layer.visible ? 'visible' : 'hidden']"
            :title="layer.visible ? '隐藏图层' : '显示图层'"
          >
            {{ layer.visible ? '👁️' : '🙈' }}
          </button>
          
          <button 
            @click="flyToLayer(layer)" 
            class="fly-btn"
            title="飞行到图层"
          >
            🎯
          </button>
          
          <button 
            @click="removeLayer(layer)" 
            class="remove-btn"
            title="移除图层"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue';
import * as Cesium from 'cesium';

export default defineComponent({
  name: 'LayerManager',
  props: {
    viewer: {
      type: Object,
      required: true,
    },
  },
  emits: ['remove-layer'],
  setup(props, { emit }) {
    const layers = ref([]);

    // 添加图层
    const addLayer = (layer) => {
      layers.value.push(layer);
    };

    // 切换图层可见性
    const toggleLayerVisibility = (layer) => {
      layer.visible = !layer.visible;
      
      try {
        switch (layer.type) {
          case 'GLTF':
            if (layer.entity && props.viewer.entities.contains(layer.entity)) {
              layer.entity.show = layer.visible;
            }
            break;
          case '3DTILES':
            if (layer.tileset && props.viewer.scene.primitives.contains(layer.tileset)) {
              layer.tileset.show = layer.visible;
            }
            break;
          case 'GEOJSON':
            if (layer.dataSource && props.viewer.dataSources.contains(layer.dataSource)) {
              layer.dataSource.show = layer.visible;
            }
            break;
        }
      } catch (error) {
        console.error('切换图层可见性失败:', error);
      }
    };

    // 飞行到图层
    const flyToLayer = (layer) => {
      try {
        switch (layer.type) {
          case 'GLTF':
            if (layer.entity && props.viewer.entities.contains(layer.entity)) {
              props.viewer.flyTo(layer.entity);
            }
            break;
          case '3DTILES':
            if (layer.tileset && props.viewer.scene.primitives.contains(layer.tileset)) {
              props.viewer.flyTo(layer.tileset);
            }
            break;
          case 'GEOJSON':
            if (layer.dataSource && props.viewer.dataSources.contains(layer.dataSource)) {
              const entities = layer.dataSource.entities.values;
              let hasValidPositions = false;
              let rectangle = new Cesium.Rectangle();
              
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
                
                props.viewer.camera.flyTo({
                  destination: Cesium.Cartesian3.fromDegrees(centerLong, centerLat, 10000),
                  duration: 2.0
                });
              } else {
                props.viewer.flyTo(layer.dataSource);
              }
            }
            break;
        }
      } catch (error) {
        console.error('飞行到图层失败:', error);
      }
    };

    // 移除图层
    const removeLayer = (layer) => {
      const index = layers.value.findIndex(l => l.id === layer.id);
      if (index > -1) {
        layers.value.splice(index, 1);
        emit('remove-layer', layer);
      }
    };

    return {
      layers,
      addLayer,
      toggleLayerVisibility,
      flyToLayer,
      removeLayer,
    };
  },
});
</script>

<style scoped>
.layer-manager-panel {
  position: absolute;
  top: 60px;
  right: 10px;
  z-index: 1000;
  background-color: rgba(248, 249, 250, 0.95);
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  min-width: 250px;
  max-width: 300px;
  max-height: 500px;
  overflow-y: auto;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.panel-header h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.empty-state {
  text-align: center;
  color: #999;
  font-style: italic;
  padding: 20px;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.layer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 6px;
  background-color: white;
}

.layer-info {
  flex: 1;
}

.layer-name {
  font-weight: bold;
  font-size: 14px;
  color: #333;
  margin-bottom: 2px;
}

.layer-type {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
}

.layer-controls {
  display: flex;
  gap: 5px;
}

.layer-controls button {
  padding: 5px 8px;
  border: 1px solid #ddd;
  background-color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.layer-controls button:hover {
  background-color: #f0f0f0;
  transform: scale(1.05);
}

.visibility-btn.visible {
  background-color: #e8f5e8;
  border-color: #28a745;
}

.visibility-btn.hidden {
  background-color: #f8f8f8;
  border-color: #ccc;
}

.fly-btn:hover {
  background-color: #e3f2fd;
  border-color: #2196f3;
}

.remove-btn:hover {
  background-color: #ffebee;
  border-color: #f44336;
}
</style>
