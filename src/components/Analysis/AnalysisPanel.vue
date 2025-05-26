<template>
  <div class="analysis-panel-overlay" v-if="visible" @click="handleOverlayClick">
    <div class="analysis-panel" @click.stop>
      <div class="panel-header">
        <h2>综合分析工具</h2>
        <div class="header-controls">
          <button @click="minimizePanel" class="minimize-btn" title="最小化面板">
            <i class="fas fa-minus"></i>
          </button>
          <button @click="$emit('close')" class="close-btn" title="关闭面板（保留地图数据）">
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
          />
          
          <div v-else-if="activeTab === 'weather'" class="coming-soon">
            <i class="fas fa-cloud-sun"></i>
            <h3>气象分析</h3>
            <p>功能开发中...</p>
          </div>
          
          <div v-else-if="activeTab === 'environment'" class="coming-soon">
            <i class="fas fa-leaf"></i>
            <h3>环境分析</h3>
            <p>功能开发中...</p>
          </div>
          
          <div v-else-if="activeTab === 'population'" class="coming-soon">
            <i class="fas fa-users"></i>
            <h3>人口分析</h3>
            <p>功能开发中...</p>
          </div>
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

export default defineComponent({
  name: 'AnalysisPanel',
  components: {
    EarthquakeAnalysis
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
      { id: 'environment', name: '环境分析', icon: 'fas fa-leaf' },
      { id: 'population', name: '人口分析', icon: 'fas fa-users' }
    ];
    
    const handleOverlayClick = () => {
      // 关闭面板但不清除数据
      emit('close');
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
    
    return {
      activeTab,
      isMinimized,
      tabs,
      handleOverlayClick,
      minimizePanel,
      restorePanel,
      handleEarthquakeDataLoaded
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
</style>
