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
    
    <!-- 地图选择器集成到导航栏 -->
    <div class="map-selector">
      <select :value="selectedMap" @change="onMapChange($event)" title="切换地图底图">
        <option value="googleEarth">谷歌地球影像</option>
        <option value="tiandituImg">天地图影像</option>
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

    <!-- 新增综合分析菜单项 -->
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
    }
  },
  emits: ['toggle-panel', 'update:selectedMap', 'reset-view', 'toggle-analysis-panel'],
  setup(props, { emit }) {
    // 导航项定义
    const navItems = [
      { id: 'viewControl', name: '视角控制', icon: '🔍', title: '打开/关闭视角控制面板' },
      { id: 'dataLoad', name: '数据加载', icon: '📂', title: '打开/关闭数据加载面板' },
      { id: 'analysis', name: '空间分析', icon: '📊', title: '打开/关闭空间分析面板' },
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
    
    return {
      navItems,
      togglePanel,
      onMapChange,
      resetView,
      toggleAnalysisPanel
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
  background-color: rgba(30, 30, 30, 0.85);
  display: flex;
  align-items: center;
  padding: 0 15px;
  z-index: 1100;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
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
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.map-selector select {
  padding: 5px 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background-color: rgba(30, 30, 30, 0.5);
  color: white;
  font-size: 14px;
}

.reset-button {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  border: none;
  border-radius: 4px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.reset-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.nav-item {
  cursor: pointer;
  padding: 8px 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
}

.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
  background-color: rgba(255, 255, 255, 0.2);
  border-bottom: 2px solid #4285f4;
}

.nav-item i {
  font-size: 16px;
}
</style>
