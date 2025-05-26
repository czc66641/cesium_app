<template>
  <div class="satellite-analysis">
    <div class="section-title">
      <i class="fas fa-satellite"></i>
      卫星轨道分析
    </div>
    
    <!-- 控制面板 -->
    <div class="control-section">
      <h4>卫星数据控制</h4>
      <div class="control-buttons">
        <button 
          @click="loadSatelliteData" 
          :disabled="isLoading"
          class="btn-primary"
        >
          <i class="fas fa-download"></i>
          {{ isLoading ? '加载中...' : '加载卫星轨道' }}
        </button>
        <button 
          @click="clearSatellites" 
          :disabled="!satelliteLoaded"
          class="btn-danger"
        >
          <i class="fas fa-trash"></i>
          清除轨道
        </button>
      </div>
    </div>
    
    <!-- 卫星显示控制 -->
    <div class="control-section" v-if="satelliteLoaded">
      <h4>显示控制</h4>
      <div class="control-group">
        <label class="control-option">
          <input type="checkbox" v-model="showOptions.satellites" @change="toggleSatellites">
          <span>显示卫星</span>
        </label>
        <label class="control-option">
          <input type="checkbox" v-model="showOptions.orbits" @change="toggleOrbits">
          <span>显示轨道</span>
        </label>
        <label class="control-option">
          <input type="checkbox" v-model="showOptions.labels" @change="toggleLabels">
          <span>显示标签</span>
        </label>
        <label class="control-option">
          <input type="checkbox" v-model="showOptions.animation" @change="toggleAnimation">
          <span>轨道动画</span>
        </label>
      </div>
    </div>
    
    <!-- 时间控制 -->
    <div class="control-section" v-if="satelliteLoaded">
      <h4>时间控制</h4>
      <div class="time-controls">
        <button @click="playAnimation" :disabled="!showOptions.animation" class="btn-control">
          <i class="fas fa-play"></i>
          播放
        </button>
        <button @click="pauseAnimation" :disabled="!showOptions.animation" class="btn-control">
          <i class="fas fa-pause"></i>
          暂停
        </button>
        <button @click="resetTime" class="btn-control">
          <i class="fas fa-undo"></i>
          重置时间
        </button>
      </div>
      
      <div class="speed-control">
        <label>播放速度: {{ animationSpeed }}x</label>
        <input 
          type="range" 
          min="0.1" 
          max="10" 
          step="0.1" 
          v-model.number="animationSpeed" 
          @input="updateAnimationSpeed"
          class="speed-slider"
        />
      </div>
    </div>
    
    <!-- 卫星信息 -->
    <div class="satellite-info" v-if="satelliteLoaded && selectedSatellite">
      <h4>卫星信息</h4>
      <div class="info-content">
        <p><strong>名称:</strong> {{ selectedSatellite.name }}</p>
        <p><strong>ID:</strong> {{ selectedSatellite.id }}</p>
        <p v-if="selectedSatellite.description">
          <strong>描述:</strong> {{ selectedSatellite.description }}
        </p>
        <p v-if="selectedSatellite.availability">
          <strong>可见时间:</strong> {{ formatTimeRange(selectedSatellite.availability) }}
        </p>
      </div>
    </div>
    
    <!-- 统计信息 -->
    <div class="statistics" v-if="satelliteLoaded">
      <h4>统计信息</h4>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">卫星数量</span>
          <span class="stat-value">{{ satelliteCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">轨道类型</span>
          <span class="stat-value">{{ orbitTypes.join(', ') }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">数据来源</span>
          <span class="stat-value">CZML</span>
        </div>
      </div>
    </div>
    
    <!-- 状态信息 -->
    <div class="status-info" v-if="statusMessage">
      <div :class="['status-message', statusType]">
        <i :class="statusIcon"></i>
        {{ statusMessage }}
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, reactive, computed, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';

export default defineComponent({
  name: 'SatelliteAnalysis',
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
      default: true
    }
  },
  setup(props) {
    // 基础状态
    const isLoading = ref(false);
    const satelliteLoaded = ref(false);
    const statusMessage = ref('');
    const statusType = ref('info');
    const animationSpeed = ref(1);
    
    // 显示选项
    const showOptions = reactive({
      satellites: true,
      orbits: true,
      labels: true,
      animation: true
    });
    
    // 卫星数据
    let satelliteDataSource = null;
    let originalClockSettings = null;
    const selectedSatellite = ref(null);
    const satelliteCount = ref(0);
    const orbitTypes = ref(['LEO', 'GEO', 'MEO']); // 低轨、地球同步轨道、中轨
    
    // 状态图标
    const statusIcon = computed(() => {
      switch (statusType.value) {
        case 'success': return 'fas fa-check-circle';
        case 'error': return 'fas fa-exclamation-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        default: return 'fas fa-info-circle';
      }
    });
    
    // 设置状态信息
    const setStatus = (message, type = 'info', duration = 3000) => {
      statusMessage.value = message;
      statusType.value = type;
      
      if (duration > 0) {
        setTimeout(() => {
          if (statusMessage.value === message) {
            statusMessage.value = '';
          }
        }, duration);
      }
    };
    
    // 加载卫星数据
    const loadSatelliteData = async () => {
      if (!props.viewer) {
        setStatus('Viewer未初始化', 'error');
        return;
      }
      
      isLoading.value = true;
      setStatus('正在加载卫星轨道数据...', 'info', 0);
      
      try {
        // 保存原始时钟设置
        if (!originalClockSettings) {
          originalClockSettings = {
            shouldAnimate: props.viewer.clock.shouldAnimate,
            multiplier: props.viewer.clock.multiplier,
            startTime: props.viewer.clock.startTime.clone(),
            stopTime: props.viewer.clock.stopTime.clone(),
            currentTime: props.viewer.clock.currentTime.clone()
          };
        }
        
        // 尝试多个可能的路径加载CZML数据
        let dataSource = null;
        const possiblePaths = [
          '/wx.czml',
          './wx.czml',
          'wx.czml'
        ];
        
        for (const path of possiblePaths) {
          try {
            console.log(`尝试加载卫星数据: ${path}`);
            dataSource = await Cesium.CzmlDataSource.load(path);
            console.log(`卫星数据加载成功: ${path}`);
            break;
          } catch (err) {
            console.warn(`无法从 ${path} 加载数据:`, err.message);
          }
        }
        
        // 如果所有路径都失败，创建示例卫星数据
        if (!dataSource) {
          console.warn('无法加载卫星数据文件，使用示例数据');
          dataSource = createExampleSatelliteData();
        }
        
        // 清除现有的卫星数据
        if (satelliteDataSource) {
          props.viewer.dataSources.remove(satelliteDataSource);
        }
        
        // 添加新的数据源
        satelliteDataSource = dataSource;
        props.viewer.dataSources.add(satelliteDataSource);
        
        // 统计卫星数量
        satelliteCount.value = satelliteDataSource.entities.values.filter(entity => 
          entity.model || entity.billboard || entity.point
        ).length;
        
        // 设置时间和动画
        if (showOptions.animation) {
          props.viewer.clock.shouldAnimate = true;
          props.viewer.clock.multiplier = animationSpeed.value;
        }
        
        // 飞行到卫星轨道视图
        await flyToSatellites();
        
        // 设置点击事件
        setupSatelliteClickHandler();
        
        satelliteLoaded.value = true;
        setStatus('卫星轨道数据加载完成', 'success');
        
      } catch (error) {
        console.error('加载卫星数据失败:', error);
        setStatus(`加载失败: ${error.message}`, 'error');
      } finally {
        isLoading.value = false;
      }
    };
    
    // 创建示例卫星数据
    const createExampleSatelliteData = () => {
      console.log('创建示例卫星轨道数据...');
      
      const dataSource = new Cesium.CzmlDataSource();
      
      // 创建CZML文档
      const czmlData = [
        {
          "id": "document",
          "name": "示例卫星轨道",
          "version": "1.0",
          "clock": {
            "interval": "2024-01-01T00:00:00Z/2024-01-02T00:00:00Z",
            "currentTime": "2024-01-01T00:00:00Z",
            "multiplier": 60
          }
        }
      ];
      
      // 创建几个示例卫星
      const satellites = [
        {
          name: "示例卫星-1",
          altitude: 400000, // 400km
          inclination: 51.6, // ISS轨道倾角
          color: Cesium.Color.CYAN
        },
        {
          name: "示例卫星-2", 
          altitude: 35786000, // 地球同步轨道
          inclination: 0,
          color: Cesium.Color.YELLOW
        },
        {
          name: "示例卫星-3",
          altitude: 20200000, // GPS轨道
          inclination: 55,
          color: Cesium.Color.LIME
        }
      ];
      
      satellites.forEach((sat, index) => {
        const startTime = new Date('2024-01-01T00:00:00Z');
        const endTime = new Date('2024-01-02T00:00:00Z');
        
        // 计算轨道周期
        const earthRadius = 6371000;
        const mu = 3.986004418e14; // 地球引力常数
        const orbitalRadius = earthRadius + sat.altitude;
        const period = 2 * Math.PI * Math.sqrt(Math.pow(orbitalRadius, 3) / mu);
        
        // 生成轨道位置
        const positions = [];
        const timeSteps = 100;
        for (let i = 0; i <= timeSteps; i++) {
          const time = startTime.getTime() + (endTime.getTime() - startTime.getTime()) * (i / timeSteps);
          const timeString = new Date(time).toISOString();
          
          // 简化的轨道计算
          const angle = (time - startTime.getTime()) / 1000 * (2 * Math.PI / period);
          const longitude = (angle * 180 / Math.PI) % 360 - 180;
          const latitude = Math.sin(sat.inclination * Math.PI / 180) * Math.sin(angle) * 90;
          
          positions.push(timeString, longitude, latitude, sat.altitude);
        }
        
        const satelliteData = {
          "id": `satellite-${index + 1}`,
          "name": sat.name,
          "description": `示例卫星轨道 - 高度: ${(sat.altitude / 1000).toFixed(0)}km`,
          "availability": "2024-01-01T00:00:00Z/2024-01-02T00:00:00Z",
          "position": {
            "interpolationAlgorithm": "LAGRANGE",
            "interpolationDegree": 5,
            "referenceFrame": "INERTIAL",
            "epoch": "2024-01-01T00:00:00Z",
            "cartographicDegrees": positions
          },
          "billboard": {
            "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVDiNpZNrSFNhGMafM2fOdmwzd2m6kTNn5gqzKNdyKRctSQu8LMXM3LhThghtIepX5Ad/RBaUfdCKuliEXc2rlgOz1SZSGrTMK7pOa846ncuZ5bbTB1tldkH9P7zw/l7e92Ee4D8Xu3ZNf6PBG2coDmOXJVLqVPYJAEk6zSyqfT7I+wqhb6zqKGcR7TZ3IEHkRG5+NgCnhOwqXNKdYVCfT5KAr8xHbT8bNvQP1Z5X56zY9r43MUgcwGUYjWGCWBGbsLMAkWg/8vKyUFd7l8o8nwC3exaZO+dgwDBNj5OhfwrpinMBANPEhbBhfGXrj24TNB0SqGPwV3yfNuvVeQ64k6+GZNkJdQlw4NzRwM8rMPgshSXCY3wAo4eKIaUcVFzd8L54grGhU5ibaX/daTGZI5E7gOkpC7CbJ7gVDNpgFNPUj3s8SdYpEGOYJm7Qu13Ew7QnKN6twOOqLqgbK5BYlQZ7bBHe6zfD5XxvqWMX0pF7gAGMnS1QzU/zDKP4FWdJMrZ+cMw1Fv7HNO1OQNA+D9EkjjPKQWDNOgJT4cKJeHKdW5AugaGGCqJ3M4OqhQ8QNHYKwsR7Hw8R7TZ3oKGNr3h2R5ksL/QJaJu6hO8SZyDEsOH+1v4nWKFjcjdm+1Gv12hgwHfGP4w4RWyg2iH+kBzuFCVfPx/z3d2eQCAtEBWgQSJOhZ8F1EHQz4xNGNHT04+X4EAEAQW7ONHJZF9cBm6nG3tgBFr8x0UXq+TPTZ0MWayEq3DhBOhZVhSfhXCsFJ4qE3Y7EQQBhQKB8jQa0KQSZrDCEBu4Bi8cg7r1Hjo8QUhJ3fEA9v1QJQE2m5cZUNlUvDVmhFcPgOPz0BYDgDAQ9Uev0WBJdUwvtYP4wNEaCtBgb1SfJqoEqGUDqGXEd5XM+l6vUmGQeYWjqJOqQFArAwlCWCT1N3xkqAzQPLSCJFZK0NeGARXaKb1HqB04tFCKoAHAHNswz8C4J5VBgQ0VkeFxPHM1beLYZJsHCjUKhd8AxZ5JmVzJF5Mq8xAaAAvyYqgcOyW8FhQvLgCmvxoIGj6h1QnAbDX2xAF7S7rDn+OFgC7/bJ6QFH3xt7wJ4DTIFIBxr4AAAAAASUVORK5CYII=",
            "scale": 1.0,
            "color": {
              "rgba": [sat.color.red * 255, sat.color.green * 255, sat.color.blue * 255, 255]
            }
          },
          "label": {
            "text": sat.name,
            "font": "11pt Lucida Console",
            "style": "FILL",
            "fillColor": {
              "rgba": [255, 255, 255, 255]
            },
            "outlineColor": {
              "rgba": [0, 0, 0, 255]
            },
            "outlineWidth": 2,
            "pixelOffset": {
              "cartesian2": [12, 0]
            }
          },
          "path": {
            "material": {
              "solidColor": {
                "color": {
                  "rgba": [sat.color.red * 255, sat.color.green * 255, sat.color.blue * 255, 100]
                }
              }
            },
            "width": 2,
            "leadTime": 3600,
            "trailTime": 3600,
            "resolution": 120
          }
        };
        
        czmlData.push(satelliteData);
      });
      
      return Cesium.CzmlDataSource.load(czmlData);
    };
    
    // 飞行到卫星视图
    const flyToSatellites = async () => {
      if (!props.viewer || !satelliteDataSource) return;
      
      try {
        // 飞行到全球视图以查看所有卫星
        await props.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0
          },
          duration: 2
        });
      } catch (error) {
        console.error('飞行到卫星视图失败:', error);
      }
    };
    
    // 设置卫星点击事件
    const setupSatelliteClickHandler = () => {
      if (!props.viewer) return;
      
      // 移除现有的点击处理器
      if (props.viewer.cesiumWidget.screenSpaceEventHandler) {
        props.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
          Cesium.ScreenSpaceEventType.LEFT_CLICK
        );
      }
      
      // 添加新的点击处理器
      props.viewer.cesiumWidget.screenSpaceEventHandler.setInputAction((event) => {
        const pickedObject = props.viewer.scene.pick(event.position);
        
        if (pickedObject && pickedObject.id && satelliteDataSource.entities.contains(pickedObject.id)) {
          const entity = pickedObject.id;
          selectedSatellite.value = {
            name: entity.name || entity.id,
            id: entity.id,
            description: entity.description ? entity.description.getValue() : null,
            availability: entity.availability
          };
          
          // 跟踪选中的卫星
          props.viewer.trackedEntity = entity;
          
          setStatus(`已选择卫星: ${selectedSatellite.value.name}`, 'success');
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    };
    
    // 格式化时间范围
    const formatTimeRange = (availability) => {
      if (!availability) return '未知';
      
      try {
        const start = availability.start;
        const stop = availability.stop;
        
        const startStr = start ? start.toString().split('T')[0] : '未知';
        const stopStr = stop ? stop.toString().split('T')[0] : '未知';
        
        return `${startStr} 至 ${stopStr}`;
      } catch (error) {
        return '格式错误';
      }
    };
    
    // 控制函数
    const toggleSatellites = () => {
      if (!satelliteDataSource) return;
      
      satelliteDataSource.entities.values.forEach(entity => {
        if (entity.billboard) {
          entity.billboard.show = showOptions.satellites;
        }
        if (entity.model) {
          entity.model.show = showOptions.satellites;
        }
        if (entity.point) {
          entity.point.show = showOptions.satellites;
        }
      });
    };
    
    const toggleOrbits = () => {
      if (!satelliteDataSource) return;
      
      satelliteDataSource.entities.values.forEach(entity => {
        if (entity.path) {
          entity.path.show = showOptions.orbits;
        }
      });
    };
    
    const toggleLabels = () => {
      if (!satelliteDataSource) return;
      
      satelliteDataSource.entities.values.forEach(entity => {
        if (entity.label) {
          entity.label.show = showOptions.labels;
        }
      });
    };
    
    const toggleAnimation = () => {
      if (!props.viewer) return;
      
      props.viewer.clock.shouldAnimate = showOptions.animation;
      if (showOptions.animation) {
        props.viewer.clock.multiplier = animationSpeed.value;
      }
    };
    
    const playAnimation = () => {
      if (!props.viewer) return;
      props.viewer.clock.shouldAnimate = true;
    };
    
    const pauseAnimation = () => {
      if (!props.viewer) return;
      props.viewer.clock.shouldAnimate = false;
    };
    
    const resetTime = () => {
      if (!props.viewer || !originalClockSettings) return;
      
      props.viewer.clock.currentTime = originalClockSettings.currentTime.clone();
      props.viewer.clock.shouldAnimate = showOptions.animation;
    };
    
    const updateAnimationSpeed = () => {
      if (!props.viewer) return;
      props.viewer.clock.multiplier = animationSpeed.value;
    };
    
    // 清除卫星数据
    const clearSatellites = () => {
      if (satelliteDataSource && props.viewer) {
        props.viewer.dataSources.remove(satelliteDataSource);
        satelliteDataSource = null;
      }
      
      // 恢复原始时钟设置
      if (originalClockSettings && props.viewer) {
        props.viewer.clock.shouldAnimate = originalClockSettings.shouldAnimate;
        props.viewer.clock.multiplier = originalClockSettings.multiplier;
        props.viewer.clock.currentTime = originalClockSettings.currentTime.clone();
      }
      
      // 清除选择
      if (props.viewer) {
        props.viewer.trackedEntity = undefined;
      }
      
      selectedSatellite.value = null;
      satelliteLoaded.value = false;
      setStatus('卫星轨道数据已清除', 'success');
    };
    
    // 组件销毁时清理
    onBeforeUnmount(() => {
      if (!props.preserveDataOnClose) {
        clearSatellites();
      }
    });
    
    return {
      // 状态
      isLoading,
      satelliteLoaded,
      statusMessage,
      statusType,
      statusIcon,
      showOptions,
      animationSpeed,
      selectedSatellite,
      satelliteCount,
      orbitTypes,
      
      // 方法
      loadSatelliteData,
      clearSatellites,
      toggleSatellites,
      toggleOrbits,
      toggleLabels,
      toggleAnimation,
      playAnimation,
      pauseAnimation,
      resetTime,
      updateAnimationSpeed,
      formatTimeRange
    };
  }
});
</script>

<style scoped>
.satellite-analysis {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  max-height: 600px;
  overflow-y: auto;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-section {
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.control-section h4 {
  margin: 0 0 15px 0;
  color: #555;
  font-size: 14px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.control-buttons {
  display: flex;
  gap: 10px;
}

.control-buttons button {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-danger:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.control-option input[type="checkbox"] {
  margin: 0;
}

.time-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 15px;
}

.btn-control {
  flex: 1;
  padding: 6px 10px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.2s ease;
}

.btn-control:hover:not(:disabled) {
  background: #e9ecef;
}

.btn-control:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.speed-control {
  margin-top: 10px;
}

.speed-control label {
  display: block;
  margin-bottom: 5px;
  font-size: 13px;
  font-weight: bold;
}

.speed-slider {
  width: 100%;
  margin: 5px 0;
}

.satellite-info {
  padding: 15px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  margin-bottom: 20px;
}

.satellite-info h4 {
  margin: 0 0 15px 0;
  color: #555;
  font-size: 14px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.info-content p {
  margin: 8px 0;
  font-size: 13px;
}

.statistics {
  padding: 15px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  margin-bottom: 20px;
}

.statistics h4 {
  margin: 0 0 15px 0;
  color: #555;
  font-size: 14px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.stat-label {
  color: #666;
}

.stat-value {
  font-weight: bold;
  color: #333;
}

.status-info {
  margin-top: 15px;
}

.status-message {
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f1b0b7;
}
</style>
