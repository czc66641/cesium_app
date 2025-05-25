<template>
  <div class="app">
    <NavBar 
      :show-analysis-panel="showAnalysisPanel"
      :selectedMap="selectedMap"
      @toggle-analysis-panel="toggleAnalysisPanel"
    />
    
    <CesiumView 
      ref="cesiumView"
      @update-location="updateLocation"
      v-model:selectedMap="selectedMap"
    />
    
    <!-- 其他组件 -->
    
    <!-- 分析面板组件 - 条件渲染 -->
    <Analysis 
      v-if="showAnalysisPanel"
      :viewer="cesiumViewer"
      :current-location="currentLocation"
      @update-location="updateLocation"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import CesiumView from './components/CesiumView.vue';
import NavBar from './components/NavBar.vue';
import Analysis from './components/Analysis/index.vue';

export default {
  name: 'App',
  components: {
    CesiumView,
    NavBar,
    Analysis
  },
  setup() {
    // Cesium 相关引用
    const cesiumView = ref(null);
    const cesiumViewer = computed(() => cesiumView.value ? cesiumView.value.viewer : null);
    
    // 当前位置
    const currentLocation = ref({
      longitude: 116.3912757,
      latitude: 39.906217,
      height: 500
    });
    
    // 添加地图类型状态
    const selectedMap = ref('cesiumTerrain1');
    
    // 分析面板显示状态
    const showAnalysisPanel = ref(false);
    
    // 切换分析面板显示
    const toggleAnalysisPanel = () => {
      showAnalysisPanel.value = !showAnalysisPanel.value;
    };
    
    // 更新位置
    const updateLocation = (location) => {
      currentLocation.value = location;
    };
    
    return {
      cesiumView,
      cesiumViewer,
      currentLocation,
      showAnalysisPanel,
      toggleAnalysisPanel,
      updateLocation,
      selectedMap
    };
  }
};
</script>

<style>
html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>