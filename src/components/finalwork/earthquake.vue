<template>
  <div class="analysis-section">
    <div class="section-title">地震信息分析</div>
    
    <!-- 数据加载控制 -->
    <div class="input-group">
      <div v-if="!dataLoaded">
        <button @click="loadEarthquakeData" class="btn-primary full-width-btn" :disabled="isLoading">
          {{ isLoading ? '加载中...' : '加载地震数据' }}
        </button>
      </div>
      <div v-else class="data-loaded">
        <div class="status-badge success">数据已加载 ({{ earthquakeData.length }} 条记录)</div>
        <button @click="clearData" class="btn-secondary full-width-btn">
          清除数据
        </button>
      </div>
    </div>

    <!-- 地震数据统计信息 -->
    <div v-if="dataLoaded && earthquakeStats" class="input-group">
      <label>数据概览:</label>
      <div class="stats-display">
        <div class="stat-item">
          <span class="stat-label">总记录数:</span>
          <span class="stat-value">{{ earthquakeStats.total }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">震级范围:</span>
          <span class="stat-value">{{ earthquakeStats.minMagnitude.toFixed(1) }} - {{ earthquakeStats.maxMagnitude.toFixed(1) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">深度范围:</span>
          <span class="stat-value">{{ earthquakeStats.minDepth.toFixed(0) }} - {{ earthquakeStats.maxDepth.toFixed(0) }} km</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">时间跨度:</span>
          <span class="stat-value">{{ earthquakeStats.dateRange }}</span>
        </div>
      </div>
    </div>

    <!-- 显示控制 -->
    <div v-if="dataLoaded" class="input-group">
      <label>
        <input type="checkbox" v-model="showPoints" @change="togglePointsDisplay"> 
        显示地震点
      </label>
      <label>
        <input type="checkbox" v-model="showLabels" @change="toggleLabelsDisplay"> 
        显示标签
      </label>
    </div>

    <!-- 震级筛选 -->
    <div v-if="dataLoaded" class="input-group">
      <label>震级筛选 (M {{ magnitudeFilter }}+):</label>
      <input 
        type="range" 
        min="0" 
        max="8" 
        step="0.1" 
        v-model.number="magnitudeFilter" 
        @input="applyFilters"
        class="range-slider" 
      />
    </div>

    <!-- 深度筛选 -->
    <div v-if="dataLoaded" class="input-group">
      <label>震源深度筛选 ({{ depthFilter[0] }}km - {{ depthFilter[1] }}km):</label>
      <div class="range-inputs">
        <div class="range-input">
          <label>最小:</label>
          <input type="number" v-model.number="depthFilter[0]" @change="applyFilters" min="0" max="1000" />
        </div>
        <div class="range-input">
          <label>最大:</label>
          <input type="number" v-model.number="depthFilter[1]" @change="applyFilters" min="0" max="1000" />
        </div>
      </div>
    </div>

    <!-- 时间范围筛选 -->
    <div v-if="dataLoaded" class="input-group">
      <label>时间范围筛选:</label>
      <div class="date-inputs">
        <div class="date-input">
          <label>开始时间:</label>
          <input type="date" v-model="startDate" @change="applyFilters" />
        </div>
        <div class="date-input">
          <label>结束时间:</label>
          <input type="date" v-model="endDate" @change="applyFilters" />
        </div>
      </div>
    </div>

    <!-- 分析工具 -->
    <div v-if="dataLoaded" class="input-group">
      <label>分析工具:</label>
      <div class="control-buttons">
        <button @click="flyToEarthquakeRegion" class="btn-secondary">
          飞行到地震区域
        </button>
        <button @click="showMagnitudeDistribution" class="btn-secondary">
          震级分布统计
        </button>
        <button @click="exportData" class="btn-secondary">
          导出数据
        </button>
      </div>
    </div>

    <!-- 震级分布图表 -->
    <div v-if="showDistribution" class="input-group">
      <label>震级分布:</label>
      <div class="chart-container">
        <div v-for="(count, magnitude) in magnitudeDistribution" :key="magnitude" class="chart-bar">
          <div class="bar-label">M{{ magnitude }}</div>
          <div class="bar" :style="{ height: (count / maxCount * 100) + '%' }"></div>
          <div class="bar-count">{{ count }}</div>
        </div>
      </div>
    </div>

    <!-- 状态消息 -->
    <div class="status-message" v-if="statusMessage">{{ statusMessage }}</div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';
import * as XLSX from 'xlsx';

export default {
  name: 'EarthquakeAnalysis',
  props: {
    viewer: {
      type: Object,
      required: true
    },
    currentLocation: {
      type: Object,
      required: true
    }
  },
  emits: ['update-location'],
  setup(props, { emit }) {
    // 状态变量
    const isLoading = ref(false);
    const dataLoaded = ref(false);
    const statusMessage = ref('');
    const earthquakeData = ref([]);
    const filteredData = ref([]);
    
    // 显示控制
    const showPoints = ref(true);
    const showLabels = ref(false);
    
    // 筛选控制
    const magnitudeFilter = ref(0.0);
    const depthFilter = ref([0, 1000]);
    const startDate = ref('');
    const endDate = ref('');
    
    // 统计信息
    const earthquakeStats = ref(null);
    
    // 图表显示
    const showDistribution = ref(false);
    const magnitudeDistribution = ref({});
    
    // Cesium 实体管理
    let earthquakeDataSource = null;
    
    // 计算统计数据
    const computeStats = (data) => {
      if (!data || data.length === 0) return null;
      
      const magnitudes = data.map(item => item.magnitude).filter(m => !isNaN(m));
      const depths = data.map(item => item.depth).filter(d => !isNaN(d));
      const dates = data.map(item => new Date(item.date)).filter(d => !isNaN(d));
      
      return {
        total: data.length,
        minMagnitude: Math.min(...magnitudes),
        maxMagnitude: Math.max(...magnitudes),
        minDepth: Math.min(...depths),
        maxDepth: Math.max(...depths),
        dateRange: dates.length > 0 ? 
          `${new Date(Math.min(...dates)).toLocaleDateString()} - ${new Date(Math.max(...dates)).toLocaleDateString()}` : 
          '无有效日期'
      };
    };
    
    // 最大计数 (用于图表归一化)
    const maxCount = computed(() => {
      const counts = Object.values(magnitudeDistribution.value);
      return Math.max(...counts, 1);
    });
    
    // 加载地震数据
    const loadEarthquakeData = async () => {
      if (isLoading.value) return;
      
      try {
        isLoading.value = true;
        statusMessage.value = '正在加载地震数据...';
        
        // 读取Excel文件
        const response = await fetch('/data/速报目录.xls');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // 获取第一个工作表
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 转换为JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // 处理数据格式
        const processedData = jsonData.map((row, index) => {
          // 根据Excel文件的列名进行映射
          const item = {
            id: index + 1,
            序号: row['序号'],
            date: row['发震日期（北京时间）'],
            longitude: parseFloat(row['经度(°)']),
            latitude: parseFloat(row['纬度(°)']),
            depth: parseFloat(row['震源深度(Km)']),
            magnitude: parseFloat(row['震级(M)']),
            location: row['震中位置'],
            type: row['事件类型']
          };
          
          return item;
        }).filter(item => 
          !isNaN(item.longitude) && 
          !isNaN(item.latitude) && 
          !isNaN(item.magnitude)
        );
        
        earthquakeData.value = processedData;
        filteredData.value = [...processedData];
        earthquakeStats.value = computeStats(processedData);
        
        // 设置默认筛选日期范围
        if (processedData.length > 0) {
          const dates = processedData.map(item => new Date(item.date)).filter(d => !isNaN(d));
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
        
        statusMessage.value = `成功加载 ${processedData.length} 条地震记录`;
        
        // 3秒后清除状态消息
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
    
    // 创建地震可视化
    const createEarthquakeVisualization = async () => {
      if (!props.viewer || !dataLoaded.value) return;
      
      try {
        // 移除现有数据源
        if (earthquakeDataSource) {
          props.viewer.dataSources.remove(earthquakeDataSource);
        }
        
        // 创建新的数据源
        earthquakeDataSource = new Cesium.CustomDataSource('earthquake-data');
        props.viewer.dataSources.add(earthquakeDataSource);
        
        // 为每个地震事件创建实体
        filteredData.value.forEach((earthquake, index) => {
          const magnitude = earthquake.magnitude;
          const depth = earthquake.depth;
          
          // 根据震级确定点的大小和颜色
          let pixelSize, color;
          if (magnitude >= 7.0) {
            pixelSize = 20;
            color = Cesium.Color.RED;
          } else if (magnitude >= 6.0) {
            pixelSize = 16;
            color = Cesium.Color.ORANGE;
          } else if (magnitude >= 5.0) {
            pixelSize = 12;
            color = Cesium.Color.YELLOW;
          } else if (magnitude >= 4.0) {
            pixelSize = 10;
            color = Cesium.Color.GREENYELLOW;
          } else {
            pixelSize = 8;
            color = Cesium.Color.GREEN;
          }
          
          // 根据深度调整透明度
          const alpha = Math.max(0.3, 1 - depth / 300);
          color = color.withAlpha(alpha);
          
          const entity = earthquakeDataSource.entities.add({
            id: `earthquake_${earthquake.id}`,
            name: `M${magnitude} 地震`,
            position: Cesium.Cartesian3.fromDegrees(
              earthquake.longitude, 
              earthquake.latitude, 
              0
            ),
            point: {
              pixelSize: pixelSize,
              color: color,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.5)
            },
            label: {
              text: showLabels.value ? `M${magnitude}` : '',
              font: '12px sans-serif',
              fillColor: Cesium.Color.WHITE,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              outlineWidth: 2,
              outlineColor: Cesium.Color.BLACK,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -20),
              scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.3)
            },
            description: `
              <table style="font-family: Arial; font-size: 12px;">
                <tr><td><b>震级:</b></td><td>M${magnitude}</td></tr>
                <tr><td><b>深度:</b></td><td>${depth} km</td></tr>
                <tr><td><b>位置:</b></td><td>${earthquake.location}</td></tr>
                <tr><td><b>时间:</b></td><td>${earthquake.date}</td></tr>
                <tr><td><b>经纬度:</b></td><td>${earthquake.longitude.toFixed(3)}°, ${earthquake.latitude.toFixed(3)}°</td></tr>
                <tr><td><b>类型:</b></td><td>${earthquake.type}</td></tr>
              </table>
            `,
            earthquake: earthquake // 存储原始数据
          });
        });
        
        statusMessage.value = `已创建 ${filteredData.value.length} 个地震点标记`;
        
      } catch (error) {
        console.error('创建地震可视化失败:', error);
        statusMessage.value = `可视化创建失败: ${error.message}`;
      }
    };
    
    // 应用筛选条件
    const applyFilters = () => {
      if (!dataLoaded.value) return;
      
      filteredData.value = earthquakeData.value.filter(earthquake => {
        // 震级筛选
        if (earthquake.magnitude < magnitudeFilter.value) return false;
        
        // 深度筛选
        if (earthquake.depth < depthFilter.value[0] || earthquake.depth > depthFilter.value[1]) return false;
        
        // 时间筛选
        if (startDate.value || endDate.value) {
          const earthquakeDate = new Date(earthquake.date);
          if (isNaN(earthquakeDate)) return false;
          
          if (startDate.value && earthquakeDate < new Date(startDate.value)) return false;
          if (endDate.value && earthquakeDate > new Date(endDate.value)) return false;
        }
        
        return true;
      });
      
      // 重新创建可视化
      createEarthquakeVisualization();
      
      statusMessage.value = `筛选后显示 ${filteredData.value.length} 条记录`;
      setTimeout(() => {
        if (statusMessage.value.includes('筛选后显示')) {
          statusMessage.value = '';
        }
      }, 2000);
    };
    
    // 切换点显示
    const togglePointsDisplay = () => {
      if (!earthquakeDataSource) return;
      
      earthquakeDataSource.entities.values.forEach(entity => {
        if (entity.point) {
          entity.point.show = showPoints.value;
        }
      });
    };
    
    // 切换标签显示
    const toggleLabelsDisplay = () => {
      if (!earthquakeDataSource) return;
      
      earthquakeDataSource.entities.values.forEach(entity => {
        if (entity.label) {
          entity.label.text = showLabels.value ? `M${entity.earthquake.magnitude}` : '';
        }
      });
    };
    
    // 飞行到地震区域
    const flyToEarthquakeRegion = () => {
      if (!props.viewer || !filteredData.value.length) return;
      
      // 计算边界
      const longitudes = filteredData.value.map(eq => eq.longitude);
      const latitudes = filteredData.value.map(eq => eq.latitude);
      
      const west = Math.min(...longitudes);
      const east = Math.max(...longitudes);
      const south = Math.min(...latitudes);
      const north = Math.max(...latitudes);
      
      // 添加边距
      const margin = 0.5;
      
      const rectangle = Cesium.Rectangle.fromDegrees(
        west - margin, south - margin, 
        east + margin, north + margin
      );
      
      props.viewer.camera.flyTo({
        destination: rectangle,
        duration: 2.0
      });
    };
    
    // 显示震级分布
    const showMagnitudeDistribution = () => {
      if (!filteredData.value.length) return;
      
      // 计算震级分布
      const distribution = {};
      filteredData.value.forEach(eq => {
        const magnitude = Math.floor(eq.magnitude * 10) / 10; // 保留一位小数
        distribution[magnitude] = (distribution[magnitude] || 0) + 1;
      });
      
      magnitudeDistribution.value = distribution;
      showDistribution.value = true;
    };
    
    // 导出数据
    const exportData = () => {
      if (!filteredData.value.length) return;
      
      try {
        // 准备导出数据
        const exportData = filteredData.value.map(eq => ({
          '序号': eq.序号,
          '发震时间': eq.date,
          '经度': eq.longitude,
          '纬度': eq.latitude,
          '震源深度(km)': eq.depth,
          '震级': eq.magnitude,
          '震中位置': eq.location,
          '事件类型': eq.type
        }));
        
        // 创建工作表
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '地震数据');
        
        // 下载文件
        const fileName = `地震数据_筛选结果_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        statusMessage.value = '数据导出成功';
        setTimeout(() => {
          if (statusMessage.value === '数据导出成功') {
            statusMessage.value = '';
          }
        }, 3000);
        
      } catch (error) {
        console.error('导出失败:', error);
        statusMessage.value = `导出失败: ${error.message}`;
      }
    };
    
    // 清除数据
    const clearData = () => {
      // 移除可视化
      if (earthquakeDataSource && props.viewer) {
        props.viewer.dataSources.remove(earthquakeDataSource);
        earthquakeDataSource = null;
      }
      
      // 重置状态
      dataLoaded.value = false;
      earthquakeData.value = [];
      filteredData.value = [];
      earthquakeStats.value = null;
      showDistribution.value = false;
      statusMessage.value = '数据已清除';
      
      setTimeout(() => {
        if (statusMessage.value === '数据已清除') {
          statusMessage.value = '';
        }
      }, 2000);
    };
    
    // 组件卸载时清理
    onBeforeUnmount(() => {
      clearData();
    });
    
    return {
      isLoading,
      dataLoaded,
      statusMessage,
      earthquakeData,
      filteredData,
      earthquakeStats,
      showPoints,
      showLabels,
      magnitudeFilter,
      depthFilter,
      startDate,
      endDate,
      showDistribution,
      magnitudeDistribution,
      maxCount,
      loadEarthquakeData,
      clearData,
      applyFilters,
      togglePointsDisplay,
      toggleLabelsDisplay,
      flyToEarthquakeRegion,
      showMagnitudeDistribution,
      exportData
    };
  }
};
</script>

<style scoped>
.analysis-section {
  margin-bottom: 15px;
}

.section-title {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 12px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}

.input-group {
  margin-bottom: 12px;
}

.input-group > label {
  display: block;
  margin-bottom: 5px;
  font-size: 13px;
  font-weight: bold;
}

.input-group label input[type="checkbox"] {
  margin-right: 5px;
}

.btn-primary {
  background-color: #4285f4;
  color: white;
  border: 1px solid #3367d6;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: #3367d6;
}

.btn-primary:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border: 1px solid #5a6268;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.full-width-btn {
  width: 100%;
}

.data-loaded {
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 5px 10px;
  background-color: #28a745;
  color: white;
  border-radius: 15px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: bold;
}

.status-badge.success {
  background-color: #28a745;
}

.stats-display {
  background-color: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3px;
}

.stat-label {
  color: #666;
}

.stat-value {
  font-weight: bold;
  color: #333;
}

.range-slider {
  width: 100%;
  margin-top: 5px;
}

.range-inputs {
  display: flex;
  gap: 10px;
}

.range-input {
  flex: 1;
}

.range-input label {
  font-size: 11px;
  color: #666;
  margin-bottom: 2px;
}

.range-input input {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 12px;
}

.date-inputs {
  display: flex;
  gap: 10px;
}

.date-input {
  flex: 1;
}

.date-input label {
  font-size: 11px;
  color: #666;
  margin-bottom: 2px;
}

.date-input input {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 12px;
}

.control-buttons {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.chart-container {
  display: flex;
  align-items: end;
  height: 80px;
  gap: 3px;
  padding: 10px 5px;
  background-color: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-top: 5px;
}

.chart-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar-label {
  font-size: 10px;
  color: #666;
  margin-bottom: 2px;
}

.bar {
  width: 100%;
  background-color: #4285f4;
  border-radius: 2px 2px 0 0;
  min-height: 2px;
  margin-bottom: 2px;
}

.bar-count {
  font-size: 10px;
  color: #333;
  font-weight: bold;
}

.status-message {
  margin-top: 10px;
  padding: 6px;
  font-size: 12px;
  color: #666;
  text-align: center;
  font-style: italic;
}
</style>