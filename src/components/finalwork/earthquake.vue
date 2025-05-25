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

    <!-- 统计信息 -->
    <div v-if="earthquakeStats" class="stats-panel">
      <div class="stats-title">数据统计</div>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">总数:</span>
          <span class="stat-value">{{ earthquakeStats.total }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">震级范围:</span>
          <span class="stat-value">{{ earthquakeStats.minMagnitude?.toFixed(1) }} - {{ earthquakeStats.maxMagnitude?.toFixed(1) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">深度范围:</span>
          <span class="stat-value">{{ earthquakeStats.minDepth?.toFixed(0) }} - {{ earthquakeStats.maxDepth?.toFixed(0) }}km</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">时间范围:</span>
          <span class="stat-value">{{ earthquakeStats.dateRange }}</span>
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
        
        data.push({
          id: i + 1,
          序号: i + 1,
          date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
    
    // 加载地震数据
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
        earthquakeStats.value = computeStats(processedData);
        
        // 发射数据加载事件，传递给父组件
        emit('earthquake-data-loaded', processedData);
        console.log('地震数据已加载，发射事件给父组件:', processedData.length, '条记录');
        
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
      if (clickHandler && props.viewer) {
        props.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        clickHandler = null;
      }
      
      if (earthquakeDataSource && props.viewer) {
        props.viewer.dataSources.remove(earthquakeDataSource);
        earthquakeDataSource = null;
      }

      // 清除辐射圈
      if (radiantManager) {
        radiantManager.clearAll();
      }
      
      dataLoaded.value = false;
      earthquakeData.value = [];
      filteredData.value = [];
      earthquakeStats.value = null;
      selectedEarthquake.value = null;
      statusMessage.value = '数据已清除';
      
      setTimeout(() => {
        if (statusMessage.value === '数据已清除') {
          statusMessage.value = '';
        }
      }, 2000);
    };

    // 监听变化
    watch([magnitudeRange, depthFilter, maxDisplayCount], () => {
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

    onBeforeUnmount(() => {
      clearData();
      // 销毁辐射圈管理器
      if (radiantManager) {
        radiantManager.destroy();
        radiantManager = null;
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
</style>