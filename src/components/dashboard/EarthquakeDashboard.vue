<template>
  <div class="earthquake-dashboard" v-if="visible" @click="handleOverlayClick">
    <div class="dashboard-content" @click.stop>
      <!-- 头部 -->
      <div class="dashboard-header">
        <h2 class="dashboard-title">
          <i class="fas fa-chart-bar"></i>
          地震数据分析看板
        </h2>
        <div class="header-controls">
          <button class="view-toggle-btn" @click="toggleView">
            <i class="fas" :class="currentView === 'overview' ? 'fa-chart-line' : 'fa-th-large'"></i>
            {{ currentView === 'overview' ? '详细分析' : '概览视图' }}
          </button>
          <button class="refresh-btn" @click="refreshData" :disabled="isRefreshing">
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isRefreshing }"></i>
            {{ isRefreshing ? '刷新中...' : '刷新数据' }}
          </button>
          <button class="close-btn" @click="$emit('close')">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 概览视图 -->
      <div v-if="currentView === 'overview'" class="overview-content">
        <!-- 统计概览 -->
        <div class="stats-overview">
          <div class="stat-card">
            <div class="stat-icon earthquake-icon">
              <i class="fas fa-globe"></i>
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ totalCount }}</div>
              <div class="stat-label">总地震数</div>
              <div class="stat-trend" v-if="yearlyTrend">
                <i class="fas" :class="yearlyTrend > 0 ? 'fa-arrow-up trend-up' : 'fa-arrow-down trend-down'"></i>
                {{ Math.abs(yearlyTrend).toFixed(1) }}% 年度变化
              </div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon major-icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ majorEarthquakes }}</div>
              <div class="stat-label">强震数量 (M≥6.0)</div>
              <div class="stat-sub">占比 {{ ((majorEarthquakes / totalCount) * 100).toFixed(1) }}%</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon magnitude-icon">
              <i class="fas fa-chart-line"></i>
            </div>
            <div class="stat-content">
              <div class="stat-number">M{{ maxMagnitude?.toFixed(1) || '0.0' }}</div>
              <div class="stat-label">最大震级</div>
              <div class="stat-sub">平均: M{{ avgMagnitude?.toFixed(1) || '0.0' }}</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon depth-icon">
              <i class="fas fa-arrows-alt-v"></i>
            </div>
            <div class="stat-content">
              <div class="stat-number">{{ maxDepth?.toFixed(0) || '0' }}km</div>
              <div class="stat-label">最大深度</div>
              <div class="stat-sub">平均: {{ avgDepth?.toFixed(0) || '0' }}km</div>
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
          <button class="action-btn tertiary" @click="showSeismicBelts">
            <i class="fas fa-map-marked-alt"></i>
            地震带分析
          </button>
        </div>

        <!-- 震级分布环形图 -->
        <div class="chart-section">
          <h3 class="section-title">
            <i class="fas fa-chart-pie"></i>
            震级分布概览
          </h3>
          <div class="donut-chart-container">
            <div class="donut-chart" ref="donutChart">
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="80" fill="none" stroke="#f0f0f0" stroke-width="20"/>
                <circle 
                  v-for="(segment, index) in donutSegments" 
                  :key="index"
                  cx="100" 
                  cy="100" 
                  r="80" 
                  fill="none" 
                  :stroke="segment.color" 
                  stroke-width="20"
                  :stroke-dasharray="`${segment.length} ${502.4 - segment.length}`"
                  :stroke-dashoffset="segment.offset"
                  :title="`${segment.label}: ${segment.count}次 (${segment.percentage}%)`"
                  class="donut-segment"
                />
                <text x="100" y="95" text-anchor="middle" class="donut-total">{{ totalCount }}</text>
                <text x="100" y="115" text-anchor="middle" class="donut-label">地震总数</text>
              </svg>
            </div>
            <div class="donut-legend">
              <div 
                v-for="(segment, index) in donutSegments" 
                :key="index"
                class="legend-item"
              >
                <div class="legend-color" :style="{ backgroundColor: segment.color }"></div>
                <span class="legend-text">{{ segment.label }} ({{ segment.count }})</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 最近地震列表 -->
        <div class="recent-earthquakes">
          <h3 class="section-title">
            <i class="fas fa-clock"></i>
            最近强震 (M≥5.0)
            <span class="earthquake-count">({{ recentMajorEarthquakes.length }}条)</span>
          </h3>
          <div class="earthquake-list">
            <div 
              v-for="earthquake in recentMajorEarthquakes.slice(0, 8)" 
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
                  <span><i class="fas fa-arrows-alt-v"></i> {{ earthquake.depth?.toFixed(1) || '0' }}km</span>
                  <span><i class="fas fa-clock"></i> {{ formatDate(earthquake.date) }}</span>
                </div>
              </div>
              <div class="earthquake-coords">
                <div>{{ earthquake.longitude?.toFixed(3) || '0' }}°E</div>
                <div>{{ earthquake.latitude?.toFixed(3) || '0' }}°N</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 详细分析视图 -->
      <div v-else class="detailed-content">
        <!-- 历年地震数量趋势线图 -->
        <div class="chart-section full-width">
          <h3 class="section-title">
            <i class="fas fa-chart-line"></i>
            历年地震活动趋势
          </h3>
          <div class="line-chart-container">
            <svg class="line-chart" :width="lineChartWidth" height="300" viewBox="`0 0 ${lineChartWidth} 300`">
              <!-- 网格线 -->
              <g class="grid">
                <line 
                  v-for="i in 5" 
                  :key="`h-${i}`"
                  :x1="60" 
                  :y1="50 + (i-1) * 40" 
                  :x2="lineChartWidth - 40" 
                  :y2="50 + (i-1) * 40" 
                  stroke="#e0e0e0" 
                  stroke-width="1"
                />
                <line 
                  v-for="(year, index) in yearlyData" 
                  :key="`v-${index}`"
                  :x1="60 + index * yearStepWidth" 
                  :y1="50" 
                  :x2="60 + index * yearStepWidth" 
                  :y2="210" 
                  stroke="#e0e0e0" 
                  stroke-width="1"
                />
              </g>
              
              <!-- Y轴标签 -->
              <g class="y-axis">
                <text 
                  v-for="i in 5" 
                  :key="`y-${i}`"
                  :x="50" 
                  :y="55 + (5-i) * 40" 
                  text-anchor="end" 
                  class="axis-label"
                >
                  {{ Math.round(maxYearlyCount * (i-1) / 4) }}
                </text>
              </g>
              
              <!-- X轴标签 -->
              <g class="x-axis">
                <text 
                  v-for="(year, index) in yearlyData" 
                  :key="`x-${index}`"
                  :x="60 + index * yearStepWidth" 
                  :y="230" 
                  text-anchor="middle" 
                  class="axis-label"
                >
                  {{ year.year }}
                </text>
              </g>
              
              <!-- 趋势线 -->
              <polyline 
                :points="trendLinePoints" 
                fill="none" 
                stroke="url(#lineGradient)" 
                stroke-width="3"
                class="trend-line"
              />
              
              <!-- 数据点 -->
              <g class="data-points">
                <circle 
                  v-for="(year, index) in yearlyData" 
                  :key="`point-${index}`"
                  :cx="60 + index * yearStepWidth"
                  :cy="210 - (year.count / maxYearlyCount) * 160"
                  r="5"
                  :fill="getYearPointColor(year.count)"
                  stroke="white"
                  stroke-width="2"
                  class="data-point"
                  @mouseover="showTooltip($event, year)"
                  @mouseout="hideTooltip"
                />
              </g>
              
              <!-- 渐变定义 -->
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                </linearGradient>
              </defs>
            </svg>
            
            <!-- 图表说明 -->
            <div class="chart-summary">
              <div class="summary-item">
                <span class="summary-label">数据年份:</span>
                <span class="summary-value">{{ yearlyData.length }}年</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">年均地震:</span>
                <span class="summary-value">{{ avgYearlyCount.toFixed(0) }}次</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">峰值年份:</span>
                <span class="summary-value">{{ peakYear?.year || '未知' }} ({{ peakYear?.count || 0 }}次)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 震级-深度散点图 -->
        <div class="chart-section full-width">
          <h3 class="section-title">
            <i class="fas fa-project-diagram"></i>
            震级-深度关系分析
          </h3>
          <div class="scatter-chart-container">
            <svg class="scatter-chart" width="600" height="350" viewBox="0 0 600 350">
              <!-- 网格 -->
              <g class="grid">
                <line 
                  v-for="i in 6" 
                  :key="`sh-${i}`"
                  x1="60" 
                  :y1="50 + (i-1) * 40" 
                  x2="540" 
                  :y2="50 + (i-1) * 40" 
                  stroke="#e0e0e0"
                />
                <line 
                  v-for="i in 9" 
                  :key="`sv-${i}`"
                  :x1="60 + (i-1) * 60" 
                  y1="50" 
                  :x2="60 + (i-1) * 60" 
                  y2="250" 
                  stroke="#e0e0e0"
                />
              </g>
              
              <!-- 坐标轴标签 -->
              <g class="axes">
                <!-- Y轴（深度） -->
                <text 
                  v-for="i in 6" 
                  :key="`sy-${i}`"
                  x="50" 
                  :y="55 + (6-i) * 40" 
                  text-anchor="end" 
                  class="axis-label"
                >
                  {{ Math.round(maxScatterDepth * (i-1) / 5) }}
                </text>
                
                <!-- X轴（震级） -->
                <text 
                  v-for="i in 9" 
                  :key="`sx-${i}`"
                  :x="60 + (i-1) * 60" 
                  y="270" 
                  text-anchor="middle" 
                  class="axis-label"
                >
                  {{ (i-1) + 1 }}
                </text>
                
                <!-- 轴标题 -->
                <text x="300" y="295" text-anchor="middle" class="axis-title">震级 (M)</text>
                <text x="25" y="150" text-anchor="middle" class="axis-title" transform="rotate(-90, 25, 150)">深度 (km)</text>
              </g>
              
              <!-- 散点 -->
              <g class="scatter-points">
                <circle 
                  v-for="(point, index) in scatterData" 
                  :key="`scatter-${index}`"
                  :cx="60 + (point.magnitude - 1) * 60"
                  :cy="250 - (point.depth / maxScatterDepth) * 200"
                  :r="getScatterPointSize(point.magnitude)"
                  :fill="getScatterPointColor(point.magnitude)"
                  :opacity="0.7"
                  class="scatter-point"
                  @mouseover="showScatterTooltip($event, point)"
                  @mouseout="hideTooltip"
                />
              </g>
            </svg>
            
            <div class="scatter-legend">
              <div class="legend-title">震级强度</div>
              <div class="magnitude-scale">
                <div v-for="i in 7" :key="i" class="scale-item">
                  <div 
                    class="scale-dot" 
                    :style="{ 
                      backgroundColor: getScatterPointColor(i + 1),
                      width: getScatterPointSize(i + 1) * 2 + 'px',
                      height: getScatterPointSize(i + 1) * 2 + 'px'
                    }"
                  ></div>
                  <span>M{{ i + 1 }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 地震带分析 -->
        <div class="chart-section full-width">
          <h3 class="section-title">
            <i class="fas fa-map"></i>
            主要地震带分布
          </h3>
          <div class="seismic-belts-analysis">
            <div class="belts-grid">
              <div 
                v-for="belt in seismicBelts" 
                :key="belt.name"
                class="belt-card"
                @click="focusOnBelt(belt)"
              >
                <div class="belt-header">
                  <h4 class="belt-name">{{ belt.name }}</h4>
                  <div class="belt-count">{{ belt.count }}次</div>
                </div>
                <div class="belt-stats">
                  <div class="belt-stat">
                    <span class="stat-label">平均震级:</span>
                    <span class="stat-value">M{{ belt.avgMagnitude.toFixed(1) }}</span>
                  </div>
                  <div class="belt-stat">
                    <span class="stat-label">最强震级:</span>
                    <span class="stat-value">M{{ belt.maxMagnitude.toFixed(1) }}</span>
                  </div>
                  <div class="belt-stat">
                    <span class="stat-label">平均深度:</span>
                    <span class="stat-value">{{ belt.avgDepth.toFixed(0) }}km</span>
                  </div>
                </div>
                <div class="belt-activity">
                  <div 
                    class="activity-bar" 
                    :style="{ width: (belt.count / maxBeltCount * 100) + '%' }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 时间分布热力图 -->
        <div class="chart-section full-width">
          <h3 class="section-title">
            <i class="fas fa-calendar-alt"></i>
            月度活动热力图
          </h3>
          <div class="heatmap-container">
            <div class="heatmap-grid">
              <div class="heatmap-months">
                <div v-for="month in 12" :key="month" class="month-label">
                  {{ getMonthName(month) }}
                </div>
              </div>
              <div class="heatmap-years">
                <div 
                  v-for="year in heatmapYears" 
                  :key="year" 
                  class="year-row"
                >
                  <div class="year-label">{{ year }}</div>
                  <div class="year-cells">
                    <div 
                      v-for="month in 12" 
                      :key="`${year}-${month}`"
                      class="heatmap-cell"
                      :class="getHeatmapCellClass(year, month)"
                      :title="`${year}年${month}月: ${getMonthCount(year, month)}次地震`"
                    >
                      <span class="cell-count">{{ getMonthCount(year, month) || '' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="heatmap-scale">
              <span class="scale-label">活动强度:</span>
              <div class="scale-gradient">
                <div class="scale-item" data-level="低">低</div>
                <div class="scale-item" data-level="中">中</div>
                <div class="scale-item" data-level="高">高</div>
                <div class="scale-item" data-level="极高">极高</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 悬浮提示框 -->
      <div 
        v-if="showTooltipData" 
        class="tooltip" 
        :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
      >
        {{ tooltipContent }}
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
    const currentView = ref('overview'); // 'overview' 或 'detailed'
    
    // 提示框相关
    const showTooltipData = ref(false);
    const tooltipX = ref(0);
    const tooltipY = ref(0);
    const tooltipContent = ref('');

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

    const avgMagnitude = computed(() => {
      if (props.earthquakeData.length === 0) return 0;
      const sum = props.earthquakeData.reduce((acc, eq) => acc + (eq.magnitude || 0), 0);
      return sum / props.earthquakeData.length;
    });

    const avgDepth = computed(() => {
      if (props.earthquakeData.length === 0) return 0;
      const sum = props.earthquakeData.reduce((acc, eq) => acc + (eq.depth || 0), 0);
      return sum / props.earthquakeData.length;
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
        .map(eq => {
          // 为每个地震添加解析后的时间用于排序
          const parsedDate = parseEarthquakeDate(eq.date);
          return {
            ...eq,
            _parsedDate: parsedDate
          };
        })
        .filter(eq => eq._parsedDate) // 只保留能成功解析时间的地震
        .sort((a, b) => b._parsedDate - a._parsedDate) // 按时间倒序排列
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
          const date = parseEarthquakeDate(eq.date);
          if (date && !isNaN(date.getTime())) {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (monthCounts.hasOwnProperty(key)) {
              monthCounts[key]++;
            }
          }
        }
      });

      const months = Object.keys(monthCounts).map(key => {
        const [year, month] = key.split('-');
        return {
          month: key,
          label: `${month}月`,
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

    // 年度趋势数据
    const yearlyData = computed(() => {
      const yearCounts = {};
      
      props.earthquakeData.forEach(eq => {
        const date = parseEarthquakeDate(eq.date);
        if (date && !isNaN(date.getTime())) {
          const year = date.getFullYear();
          yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
      });

      return Object.keys(yearCounts)
        .sort()
        .map(year => ({
          year: parseInt(year),
          count: yearCounts[year]
        }));
    });

    const maxYearlyCount = computed(() => {
      return Math.max(...yearlyData.value.map(y => y.count), 1);
    });

    const avgYearlyCount = computed(() => {
      if (yearlyData.value.length === 0) return 0;
      return yearlyData.value.reduce((sum, y) => sum + y.count, 0) / yearlyData.value.length;
    });

    const peakYear = computed(() => {
      return yearlyData.value.reduce((peak, current) => 
        current.count > (peak?.count || 0) ? current : peak, null);
    });

    const yearlyTrend = computed(() => {
      if (yearlyData.value.length < 2) return null;
      const recent = yearlyData.value.slice(-2);
      return ((recent[1].count - recent[0].count) / recent[0].count) * 100;
    });

    // 折线图相关
    const lineChartWidth = computed(() => Math.max(600, yearlyData.value.length * 60 + 100));
    const yearStepWidth = computed(() => (lineChartWidth.value - 100) / Math.max(1, yearlyData.value.length - 1));

    const trendLinePoints = computed(() => {
      return yearlyData.value.map((year, index) => {
        const x = 60 + index * yearStepWidth.value;
        const y = 210 - (year.count / maxYearlyCount.value) * 160;
        return `${x},${y}`;
      }).join(' ');
    });

    // 散点图数据
    const scatterData = computed(() => {
      return props.earthquakeData
        .filter(eq => eq.magnitude && eq.depth && eq.magnitude > 0 && eq.depth > 0)
        .map(eq => ({
          magnitude: eq.magnitude,
          depth: eq.depth,
          location: eq.location || '未知',
          date: eq.date
        }));
    });

    const maxScatterDepth = computed(() => {
      return Math.max(...scatterData.value.map(p => p.depth), 100);
    });

    // 环形图数据
    const donutSegments = computed(() => {
      const ranges = magnitudeRanges.value;
      const total = totalCount.value;
      const circumference = 502.4; // 2 * π * 80
      
      let currentOffset = 0;
      const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#43e97b', '#38f9d7'];
      
      return ranges.filter(r => r.count > 0).map((range, index) => {
        const percentage = ((range.count / total) * 100).toFixed(1);
        const length = (range.count / total) * circumference;
        const segment = {
          label: range.label,
          count: range.count,
          percentage,
          length,
          offset: -currentOffset,
          color: colors[index % colors.length]
        };
        currentOffset += length;
        return segment;
      });
    });

    // 地震带分析
    const seismicBelts = computed(() => {
      const belts = {
        '环太平洋地震带': { earthquakes: [], bounds: { minLat: -60, maxLat: 70, minLng: 120, maxLng: -60 } },
        '地中海-喜马拉雅地震带': { earthquakes: [], bounds: { minLat: 25, maxLat: 45, minLng: -10, maxLng: 140 } },
        '大西洋中脊地震带': { earthquakes: [], bounds: { minLat: -60, maxLat: 80, minLng: -40, maxLng: -10 } },
        '印度洋中脊地震带': { earthquakes: [], bounds: { minLat: -55, maxLat: 25, minLng: 40, maxLng: 100 } },
        '其他地区': { earthquakes: [], bounds: null }
      };

      props.earthquakeData.forEach(eq => {
        if (!eq.latitude || !eq.longitude) return;
        
        let assigned = false;
        for (const [beltName, belt] of Object.entries(belts)) {
          if (belt.bounds && isInBounds(eq, belt.bounds)) {
            belt.earthquakes.push(eq);
            assigned = true;
            break;
          }
        }
        
        if (!assigned) {
          belts['其他地区'].earthquakes.push(eq);
        }
      });

      return Object.entries(belts)
        .filter(([_, belt]) => belt.earthquakes.length > 0)
        .map(([name, belt]) => ({
          name,
          count: belt.earthquakes.length,
          avgMagnitude: belt.earthquakes.reduce((sum, eq) => sum + (eq.magnitude || 0), 0) / belt.earthquakes.length,
          maxMagnitude: Math.max(...belt.earthquakes.map(eq => eq.magnitude || 0)),
          avgDepth: belt.earthquakes.reduce((sum, eq) => sum + (eq.depth || 0), 0) / belt.earthquakes.length,
          earthquakes: belt.earthquakes
        }))
        .sort((a, b) => b.count - a.count);
    });

    const maxBeltCount = computed(() => {
      return Math.max(...seismicBelts.value.map(b => b.count), 1);
    });

    // 热力图数据
    const heatmapYears = computed(() => {
      const years = new Set();
      props.earthquakeData.forEach(eq => {
        const date = parseEarthquakeDate(eq.date);
        if (date && !isNaN(date.getTime())) {
          years.add(date.getFullYear());
        }
      });
      return Array.from(years).sort().slice(-10); // 最近10年
    });

    const monthlyHeatmapData = computed(() => {
      const data = {};
      
      props.earthquakeData.forEach(eq => {
        const date = parseEarthquakeDate(eq.date);
        if (date && !isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const key = `${year}-${month}`;
          data[key] = (data[key] || 0) + 1;
        }
      });
      
      return data;
    });

    // 方法
    const toggleView = () => {
      currentView.value = currentView.value === 'overview' ? 'detailed' : 'overview';
    };

    const isInBounds = (earthquake, bounds) => {
      const lat = earthquake.latitude;
      const lng = earthquake.longitude;
      return lat >= bounds.minLat && lat <= bounds.maxLat && 
             ((bounds.minLng < bounds.maxLng && lng >= bounds.minLng && lng <= bounds.maxLng) ||
              (bounds.minLng > bounds.maxLng && (lng >= bounds.minLng || lng <= bounds.maxLng)));
    };

    const getYearPointColor = (count) => {
      const ratio = count / maxYearlyCount.value;
      if (ratio > 0.8) return '#ff4b2b';
      if (ratio > 0.6) return '#f5576c';
      if (ratio > 0.4) return '#4facfe';
      if (ratio > 0.2) return '#43e97b';
      return '#667eea';
    };

    const getScatterPointSize = (magnitude) => {
      return Math.max(3, Math.min(12, magnitude * 1.5));
    };

    const getScatterPointColor = (magnitude) => {
      if (magnitude >= 7) return '#ff4b2b';
      if (magnitude >= 6) return '#f5576c';
      if (magnitude >= 5) return '#f093fb';
      if (magnitude >= 4) return '#4facfe';
      if (magnitude >= 3) return '#43e97b';
      return '#667eea';
    };

    const getMonthName = (month) => {
      const names = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      return names[month - 1];
    };

    const getMonthCount = (year, month) => {
      return monthlyHeatmapData.value[`${year}-${month}`] || 0;
    };

    const getHeatmapCellClass = (year, month) => {
      const count = getMonthCount(year, month);
      if (count === 0) return 'heatmap-empty';
      if (count <= 5) return 'heatmap-low';
      if (count <= 15) return 'heatmap-medium';
      if (count <= 30) return 'heatmap-high';
      return 'heatmap-extreme';
    };

    const showTooltip = (event, data) => {
      showTooltipData.value = true;
      tooltipX.value = event.clientX + 10;
      tooltipY.value = event.clientY - 10;
      tooltipContent.value = `${data.year}年: ${data.count}次地震`;
    };

    const showScatterTooltip = (event, data) => {
      showTooltipData.value = true;
      tooltipX.value = event.clientX + 10;
      tooltipY.value = event.clientY - 10;
      tooltipContent.value = `M${data.magnitude.toFixed(1)}, 深度${data.depth.toFixed(1)}km\n${data.location}`;
    };

    const hideTooltip = () => {
      showTooltipData.value = false;
    };

    const focusOnBelt = (belt) => {
      console.log('聚焦地震带:', belt.name);
      // 这里可以触发地图视角切换到该地震带
    };

    const showSeismicBelts = () => {
      console.log('显示地震带分析');
      // 可以在地图上高亮显示地震带
    };

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

    // 解析地震时间 - 修复版本，支持Excel序列号和字符串格式
    const parseEarthquakeDate = (dateInput) => {
      if (!dateInput) return null;
      
      try {
        // 如果是数字（Excel序列号）
        if (typeof dateInput === 'number') {
          // Excel序列号转换为日期
          // Excel以1900年1月1日为起点，但实际上1900年不是闰年，Excel有bug认为是闰年
          // 所以需要减去2天来修正
          const excelEpoch = new Date(1900, 0, 1); // 1900年1月1日
          const daysSince1900 = dateInput - 2; // 修正Excel的闰年bug
          const date = new Date(excelEpoch.getTime() + daysSince1900 * 24 * 60 * 60 * 1000);
          
          // 验证日期是否有效且在合理范围内
          if (!isNaN(date.getTime()) && 
              date.getFullYear() >= 1900 && 
              date.getFullYear() <= 2100) {
            return date;
          }
        }
        
        // 如果是字符串
        if (typeof dateInput === 'string') {
          const dateStr = dateInput.trim();
          
          // 处理 "2025/5/23  11:57:21" 格式（注意可能有多个空格）
          if (dateStr.includes('/')) {
            // 先清理多余空格，然后分割日期和时间
            const cleanDateStr = dateStr.replace(/\s+/g, ' '); // 将多个空格替换为单个空格
            const parts = cleanDateStr.split(' ');
            
            if (parts.length >= 1) {
              const datePart = parts[0]; // 日期部分
              const timePart = parts.length > 1 ? parts[1] : '00:00:00'; // 时间部分，如果没有则默认
              
              if (datePart) {
                const dateComponents = datePart.split('/');
                
                // 验证年月日是否有效
                if (dateComponents.length === 3) {
                  const [year, month, day] = dateComponents;
                  
                  // 补零处理
                  const paddedMonth = month.padStart(2, '0');
                  const paddedDay = day.padStart(2, '0');
                  
                  // 构建标准ISO格式
                  const isoDateStr = `${year}-${paddedMonth}-${paddedDay}T${timePart}`;
                  
                  const date = new Date(isoDateStr);
                  
                  // 验证日期是否有效
                  if (!isNaN(date.getTime())) {
                    return date;
                  }
                }
              }
            }
          }
          
          // 尝试直接解析其他格式
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
        
        return null;
      } catch (error) {
        console.warn('解析地震时间失败:', dateInput, error);
        return null;
      }
    };

    // 格式化日期 - 修复版本
    const formatDate = (dateStr) => {
      if (!dateStr) return '未知';
      
      const date = parseEarthquakeDate(dateStr);
      if (!date) return '未知时间';
      
      try {
        // 格式化为中文日期时间
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}年${month}月${day}日 ${hours}:${minutes}`;
      } catch (error) {
        console.warn('格式化时间失败:', dateStr, error);
        return '时间格式错误';
      }
    };

    return {
      isRefreshing,
      showHeatmap,
      currentView,
      showTooltipData,
      tooltipX,
      tooltipY,
      tooltipContent,
      totalCount,
      majorEarthquakes,
      maxMagnitude,
      maxDepth,
      avgMagnitude,
      avgDepth,
      yearlyTrend,
      magnitudeRanges,
      depthRanges,
      recentMajorEarthquakes,
      monthlyDistribution,
      yearlyData,
      maxYearlyCount,
      avgYearlyCount,
      peakYear,
      lineChartWidth,
      yearStepWidth,
      trendLinePoints,
      scatterData,
      maxScatterDepth,
      donutSegments,
      seismicBelts,
      maxBeltCount,
      heatmapYears,
      monthlyHeatmapData,
      toggleView,
      getYearPointColor,
      getScatterPointSize,
      getScatterPointColor,
      getMonthName,
      getMonthCount,
      getHeatmapCellClass,
      showTooltip,
      showScatterTooltip,
      hideTooltip,
      focusOnBelt,
      showSeismicBelts,
      handleOverlayClick,
      refreshData,
      toggleHeatmap,
      getMagnitudeClass,
      formatDate,
      parseEarthquakeDate
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

.stat-trend {
  font-size: 12px;
  margin-top: 4px;
}

.trend-up {
  color: #e74c3c;
}

.trend-down {
  color: #27ae60;
}

.stat-sub {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
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

.action-btn.tertiary {
  background: linear-gradient(135deg, #43e97b, #38f9d7);
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

.view-toggle-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.overview-content, .detailed-content {
  padding: 20px;
}

.full-width {
  grid-column: 1 / -1;
}

.stat-trend {
  font-size: 12px;
  margin-top: 4px;
}

.trend-up {
  color: #e74c3c;
}

.trend-down {
  color: #27ae60;
}

.stat-sub {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
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

.action-btn.tertiary {
  background: linear-gradient(135deg, #43e97b, #38f9d7);
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

.donut-chart-container {
  display: flex;
  align-items: center;
  gap: 30px;
}

.donut-chart svg {
  transform: rotate(-90deg);
}

.donut-segment {
  transition: all 0.2s;
  cursor: pointer;
}

.donut-segment:hover {
  stroke-width: 22;
}

.donut-total {
  font-size: 24px;
  font-weight: bold;
  fill: #333;
}

.donut-label {
  font-size: 12px;
  fill: #666;
}

.donut-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 折线图样式 */
.line-chart-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
}

.line-chart {
  width: 100%;
  overflow-x: auto;
}

.axis-label {
  font-size: 12px;
  fill: #666;
}

.axis-title {
  font-size: 14px;
  fill: #333;
  font-weight: bold;
}

.trend-line {
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}

.data-point {
  cursor: pointer;
  transition: all 0.2s;
}

.data-point:hover {
  r: 7;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}

.chart-summary {
  display: flex;
  gap: 30px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 12px;
  color: #666;
}

.summary-value {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

/* 散点图样式 */
.scatter-chart-container {
  display: flex;
  gap: 30px;
  background: white;
  border-radius: 8px;
  padding: 20px;
}

.scatter-point {
  cursor: pointer;
  transition: all 0.2s;
}

.scatter-point:hover {
  stroke: #333;
  stroke-width: 2;
}

.scatter-legend {
  min-width: 150px;
}

.legend-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 10px;
}

.magnitude-scale {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scale-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.scale-dot {
  border-radius: 50%;
  flex-shrink: 0;
}

/* 地震带分析样式 */
.belts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.belt-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.belt-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.belt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.belt-name {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.belt-count {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
}

.belt-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.belt-stat {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.belt-activity {
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
}

.activity-bar {
  height: 100%;
  background: linear-gradient(90deg, #43e97b, #38f9d7);
  transition: width 0.3s ease;
}

/* 热力图样式 */
.heatmap-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
}

.heatmap-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.heatmap-months {
  display: flex;
  margin-left: 60px;
}

.month-label {
  width: 30px;
  text-align: center;
  font-size: 12px;
  color: #666;
  margin-right: 2px;
}

.year-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
}

.year-label {
  width: 50px;
  font-size: 12px;
  color: #666;
  text-align: right;
}

.year-cells {
  display: flex;
  gap: 2px;
}

.heatmap-cell {
  width: 30px;
  height: 20px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.heatmap-empty {
  background: #f8f9fa;
  color: #999;
}

.heatmap-low {
  background: #c6e48b;
}

.heatmap-medium {
  background: #7bc96f;
}

.heatmap-high {
  background: #239a3b;
}

.heatmap-extreme {
  background: #196127;
}

.heatmap-cell:hover {
  transform: scale(1.1);
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.heatmap-scale {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.scale-label {
  font-size: 12px;
  color: #666;
}

.scale-gradient {
  display: flex;
  gap: 5px;
}

.scale-gradient .scale-item {
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  color: white;
}

.scale-gradient .scale-item[data-level="低"] {
  background: #c6e48b;
}

.scale-gradient .scale-item[data-level="中"] {
  background: #7bc96f;
}

.scale-gradient .scale-item[data-level="高"] {
  background: #239a3b;
}

.scale-gradient .scale-item[data-level="极高"] {
  background: #196127;
}

/* 提示框样式 */
.tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  z-index: 10000;
  white-space: pre-line;
}

/* 图表图标样式 */
.section-title i {
  margin-right: 8px;
  color: #667eea;
}
</style>
