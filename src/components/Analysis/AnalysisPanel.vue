<template>
  <div class="analysis-panel-overlay" v-if="visible" @click="handleOverlayClick">
    <div class="analysis-panel" @click.stop>
      <div class="panel-header">
        <h2>综合分析工具</h2>
        <div class="header-controls">
          <button @click="minimizePanel" class="minimize-btn" title="最小化面板">
            <i class="fas fa-minus"></i>
          </button>
          <button @click="closePanel" class="close-btn" title="关闭面板（保留地图数据）">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      
      <div class="panel-content" v-if="!isMinimized">
        <div class="analysis-tabs">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            :class="['tab-btn', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            <i :class="tab.icon"></i>
            {{ tab.name }}
          </button>
        </div>
        
        <div class="tab-content">
          <EarthquakeAnalysis 
            v-if="activeTab === 'earthquake'"
            :viewer="viewer"
            :current-location="currentLocation"
            @earthquake-data-loaded="handleEarthquakeDataLoaded"
            :preserve-data-on-close="true"
            :keep-data-on-panel-close="true"
          />
          
          <div v-else-if="activeTab === 'weather'" class="weather-analysis">
            <TyphoonAnalysis 
              :viewer="viewer"
              :current-location="currentLocation"
              :preserve-data-on-close="true"
              :keep-data-on-panel-close="true"
            />
            
            <!-- 简化的气象控制面板 -->
            <div class="weather-controls">
              <h4>台风模型控制</h4>
              <div class="weather-options">
                <label class="weather-option">
                  <input type="checkbox" v-model="weatherOptions.showPath" @change="toggleTyphoonPath">
                  <span>显示台风路径</span>
                </label>
                <label class="weather-option">
                  <input type="checkbox" v-model="weatherOptions.showWarningLines" @change="toggleWarningLines">
                  <span>显示警戒线</span>
                </label>
                <label class="weather-option">
                  <input type="checkbox" v-model="weatherOptions.showTyphoonEye" @change="toggleTyphoonEye">
                  <span>显示台风眼</span>
                </label>
              </div>
              
              <div class="model-info">
                <p><strong>台风模型:</strong> harricane_typhoon_weather_map.glb</p>
                <p><strong>数据源:</strong> typhoon.json</p>
                <p><small>模型会根据台风强度自动调整大小和颜色</small></p>
              </div>
            </div>
          </div>
          
          <WindAnalysis
            v-else-if="activeTab === 'wind'"
            :viewer="viewer"
            :current-location="currentLocation"
            :preserve-data-on-close="true"
            :keep-data-on-panel-close="true"
          />
          
          <SatelliteAnalysis
            v-else-if="activeTab === 'satellite'"
            :viewer="viewer"
            :current-location="currentLocation"
            :preserve-data-on-close="true"
            :keep-data-on-panel-close="true"
          />
        </div>
      </div>
      
      <!-- 最小化状态的显示 -->
      <div v-else class="minimized-content">
        <span>综合分析工具已最小化</span>
        <button @click="restorePanel" class="restore-btn">
          <i class="fas fa-expand"></i>
          展开
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue';
import EarthquakeAnalysis from '../finalwork/earthquake.vue';
import TyphoonAnalysis from './TyphoonAnalysis.vue';
import WindAnalysis from './WindAnalysis.vue';
import SatelliteAnalysis from './SatelliteAnalysis.vue'; // 新增卫星分析组件

export default defineComponent({
  name: 'AnalysisPanel',
  components: {
    EarthquakeAnalysis,
    TyphoonAnalysis,
    WindAnalysis,
    SatelliteAnalysis // 注册卫星分析组件
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    viewer: {
      type: Object,
      required: false
    },
    currentLocation: {
      type: Object,
      required: true
    }
  },
  emits: ['close', 'earthquake-data-loaded'],
  setup(props, { emit }) {
    const activeTab = ref('earthquake');
    const isMinimized = ref(false);
    
    const tabs = [
      { id: 'earthquake', name: '地震分析', icon: 'fas fa-mountain' },
      { id: 'weather', name: '气象分析', icon: 'fas fa-cloud-sun' },
      { id: 'wind', name: '风场分析', icon: 'fas fa-wind' },
      { id: 'satellite', name: '卫星轨道', icon: 'fas fa-satellite' } // 替换人口分析
    ];
    
    const weatherOptions = ref({
      showClouds: true,
      showWind: true,
      showPressure: true,
      showTemperature: true
    });
    
    const weatherTime = ref(12);
    
    const closePanel = () => {
      // 关闭面板但保留所有数据
      console.log('关闭综合分析面板，保留所有数据');
      emit('close');
    };
    
    const handleOverlayClick = () => {
      // 点击遮罩层关闭面板但保留数据
      console.log('点击遮罩层关闭面板，保留数据');
      closePanel();
    };
    
    const minimizePanel = () => {
      isMinimized.value = true;
    };
    
    const restorePanel = () => {
      isMinimized.value = false;
    };
    
    // 处理地震数据加载事件，传递给App.vue
    const handleEarthquakeDataLoaded = (data) => {
      console.log('AnalysisPanel收到地震数据:', data.length, '条记录');
      emit('earthquake-data-loaded', data);
    };
    
    const toggleClouds = () => {
      // 切换云层显示逻辑
      console.log('切换云层显示:', weatherOptions.value.showClouds);
    };
    
    const toggleWind = () => {
      // 切换风场显示逻辑
      console.log('切换风场显示:', weatherOptions.value.showWind);
    };
    
    const togglePressure = () => {
      // 切换气压等值线显示逻辑
      console.log('切换气压等值线显示:', weatherOptions.value.showPressure);
    };
    
    const toggleTemperature = () => {
      // 切换温度分布显示逻辑
      console.log('切换温度分布显示:', weatherOptions.value.showTemperature);
    };
    
    const updateWeatherTime = () => {
      // 更新气象时间控制逻辑
      console.log('更新气象时间:', weatherTime.value);
    };
    
    const toggleTyphoonPath = () => {
      // 切换台风路径显示逻辑
      console.log('切换台风路径显示:', weatherOptions.value.showPath);
    };
    
    const toggleWarningLines = () => {
      // 切换警戒线显示逻辑
      console.log('切换警戒线显示:', weatherOptions.value.showWarningLines);
    };
    
    const toggleTyphoonEye = () => {
      // 切换台风眼显示逻辑
      console.log('切换台风眼显示:', weatherOptions.value.showTyphoonEye);
    };
    
    return {
      activeTab,
      isMinimized,
      tabs,
      weatherOptions,
      weatherTime,
      closePanel,
      handleOverlayClick,
      minimizePanel,
      restorePanel,
      handleEarthquakeDataLoaded,
      toggleClouds,
      toggleWind,
      togglePressure,
      toggleTemperature,
      updateWeatherTime,
      toggleTyphoonPath,
      toggleWarningLines,
      toggleTyphoonEye
    };
  }
});
</script>

<style scoped>
.analysis-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 3000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.analysis-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 90vw;
  max-height: 90vh;
  width: 800px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.panel-header h2 {
  margin: 0;
  font-size: 20px;
}

.header-controls {
  display: flex;
  gap: 5px;
  align-items: center;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.minimize-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s ease;
}

.minimize-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.panel-content {
  padding: 0;
}

.analysis-tabs {
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.tab-btn {
  flex: 1;
  padding: 15px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: #6c757d;
}

.tab-btn:hover {
  background: #e9ecef;
  color: #495057;
}

.tab-btn.active {
  background: white;
  color: #007bff;
  border-bottom: 3px solid #007bff;
}

.tab-content {
  padding: 20px;
  min-height: 400px;
  max-height: 60vh;
  overflow-y: auto;
}

.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #6c757d;
  text-align: center;
}

.coming-soon i {
  font-size: 48px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.coming-soon h3 {
  margin: 0 0 10px 0;
  font-size: 24px;
}

.coming-soon p {
  margin: 0;
  font-size: 16px;
  opacity: 0.7;
}

.minimized-content {
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  font-size: 14px;
  color: #666;
}

.restore-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  transition: background-color 0.3s ease;
}

.restore-btn:hover {
  background: #0056b3;
}

.weather-analysis {
  margin-top: 20px;
}

.weather-controls {
  margin-top: 20px;
  padding: 15px;
  background: #f1f1f1;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.weather-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.weather-option {
  display: flex;
  align-items: center;
  gap: 10px;
}

.time-slider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.time-range {
  flex: 1;
}
</style>
