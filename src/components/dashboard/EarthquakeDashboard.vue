<template>
  <div class="earthquake-dashboard" v-if="visible" @click="handleOverlayClick">
    <div class="dashboard-content" @click.stop>
      <!-- 头部 -->
      <div class="dashboard-header">
        <h2 class="dashboard-title">
          <i class="fas fa-chart-bar"></i>
          地震数据看板
        </h2>
        <div class="header-controls">
          <button class="refresh-btn" @click="refreshData" :disabled="isRefreshing">
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isRefreshing }"></i>
            {{ isRefreshing ? '刷新中...' : '刷新数据' }}
          </button>
          <button class="close-btn" @click="$emit('close')">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 统计概览 -->
      <div class="stats-overview">
        <div class="stat-card">
          <div class="stat-icon earthquake-icon">
            <i class="fas fa-globe"></i>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ totalCount }}</div>
            <div class="stat-label">总地震数</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon major-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ majorEarthquakes }}</div>
            <div class="stat-label">强震数量 (M≥6.0)</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon magnitude-icon">
            <i class="fas fa-chart-line"></i>
          </div>
          <div class="stat-content">
            <div class="stat-number">M{{ maxMagnitude?.toFixed(1) || '0.0' }}</div>
            <div class="stat-label">最大震级</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon depth-icon">
            <i class="fas fa-arrows-alt-v"></i>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ maxDepth?.toFixed(0) || '0' }}km</div>
            <div class="stat-label">最大深度</div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button class="action-btn primary" @click="$emit('open-earthquake-analysis')">
          <i class="fas fa-search"></i>
          打开地震分析
        </button>
        <button class="action-btn secondary" @click="toggleHeatmap">
          <i class="fas fa-fire"></i>
          {{ showHeatmap ? '隐藏' : '显示' }}热力图
        </button>
      </div>

      <!-- 地震分布图表 -->
      <div class="chart-section">
        <h3 class="section-title">震级分布</h3>
        <div class="magnitude-chart">
          <div 
            v-for="(range, index) in magnitudeRanges" 
            :key="index"
            class="magnitude-bar"
            :style="{ height: range.height + '%' }"
            :title="`M${range.min}-${range.max}: ${range.count}次`"
          >
            <div class="bar-label">{{ range.label }}</div>
            <div class="bar-count">{{ range.count }}</div>
          </div>
        </div>
      </div>

      <!-- 深度分布图表 -->
      <div class="chart-section">
        <h3 class="section-title">深度分布</h3>
        <div class="depth-chart">
          <div 
            v-for="(range, index) in depthRanges" 
            :key="index"
            class="depth-bar"
            :style="{ height: range.height + '%' }"
            :title="`${range.min}-${range.max}km: ${range.count}次`"
          >
            <div class="bar-label">{{ range.label }}</div>
            <div class="bar-count">{{ range.count }}</div>
          </div>
        </div>
      </div>

      <!-- 最近地震列表 -->
      <div class="recent-earthquakes">
        <h3 class="section-title">
          最近强震 (M≥5.0)
          <span class="earthquake-count">({{ recentMajorEarthquakes.length }}条)</span>
        </h3>
        <div class="earthquake-list">
          <div 
            v-for="earthquake in recentMajorEarthquakes.slice(0, 10)" 
            :key="earthquake.id"
            class="earthquake-item"
            @click="$emit('locate-earthquake', earthquake)"
          >
            <div class="earthquake-magnitude" :class="getMagnitudeClass(earthquake.magnitude)">
              M{{ earthquake.magnitude?.toFixed(1) || '0.0' }}
            </div>
            <div class="earthquake-info">
              <div class="earthquake-location">{{ earthquake.location || '未知位置' }}</div>
              <div class="earthquake-details">
                <span>深度: {{ earthquake.depth?.toFixed(1) || '0' }}km</span>
                <span>时间: {{ formatDate(earthquake.date) }}</span>
              </div>
            </div>
            <div class="earthquake-coords">
              <div>{{ earthquake.longitude?.toFixed(3) || '0' }}°E</div>
              <div>{{ earthquake.latitude?.toFixed(3) || '0' }}°N</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 时间分布图表 -->
      <div class="chart-section">
        <h3 class="section-title">时间分布 (按月)</h3>
        <div class="timeline-chart">
          <div 
            v-for="(month, index) in monthlyDistribution" 
            :key="index"
            class="timeline-bar"
            :style="{ height: month.height + '%' }"
            :title="`${month.month}: ${month.count}次`"
          >
            <div class="timeline-label">{{ month.label }}</div>
            <div class="timeline-count">{{ month.count }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, computed, watch } from 'vue';

export default defineComponent({
  name: 'EarthquakeDashboard',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    earthquakeData: {
      type: Array,
      default: () => []
    },
    viewer: {
      type: Object,
      required: false
    }
  },
  emits: ['close', 'open-earthquake-analysis', 'locate-earthquake', 'generate-heatmap', 'clear-heatmap'],
  setup(props, { emit }) {
    const isRefreshing = ref(false);
    const showHeatmap = ref(false);

    // 基础统计数据
    const totalCount = computed(() => props.earthquakeData.length);
    
    const majorEarthquakes = computed(() => 
      props.earthquakeData.filter(eq => eq.magnitude >= 6.0).length
    );
    
    const maxMagnitude = computed(() => {
      if (props.earthquakeData.length === 0) return 0;
      return Math.max(...props.earthquakeData.map(eq => eq.magnitude || 0));
    });
    
    const maxDepth = computed(() => {
      if (props.earthquakeData.length === 0) return 0;
      return Math.max(...props.earthquakeData.map(eq => eq.depth || 0));
    });

    // 震级分布
    const magnitudeRanges = computed(() => {
      const ranges = [
        { min: 0, max: 3, label: '0-3', count: 0 },
        { min: 3, max: 4, label: '3-4', count: 0 },
        { min: 4, max: 5, label: '4-5', count: 0 },
        { min: 5, max: 6, label: '5-6', count: 0 },
        { min: 6, max: 7, label: '6-7', count: 0 },
        { min: 7, max: 10, label: '7+', count: 0 }
      ];

      props.earthquakeData.forEach(eq => {
        const mag = eq.magnitude || 0;
        for (let range of ranges) {
          if (mag >= range.min && mag < range.max) {
            range.count++;
            break;
          }
          if (range.min === 7 && mag >= 7) {
            range.count++;
            break;
          }
        }
      });

      const maxCount = Math.max(...ranges.map(r => r.count), 1);
      ranges.forEach(range => {
        range.height = (range.count / maxCount) * 100;
      });

      return ranges;
    });

    // 深度分布
    const depthRanges = computed(() => {
      const ranges = [
        { min: 0, max: 50, label: '0-50', count: 0 },
        { min: 50, max: 100, label: '50-100', count: 0 },
        { min: 100, max: 200, label: '100-200', count: 0 },
        { min: 200, max: 300, label: '200-300', count: 0 },
        { min: 300, max: 500, label: '300-500', count: 0 },
        { min: 500, max: 1000, label: '500+', count: 0 }
      ];

      props.earthquakeData.forEach(eq => {
        const depth = eq.depth || 0;
        for (let range of ranges) {
          if (depth >= range.min && depth < range.max) {
            range.count++;
            break;
          }
          if (range.min === 500 && depth >= 500) {
            range.count++;
            break;
          }
        }
      });

      const maxCount = Math.max(...ranges.map(r => r.count), 1);
      ranges.forEach(range => {
        range.height = (range.count / maxCount) * 100;
      });

      return ranges;
    });

    // 最近强震
    const recentMajorEarthquakes = computed(() => {
      return props.earthquakeData
        .filter(eq => eq.magnitude >= 5.0)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 20);
    });

    // 月度分布
    const monthlyDistribution = computed(() => {
      const monthCounts = {};
      const now = new Date();
      
      // 初始化最近12个月
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthCounts[key] = 0;
      }

      // 统计每月地震数量
      props.earthquakeData.forEach(eq => {
        if (eq.date) {
          const date = new Date(eq.date);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (monthCounts.hasOwnProperty(key)) {
            monthCounts[key]++;
          }
        }
      });

      const months = Object.keys(monthCounts).map(key => {
        const [year, month] = key.split('-');
        return {
          month: key,
          label: `${month}`,
          count: monthCounts[key],
          height: 0
        };
      });

      const maxCount = Math.max(...months.map(m => m.count), 1);
      months.forEach(month => {
        month.height = (month.count / maxCount) * 100;
      });

      return months;
    });

    // 处理点击遮罩层关闭
    const handleOverlayClick = () => {
      emit('close');
    };

    // 刷新数据
    const refreshData = () => {
      isRefreshing.value = true;
      setTimeout(() => {
        isRefreshing.value = false;
      }, 1000);
    };

    // 切换热力图
    const toggleHeatmap = () => {
      showHeatmap.value = !showHeatmap.value;
      if (showHeatmap.value) {
        emit('generate-heatmap', props.earthquakeData);
      } else {
        emit('clear-heatmap');
      }
    };

    // 获取震级样式类
    const getMagnitudeClass = (magnitude) => {
      if (magnitude >= 7) return 'magnitude-severe';
      if (magnitude >= 6) return 'magnitude-major';
      if (magnitude >= 5) return 'magnitude-moderate';
      if (magnitude >= 4) return 'magnitude-light';
      return 'magnitude-minor';
    };

    // 格式化日期
    const formatDate = (dateStr) => {
      if (!dateStr) return '未知';
      const date = new Date(dateStr);
      if (isNaN(date)) return '未知';
      return date.toLocaleDateString('zh-CN');
    };

    return {
      isRefreshing,
      showHeatmap,
      totalCount,
      majorEarthquakes,
      maxMagnitude,
      maxDepth,
      magnitudeRanges,
      depthRanges,
      recentMajorEarthquakes,
      monthlyDistribution,
      handleOverlayClick,
      refreshData,
      toggleHeatmap,
      getMagnitudeClass,
      formatDate
    };
  }
});
</script>

<style scoped>
.earthquake-dashboard {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.dashboard-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 1200px;
  max-height: 90%;
  overflow-y: auto;
  padding: 0;
}

.dashboard-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px 12px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.dashboard-title i {
  margin-right: 10px;
}

.header-controls {
  display: flex;
  gap: 10px;
}

.refresh-btn, .close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover, .close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  padding: 20px;
}

.stat-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  font-size: 24px;
  color: white;
}

.earthquake-icon {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.major-icon {
  background: linear-gradient(135deg, #f093fb, #f5576c);
}

.magnitude-icon {
  background: linear-gradient(135deg, #4facfe, #00f2fe);
}

.depth-icon {
  background: linear-gradient(135deg, #43e97b, #38f9d7);
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.action-buttons {
  display: flex;
  gap: 15px;
  padding: 0 20px;
  margin-bottom: 20px;
}

.action-btn {
  flex: 1;
  padding: 12px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.action-btn.primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.action-btn.secondary {
  background: linear-gradient(135deg, #f093fb, #f5576c);
  color: white;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.chart-section {
  margin: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
}

.section-title {
  margin: 0 0 15px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.magnitude-chart, .depth-chart, .timeline-chart {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 120px;
  padding: 10px 0;
}

.magnitude-bar, .depth-bar, .timeline-bar {
  flex: 1;
  background: linear-gradient(to top, #667eea, #764ba2);
  border-radius: 4px 4px 0 0;
  position: relative;
  min-height: 20px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  transition: all 0.2s;
}

.magnitude-bar:hover, .depth-bar:hover, .timeline-bar:hover {
  opacity: 0.8;
  transform: scale(1.05);
}

.bar-label, .timeline-label {
  position: absolute;
  bottom: -25px;
  font-size: 12px;
  color: #666;
  text-align: center;
  width: 100%;
}

.bar-count, .timeline-count {
  color: white;
  font-size: 11px;
  font-weight: bold;
  padding: 2px;
}

.recent-earthquakes {
  margin: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
}

.earthquake-count {
  font-size: 14px;
  color: #666;
  font-weight: normal;
}

.earthquake-list {
  max-height: 300px;
  overflow-y: auto;
}

.earthquake-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: white;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.earthquake-item:hover {
  transform: translateX(5px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.earthquake-magnitude {
  min-width: 60px;
  height: 40px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 12px;
  margin-right: 15px;
}

.magnitude-severe {
  background: linear-gradient(135deg, #ff416c, #ff4b2b);
}

.magnitude-major {
  background: linear-gradient(135deg, #f093fb, #f5576c);
}

.magnitude-moderate {
  background: linear-gradient(135deg, #4facfe, #00f2fe);
}

.magnitude-light {
  background: linear-gradient(135deg, #43e97b, #38f9d7);
}

.magnitude-minor {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.earthquake-info {
  flex: 1;
  margin-right: 15px;
}

.earthquake-location {
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.earthquake-details {
  font-size: 12px;
  color: #666;
}

.earthquake-details span {
  margin-right: 15px;
}

.earthquake-coords {
  text-align: right;
  font-size: 12px;
  color: #666;
  min-width: 80px;
}

/* 滚动条样式 */
.dashboard-content::-webkit-scrollbar,
.earthquake-list::-webkit-scrollbar {
  width: 6px;
}

.dashboard-content::-webkit-scrollbar-track,
.earthquake-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.dashboard-content::-webkit-scrollbar-thumb,
.earthquake-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.dashboard-content::-webkit-scrollbar-thumb:hover,
.earthquake-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
