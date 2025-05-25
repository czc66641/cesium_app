<template>
  <div class="analysis-panel" @mousedown="startDrag" @mousemove="onDrag" @mouseup="endDrag" @mouseleave="endDrag">
    <div class="panel-header">
      <span class="panel-title">空间分析工具</span>      <div class="tabs">
        <button :class="{ active: activeTab === 'route' }" @click="activeTab = 'route'">路径规划</button>
        <button :class="{ active: activeTab === 'visibility' }" @click="activeTab = 'visibility'">视域分析</button>
        <button :class="{ active: activeTab === 'height' }" @click="activeTab = 'height'">高程分析</button>
        <button :class="{ active: activeTab === 'flood' }" @click="activeTab = 'flood'">洪水分析</button>
        <button :class="{ active: activeTab === 'earthquake' }" @click="activeTab = 'earthquake'">地震分析</button>
      </div>
    </div>

    <div class="tab-content">
      <!-- 路径分析组件 -->
      <RouteAnalysis 
        v-if="activeTab === 'route'"
        :viewer="viewer"
        :current-location="currentLocation"
      />
      
      <!-- 视域分析组件 -->
      <VisibilityAnalysis
        v-if="activeTab === 'visibility'"
        :viewer="viewer"
        :current-location="currentLocation"
      />

      <!-- 高程分析组件 -->
      <HeightAnalysis 
        v-if="activeTab === 'height'"
        :viewer="viewer"
        :current-location="currentLocation"
        @update-location="$emit('update-location', $event)"
      />
        <!-- 洪水分析组件 -->
      <FloodAnalysis
        v-if="activeTab === 'flood'"
        :viewer="viewer"
        :current-location="currentLocation"
        @update-location="$emit('update-location', $event)"
      />
      
      <!-- 地震分析组件 -->
      <EarthquakeAnalysis
        v-if="activeTab === 'earthquake'"
        :viewer="viewer"
        :current-location="currentLocation"
        @update-location="$emit('update-location', $event)"
      />
    </div>
    
    <div class="drag-handle"></div>
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue';
import RouteAnalysis from './RouteAnalysis.vue';
import VisibilityAnalysis from './VisibilityAnalysis.vue';
import HeightAnalysis from './height.vue';
import FloodAnalysis from '../finalwork/drown.vue';
import EarthquakeAnalysis from '../finalwork/earthquake.vue';

export default defineComponent({
  name: 'Analysis',  components: {
    RouteAnalysis,
    VisibilityAnalysis,
    HeightAnalysis,
    FloodAnalysis,
    EarthquakeAnalysis
  },
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
  emits: ['update-location'],
  setup() {
    // 当前激活的标签页
    const activeTab = ref('route');
    
    // 拖动功能
    const isDragging = ref(false);
    const dragOffset = ref({ x: 0, y: 0 });

    const startDrag = (event) => {
      // 只在面板头部拖动
      if (!event.target.closest('.panel-header, .drag-handle')) return;
      
      isDragging.value = true;
      dragOffset.value = {
        x: event.clientX - event.currentTarget.getBoundingClientRect().left,
        y: event.clientY - event.currentTarget.getBoundingClientRect().top,
      };
      
      // 防止文本选择
      event.preventDefault();
    };

    const onDrag = (event) => {
      if (isDragging.value) {
        const panel = document.querySelector('.analysis-panel');
        panel.style.left = `${event.clientX - dragOffset.value.x}px`;
        panel.style.top = `${event.clientY - dragOffset.value.y}px`;
      }
    };

    const endDrag = () => {
      isDragging.value = false;
    };

    return {
      activeTab,
      startDrag,
      onDrag,
      endDrag
    };
  }
});
</script>

<style scoped>
.analysis-panel {
  position: absolute;
  top: 60px; /* 调整位置，放在导航栏下方 */
  right: 320px; /* 不覆盖图层管理器 */
  z-index: 1000;
  background-color: rgba(248, 249, 250, 0.95);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 350px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
  cursor: default;
}

.analysis-panel:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.panel-header {
  background-color: #f0f0f0;
  border-bottom: 1px solid #ddd;
  padding: 8px;
  cursor: move;
  user-select: none;
}

.panel-title {
  font-weight: bold;
  font-size: 14px;
  color: #333;
  display: block;
  text-align: center;
  margin-bottom: 8px;
}

.tabs {
  display: flex;
  justify-content: space-around;
  margin-top: 5px;
  flex-wrap: wrap; /* 允许在小屏幕上换行 */
}

.tabs button {
  flex: 1;
  padding: 6px 4px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px; /* 调小字体以适应更多选项卡 */
  margin: 0 2px;
  transition: all 0.2s ease;
  min-width: 60px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tabs button.active {
  background-color: #4285f4;
  color: white;
  font-weight: bold;
  border-color: #3367d6;
}

.tab-content {
  padding: 10px;
  max-height: 500px;
  overflow-y: auto;
}

.drag-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, #ccc 50%, #ccc 100%);
  border-bottom-right-radius: 8px;
}
</style>
