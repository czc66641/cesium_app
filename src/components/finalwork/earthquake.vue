<template>
  <div class="analysis-section">
    <div class="section-title">地震信息分析</div>
    
    <!-- 数据加载控制 -->
    <div class="input-group">
      <div v-if="!dataLoaded" class="data-load-controls">
        <button @click="loadEarthquakeData" :disabled="isLoading" class="btn-primary full-width-btn">
          {{ isLoading ? '加载中...' : '加载地震数据' }}
        </button>
      </div>
      <div v-else class="data-controls">
        <div class="data-status">
          <span class="status-text">已加载 {{ earthquakeData.length }} 条地震记录</span>
          <button @click="clearData" class="btn-secondary">清除数据</button>
        </div>
      </div>
    </div>

    <!-- 显示控制 -->
    <div v-if="dataLoaded" class="input-group">
      <label>显示控制:</label>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" v-model="showPoints" @change="togglePointsDisplay"> 
          显示地震点
        </label>
        <label class="checkbox-label">
          <input type="checkbox" v-model="showLabels" @change="toggleLabelsDisplay"> 
          显示标签
        </label>
        <label class="checkbox-label">
          <input type="checkbox" v-model="showRadiantCircles" @change="toggleRadiantCircles"> 
          显示强震辐射圈 (M≥6.0)
        </label>
      </div>
      <div v-if="showRadiantCircles" class="radiant-info">
        <small>当前显示 {{ radiantCircleCount }} 个辐射圈</small>
      </div>
    </div>

    <!-- 显示数量限制 -->
    <div v-if="dataLoaded" class="input-group">
      <label>显示数量控制:</label>
      <div class="display-limit-control">
        <div class="range-input">
          <label>当前显示: {{ filteredData.length }} / {{ earthquakeData.length }}</label>
          <input 
            type="range" 
            :min="100" 
            :max="Math.min(10000, earthquakeData.length)" 
            :step="100" 
            v-model.number="maxDisplayCount" 
            class="range-slider"
          />
        </div>
        <div class="limit-buttons">
          <button @click="setDisplayLimit(100)" class="limit-btn" :class="{ active: maxDisplayCount === 100 }">
            100
          </button>
          <button @click="setDisplayLimit(500)" class="limit-btn" :class="{ active: maxDisplayCount === 500 }">
            500
          </button>
          <button @click="setDisplayLimit(1000)" class="limit-btn" :class="{ active: maxDisplayCount === 1000 }">
            1000
          </button>
          <button @click="setDisplayLimit(5000)" class="limit-btn" :class="{ active: maxDisplayCount === 5000 }">
            5000
          </button>
          <button @click="setDisplayLimit(10000)" class="limit-btn" :class="{ active: maxDisplayCount === 10000 }">
            全部
          </button>
        </div>
      </div>
    </div>

    <!-- 震级筛选 -->
    <div v-if="dataLoaded" class="input-group">
      <label>震级筛选: {{ magnitudeRange[0] }} - {{ magnitudeRange[1] }}</label>
      <div class="range-inputs">
        <input 
          type="range" 
          min="0" 
          max="9" 
          step="0.1" 
          v-model.number="magnitudeRange[0]" 
          class="range-slider"
        />
        <input 
          type="range" 
          min="0" 
          max="9" 
          step="0.1" 
          v-model.number="magnitudeRange[1]" 
          class="range-slider"
        />
      </div>
    </div>

    <!-- 深度筛选 -->
    <div v-if="dataLoaded" class="input-group">
      <label>深度筛选 (km): {{ depthFilter[0] }} - {{ depthFilter[1] }}</label>
      <div class="range-inputs">
        <input 
          type="range" 
          min="0" 
          max="1000" 
          step="10" 
          v-model.number="depthFilter[0]" 
          class="range-slider"
        />
        <input 
          type="range" 
          min="0" 
          max="1000" 
          step="10" 
          v-model.number="depthFilter[1]" 
          class="range-slider"
        />
      </div>
    </div>

    <!-- 时间筛选 -->
    <div v-if="dataLoaded" class="input-group">
      <label>时间筛选:</label>
      <div class="date-inputs">
        <input type="date" v-model="startDate" placeholder="开始日期" />
        <input type="date" v-model="endDate" placeholder="结束日期" />
      </div>
    </div>

    <!-- 统计信息面板 - 大幅增强 -->
    <div v-if="earthquakeStats" class="enhanced-stats-panel">
      <div class="stats-header">
        <div class="stats-title">
          <i class="fas fa-chart-bar"></i>
          详细统计分析
        </div>
        <div class="stats-tabs">
          <button 
            v-for="tab in statsTabs" 
            :key="tab.key"
            @click="activeStatsTab = tab.key"
            :class="['stats-tab', { active: activeStatsTab === tab.key }]"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- 基础统计 -->
      <div v-if="activeStatsTab === 'basic'" class="stats-content">
        <div class="stats-grid">
          <div class="stat-item highlight">
            <div class="stat-icon">📊</div>
            <div class="stat-info">
              <span class="stat-label">总数</span>
              <span class="stat-value">{{ earthquakeStats.total }}</span>
            </div>
          </div>
          
          <div class="stat-item">
            <div class="stat-icon">📏</div>
            <div class="stat-info">
              <span class="stat-label">震级范围</span>
              <span class="stat-value">M{{ earthquakeStats.minMagnitude?.toFixed(1) }} - M{{ earthquakeStats.maxMagnitude?.toFixed(1) }}</span>
            </div>
          </div>
          
          <div class="stat-item">
            <div class="stat-icon">📐</div>
            <div class="stat-info">
              <span class="stat-label">深度范围</span>
              <span class="stat-value">{{ earthquakeStats.minDepth?.toFixed(0) }} - {{ earthquakeStats.maxDepth?.toFixed(0) }}km</span>
            </div>
          </div>
          
          <div class="stat-item">
            <div class="stat-icon">📅</div>
            <div class="stat-info">
              <span class="stat-label">时间跨度</span>
              <span class="stat-value">{{ earthquakeStats.timeSpanDays }}天</span>
            </div>
          </div>
          
          <div class="stat-item">
            <div class="stat-icon">📈</div>
            <div class="stat-info">
              <span class="stat-label">平均震级</span>
              <span class="stat-value">M{{ earthquakeStats.avgMagnitude?.toFixed(2) }}</span>
            </div>
          </div>
          
          <div class="stat-item">
            <div class="stat-icon">📊</div>
            <div class="stat-info">
              <span class="stat-label">平均深度</span>
              <span class="stat-value">{{ earthquakeStats.avgDepth?.toFixed(1) }}km</span>
            </div>
          </div>
        </div>

        <!-- 震级分级统计 -->
        <div class="magnitude-distribution">
          <h4>震级分级统计</h4>
          <div class="magnitude-levels">
            <div 
              v-for="level in earthquakeStats.magnitudeLevels" 
              :key="level.range"
              class="magnitude-level"
              :style="{ backgroundColor: level.color }"
            >
              <span class="level-range">{{ level.range }}</span>
              <span class="level-count">{{ level.count }}次</span>
              <span class="level-percentage">({{ level.percentage }}%)</span>
            </div>
          </div>
        </div>

        <!-- 深度分级统计 -->
        <div class="depth-distribution">
          <h4>震源深度分级</h4>
          <div class="depth-levels">
            <div 
              v-for="level in earthquakeStats.depthLevels" 
              :key="level.range"
              class="depth-level"
            >
              <span class="level-range">{{ level.range }}</span>
              <span class="level-count">{{ level.count }}次</span>
              <span class="level-percentage">({{ level.percentage }}%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 时间分析 -->
      <div v-if="activeStatsTab === 'time'" class="stats-content">
        <div class="time-analysis">
          <div class="time-summary">
            <div class="time-stat-item">
              <span class="time-label">数据时间范围:</span>
              <span class="time-value">{{ earthquakeStats.dateRange }}</span>
            </div>
            <div class="time-stat-item">
              <span class="time-label">最新记录:</span>
              <span class="time-value">{{ earthquakeStats.latestEarthquake?.date }}</span>
            </div>
            <div class="time-stat-item">
              <span class="time-label">最早记录:</span>
              <span class="time-value">{{ earthquakeStats.earliestEarthquake?.date }}</span>
            </div>
            <div class="time-stat-item">
              <span class="time-label">平均频率:</span>
              <span class="time-value">{{ earthquakeStats.avgFrequency }}</span>
            </div>
          </div>

          <!-- 年度统计 -->
          <div class="yearly-stats" v-if="earthquakeStats.yearlyStats">
            <h4>历年地震统计</h4>
            <div class="yearly-chart">
              <div 
                v-for="year in earthquakeStats.yearlyStats" 
                :key="year.year"
                class="year-bar"
                :style="{ height: `${(year.count / earthquakeStats.maxYearlyCount) * 100}px` }"
                :title="`${year.year}年: ${year.count}次地震，平均震级: M${year.avgMagnitude.toFixed(1)}`"
              >
                <div class="year-label">{{ year.year }}</div>
                <div class="year-count">{{ year.count }}</div>
              </div>
            </div>
          </div>

          <!-- 月度分布 -->
          <div class="monthly-stats" v-if="earthquakeStats.monthlyStats">
            <h4>月度分布统计</h4>
            <div class="monthly-chart">
              <div 
                v-for="month in earthquakeStats.monthlyStats" 
                :key="month.month"
                class="month-bar"
                :style="{ height: `${(month.count / earthquakeStats.maxMonthlyCount) * 60}px` }"
                :title="`${month.month}月: ${month.count}次地震`"
              >
                <div class="month-label">{{ month.month }}月</div>
                <div class="month-count">{{ month.count }}</div>
              </div>
            </div>
          </div>

          <!-- 小时分布 -->
          <div class="hourly-stats" v-if="earthquakeStats.hourlyStats">
            <h4>24小时分布</h4>
            <div class="hourly-chart">
              <div 
                v-for="hour in earthquakeStats.hourlyStats" 
                :key="hour.hour"
                class="hour-bar"
                :style="{ height: `${(hour.count / earthquakeStats.maxHourlyCount) * 40}px` }"
                :title="`${hour.hour}时: ${hour.count}次地震`"
              >
                <div class="hour-label">{{ hour.hour }}</div>
                <div class="hour-count">{{ hour.count }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 地理分析 -->
      <div v-if="activeStatsTab === 'geography'" class="stats-content">
        <div class="geography-analysis">
          <div class="region-stats">
            <h4>地理区域统计</h4>
            <div class="region-list">
              <div 
                v-for="region in earthquakeStats.regionStats" 
                :key="region.name"
                class="region-item"
                @click="focusOnRegion(region)"
              >
                <span class="region-name">{{ region.name }}</span>
                <span class="region-count">{{ region.count }}次</span>
                <span class="region-max-mag">最大M{{ region.maxMagnitude?.toFixed(1) }}</span>
              </div>
            </div>
          </div>

          <div class="coordinates-stats">
            <h4>坐标分布</h4>
            <div class="coord-range">
              <div class="coord-item">
                <span class="coord-label">经度范围:</span>
                <span class="coord-value">{{ earthquakeStats.lonRange?.min?.toFixed(3) }}° - {{ earthquakeStats.lonRange?.max?.toFixed(3) }}°</span>
              </div>
              <div class="coord-item">
                <span class="coord-label">纬度范围:</span>
                <span class="coord-value">{{ earthquakeStats.latRange?.min?.toFixed(3) }}° - {{ earthquakeStats.latRange?.max?.toFixed(3) }}°</span>
              </div>
              <div class="coord-item">
                <span class="coord-label">覆盖面积:</span>
                <span class="coord-value">约{{ earthquakeStats.coverageArea }}平方公里</span>
              </div>
            </div>
          </div>

          <div class="density-analysis">
            <h4>密度分析</h4>
            <div class="density-stats">
              <div class="density-item">
                <span class="density-label">平均密度:</span>
                <span class="density-value">{{ earthquakeStats.avgDensity }}</span>
              </div>
              <div class="density-item">
                <span class="density-label">最高密度区域:</span>
                <span class="density-value">{{ earthquakeStats.highDensityRegion }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 风险评估 -->
      <div v-if="activeStatsTab === 'risk'" class="stats-content">
        <div class="risk-analysis">
          <div class="risk-level">
            <h4>整体风险评级</h4>
            <div class="risk-indicator" :class="earthquakeStats.riskLevel?.level">
              <div class="risk-badge">{{ earthquakeStats.riskLevel?.label }}</div>
              <div class="risk-score">风险指数: {{ earthquakeStats.riskLevel?.score }}/100</div>
            </div>
          </div>

          <div class="risk-factors">
            <h4>风险因子分析</h4>
            <div class="factor-list">
              <div 
                v-for="factor in earthquakeStats.riskFactors" 
                :key="factor.name"
                class="factor-item"
              >
                <span class="factor-name">{{ factor.name }}</span>
                <div class="factor-bar">
                  <div 
                    class="factor-fill"
                    :style="{ width: `${factor.value}%`, backgroundColor: factor.color }"
                  ></div>
                </div>
                <span class="factor-value">{{ factor.value }}%</span>
              </div>
            </div>
          </div>

          <div class="warning-earthquakes">
            <h4>高风险地震记录</h4>
            <div class="warning-list">
              <div 
                v-for="eq in earthquakeStats.warningEarthquakes" 
                :key="eq.id"
                class="warning-item"
                @click="locateEarthquake(eq)"
              >
                <span class="warning-magnitude">M{{ eq.magnitude?.toFixed(1) }}</span>
                <span class="warning-location">{{ eq.location }}</span>
                <span class="warning-date">{{ formatDateTime(eq.date) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 状态信息 -->
    <div class="status-message" v-if="statusMessage">{{ statusMessage }}</div>
  </div>
</template>

<script>
import { defineComponent, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';
import { RadiantCircleManager } from '../../utils/RadiantCircle.js';

export default defineComponent({
  name: 'Earthquake',
  props: {
    viewer: {
      type: Object,
      required: true,
    },
    currentLocation: {
      type: Object,
      required: true,
    },
    preserveDataOnClose: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update-location', 'earthquake-data-loaded'],
  setup(props, { emit }) {
    // 状态变量
    const dataLoaded = ref(false);
    const isLoading = ref(false);
    const statusMessage = ref('');
    const earthquakeData = ref([]);
    const filteredData = ref([]);
    
    // 显示控制
    const showPoints = ref(true);
    const showLabels = ref(false);
    const showRadiantCircles = ref(true);
    
    // 筛选控制
    const magnitudeRange = ref([0.0, 8.0]);
    const depthFilter = ref([0, 1000]);
    const startDate = ref('');
    const endDate = ref('');
    const maxDisplayCount = ref(1000);
    
    // 选中的地震信息
    const selectedEarthquake = ref(null);
    
    // 统计信息
    const earthquakeStats = ref(null);
    
    // Cesium 实体管理
    let earthquakeDataSource = null;
    let clickHandler = null;
    
    // 辐射圈管理器
    let radiantManager = null;
    
    // 辐射圈数量计算属性
    const radiantCircleCount = computed(() => {
      return radiantManager ? radiantManager.getCount() : 0;
    });

    // 新增统计标签页状态
    const activeStatsTab = ref('basic');
    const statsTabs = [
      { key: 'basic', label: '基础统计' },
      { key: 'time', label: '时间分析' },
      { key: 'geography', label: '地理分析' },
      { key: 'risk', label: '风险评估' }
    ];

    // 生成模拟地震数据
    const generateMockEarthquakeData = () => {
      const data = [];
      const centerLat = props.currentLocation.latitude || 39.9;
      const centerLon = props.currentLocation.longitude || 116.4;
      
      for (let i = 0; i < 2000; i++) {
        const lat = centerLat + (Math.random() - 0.5) * 20;
        const lon = centerLon + (Math.random() - 0.5) * 20;
        const magnitude = Math.random() * 8 + 1;
        const depth = Math.random() * 800 + 10;
        
        // 生成随机时间（过去一年内）
        const randomTime = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);
        const timeStr = `${randomTime.getFullYear()}-${randomTime.getMonth() + 1}-${randomTime.getDate()} ${randomTime.getHours()}:${randomTime.getMinutes()}:${randomTime.getSeconds()}`;
        
        data.push({
          id: i + 1,
          序号: i + 1,
          date: timeStr,
          longitude: lon,
          latitude: lat,
          depth: depth,
          magnitude: magnitude,
          location: `地震点 ${i + 1}`,
          type: '天然地震'
        });
      }
      
      return data;
    };

    // 修复 loadEarthquakeData 函数
    const loadEarthquakeData = async () => {
      if (isLoading.value) return;
      
      try {
        isLoading.value = true;
        statusMessage.value = '正在加载地震数据...';
        
        // 初始化辐射圈管理器
        if (!radiantManager) {
          radiantManager = new RadiantCircleManager(props.viewer);
        }
        
        let processedData;
        
        try {
          // 尝试读取Excel文件
          const response = await fetch('/data/速报目录.xls');
          if (!response.ok) {
            throw new Error('Excel文件未找到，使用模拟数据');
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          processedData = jsonData.map((row, index) => ({
            id: index + 1,
            序号: row['序号'],
            date: row['发震日期（北京时间）'],
            longitude: parseFloat(row['经度(°)']),
            latitude: parseFloat(row['纬度(°)']),
            depth: parseFloat(row['震源深度(Km)']),
            magnitude: parseFloat(row['震级(M)']),
            location: row['震中位置'],
            type: row['事件类型']
          })).filter(item => 
            !isNaN(item.longitude) && 
            !isNaN(item.latitude) && 
            !isNaN(item.magnitude)
          );
        } catch (excelError) {
          console.warn('Excel读取失败，使用模拟数据:', excelError);
          processedData = generateMockEarthquakeData();
        }
        
        earthquakeData.value = processedData;
        filteredData.value = [...processedData];
        earthquakeStats.value = computeEnhancedStats(processedData);
        
        // 发射数据加载事件，传递给父组件
        emit('earthquake-data-loaded', processedData);
        console.log('地震数据已加载，发射事件给父组件:', processedData.length, '条记录');
        
        // 设置默认筛选日期范围
        if (processedData.length > 0) {
          const dates = processedData.map(item => parseEarthquakeDate(item.date)).filter(d => d);
          if (dates.length > 0) {
            const minDate = new Date(Math.min(...dates));
            const maxDate = new Date(Math.max(...dates));
            startDate.value = minDate.toISOString().split('T')[0];
            endDate.value = maxDate.toISOString().split('T')[0];
          }
        }
        
        dataLoaded.value = true;
        
        // 创建可视化
        await createEarthquakeVisualization();
        
        // 设置点击事件监听
        setupClickHandler();
        
        statusMessage.value = `成功加载 ${processedData.length} 条地震记录`;
        
        setTimeout(() => {
          if (statusMessage.value.includes('成功加载')) {
            statusMessage.value = '';
          }
        }, 3000);
        
      } catch (error) {
        console.error('加载地震数据失败:', error);
        statusMessage.value = `加载失败: ${error.message}`;
      } finally {
        isLoading.value = false;
      }
    };

    // 修复统计计算函数中的数据处理
    const computeEnhancedStats = (data) => {
      if (!data || data.length === 0) return null;
      
      // 基础统计
      const magnitudes = data.map(item => item.magnitude).filter(m => !isNaN(m));
      const depths = data.map(item => item.depth).filter(d => !isNaN(d));
      const dates = data.map(item => parseEarthquakeDate(item.date)).filter(d => d);
      
      // 坐标统计
      const longitudes = data.map(item => item.longitude).filter(lng => !isNaN(lng));
      const latitudes = data.map(item => item.latitude).filter(lat => !isNaN(lat));

      if (magnitudes.length === 0) return null;

      // 基础计算
      const minMagnitude = Math.min(...magnitudes);
      const maxMagnitude = Math.max(...magnitudes);
      const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
      
      const minDepth = depths.length > 0 ? Math.min(...depths) : 0;
      const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
      const avgDepth = depths.length > 0 ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;

      // 时间分析
      const sortedDates = dates.sort((a, b) => a - b);
      const earliestDate = sortedDates[0];
      const latestDate = sortedDates[sortedDates.length - 1];
      const timeSpanDays = dates.length > 1 ? Math.ceil((latestDate - earliestDate) / (1000 * 60 * 60 * 24)) : 0;
      
      // 震级分级统计
      const magnitudeLevels = [
        { range: '1.0-2.9', min: 1.0, max: 2.9, color: '#90EE90', count: 0 },
        { range: '3.0-3.9', min: 3.0, max: 3.9, color: '#FFFF00', count: 0 },
        { range: '4.0-4.9', min: 4.0, max: 4.9, color: '#FFA500', count: 0 },
        { range: '5.0-5.9', min: 5.0, max: 5.9, color: '#FF6347', count: 0 },
        { range: '6.0-6.9', min: 6.0, max: 6.9, color: '#FF0000', count: 0 },
        { range: '7.0+', min: 7.0, max: 10.0, color: '#8B0000', count: 0 }
      ];

      magnitudes.forEach(mag => {
        const level = magnitudeLevels.find(l => mag >= l.min && (mag < l.max || l.range === '7.0+')) || magnitudeLevels[magnitudeLevels.length - 1];
        level.count++;
      });

      magnitudeLevels.forEach(level => {
        level.percentage = ((level.count / magnitudes.length) * 100).toFixed(1);
      });

      // 深度分级统计
      const depthLevels = [
        { range: '0-10km (浅源)', min: 0, max: 10, count: 0 },
        { range: '10-70km (中源)', min: 10, max: 70, count: 0 },
        { range: '70-300km (深源)', min: 70, max: 300, count: 0 },
        { range: '300km+ (极深)', min: 300, max: 1000, count: 0 }
      ];

      depths.forEach(depth => {
        const level = depthLevels.find(l => depth >= l.min && (depth < l.max || l.range === '300km+ (极深)')) || depthLevels[depthLevels.length - 1];
        level.count++;
      });

      depthLevels.forEach(level => {
        level.percentage = depths.length > 0 ? ((level.count / depths.length) * 100).toFixed(1) : '0.0';
      });

      // 年度统计
      const yearlyMap = new Map();
      dates.forEach((date, index) => {
        const year = date.getFullYear();
        if (!yearlyMap.has(year)) {
          yearlyMap.set(year, { count: 0, magnitudes: [] });
        }
        yearlyMap.get(year).count++;
        if (magnitudes[index] !== undefined) {
          yearlyMap.get(year).magnitudes.push(magnitudes[index]);
        }
      });

      const yearlyStats = Array.from(yearlyMap.entries()).map(([year, stats]) => ({
        year,
        count: stats.count,
        avgMagnitude: stats.magnitudes.length > 0 ? stats.magnitudes.reduce((a, b) => a + b, 0) / stats.magnitudes.length : 0
      })).sort((a, b) => a.year - b.year);

      // 月度统计
      const monthlyMap = new Map();
      for (let i = 1; i <= 12; i++) {
        monthlyMap.set(i, 0);
      }
      dates.forEach(date => {
        const month = date.getMonth() + 1;
        monthlyMap.set(month, monthlyMap.get(month) + 1);
      });

      const monthlyStats = Array.from(monthlyMap.entries()).map(([month, count]) => ({
        month,
        count
      }));

      // 小时分布统计
      const hourlyMap = new Map();
      for (let i = 0; i < 24; i++) {
        hourlyMap.set(i, 0);
      }
      dates.forEach(date => {
        const hour = date.getHours();
        hourlyMap.set(hour, hourlyMap.get(hour) + 1);
      });

      const hourlyStats = Array.from(hourlyMap.entries()).map(([hour, count]) => ({
        hour,
        count
      }));

      // 地理统计
      const lonRange = longitudes.length > 0 ? { min: Math.min(...longitudes), max: Math.max(...longitudes) } : { min: 0, max: 0 };
      const latRange = latitudes.length > 0 ? { min: Math.min(...latitudes), max: Math.max(...latitudes) } : { min: 0, max: 0 };
      
      // 计算覆盖面积（粗略估算）
      const lonDiff = lonRange.max - lonRange.min;
      const latDiff = latRange.max - latRange.min;
      const coverageArea = Math.round(lonDiff * latDiff * 111 * 111); // 转换为平方公里

      // 地区统计（基于位置名称）
      const regionMap = new Map();
      data.forEach(eq => {
        if (eq.location) {
          const region = extractRegionFromLocation(eq.location);
          if (!regionMap.has(region)) {
            regionMap.set(region, { count: 0, maxMagnitude: 0 });
          }
          regionMap.get(region).count++;
          regionMap.get(region).maxMagnitude = Math.max(regionMap.get(region).maxMagnitude, eq.magnitude || 0);
        }
      });

      const regionStats = Array.from(regionMap.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // 取前10个地区

      // 风险评估
      const riskLevel = calculateRiskLevel(data, magnitudes, timeSpanDays);
      const riskFactors = calculateRiskFactors(data, magnitudes, depths);
      
      // 高风险地震（M≥6.0）
      const warningEarthquakes = data.filter(eq => eq.magnitude >= 6.0)
        .sort((a, b) => b.magnitude - a.magnitude)
        .slice(0, 10);

      return {
        total: data.length,
        minMagnitude,
        maxMagnitude,
        avgMagnitude,
        minDepth,
        maxDepth,
        avgDepth,
        timeSpanDays,
        dateRange: dates.length > 0 ? 
          `${earliestDate?.toLocaleDateString()} - ${latestDate?.toLocaleDateString()}` : 
          '无有效日期',
        latestEarthquake: data.find(eq => parseEarthquakeDate(eq.date)?.getTime() === latestDate?.getTime()),
        earliestEarthquake: data.find(eq => parseEarthquakeDate(eq.date)?.getTime() === earliestDate?.getTime()),
        avgFrequency: timeSpanDays > 0 ? `每天${(data.length / timeSpanDays).toFixed(2)}次` : '无法计算',
        magnitudeLevels,
        depthLevels,
        yearlyStats,
        maxYearlyCount: yearlyStats.length > 0 ? Math.max(...yearlyStats.map(y => y.count)) : 0,
        monthlyStats,
        maxMonthlyCount: monthlyStats.length > 0 ? Math.max(...monthlyStats.map(m => m.count)) : 0,
        hourlyStats,
        maxHourlyCount: hourlyStats.length > 0 ? Math.max(...hourlyStats.map(h => h.count)) : 0,
        lonRange,
        latRange,
        coverageArea,
        regionStats,
        avgDensity: coverageArea > 0 ? `${(data.length / coverageArea * 1000).toFixed(2)}次/千平方公里` : '无法计算',
        highDensityRegion: regionStats[0]?.name || '暂无数据',
        riskLevel,
        riskFactors,
        warningEarthquakes
      };
    };

    // 解析地震时间的函数
    const parseEarthquakeDate = (dateStr) => {
      // 首先检查输入是否为空或undefined
      if (!dateStr && dateStr !== 0) return null;
      
      try {
        // 如果是数字类型，可能是Excel日期序列号
        if (typeof dateStr === 'number') {
          // Excel日期序列号转换为JavaScript Date
          // Excel起始日期是1900年1月1日，但有一个bug认为1900年是闰年
          // 所以需要减去2天来修正
          const excelEpoch = new Date(1900, 0, 1); // 1900年1月1日
          const daysSinceEpoch = dateStr - 2; // 修正Excel的闰年bug
          const jsDate = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000);
          
          if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() > 1900 && jsDate.getFullYear() < 2100) {
            return jsDate;
          }
        }
        
        // 确保dateStr是字符串类型
        const cleanDateStr = String(dateStr).trim();
        
        // 如果转换后仍为空，返回null
        if (!cleanDateStr) return null;
        
        // 检查是否是纯数字字符串（可能是序列号）
        const numericDate = parseFloat(cleanDateStr);
        if (!isNaN(numericDate) && numericDate > 25000 && numericDate < 80000) {
          // 看起来像Excel日期序列号
          const excelEpoch = new Date(1900, 0, 1);
          const daysSinceEpoch = numericDate - 2;
          const jsDate = new Date(excelEpoch.getTime() + daysSinceEpoch * 24 * 60 * 60 * 1000);
          
          if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() > 1900 && jsDate.getFullYear() < 2100) {
            return jsDate;
          }
        }
        
        // 尝试多种日期格式 - 针对你的格式 "2025-5-23 11:57:21"
        const formats = [
          // 标准格式: "2025-5-23 11:57:21"
          /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/,
          // 只有日期: "2025-5-23"
          /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
          // ISO格式: "2025-05-23T11:57:21"
          /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
          // 斜杠格式: "2025/5/23 11:57:21"
          /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/,
          // 斜杠日期格式: "2025/5/23"
          /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
          // 中文格式: "2025年5月23日"
          /^(\d{4})年(\d{1,2})月(\d{1,2})日/
        ];

        for (const format of formats) {
          const match = cleanDateStr.match(format);
          if (match) {
            const [, year, month, day, hour = 0, minute = 0, second = 0] = match;
            
            // 创建Date对象，注意月份需要减1
            const date = new Date(
              parseInt(year),
              parseInt(month) - 1, // JavaScript月份从0开始
              parseInt(day),
              parseInt(hour),
              parseInt(minute),
              parseInt(second)
            );
            
            // 验证创建的日期是否有效且在合理范围内
            if (!isNaN(date.getTime()) && 
                date.getFullYear() > 1900 && 
                date.getFullYear() < 2100) {
              return date;
            }
          }
        }

        // 如果正则匹配都失败，尝试直接解析
        const directParsed = new Date(cleanDateStr);
        if (!isNaN(directParsed.getTime()) && 
            directParsed.getFullYear() > 1900 && 
            directParsed.getFullYear() < 2100) {
          return directParsed;
        }

        console.warn('无法解析日期格式:', cleanDateStr, '原始值:', dateStr);
        return null;
        
      } catch (error) {
        console.error('解析日期时出错:', error, 'dateStr:', dateStr);
        return null;
      }
    };

    // 从位置字符串提取地区信息
    const extractRegionFromLocation = (location) => {
      if (!location) return '未知地区';
      
      // 简单的地区提取逻辑
      const patterns = [
        /(\w+省)/,
        /(\w+市)/,
        /(\w+县)/,
        /(\w+区)/,
        /(\w+州)/,
        /(\w+自治区)/,
        // 新增的匹配模式
        /(\w+地区)/,
        /(\w+乡镇)/
      ];

      for (const pattern of patterns) {
        const match = location.match(pattern);
        if (match) {
          return match[1];
        }
      }

      // 如果没有匹配到，返回前几个字符
      return location.length > 6 ? location.substring(0, 6) + '...' : location;
    };

    // 计算风险等级
    const calculateRiskLevel = (data, magnitudes, timeSpanDays) => {
      let score = 0;
      
      // 基于震级分布计算风险
      const highMagCount = magnitudes.filter(m => m >= 6.0).length;
      const midMagCount = magnitudes.filter(m => m >= 5.0 && m < 6.0).length;
      
      score += highMagCount * 20; // 高震级权重高
      score += midMagCount * 10;
      
      // 基于频率计算风险
      const frequency = data.length / Math.max(timeSpanDays, 1);
      if (frequency > 1) score += 30;
      else if (frequency > 0.5) score += 20;
      else if (frequency > 0.1) score += 10;
      
      // 基于地区集中度
      const uniqueLocations = new Set(data.map(eq => eq.location)).size;
      const concentration = data.length / Math.max(uniqueLocations, 1);
      if (concentration > 10) score += 20;
      else if (concentration > 5) score += 10;
      
      // 限制分数范围
      score = Math.min(100, score);
      
      let level, label;
      if (score >= 80) {
        level = 'high';
        label = '高风险';
      } else if (score >= 60) {
        level = 'medium-high';
        label = '中高风险';
      } else if (score >= 40) {
        level = 'medium';
        label = '中等风险';
      } else if (score >= 20) {
        level = 'low-medium';
        label = '中低风险';
      } else {
        level = 'low';
        label = '低风险';
      }
      
      return { level, label, score };
    };

    // 计算风险因子
    const calculateRiskFactors = (data, magnitudes, depths) => {
      const factors = [];
      
      // 震级因子
      const highMagRatio = magnitudes.filter(m => m >= 6.0).length / magnitudes.length;
      factors.push({
        name: '高震级比例',
        value: Math.round(highMagRatio * 100),
        color: highMagRatio > 0.1 ? '#ff4444' : highMagRatio > 0.05 ? '#ffaa44' : '#44ff44'
      });
      
      // 浅源地震比例
      const shallowRatio = depths.filter(d => d <= 30).length / depths.length;
      factors.push({
        name: '浅源地震比例',
        value: Math.round(shallowRatio * 100),
        color: shallowRatio > 0.7 ? '#ff4444' : shallowRatio > 0.5 ? '#ffaa44' : '#44ff44'
      });
      
      // 活动密度
      const timeSpan = Math.max(1, (new Date().getTime() - new Date(data[0]?.date || new Date()).getTime()) / (1000 * 60 * 60 * 24));
      const activityDensity = Math.min(100, (data.length / timeSpan) * 365 * 10); // 年化活动密度
      factors.push({
        name: '活动密度',
        value: Math.round(activityDensity),
        color: activityDensity > 50 ? '#ff4444' : activityDensity > 25 ? '#ffaa44' : '#44ff44'
      });
      
      // 地区集中度
      const locations = data.map(eq => eq.location).filter(loc => loc);
      const uniqueLocations = new Set(locations).size;
      const concentration = Math.min(100, (locations.length / Math.max(uniqueLocations, 1)) * 10);
      factors.push({
        name: '地区集中度',
        value: Math.round(concentration),
        color: concentration > 50 ? '#ff4444' : concentration > 25 ? '#ffaa44' : '#44ff44'
      });
      
      return factors;
    };

    // 格式化日期时间显示
    const formatDateTime = (dateStr) => {
      const date = parseEarthquakeDate(dateStr);
      if (!date) return dateStr || '未知时间';
      
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // 聚焦到特定地区
    const focusOnRegion = (region) => {
      console.log('聚焦到地区:', region.name);
      // 这里可以添加地图飞行到特定地区的逻辑
    };

    // 定位到特定地震
    const locateEarthquake = (earthquake) => {
      if (!props.viewer || !earthquake.longitude || !earthquake.latitude) return;
      
      props.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          earthquake.longitude,
          earthquake.latitude,
          50000
        ),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-45),
          roll: 0
        },
        duration: 2
      });
    };

    // 修改原有的computeStats函数为computeEnhancedStats
    // ...existing code...

    // 创建地震可视化
    const createEarthquakeVisualization = async () => {
      if (!props.viewer || !dataLoaded.value || earthquakeData.value.length === 0) {
        console.warn('无法创建地震可视化: viewer或数据不可用');
        return;
      }
      
      try {
        console.log('开始创建地震可视化，数据量:', earthquakeData.value.length);
        
        // 移除现有数据源
        if (earthquakeDataSource) {
          props.viewer.dataSources.remove(earthquakeDataSource);
          earthquakeDataSource = null;
        }
        
        // 清除现有辐射圈
        if (radiantManager) {
          radiantManager.clearAll();
        }
        
        // 创建新的数据源
        earthquakeDataSource = new Cesium.CustomDataSource('earthquake-data');
        await props.viewer.dataSources.add(earthquakeDataSource);
        
        let successCount = 0;
        let errorCount = 0;
        
        // 为每个地震事件创建实体
        earthquakeData.value.forEach((earthquake, index) => {
          try {
            // 验证数据有效性
            if (isNaN(earthquake.longitude) || isNaN(earthquake.latitude) || isNaN(earthquake.magnitude)) {
              console.warn(`跳过无效地震数据 ${index}:`, earthquake);
              errorCount++;
              return;
            }
            
            const magnitude = earthquake.magnitude;
            const depth = earthquake.depth || 0;
            
            // 根据震级确定点的大小和颜色
            let pixelSize, color;
            if (magnitude >= 7.0) {
              pixelSize = 25;
              color = Cesium.Color.DARKRED;
            } else if (magnitude >= 6.0) {
              pixelSize = 20;
              color = Cesium.Color.RED;
            } else if (magnitude >= 5.0) {
              pixelSize = 16;
              color = Cesium.Color.ORANGE;
            } else if (magnitude >= 4.0) {
              pixelSize = 12;
              color = Cesium.Color.YELLOW;
            } else if (magnitude >= 3.0) {
              pixelSize = 10;
              color = Cesium.Color.GREENYELLOW;
            } else {
              pixelSize = 8;
              color = Cesium.Color.GREEN;
            }
            
            // 确保透明度足够可见
            const alpha = Math.max(0.7, 1 - depth / 500);
            color = color.withAlpha(alpha);
            
            // 创建位置
            const position = Cesium.Cartesian3.fromDegrees(
              earthquake.longitude, 
              earthquake.latitude, 
              0
            );
            
            const entity = earthquakeDataSource.entities.add({
              id: `earthquake_${earthquake.id}`,
              name: `M${magnitude.toFixed(1)} 地震`,
              position: position,
              point: {
                pixelSize: pixelSize,
                color: color,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                scaleByDistance: new Cesium.NearFarScalar(1.0e3, 1.0, 1.0e7, 0.3),
                show: true
              },
              label: {
                text: showLabels.value ? `M${magnitude.toFixed(1)}` : '',
                font: '14px sans-serif',
                fillColor: Cesium.Color.WHITE,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                outlineColor: Cesium.Color.BLACK,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -25),
                scaleByDistance: new Cesium.NearFarScalar(1.0e3, 1.0, 1.0e7, 0.2),
                show: showLabels.value
              },
              description: `
                <div style="font-family: Arial; font-size: 14px; min-width: 300px;">
                  <h3 style="margin: 0 0 10px 0; color: #333;">地震详情</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 4px; border-bottom: 1px solid #ddd;"><b>震级:</b></td><td style="padding: 4px; border-bottom: 1px solid #ddd;">M${magnitude.toFixed(1)}</td></tr>
                    <tr><td style="padding: 4px; border-bottom: 1px solid #ddd;"><b>深度:</b></td><td style="padding: 4px; border-bottom: 1px solid #ddd;">${depth.toFixed(1)} km</td></tr>
                    <tr><td style="padding: 4px; border-bottom: 1px solid #ddd;"><b>位置:</b></td><td style="padding: 4px; border-bottom: 1px solid #ddd;">${earthquake.location || '未知'}</td></tr>
                    <tr><td style="padding: 4px; border-bottom: 1px solid #ddd;"><b>时间:</b></td><td style="padding: 4px; border-bottom: 1px solid #ddd;">${earthquake.date || '未知'}</td></tr>
                    <tr><td style="padding: 4px; border-bottom: 1px solid #ddd;"><b>坐标:</b></td><td style="padding: 4px; border-bottom: 1px solid #ddd;">${earthquake.longitude.toFixed(3)}°E, ${earthquake.latitude.toFixed(3)}°N</td></tr>
                    <tr><td style="padding: 4px;"><b>类型:</b></td><td style="padding: 4px;">${earthquake.type || '未知'}</td></tr>
                  </table>
                </div>
              `,
              earthquake: earthquake
            });
            
            successCount++;
          } catch (entityError) {
            console.error(`创建地震实体 ${index} 失败:`, entityError);
            errorCount++;
          }
        });
        
        console.log(`地震实体创建完成: 成功 ${successCount}, 失败 ${errorCount}`);
        
        // 应用当前的筛选条件
        applyFilters();
        
        // 创建辐射圈
        updateRadiantCircles();
        
        // 更新状态信息
        statusMessage.value = `已创建 ${successCount} 个地震点标记${errorCount > 0 ? ` (${errorCount} 个失败)` : ''}`;
        
        // 如果有数据，飞到第一个地震位置
        if (successCount > 0 && earthquakeData.value.length > 0) {
          const firstEarthquake = earthquakeData.value[0];
          if (!isNaN(firstEarthquake.longitude) && !isNaN(firstEarthquake.latitude)) {
            setTimeout(() => {
              props.viewer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(
                  firstEarthquake.longitude, 
                  firstEarthquake.latitude, 
                  500000
                )
              });
            }, 1000);
          }
        }
        
      } catch (error) {
        console.error('创建地震可视化失败:', error);
        statusMessage.value = `可视化创建失败: ${error.message}`;
      }
    };
    
    // 更新辐射圈显示
    const updateRadiantCircles = () => {
      if (!dataLoaded.value || !earthquakeDataSource || !radiantManager) return;

      // 清除现有辐射圈
      radiantManager.clearAll();

      if (!showRadiantCircles.value) return;

      let createdCount = 0;
      
      // 为震级≥6.0且可见的地震创建辐射圈
      earthquakeDataSource.entities.values.forEach(entity => {
        if (entity.earthquake && entity.earthquake.magnitude >= 6.0 && entity.show) {
          const radiantCircle = radiantManager.createRadiantCircle(entity.earthquake);
          if (radiantCircle) {
            createdCount++;
          }
        }
      });

      statusMessage.value = `已为 ${createdCount} 个强震添加辐射圈`;
      setTimeout(() => {
        if (statusMessage.value.includes('已为') && statusMessage.value.includes('强震添加辐射圈')) {
          statusMessage.value = '';
        }
      }, 3000);
    };

    // 切换辐射圈显示
    const toggleRadiantCircles = () => {
      if (radiantManager) {
        if (showRadiantCircles.value) {
          updateRadiantCircles();
        } else {
          radiantManager.clearAll();
        }
      }
    };
    
    // 应用筛选条件
    const applyFilters = () => {
      if (!dataLoaded.value || !earthquakeDataSource) return;
      
      let visibleCount = 0;
      const eligibleEntities = [];
      
      // 首先收集符合条件的实体
      earthquakeDataSource.entities.values.forEach(entity => {
        if (entity.earthquake) {
          const earthquake = entity.earthquake;
          let isEligible = true;
          
          // 震级筛选
          if (earthquake.magnitude < magnitudeRange.value[0] || earthquake.magnitude > magnitudeRange.value[1]) {
            isEligible = false;
          }
          
          // 深度筛选
          if (isEligible && (earthquake.depth < depthFilter.value[0] || earthquake.depth > depthFilter.value[1])) {
            isEligible = false;
          }
          
          // 时间筛选
          if (isEligible && (startDate.value || endDate.value)) {
            const earthquakeDate = new Date(earthquake.date);
            if (!isNaN(earthquakeDate)) {
              if (startDate.value && earthquakeDate < new Date(startDate.value)) {
                isEligible = false;
              }
              if (endDate.value && earthquakeDate > new Date(endDate.value)) {
                isEligible = false;
              }
            } else {
              isEligible = false;
            }
          }
          
          if (isEligible) {
            eligibleEntities.push(entity);
          }
        }
      });
      
      // 按震级排序，优先显示大震级
      eligibleEntities.sort((a, b) => b.earthquake.magnitude - a.earthquake.magnitude);
      
      // 应用显示数量限制
      const displayLimit = maxDisplayCount.value === 10000 ? eligibleEntities.length : maxDisplayCount.value;
      
      // 设置所有实体的显示状态
      earthquakeDataSource.entities.values.forEach(entity => {
        entity.show = false;
      });
      
      // 显示符合条件且在限制数量内的实体
      for (let i = 0; i < Math.min(displayLimit, eligibleEntities.length); i++) {
        eligibleEntities[i].show = showPoints.value;
        visibleCount++;
      }
      
      // 更新筛选后的数据引用
      filteredData.value = eligibleEntities.slice(0, Math.min(displayLimit, eligibleEntities.length))
        .map(entity => entity.earthquake);
      
      // 更新辐射圈显示
      updateRadiantCircles();
      
      statusMessage.value = `筛选后显示 ${visibleCount} 条记录 (共 ${eligibleEntities.length} 条符合条件)`;
      setTimeout(() => {
        if (statusMessage.value.includes('筛选后显示')) {
          statusMessage.value = '';
        }
      }, 2000);
    };
    
    // 切换点显示
    const togglePointsDisplay = () => {
      if (!earthquakeDataSource) return;
      applyFilters();
    };
    
    // 切换标签显示
    const toggleLabelsDisplay = () => {
      if (!earthquakeDataSource) return;
      
      earthquakeDataSource.entities.values.forEach(entity => {
        if (entity.label && entity.earthquake) {
          entity.label.text = showLabels.value ? `M${entity.earthquake.magnitude.toFixed(1)}` : '';
          entity.label.show = showLabels.value;
        }
      });
    };
    
    // 设置点击事件处理
    const setupClickHandler = () => {
      if (clickHandler && props.viewer) {
        props.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        clickHandler = null;
      }
      
      if (!props.viewer) return;
      
      clickHandler = props.viewer.cesiumWidget.screenSpaceEventHandler.setInputAction((click) => {
        const picked = props.viewer.scene.pick(click.position);
        if (picked && picked.id && picked.id.earthquake) {
          selectedEarthquake.value = picked.id.earthquake;
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    };
    
    // 设置显示数量限制
    const setDisplayLimit = (limit) => {
      maxDisplayCount.value = limit;
    };
    
    // 清除数据
    const clearData = () => {
      if (props.preserveDataOnClose) {
        // 只清除UI状态，保留地图上的数据
        earthquakeData.value = [];
        filteredData.value = [];
        earthquakeStats.value = {};
        dataLoaded.value = false;
        statusMessage.value = '数据已从界面清除，但地图显示保留';
      } else {
        // 完全清除包括地图数据
        clearAllData();
      }
    };
    
    // 完全清除所有数据
    const clearAllData = () => {
      // 清除地图实体
      if (earthquakeDataSource) {
        props.viewer.dataSources.remove(earthquakeDataSource);
        earthquakeDataSource = null;
      }
      
      // 清除辐射圈管理器
      if (radiantManager) {
        radiantManager.destroy();
        radiantManager = null;
      }
      
      // 重置所有状态
      earthquakeData.value = [];
      filteredData.value = [];
      earthquakeStats.value = {};
      dataLoaded.value = false;
      statusMessage.value = '';
    };
    
    // 组件卸载时的清理逻辑
    onBeforeUnmount(() => {
      if (!props.preserveDataOnClose) {
        clearAllData();
      }
    });
    
    // 监听变化
    watch([magnitudeRange, depthFilter, maxDisplayCount, startDate, endDate], () => {
      if (showPoints.value && dataLoaded.value) {
        applyFilters();
      }
    }, { deep: true });
    
    watch(showPoints, togglePointsDisplay);
    watch(showLabels, toggleLabelsDisplay);
    watch(showRadiantCircles, toggleRadiantCircles);

    onMounted(() => {
      // 组件挂载时初始化辐射圈管理器
      if (props.viewer) {
        radiantManager = new RadiantCircleManager(props.viewer);
      }
    });

    return {
      dataLoaded,
      isLoading,
      statusMessage,
      earthquakeData,
      filteredData,
      earthquakeStats,
      showPoints,
      showLabels,
      showRadiantCircles,
      radiantCircleCount,
      magnitudeRange,
      depthFilter,
      startDate,
      endDate,
      maxDisplayCount,
      selectedEarthquake,
      loadEarthquakeData,
      clearData,
      applyFilters,
      togglePointsDisplay,
      toggleLabelsDisplay,
      toggleRadiantCircles,
      setDisplayLimit,
      activeStatsTab,
      statsTabs,
      formatDateTime,
      focusOnRegion,
      locateEarthquake,
      generateMockEarthquakeData
    };
  }
});
</script>

<style scoped>
.analysis-section {
  margin-bottom: 10px;
}

.section-title {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 12px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 4px;
}

.input-group {
  margin-bottom: 12px;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.radiant-info {
  margin-top: 5px;
  padding: 4px 8px;
  background-color: #f0f8ff;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.radiant-info small {
  color: #666;
  font-size: 12px;
}

.display-limit-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.limit-buttons {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.limit-btn {
  flex: 1;
  padding: 5px 8px;
  font-size: 12px;
  border: 1px solid #ddd;
  background-color: #f9f9f9;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.limit-btn.active {
  background-color: #4285f4;
  color: white;
  border-color: #3367d6;
}

.range-inputs {
  display: flex;
  gap: 10px;
}

.range-slider {
  flex: 1;
}

.date-inputs {
  display: flex;
  gap: 8px;
}

.date-inputs input {
  flex: 1;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.stats-panel {
  background-color: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 12px;
  margin: 10px 0;
}

.stats-title {
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 13px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
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

.status-message {
  margin-top: 10px;
  padding: 6px;
  font-size: 12px;
  color: #666;
  text-align: center;
  font-style: italic;
}

.btn-primary {
  background-color: #4285f4;
  color: white;
  border: 1px solid #3367d6;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border: 1px solid #5a6268;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
}

.full-width-btn {
  width: 100%;
}

.data-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.status-text {
  font-size: 12px;
  color: #666;
}

/* 增强统计面板样式 */
.enhanced-stats-panel {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  margin: 15px 0;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.stats-header {
  background: linear-gradient(135deg, #4285f4 0%, #3367d6 100%);
  color: white;
  padding: 12px;
}

.stats-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.stats-tabs {
  display: flex;
  gap: 5px;
}

.stats-tab {
  padding: 6px 12px;
  background: rgba(255,255,255,0.1);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.stats-tab:hover {
  background: rgba(255,255,255,0.2);
}

.stats-tab.active {
  background: rgba(255,255,255,0.3);
  font-weight: bold;
}

.stats-content {
  padding: 15px;
  max-height: 400px;
  overflow-y: auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}

.stat-item {
  background: white;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.stat-item:hover {
  transform: translateY(-2px);
}

.stat-item.highlight {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border: 2px solid #2196f3;
}

.stat-icon {
  font-size: 18px;
  width: 20px;
  text-align: center;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 11px;
  color: #666;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 13px;
  font-weight: bold;
  color: #333;
}

/* 震级分布样式 */
.magnitude-distribution, .depth-distribution {
  margin: 15px 0;
}

.magnitude-distribution h4, .depth-distribution h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #333;
}

.magnitude-levels, .depth-levels {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.magnitude-level, .depth-level {
  display: flex;
  align-items: center;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.magnitude-level {
  color: white;
  font-weight: bold;
}

.depth-level {
  background: #f1f3f4;
  border-left: 4px solid #4285f4;
}

.level-range {
  flex: 1;
}

.level-count {
  margin: 0 8px;
  font-weight: bold;
}

.level-percentage {
  font-size: 11px;
  opacity: 0.8;
}

/* 时间分析样式 */
.time-analysis {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.time-summary {
  background: white;
  padding: 10px;
  border-radius: 6px;
  border-left: 4px solid #4285f4;
}

.time-stat-item {
  display: flex;
  justify-content: space-between;
  margin: 5px 0;
  font-size: 12px;
}

.time-label {
  color: #666;
}

.time-value {
  font-weight: bold;
  color: #333;
}

/* 图表样式 */
.yearly-chart, .monthly-chart, .hourly-chart {
  display: flex;
  align-items: end;
  gap: 2px;
  padding: 10px;
  background: white;
  border-radius: 6px;
  overflow-x: auto;
}

.year-bar, .month-bar, .hour-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 30px;
  cursor: pointer;
  transition: all 0.2s;
}

.year-bar:hover, .month-bar:hover, .hour-bar:hover {
  transform: translateY(-2px);
}

.year-bar {
  background: linear-gradient(to top, #4285f4, #6fa8f7);
  border-radius: 2px 2px 0 0;
  margin: 0 1px;
}

.month-bar {
  background: linear-gradient(to top, #34a853, #5bb75b);
  border-radius: 2px 2px 0 0;
}

.hour-bar {
  background: linear-gradient(to top, #fbbc04, #fdd663);
  border-radius: 2px 2px 0 0;
}

.year-label, .month-label, .hour-label {
  font-size: 10px;
  color: #666;
  margin-top: 5px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.year-count, .month-count, .hour-count {
  font-size: 10px;
  font-weight: bold;
  color: white;
  padding: 2px;
}

/* 地理分析样式 */
.geography-analysis {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.region-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.region-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}

.region-item:hover {
  background: #e3f2fd;
  transform: translateX(5px);
}

.region-name {
  flex: 1;
  font-weight: bold;
}

.region-count {
  color: #4285f4;
  font-weight: bold;
}

.region-max-mag {
  color: #ea4335;
  font-size: 11px;
}

.coord-range, .density-stats {
  background: white;
  padding: 10px;
  border-radius: 6px;
}

.coord-item, .density-item {
  display: flex;
  justify-content: space-between;
  margin: 5px 0;
  font-size: 12px;
}

.coord-label, .density-label {
  color: #666;
}

.coord-value, .density-value {
  font-weight: bold;
  color: #333;
}

/* 风险评估样式 */
.risk-analysis {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.risk-indicator {
  text-align: center;
  padding: 15px;
  border-radius: 8px;
  color: white;
}

.risk-indicator.low {
  background: linear-gradient(135deg, #4caf50, #66bb6a);
}

.risk-indicator.low-medium {
  background: linear-gradient(135deg, #8bc34a, #9ccc65);
}

.risk-indicator.medium {
  background: linear-gradient(135deg, #ff9800, #ffb74d);
}

.risk-indicator.medium-high {
  background: linear-gradient(135deg, #ff5722, #ff7043);
}

.risk-indicator.high {
  background: linear-gradient(135deg, #f44336, #e57373);
}

.risk-badge {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 5px;
}

.risk-score {
  font-size: 14px;
  opacity: 0.9;
}

.factor-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.factor-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.factor-name {
  width: 80px;
  color: #666;
}

.factor-bar {
  flex: 1;
  height: 12px;
  background: #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.factor-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.factor-value {
  width: 30px;
  text-align: right;
  font-weight: bold;
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 150px;
  overflow-y: auto;
}

.warning-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
  border-left: 4px solid #ea4335;
}

.warning-item:hover {
   background: #ffebee;
  transform: translateX(5px);
}

.warning-magnitude {
  font-weight: bold;
  color: #ea4335;
}

.warning-location {
  flex: 1;
  margin: 0 10px;
  color: #333;
}

.warning-date {
  color: #666;
  font-size: 11px;
}
</style>