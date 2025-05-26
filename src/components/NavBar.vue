<template>
  <div class="nav-bar">
    <div class="nav-title">3D GIS应用</div>
    
    <div class="nav-buttons">
      <button 
        v-for="item in navItems" 
        :key="item.id"
        :class="['nav-button', { active: activePanels.includes(item.id) }]"
        @click="togglePanel(item.id)"
        :title="item.title"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        {{ item.name }}
      </button>
    </div>
    
    <div class="map-selector">
      <select :value="selectedMap" @change="onMapChange($event)" title="切换地图底图">
        <option value="tiandituVec">天地图矢量</option>
        <option value="arcgisTerrain">ARCGIS 地形图</option>
        <option value="cesiumTerrain1">Cesium地形图1</option>
        <option value="cesiumTerrain2">Cesium地形图2</option>
        <option value="bingAerial">必应卫星影像</option>
        <option value="bingRoad">必应道路</option>
        <option value="gaodeMap">高德地图</option>
        <option value="gaodeSatellite">高德卫星影像</option>
        <option value="osm">OpenStreetMap</option>
      </select>
      <button @click="resetView" class="reset-button" title="回到初始视角">
        <span class="nav-icon">🏠</span>
      </button>
    </div>

    <!-- 新增地震数据看板菜单项 -->
    <div class="nav-item" @click="toggleEarthquakeDashboard" :class="{ active: showEarthquakeDashboard }">
      <i class="fas fa-chart-bar"></i>
      <span>地震看板</span>
    </div>

    <!-- 综合分析菜单项 -->
    <div class="nav-item" @click="toggleAnalysisPanel" :class="{ active: showAnalysisPanel }">
      <i class="fas fa-chart-line"></i>
      <span>综合分析</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'NavBar',
  props: {
    activePanels: {
      type: Array,
      default: () => [],
    },
    selectedMap: {
      type: String,
      required: true
    },
    showAnalysisPanel: {
      type: Boolean,
      default: false
    },
    showEarthquakeDashboard: {
      type: Boolean,
      default: false
    }
  },
  emits: ['toggle-panel', 'update:selectedMap', 'reset-view', 'toggle-analysis-panel', 'toggle-earthquake-dashboard'],
  setup(props, { emit }) {
    // 导航项定义
    const navItems = [
      { id: 'viewControl', name: '视角控制', icon: '🔍', title: '打开/关闭视角控制面板' },
      { id: 'dataLoad', name: '数据加载', icon: '📂', title: '打开/关闭数据加载面板' },
      { id: 'analysis', name: '空间分析', icon: '📊', title: '打开/关闭空间分析面板' },
      { id: 'layerManager', name: '图层管理', icon: '🗂️', title: '打开/关闭图层管理面板' },
    ];
    
    // 切换面板显示
    const togglePanel = (panelId) => {
      emit('toggle-panel', panelId);
    };
    
    // 修复地图切换方法 - 使用update:selectedMap替代直接修改
    const onMapChange = (event) => {
      emit('update:selectedMap', event.target.value);
    };
    
    // 重置视图
    const resetView = () => {
      emit('reset-view');
    };

    // 切换综合分析面板
    const toggleAnalysisPanel = () => {
      emit('toggle-analysis-panel');
    };
    
    // 切换地震数据看板
    const toggleEarthquakeDashboard = () => {
      emit('toggle-earthquake-dashboard');
    };
    
    return {
      navItems,
      togglePanel,
      onMapChange,
      resetView,
      toggleAnalysisPanel,
      toggleEarthquakeDashboard
    };
  }
}
</script>

<style scoped>
.nav-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  z-index: 1000;
  color: white;
}

.nav-title {
  color: white;
  font-size: 18px;
  font-weight: bold;
  margin-right: 25px;
}

.nav-buttons {
  display: flex;
  gap: 10px;
}

.nav-button {
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  border: none;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.nav-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
}

.nav-button.active {
  background-color: rgba(66, 133, 244, 0.7);
  color: white;
}

.nav-icon {
  font-size: 16px;
}

.map-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.map-selector select {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  background: rgba(255,255,255,0.9);
  color: #333;
  font-size: 14px;
}

.reset-button {
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.reset-button:hover {
  background: rgba(255,255,255,0.3);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
}

.nav-item:hover {
  background: rgba(255,255,255,0.2);
  transform: translateY(-1px);
}

.nav-item.active {
  background: rgba(255,255,255,0.3);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.nav-item i {
  font-size: 16px;
}

.nav-item span {
  font-size: 14px;
  font-weight: 500;
}
</style>
