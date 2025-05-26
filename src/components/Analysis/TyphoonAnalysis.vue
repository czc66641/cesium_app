<template>
  <div class="typhoon-analysis">
    <div class="control-section">
      <h3>台风路径分析</h3>
      
      <div class="input-group">
        <button @click="loadTyphoonData" :disabled="isLoading" class="btn-primary full-width-btn">
          {{ isLoading ? '加载中...' : '加载台风数据' }}
        </button>
      </div>

      <div v-if="typhoonLoaded" class="animation-controls">
        <h4>动画控制</h4>
        
        <div class="control-row">
          <label>显示选项:</label>
          <div class="checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="showPath" @change="togglePathDisplay"> 
              显示路径
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="showWarningLines" @change="toggleWarningLines"> 
              显示警戒线
            </label>
          </div>
        </div>

        <div class="control-row">
          <button @click="startAutoPlay" :disabled="isPlaying" class="btn-primary">
            开始动画
          </button>
          <button @click="pauseAnimation" :disabled="!isPlaying" class="btn-secondary">
            暂停
          </button>
          <button @click="stopAnimation" class="btn-secondary">
            停止
          </button>
        </div>

        <div class="control-row">
          <label>动画速度: {{ animationSpeed }}x</label>
          <input 
            type="range" 
            min="0.5" 
            max="5" 
            step="0.5" 
            v-model="animationSpeed"
            @input="updateAnimationSpeed"
            class="speed-slider"
          />
        </div>

        <div class="control-row">
          <label>时间进度: {{ currentTimeIndex + 1 }} / {{ typhoonData ? typhoonData.length : 0 }}</label>
          <input 
            type="range" 
            :min="0" 
            :max="typhoonData ? typhoonData.length - 1 : 0" 
            v-model="currentTimeIndex"
            @input="seekToTime"
            class="time-slider"
          />
        </div>

        <div v-if="currentPoint" class="current-info">
          <h5>当前状态</h5>
          <p><strong>时间:</strong> {{ currentPoint.time }}</p>
          <p><strong>位置:</strong> {{ currentPoint.lng }}, {{ currentPoint.lat }}</p>
          <p><strong>强度:</strong> <span :class="getStrengthClass(currentPoint.strong)">{{ currentPoint.strong }}</span></p>
          <p v-if="currentPoint.speed"><strong>移动速度:</strong> {{ currentPoint.speed }} km/h</p>
          <p v-if="currentPoint.pressure"><strong>中心气压:</strong> {{ currentPoint.pressure }} hPa</p>
        </div>
      </div>

      <button @click="clearTyphoon" class="btn-danger full-width">
        清除台风数据
      </button>
    </div>

    <div v-if="statusMessage" class="status-message">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';

export default defineComponent({
  name: 'TyphoonAnalysis',
  props: {
    viewer: {
      type: Object,
      required: true
    },
    currentLocation: {
      type: Object,
      required: true
    },
    preserveDataOnClose: {
      type: Boolean,
      default: false
    },
    keepDataOnPanelClose: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    // 状态变量
    const isLoading = ref(false);
    const typhoonLoaded = ref(false);
    const typhoonData = ref(null);
    const statusMessage = ref('');
    
    // 显示控制
    const showPath = ref(true);
    const showWarningLines = ref(true);
    
    // 动画控制
    const isPlaying = ref(false);
    const animationSpeed = ref(1);
    const currentTimeIndex = ref(0);
    
    // 实体管理
    const typhoonEntities = ref({
      dataSource: null,
      pathEntity: null,
      warningLines: [],
      currentMarker: null
    });
    
    let currentMarkerEntity = null;
    let animationTimer = null;
    
    // 当前点信息
    const currentPoint = computed(() => {
      if (!typhoonData.value || !Array.isArray(typhoonData.value)) return null;
      return typhoonData.value[currentTimeIndex.value];
    });

    // 加载台风数据 - 修改为读取正确的文件路径
    const loadTyphoonData = async () => {
      if (!props.viewer) {
        statusMessage.value = 'Viewer未初始化';
        return;
      }

      try {
        isLoading.value = true;
        statusMessage.value = '正在加载台风数据...';
        
        // 清除现有数据
        clearTyphoon();
        
        // 读取typhoon.json文件
        const response = await fetch('/typhoon.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('原始台风数据:', data);
        
        // 处理数据格式 - 根据实际数据结构调整
        if (data && data.points && Array.isArray(data.points)) {
          typhoonData.value = data.points;
        } else if (Array.isArray(data)) {
          typhoonData.value = data;
        } else {
          throw new Error('无法识别的数据格式');
        }
        
        console.log('台风数据加载成功:', typhoonData.value.length, '个数据点');
        
        // 初始化台风可视化
        await initializeTyphoonVisualization();
        
        typhoonLoaded.value = true;
        statusMessage.value = `台风数据加载成功，共${typhoonData.value.length}个数据点`;
        
        setTimeout(() => {
          statusMessage.value = '';
        }, 3000);
        
      } catch (error) {
        console.error('加载台风数据失败:', error);
        statusMessage.value = `加载失败: ${error.message}`;
        
        // 使用示例数据作为备选
        console.log('使用示例数据');
        typhoonData.value = getExampleTyphoonData();
        
        try {
          await initializeTyphoonVisualization();
          typhoonLoaded.value = true;
          statusMessage.value = '使用示例台风数据';
        } catch (initError) {
          console.error('初始化示例数据失败:', initError);
          statusMessage.value = '初始化失败';
        }
      } finally {
        isLoading.value = false;
      }
    };

    // 获取示例台风数据 - 基于第一个文件的数据结构
    const getExampleTyphoonData = () => {
      return [
        { time: '2023-07-01 00:00', lng: 125.5, lat: 15.2, strong: '热带低压', pressure: 1008, speed: 15, name: '台风示例' },
        { time: '2023-07-01 06:00', lng: 126.1, lat: 16.8, strong: '热带风暴', pressure: 1002, speed: 18, name: '台风示例' },
        { time: '2023-07-01 12:00', lng: 126.8, lat: 18.5, strong: '强热带风暴', pressure: 995, speed: 22, name: '台风示例' },
        { time: '2023-07-01 18:00', lng: 127.2, lat: 20.1, strong: '台风', pressure: 985, speed: 25, name: '台风示例' },
        { time: '2023-07-02 00:00', lng: 127.8, lat: 21.8, strong: '强台风', pressure: 975, speed: 28, name: '台风示例' },
        { time: '2023-07-02 06:00', lng: 128.1, lat: 23.2, strong: '超强台风', pressure: 960, speed: 32, name: '台风示例' },
        { time: '2023-07-02 12:00', lng: 128.5, lat: 24.8, strong: '超强台风', pressure: 955, speed: 35, name: '台风示例' },
        { time: '2023-07-02 18:00', lng: 128.8, lat: 26.5, strong: '台风', pressure: 970, speed: 30, name: '台风示例' },
        { time: '2023-07-03 00:00', lng: 129.2, lat: 28.1, strong: '强热带风暴', pressure: 980, speed: 25, name: '台风示例' },
        { time: '2023-07-03 06:00', lng: 129.5, lat: 29.8, strong: '热带风暴', pressure: 990, speed: 20, name: '台风示例' }
      ];
    };

    // 初始化台风可视化
    const initializeTyphoonVisualization = async () => {
      if (!props.viewer || !typhoonData.value) {
        throw new Error('Viewer或台风数据未初始化');
      }
      
      try {
        // 创建数据源
        typhoonEntities.value.dataSource = new Cesium.CustomDataSource('typhoon');
        props.viewer.dataSources.add(typhoonEntities.value.dataSource);
        
        // 创建警戒线
        if (showWarningLines.value) {
          createWarningLines();
        }
        
        // 创建台风路径
        if (showPath.value) {
          createTyphoonPath();
        }
        
        // 创建当前位置标记
        if (typhoonData.value && typhoonData.value.length > 0) {
          createCurrentMarker(typhoonData.value[0]);
        }
        
        // 飞行到台风区域
        flyToTyphoonArea();
        
      } catch (error) {
        console.error('初始化台风可视化失败:', error);
        throw error;
      }
    };

    // 创建警戒线
    const createWarningLines = () => {
      try {
        // 24小时警戒线
        const line24 = typhoonEntities.value.dataSource.entities.add({
          id: 'warning_line_24',
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
              127, 34, 127, 22, 119, 18, 119, 11, 113, 4.5, 105, 0
            ]),
            width: 3,
            material: Cesium.Color.RED,
            clampToGround: true
          },
          label: {
            text: '24小时警戒线',
            font: '14pt sans-serif',
            fillColor: Cesium.Color.RED,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -30),
            position: Cesium.Cartesian3.fromDegrees(126, 29)
          }
        });

        // 48小时警戒线
        const line48 = typhoonEntities.value.dataSource.entities.add({
          id: 'warning_line_48',
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray([
              132, 34, 132, 22, 119, 0, 105, 0
            ]),
            width: 3,
            material: Cesium.Color.YELLOW,
            clampToGround: true
          },
          label: {
            text: '48小时警戒线',
            font: '14pt sans-serif',
            fillColor: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -30),
            position: Cesium.Cartesian3.fromDegrees(132, 20)
          }
        });

        typhoonEntities.value.warningLines = [line24, line48];
      } catch (error) {
        console.error('创建警戒线失败:', error);
      }
    };

    // 创建台风路径
    const createTyphoonPath = () => {
      try {
        const positions = [];
        
        typhoonData.value.forEach(point => {
          const lng = parseFloat(point.lng);
          const lat = parseFloat(point.lat);
          
          if (!isNaN(lng) && !isNaN(lat)) {
            positions.push(lng, lat);
            
            // 为每个点添加标记
            const color = getTyphoonColor(point.strong);
            typhoonEntities.value.dataSource.entities.add({
              position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
              point: {
                pixelSize: 6,
                color: color,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
              }
            });
          }
        });

        // 创建路径线
        if (positions.length > 0) {
          typhoonEntities.value.pathEntity = typhoonEntities.value.dataSource.entities.add({
            id: 'typhoon_path',
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(positions),
              width: 4,
              material: Cesium.Color.RED.withAlpha(0.8),
              clampToGround: true
            }
          });
        }
      } catch (error) {
        console.error('创建台风路径失败:', error);
      }
    };

    // 创建当前位置标记 - 使用台风模型
    const createCurrentMarker = (point) => {
      try {
        if (!props.viewer || !point) return;
        
        const lng = parseFloat(point.lng);
        const lat = parseFloat(point.lat);
        
        if (isNaN(lng) || isNaN(lat)) return;
        
        // 移除现有标记
        if (currentMarkerEntity) {
          try {
            typhoonEntities.value.dataSource.entities.remove(currentMarkerEntity);
          } catch (e) {
            console.warn('移除当前标记失败:', e);
          }
        }
        
        // 使用台风模型文件
        currentMarkerEntity = typhoonEntities.value.dataSource.entities.add({
          id: `current_marker_${Date.now()}`,
          position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
          model: {
            uri: '/data/harricane_typhoon_weather_map.glb',
            scale: getScaleByStrength(point.strong),
            minimumPixelSize: 100,
            maximumScale: 100000,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            runAnimations: true,
            silhouetteColor: Cesium.Color.YELLOW,
            silhouetteSize: 2.0
          },
          label: {
            text: `${point.name || '台风'}\n${point.strong}\n${point.time}`,
            font: '14px sans-serif',
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -80),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
            backgroundPadding: new Cesium.Cartesian2(10, 5),
            showBackground: true
          }
        });

        // 添加简单的台风眼效果
        if (window.typhoonVisualEnhancer) {
          const position = Cesium.Cartesian3.fromDegrees(lng, lat, 0);
          window.typhoonVisualEnhancer.createTyphoonEye(props.viewer, position, getStrengthLevel(point.strong));
        }
      } catch (error) {
        console.error('创建当前台风标记失败:', error);
      }
    };

    // 根据台风强度获取模型缩放
    const getScaleByStrength = (strength) => {
      switch (strength) {
        case '热带低压': return 5000.0;
        case '热带风暴': return 8000.0;
        case '强热带风暴': return 12000.0;
        case '台风': return 15000.0;
        case '强台风': return 20000.0;
        case '超强台风': return 25000.0;
        default: return 10000.0;
      }
    };

    // 获取台风颜色
    const getTyphoonColor = (strength) => {
      switch (strength) {
        case '热带低压': return Cesium.Color.GREEN;
        case '热带风暴': return Cesium.Color.BLUE;
        case '强热带风暴': return Cesium.Color.YELLOW;
        case '台风': return Cesium.Color.fromCssColorString('#FBC712');
        case '强台风': return Cesium.Color.PLUM;
        case '超强台风': return Cesium.Color.RED;
        default: return Cesium.Color.WHITE;
      }
    };

    // 创建台风图标
    const createTyphoonIcon = (strength) => {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext('2d');
      
      // 获取颜色
      const color = getTyphoonColor(strength);
      ctx.fillStyle = color.toCssColorString();
      
      // 绘制螺旋形状
      ctx.beginPath();
      ctx.arc(24, 24, 20, 0, 2 * Math.PI);
      ctx.fill();
      
      // 添加中心眼
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(24, 24, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      return canvas.toDataURL();
    };

    // 获取强度等级
    const getStrengthLevel = (strength) => {
      const levels = {
        '热带低压': 1,
        '热带风暴': 2,
        '强热带风暴': 3,
        '台风': 4,
        '强台风': 5,
        '超强台风': 6
      };
      return levels[strength] || 1;
    };

    // 获取强度样式类
    const getStrengthClass = (strength) => {
      return `strength-${getStrengthLevel(strength)}`;
    };

    // 飞行到台风区域
    const flyToTyphoonArea = () => {
      if (!props.viewer || !typhoonData.value.length) return;
      
      // 计算台风路径的中心点
      let sumLng = 0, sumLat = 0, count = 0;
      
      typhoonData.value.forEach(point => {
        const lng = parseFloat(point.lng);
        const lat = parseFloat(point.lat);
        if (!isNaN(lng) && !isNaN(lat)) {
          sumLng += lng;
          sumLat += lat;
          count++;
        }
      });
      
      if (count > 0) {
        const centerLng = sumLng / count;
        const centerLat = sumLat / count;
        
        props.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, 2000000),
          duration: 2.0
        });
      }
    };

    // 动画控制函数
    const startAutoPlay = () => {
      if (isPlaying.value || !typhoonData.value) return;
      
      isPlaying.value = true;
      
      const animate = () => {
        if (!isPlaying.value) return;
        
        if (currentTimeIndex.value >= typhoonData.value.length - 1) {
          currentTimeIndex.value = 0;
        } else {
          currentTimeIndex.value++;
        }
        
        updateCurrentMarker();
        
        const interval = 1000 / animationSpeed.value;
        animationTimer = setTimeout(animate, interval);
      };
      
      animate();
    };

    const pauseAnimation = () => {
      isPlaying.value = false;
      if (animationTimer) {
        clearTimeout(animationTimer);
        animationTimer = null;
      }
    };

    const stopAnimation = () => {
      pauseAnimation();
      currentTimeIndex.value = 0;
      updateCurrentMarker();
    };

    const updateAnimationSpeed = () => {
      if (isPlaying.value) {
        pauseAnimation();
        startAutoPlay();
      }
    };

    const seekToTime = () => {
      updateCurrentMarker();
    };

    const updateCurrentMarker = () => {
      if (currentPoint.value) {
        createCurrentMarker(currentPoint.value);
      }
    };

    const togglePathDisplay = () => {
      if (!typhoonEntities.value.dataSource) return;
      
      if (showPath.value) {
        createTyphoonPath();
      } else if (typhoonEntities.value.pathEntity) {
        typhoonEntities.value.dataSource.entities.remove(typhoonEntities.value.pathEntity);
        typhoonEntities.value.pathEntity = null;
      }
    };

    const toggleWarningLines = () => {
      if (!typhoonEntities.value.dataSource) return;
      
      if (showWarningLines.value) {
        createWarningLines();
      } else {
        typhoonEntities.value.warningLines.forEach(line => {
          typhoonEntities.value.dataSource.entities.remove(line);
        });
        typhoonEntities.value.warningLines = [];
      }
    };

    // 修改清除台风函数
    const clearTyphoon = (forceClean = false) => {
      // 如果设置了保留数据且不是强制清除，则不清除
      if (props.keepDataOnPanelClose && !forceClean) {
        console.log('保留台风数据和显示效果');
        return;
      }
      
      try {
        // 停止动画
        pauseAnimation();
        
        // 移除数据源
        if (typhoonEntities.value.dataSource && props.viewer) {
          props.viewer.dataSources.remove(typhoonEntities.value.dataSource);
        }
        
        // 重置状态
        typhoonEntities.value = {
          dataSource: null,
          pathEntity: null,
          warningLines: [],
          currentMarker: null
        };
        
        currentMarkerEntity = null;
        typhoonLoaded.value = false;
        typhoonData.value = null;
        
        statusMessage.value = '台风数据已清除';
        setTimeout(() => {
          if (statusMessage.value === '台风数据已清除') {
            statusMessage.value = '';
          }
        }, 2000);
      } catch (error) {
        console.error('清除台风数据失败:', error);
      }
    };

    // 组件卸载时清理
    onBeforeUnmount(() => {
      // 只有在不保留数据时才清除
      if (!props.preserveDataOnClose && !props.keepDataOnPanelClose) {
        clearTyphoon(true);
      }
    });

    return {
      isLoading,
      typhoonLoaded,
      typhoonData,
      statusMessage,
      showPath,
      showWarningLines,
      isPlaying,
      animationSpeed,
      currentTimeIndex,
      currentPoint,
      loadTyphoonData,
      startAutoPlay,
      pauseAnimation,
      stopAnimation,
      updateAnimationSpeed,
      seekToTime,
      togglePathDisplay,
      toggleWarningLines,
      clearTyphoon,
      getStrengthClass
    };
  }
});
</script>

<style scoped>
.typhoon-analysis {
  padding: 20px;
}

.control-section h3 {
  margin-bottom: 20px;
  color: #333;
  border-bottom: 2px solid #007bff;
  padding-bottom: 8px;
}

.input-group {
  margin-bottom: 20px;
}

.btn-primary, .btn-secondary, .btn-danger {
  padding: 10px 15px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
  margin-right: 10px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-primary:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.full-width-btn {
  width: 100%;
}

.control-row {
  margin-bottom: 15px;
}

.checkbox-group {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-slider, .time-slider {
  width: 100%;
  margin-top: 8px;
}

.current-info {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 5px;
  padding: 15px;
  margin-top: 15px;
}

.strength-1 { color: #28a745; }
.strength-2 { color: #007bff; }
.strength-3 { color: #ffc107; }
.strength-4 { color: #fd7e14; }
.strength-5 { color: #e83e8c; }
.strength-6 { color: #dc3545; }

.status-message {
  margin-top: 15px;
  padding: 10px;
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 5px;
  color: #155724;
  text-align: center;
}
</style>
