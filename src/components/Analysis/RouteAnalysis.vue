<template>
  <div class="analysis-section">
    <div class="section-title">路径规划</div>
    
    <!-- 起点设置 -->
    <div class="input-group">
      <label>起点:</label>
      <div class="location-input">
        <input type="text" placeholder="经度" v-model="startPoint.lng">
        <input type="text" placeholder="纬度" v-model="startPoint.lat">
        <button @click="useCurrentLocation('start')" class="small-btn">当前位置</button>
        <button @click="useMapClick('start')" :class="['small-btn', pickingMode === 'start' ? 'active' : '']">地图选点</button>
      </div>
    </div>
    
    <!-- 终点设置 -->
    <div class="input-group">
      <label>终点:</label>
      <div class="location-input">
        <input type="text" placeholder="经度" v-model="endPoint.lng">
        <input type="text" placeholder="纬度" v-model="endPoint.lat">
        <button @click="useCurrentLocation('end')" class="small-btn">当前位置</button>
        <button @click="useMapClick('end')" :class="['small-btn', pickingMode === 'end' ? 'active' : '']">地图选点</button>
      </div>
    </div>

    <!-- 交通方式选择 -->
    <div class="input-group">
      <label>交通方式:</label>
      <select v-model="routeType">
        <option value="driving">驾车</option>
        <option value="walking">步行</option>
        <option value="bicycling">骑行</option>
      </select>
    </div>

    <!-- 路线策略选择 -->
    <div class="input-group" v-if="routeType === 'driving'">
      <label>路线策略:</label>
      <select v-model="strategy">
        <option value="0">速度优先</option>
        <option value="1">费用优先</option>
        <option value="2">距离优先</option>
        <option value="3">避开高速</option>
        <option value="4">避开拥堵</option>
        <option value="5">多策略</option>
      </select>
    </div>

    <!-- 路线操作按钮 -->
    <div class="control-buttons">
      <button @click="calculateRoute" class="btn-primary">计算路线</button>
      <button @click="clearRoute" class="btn-secondary">清除路线</button>
    </div>
    
    <!-- 路线信息展示 -->
    <div class="route-info" v-if="routeInfo.distance !== null && routeInfo.distance !== undefined">
      <p><strong>总距离:</strong> {{ (routeInfo.distance / 1000).toFixed(2) }} 公里</p>
      <p><strong>预计时间:</strong> {{ formatDuration(routeInfo.duration) }}</p>
      <p><strong>收费:</strong> {{ routeInfo.tolls ? routeInfo.tolls + '元' : '无' }}</p>
    </div>

    <div class="status-message" v-if="statusMessage">{{ statusMessage }}</div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as Cesium from 'cesium';

export default defineComponent({
  name: 'RouteAnalysis',
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
  setup(props) {
    // 路径规划
    const startPoint = ref({ lng: '', lat: '' });
    const endPoint = ref({ lng: '', lat: '' });
    const routeType = ref('driving');
    const strategy = ref('0');
    const routeInfo = ref({
      distance: null,
      duration: null,
      tolls: null
    });
    const statusMessage = ref('');

    // 高德API密钥
    const amapKey = 'b38b391e7fbaa0cbaf84566f941985ca';
    
    // 路径实体
    let routeEntity = null;
    let startMarker = null;
    let endMarker = null;
    
    // 选点模式
    const pickingMode = ref('');
    let pickHandler = null;

    // 初始化地图点击事件
    const initPickHandler = () => {
      if (pickHandler) {
        pickHandler.destroy();
      }
      
      pickHandler = new Cesium.ScreenSpaceEventHandler(props.viewer.scene.canvas);
      
      pickHandler.setInputAction((click) => {
        if (!pickingMode.value) return;
        
        const cartesian = props.viewer.camera.pickEllipsoid(
          click.position,
          props.viewer.scene.globe.ellipsoid
        );
        
        if (cartesian) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const lng = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
          const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
          
          if (pickingMode.value === 'start') {
            startPoint.value.lng = lng;
            startPoint.value.lat = lat;
            addMarker(startPoint.value, 'start');
          } else if (pickingMode.value === 'end') {
            endPoint.value.lng = lng;
            endPoint.value.lat = lat;
            addMarker(endPoint.value, 'end');
          }
          
          pickingMode.value = '';
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    };

    // 开始地图选点
    const useMapClick = (pointType) => {
      if (pickingMode.value === pointType) {
        pickingMode.value = '';
      } else {
        // 只清除路线路径，不清除标记点
        clearRoutePath();
        
        pickingMode.value = pointType;
        statusMessage.value = `请在地图上点击选择${pointType === 'start' ? '起点' : '终点'}位置`;
      }
    };

    // 使用当前位置
    const useCurrentLocation = (pointType) => {
      // 只清除路线路径，不清除标记点
      clearRoutePath();
      
      const { longitude, latitude } = props.currentLocation;
      
      if (pointType === 'start') {
        startPoint.value.lng = longitude.toFixed(6);
        startPoint.value.lat = latitude.toFixed(6);
        addMarker(startPoint.value, 'start');
      } else {
        endPoint.value.lng = longitude.toFixed(6);
        endPoint.value.lat = latitude.toFixed(6);
        addMarker(endPoint.value, 'end');
      }
    };

    // 添加标记点 - 只删除相同类型的标记
    const addMarker = (point, type) => {
      if (!props.viewer) return;
      
      // 移除相同类型的现有标记（只删除起点或只删除终点）
      if (type === 'start' && startMarker && props.viewer.entities.contains(startMarker)) {
        props.viewer.entities.remove(startMarker);
      } else if (type === 'end' && endMarker && props.viewer.entities.contains(endMarker)) {
        props.viewer.entities.remove(endMarker);
      }
      
      const color = type === 'start' ? Cesium.Color.GREEN : Cesium.Color.RED;
      const markerEntity = props.viewer.entities.add({
        id: `route_marker_${type}_${Date.now()}`, // 添加唯一ID
        name: type, // 添加名称用于识别
        position: Cesium.Cartesian3.fromDegrees(
          parseFloat(point.lng), 
          parseFloat(point.lat), 
          0
        ),
        point: {
          pixelSize: 12,
          color: color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        label: {
          text: type === 'start' ? '起点' : '终点',
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: color,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      });
      
      if (type === 'start') {
        startMarker = markerEntity;
      } else {
        endMarker = markerEntity;
      }
    };

    // 计算路线
    const calculateRoute = async () => {
      if (!startPoint.value.lng || !startPoint.value.lat || !endPoint.value.lng || !endPoint.value.lat) {
        statusMessage.value = '请先设置起点和终点';
        return;
      }
      
      statusMessage.value = '正在计算路线...';
      
      try {
        let apiEndpoint;
        let params;
        
        switch (routeType.value) {
          case 'driving':
            apiEndpoint = 'https://restapi.amap.com/v3/direction/driving';
            params = {
              key: amapKey,
              origin: `${startPoint.value.lng},${startPoint.value.lat}`,
              destination: `${endPoint.value.lng},${endPoint.value.lat}`,
              strategy: strategy.value,
              extensions: 'all'
            };
            break;
            
          case 'walking':
            apiEndpoint = 'https://restapi.amap.com/v3/direction/walking';
            params = {
              key: amapKey,
              origin: `${startPoint.value.lng},${startPoint.value.lat}`,
              destination: `${endPoint.value.lng},${endPoint.value.lat}`
            };
            break;
            
          case 'bicycling':
            apiEndpoint = 'https://restapi.amap.com/v4/direction/bicycling';
            params = {
              key: amapKey,
              origin: `${startPoint.value.lng},${startPoint.value.lat}`,
              destination: `${endPoint.value.lng},${endPoint.value.lat}`
            };
            break;
        }
        
        // 构建URL查询参数
        const queryParams = new URLSearchParams(params).toString();
        const url = `${apiEndpoint}?${queryParams}`;
        
        // 发起API请求
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status !== '1') {
          throw new Error(`路径规划失败: ${data.info}`);
        }
        
        if (routeType.value === 'driving') {
          processRouteResult(data.route);
        } else if (routeType.value === 'walking') {
          processRouteResult(data.route);
        } else if (routeType.value === 'bicycling') {
          processBicyclingResult(data.data);
        }
        
        statusMessage.value = '路径规划成功';
      } catch (error) {
        console.error('路径规划错误:', error);
        statusMessage.value = `路径规划错误: ${error.message}`;
      }
    };
    
    // 处理驾车和步行路线结果
    const processRouteResult = (route) => {
      if (!route || !route.paths || route.paths.length === 0) {
        throw new Error('未找到路线');
      }
      
      const path = route.paths[0]; // 取第一条路线
      let positions = [];
      let distance = 0;
      let duration = 0;
      let tolls = 0;
      
      // 解析路线段
      path.steps.forEach(step => {
        const polyline = decodePolyline(step.polyline);
        positions = positions.concat(polyline);
        distance += parseInt(step.distance) || 0;
        duration += parseInt(step.duration) || 0;
      });
      
      if (routeType.value === 'driving') {
        tolls = parseInt(path.tolls) || 0;
      }
      
      // 更新路线信息
      routeInfo.value = {
        distance,
        duration,
        tolls: tolls > 0 ? tolls / 100 : null // 转换为元
      };
      
      // 显示路线
      drawRouteLine(positions);
    };
    
    // 处理骑行路线结果（API格式不同）
    const processBicyclingResult = (data) => {
      if (!data || !data.paths || data.paths.length === 0) {
        throw new Error('未找到路线');
      }
      
      const path = data.paths[0]; // 取第一条路线
      const polyline = path.polyline.split(';').map(coord => {
        const [lng, lat] = coord.split(',');
        return { lng: parseFloat(lng), lat: parseFloat(lat) };
      });
      
      // 更新路线信息
      routeInfo.value = {
        distance: parseInt(path.distance) || 0,
        duration: parseInt(path.duration) || 0,
        tolls: null
      };
      
      // 显示路线
      drawRouteLine(polyline);
    };
    
    // 解码高德路线编码（坐标串格式为"lng1,lat1;lng2,lat2..."）
    const decodePolyline = (polyline) => {
      if (!polyline) return [];
      
      return polyline.split(';').map(point => {
        const [lng, lat] = point.split(',');
        return {
          lng: parseFloat(lng),
          lat: parseFloat(lat)
        };
      });
    };
    
    // 在Cesium地图上绘制路线
    const drawRouteLine = (positions) => {
      if (!props.viewer) return;
      
      // 首先清除已有路线但保留标记点
      if (routeEntity && props.viewer.entities.contains(routeEntity)) {
        props.viewer.entities.remove(routeEntity);
        routeEntity = null;
      }
      
      // 确保起止点标记存在
      addMarker(startPoint.value, 'start');
      addMarker(endPoint.value, 'end');
      
      // 转换坐标点为Cesium格式
      const cesiumPositions = [];
      positions.forEach(pos => {
        cesiumPositions.push(
          Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat)
        );
      });
      
      // 添加路线实体
      routeEntity = props.viewer.entities.add({
        id: `route_path_${Date.now()}`, // 添加唯一ID
        name: 'route', // 添加名称用于识别
        polyline: {
          positions: cesiumPositions,
          width: 6,
          material: new Cesium.PolylineDashMaterialProperty({
            color: routeType.value === 'driving' 
              ? Cesium.Color.BLUE.withAlpha(0.7)
              : routeType.value === 'walking'
                ? Cesium.Color.GREEN.withAlpha(0.7) 
                : Cesium.Color.ORANGE.withAlpha(0.7),
            dashLength: 16.0
          }),
          clampToGround: true
        }
      });
      
      // 缩放到路线范围
      props.viewer.flyTo(routeEntity, {
        duration: 2
      });
    };
    
    // 新增函数：只清除路线路径，不清除标记点
    const clearRoutePath = () => {
      if (props.viewer) {
        try {
          // 只删除路线实体，保留标记点
          if (routeEntity) {
            const routeId = routeEntity.id;
            if (props.viewer.entities.getById(routeId)) {
              props.viewer.entities.removeById(routeId);
            }
            routeEntity = null;
          }
          
          // 删除任何可能的路线相关实体（但不包括标记点）
          const entitiesToRemove = [];
          props.viewer.entities.values.forEach(entity => {
            if (entity.polyline && entity._name === 'route') {
              entitiesToRemove.push(entity);
            }
          });
          
          entitiesToRemove.forEach(entity => {
            try {
              props.viewer.entities.remove(entity);
            } catch (error) {
              console.error('移除实体失败:', error);
            }
          });
          
          props.viewer.scene.requestRender();
        } catch (error) {
          console.error('清除路线路径时发生错误:', error);
        }
      }
      
      // 重置路线信息
      routeInfo.value = {
        distance: null,
        duration: null,
        tolls: null
      };
    };

    // 清除路线
    const clearRoute = () => {
      if (props.viewer) {
        try {
          // 直接从 viewer 中删除实体（通过 ID 方式查找）
          if (routeEntity) {
            const routeId = routeEntity.id;
            if (props.viewer.entities.getById(routeId)) {
              props.viewer.entities.removeById(routeId);
            }
            routeEntity = null;
          }
          
          // 删除起点标记
          if (startMarker) {
            const startId = startMarker.id;
            if (props.viewer.entities.getById(startId)) {
              props.viewer.entities.removeById(startId);
            }
            startMarker = null;
          }
          
          // 删除终点标记
          if (endMarker) {
            const endId = endMarker.id;
            if (props.viewer.entities.getById(endId)) {
              props.viewer.entities.removeById(endId);
            }
            endMarker = null;
          }
          
          // 删除任何可能的路线相关实体（防御性清理）
          const entitiesToRemove = [];
          props.viewer.entities.values.forEach(entity => {
            if ((entity.polyline && entity._name === 'route') || 
                (entity.point && (entity._name === 'start' || entity._name === 'end'))) {
              entitiesToRemove.push(entity);
            }
          });
          
          entitiesToRemove.forEach(entity => {
            try {
              props.viewer.entities.remove(entity);
            } catch (error) {
              console.error('移除实体失败:', error);
            }
          });
          
          // 强制刷新 Cesium 视图
          props.viewer.scene.requestRender();
          
        } catch (error) {
          console.error('清除路线时发生错误:', error);
        }
      }
      
      // 重置路线信息
      routeInfo.value = {
        distance: null,
        duration: null,
        tolls: null
      };
      
      statusMessage.value = '';
      
      console.log('路线已清除');
    };
    
    // 格式化持续时间（秒转为时分秒格式）
    const formatDuration = (seconds) => {
      if (!seconds) return '';
      
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;
      
      let result = '';
      if (hours > 0) result += `${hours}小时`;
      if (minutes > 0) result += `${minutes}分钟`;
      if (remainingSeconds > 0 && hours === 0) result += `${remainingSeconds}秒`;
      
      return result;
    };

    onMounted(() => {
      if (props.viewer) {
        initPickHandler();
      }
    });

    onBeforeUnmount(() => {
      if (pickHandler && !pickHandler.isDestroyed()) {
        pickHandler.destroy();
        pickHandler = null;
      }
      
      clearRoute();
    });

    watch(() => props.viewer, (newViewer) => {
      if (newViewer) {
        initPickHandler();
      }
    });

    // 添加路线类型变化监听器
    watch(routeType, () => {
      // 在切换路线类型时清除已有路线
      clearRoute();
    });

    // 添加策略变化监听器
    watch(strategy, () => {
      // 在切换驾车策略时清除已有路线
      if (routeEntity) {
        clearRoute();
      }
    });

    // 监听起点和终点的变化
    watch([() => startPoint.value.lng, () => startPoint.value.lat], () => {
      // 在起点变化后清除已有路线，但保留标记点
      if (routeEntity && props.viewer && props.viewer.entities.contains(routeEntity)) {
        props.viewer.entities.remove(routeEntity);
        routeEntity = null;
        
        // 重置路线信息
        routeInfo.value = {
          distance: null,
          duration: null,
          tolls: null
        };
      }
    });

    watch([() => endPoint.value.lng, () => endPoint.value.lat], () => {
      // 在终点变化后清除已有路线，但保留标记点
      if (routeEntity && props.viewer && props.viewer.entities.contains(routeEntity)) {
        props.viewer.entities.remove(routeEntity);
        routeEntity = null;
        
        // 重置路线信息
        routeInfo.value = {
          distance: null,
          duration: null,
          tolls: null
        };
      }
    });

    return {
      startPoint,
      endPoint,
      routeType,
      strategy,
      routeInfo,
      statusMessage,
      pickingMode,
      useMapClick,
      useCurrentLocation,
      calculateRoute,
      clearRoute,
      formatDuration
    };
  }
});
</script>

<style scoped>
.analysis-section {
  margin-bottom: 10px;
}

.section-title {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 12px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 4px;
}

.input-group {
  margin-bottom: 12px;
}

.input-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: bold;
}

.input-group input, .input-group select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}

.location-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.location-input input {
  flex: 1;
  min-width: 70px;
}

.small-btn {
  padding: 3px 8px;
  font-size: 12px;
  flex-basis: calc(50% - 3px);
}

.small-btn.active {
  background-color: #4285f4;
  color: white;
}

.control-buttons {
  display: flex;
  gap: 8px;
  margin: 15px 0;
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

.route-info {
  background-color: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 10px;
  margin-top: 10px;
  font-size: 13px;
}

.route-info p {
  margin: 5px 0;
}

.status-message {
  margin-top: 10px;
  padding: 6px;
  font-size: 12px;
  color: #666;
  text-align: center;
  font-style: italic;
}
</style>
