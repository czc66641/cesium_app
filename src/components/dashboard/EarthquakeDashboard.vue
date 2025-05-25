<template>
  <div class="dashboard-overlay" v-if="visible" @click="handleOverlayClick">
    <div class="earthquake-dashboard" @click.stop>
      <div class="dashboard-header">
        <h2>地震数据看板</h2>
        <div class="header-actions">
          <button @click="refreshData" class="refresh-btn" :disabled="isRefreshing">
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isRefreshing }"></i>
            刷新数据
          </button>
          <button @click="$emit('close')" class="close-btn">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      
      <div class="dashboard-content">
        <!-- 数据统计概览 -->
        <div class="stats-overview">
          <div class="stat-card">
            <div class="stat-number">{{ totalCount }}</div>
            <div class="stat-label">总地震数</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ majorEarthquakes }}</div>
            <div class="stat-label">强震数量 (M≥6.0)</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ maxMagnitude.toFixed(1) }}</div>
            <div class="stat-label">最大震级</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ avgMagnitude.toFixed(1) }}</div>
            <div class="stat-label">平均震级</div>
          </div>
        </div>
        
        <!-- 数据表格 -->
        <div class="data-table-container">
          <div class="table-header">
            <h3>地震详细数据</h3>
            <div class="table-controls">
              <input 
                v-model="searchText" 
                type="text" 
                placeholder="搜索地震位置..." 
                class="search-input"
              />
              <select v-model="sortBy" class="sort-select">
                <option value="magnitude">按震级排序</option>
                <option value="date">按时间排序</option>
                <option value="depth">按深度排序</option>
              </select>
            </div>
          </div>
          
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>时间</th>
                  <th>位置</th>
                  <th>震级</th>
                  <th>深度(km)</th>
                  <th>经纬度</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="(earthquake, index) in paginatedData" 
                  :key="earthquake.id"
                  :class="{ 'major-earthquake': earthquake.magnitude >= 6.0 }"
                >
                  <td>{{ earthquake.序号 || earthquake.id }}</td>
                  <td>{{ formatDate(earthquake.date) }}</td>
                  <td>{{ earthquake.location || '未知' }}</td>
                  <td>
                    <span class="magnitude-badge" :class="getMagnitudeClass(earthquake.magnitude)">
                      M{{ earthquake.magnitude.toFixed(1) }}
                    </span>
                  </td>
                  <td>{{ earthquake.depth.toFixed(1) }}</td>
                  <td>
                    {{ earthquake.longitude.toFixed(3) }}°E, 
                    {{ earthquake.latitude.toFixed(3) }}°N
                  </td>
                  <td>
                    <button @click="locateEarthquake(earthquake)" class="locate-btn">
                      定位
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- 分页控件 -->
          <div class="pagination">
            <button 
              @click="currentPage = Math.max(1, currentPage - 1)" 
              :disabled="currentPage === 1"
              class="page-btn"
            >
              上一页
            </button>
            <span class="page-info">
              第 {{ currentPage }} 页，共 {{ totalPages }} 页
            </span>
            <button 
              @click="currentPage = Math.min(totalPages, currentPage + 1)" 
              :disabled="currentPage === totalPages"
              class="page-btn"
            >
              下一页
            </button>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="dashboard-actions">
          <button @click="openAnalysis" class="action-btn primary">
            <i class="fas fa-chart-line"></i>
            打开分析工具
          </button>
          <button @click="generateHeatmap" class="action-btn secondary">
            <i class="fas fa-fire"></i>
            生成热力图
          </button>
          <button @click="clearHeatmap" class="action-btn secondary">
            <i class="fas fa-eraser"></i>
            清除热力图
          </button>
          <button @click="exportData" class="action-btn secondary">
            <i class="fas fa-download"></i>
            导出数据
          </button>
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
    // 状态变量
    const isRefreshing = ref(false);
    const searchText = ref('');
    const sortBy = ref('magnitude');
    const currentPage = ref(1);
    const pageSize = ref(20);
    
    // 统计数据
    const totalCount = computed(() => props.earthquakeData.length);
    
    const majorEarthquakes = computed(() => 
      props.earthquakeData.filter(eq => eq.magnitude >= 6.0).length
    );
    
    const maxMagnitude = computed(() => {
      if (props.earthquakeData.length === 0) return 0;
      return Math.max(...props.earthquakeData.map(eq => eq.magnitude));
    });
    
    const avgMagnitude = computed(() => {
      if (props.earthquakeData.length === 0) return 0;
      const sum = props.earthquakeData.reduce((acc, eq) => acc + eq.magnitude, 0);
      return sum / props.earthquakeData.length;
    });
    
    // 过滤和排序后的数据
    const filteredAndSortedData = computed(() => {
      let data = [...props.earthquakeData];
      
      // 搜索过滤
      if (searchText.value) {
        const search = searchText.value.toLowerCase();
        data = data.filter(eq => 
          (eq.location && eq.location.toLowerCase().includes(search)) ||
          eq.magnitude.toString().includes(search) ||
          eq.depth.toString().includes(search)
        );
      }
      
      // 排序
      data.sort((a, b) => {
        switch (sortBy.value) {
          case 'magnitude':
            return b.magnitude - a.magnitude; // 震级从大到小
          case 'date':
            return new Date(b.date) - new Date(a.date); // 时间从新到旧
          case 'depth':
            return a.depth - b.depth; // 深度从浅到深
          default:
            return 0;
        }
      });
      
      return data;
    });
    
    // 分页数据
    const totalPages = computed(() => 
      Math.ceil(filteredAndSortedData.value.length / pageSize.value)
    );
    
    const paginatedData = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value;
      const end = start + pageSize.value;
      return filteredAndSortedData.value.slice(start, end);
    });
    
    // 监听搜索和排序变化，重置到第一页
    watch([searchText, sortBy], () => {
      currentPage.value = 1;
    });
    
    // 事件处理
    const handleOverlayClick = () => {
      emit('close');
    };
    
    const refreshData = () => {
      isRefreshing.value = true;
      // 模拟刷新过程
      setTimeout(() => {
        isRefreshing.value = false;
      }, 1000);
    };
    
    const openAnalysis = () => {
      emit('open-earthquake-analysis');
    };
    
    const locateEarthquake = (earthquake) => {
      emit('locate-earthquake', earthquake);
    };
    
    const generateHeatmap = () => {
      emit('generate-heatmap', props.earthquakeData);
    };
    
    const clearHeatmap = () => {
      emit('clear-heatmap');
    };
    
    const exportData = () => {
      try {
        // 创建CSV内容
        let csvContent = "序号,时间,位置,震级,深度(km),经度,纬度,类型\n";
        
        props.earthquakeData.forEach(eq => {
          csvContent += `${eq.序号 || eq.id},"${formatDate(eq.date)}","${eq.location || '未知'}",${eq.magnitude.toFixed(1)},${eq.depth.toFixed(1)},${eq.longitude.toFixed(6)},${eq.latitude.toFixed(6)},"${eq.type || '未知'}"\n`;
        });
        
        // 创建并下载文件
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `earthquake_data_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('导出数据失败:', error);
        alert('导出数据失败，请重试');
      }
    };
    
    // 工具函数
    const formatDate = (dateString) => {
      if (!dateString) return '未知';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN');
      } catch {
        return dateString;
      }
    };
    
    const getMagnitudeClass = (magnitude) => {
      if (magnitude >= 7.0) return 'magnitude-very-high';
      if (magnitude >= 6.0) return 'magnitude-high';
      if (magnitude >= 5.0) return 'magnitude-medium';
      if (magnitude >= 4.0) return 'magnitude-low';
      return 'magnitude-very-low';
    };
    
    return {
      isRefreshing,
      searchText,
      sortBy,
      currentPage,
      pageSize,
      totalCount,
      majorEarthquakes,
      maxMagnitude,
      avgMagnitude,
      filteredAndSortedData,
      totalPages,
      paginatedData,
      handleOverlayClick,
      refreshData,
      openAnalysis,
      locateEarthquake,
      generateHeatmap,
      clearHeatmap,
      exportData,
      formatDate,
      getMagnitudeClass
    };
  }
});
</script>

<style scoped>
.dashboard-overlay {
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

.earthquake-dashboard {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  max-width: 95vw;
  max-height: 95vh;
  width: 1200px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.dashboard-header h2 {
  margin: 0;
  font-size: 20px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.refresh-btn, .close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  display: flex;
  align-items: center;
  gap: 5px;
}

.refresh-btn:hover, .close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.dashboard-content {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #6c757d;
}

.data-table-container {
  background: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  margin-bottom: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #dee2e6;
  background: #f8f9fa;
}

.table-header h3 {
  margin: 0;
  color: #333;
}

.table-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.search-input, .sort-select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.table-wrapper {
  max-height: 400px;
  overflow-y: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #dee2e6;
}

.data-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
  position: sticky;
  top: 0;
  z-index: 1;
}

.data-table tr:hover {
  background: #f8f9fa;
}

.major-earthquake {
  background: rgba(255, 193, 7, 0.1);
}

.magnitude-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  color: white;
}

.magnitude-very-high { background: #dc3545; }
.magnitude-high { background: #fd7e14; }
.magnitude-medium { background: #ffc107; color: #333; }
.magnitude-low { background: #28a745; }
.magnitude-very-low { background: #17a2b8; }

.locate-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.3s ease;
}

.locate-btn:hover {
  background: #0056b3;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
}

.page-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.page-btn:hover:not(:disabled) {
  background: #0056b3;
}

.page-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #6c757d;
}

.dashboard-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.action-btn.primary {
  background: #007bff;
  color: white;
}

.action-btn.primary:hover {
  background: #0056b3;
}

.action-btn.secondary {
  background: #6c757d;
  color: white;
}

.action-btn.secondary:hover {
  background: #545b62;
}
</style>
