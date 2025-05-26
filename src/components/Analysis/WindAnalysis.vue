<template>
  <div class="wind-analysis">
    <div class="section-title">
      <i class="fas fa-wind"></i>
      风场分析
    </div>
    
    <!-- 数据加载控制 -->
    <div class="control-section">
      <h4>数据源控制</h4>
      <div class="control-group">
        <label>风场数据:</label>
        <select v-model="selectedDataSource" @change="handleDataSourceChange">
          <option value="2024122600">2024年12月26日00时</option>
          <option value="custom">自定义数据</option>
        </select>
      </div>
      
      <div class="control-buttons">
        <button 
          @click="loadWindData" 
          :disabled="isLoading"
          class="btn-primary"
        >
          <i class="fas fa-download"></i>
          {{ isLoading ? '加载中...' : '加载风场数据' }}
        </button>
        <button 
          @click="clearWindLayer" 
          :disabled="!windLayer"
          class="btn-danger"
        >
          <i class="fas fa-trash"></i>
          清除风场
        </button>
      </div>
    </div>
    
    <!-- 可视化控制 -->
    <div class="control-section" v-if="windLayer">
      <h4>可视化控制</h4>
      
      <!-- 颜色配置 -->
      <div class="control-group">
        <label>色带方案:</label>
        <select v-model="selectedColorScheme" @change="updateWindOptions">
          <option value="default">默认色带</option>
          <option value="rainbow">彩虹色带</option>
          <option value="temperature">温度色带</option>
          <option value="speed">风速色带</option>
        </select>
      </div>
      
      <!-- 粒子数量 -->
      <div class="control-group">
        <label>粒子数量: {{ windOptions.paths }}</label>
        <input 
          type="range" 
          v-model="windOptions.paths" 
          min="500" 
          max="20000" 
          step="500"
          @change="updateWindOptions"
        >
      </div>
      
      <!-- 粒子速度 -->
      <div class="control-group">
        <label>粒子速度: {{ (windOptions.velocityScale * 100).toFixed(1) }}</label>
        <input 
          type="range" 
          v-model="windOptions.velocityScale" 
          min="0.01" 
          max="0.1" 
          step="0.005"
          @change="updateWindOptions"
        >
      </div>
      
      <!-- 粒子生命周期 -->
      <div class="control-group">
        <label>粒子生命周期: {{ windOptions.maxAge }}</label>
        <input 
          type="range" 
          v-model="windOptions.maxAge" 
          min="30" 
          max="120" 
          step="10"
          @change="updateWindOptions"
        >
      </div>
      
      <!-- 透明度 -->
      <div class="control-group">
        <label>透明度: {{ (windOptions.globalAlpha * 100).toFixed(0) }}%</label>
        <input 
          type="range" 
          v-model="windOptions.globalAlpha" 
          min="0.1" 
          max="1.0" 
          step="0.05"
          @change="updateWindOptions"
        >
      </div>
      
      <!-- 帧率 -->
      <div class="control-group">
        <label>帧率: {{ windOptions.frameRate }}ms</label>
        <input 
          type="range" 
          v-model="windOptions.frameRate" 
          min="10" 
          max="50" 
          step="2"
          @change="updateWindOptions"
        >
      </div>
    </div>
    
    <!-- 风场信息显示 -->
    <div class="wind-info" v-if="windData">
      <h4>风场信息</h4>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">数据范围:</span>
          <span class="info-value">{{ windDataInfo.extent }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">网格大小:</span>
          <span class="info-value">{{ windDataInfo.gridSize }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">风速范围:</span>
          <span class="info-value">{{ windDataInfo.speedRange }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">更新时间:</span>
          <span class="info-value">{{ windDataInfo.updateTime }}</span>
        </div>
      </div>
    </div>
    
    <!-- 图例 -->
    <div class="wind-legend" v-if="windLayer">
      <h4>风速图例 (m/s)</h4>
      <div class="legend-gradient" :style="{ background: legendGradient }"></div>
      <div class="legend-labels">
        <span>0</span>
        <span>5</span>
        <span>10</span>
        <span>15</span>
        <span>20+</span>
      </div>
    </div>
    
    <!-- 状态信息 -->
    <div class="status-info" v-if="statusMessage">
      <div :class="['status-message', statusType]">
        <i :class="statusIcon"></i>
        {{ statusMessage }}
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, reactive, computed, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';

export default defineComponent({
  name: 'WindAnalysis',
  props: {
    viewer: {
      type: Object,
      required: true
    },
    currentLocation: {
      type: Object,
      required: true
    },
    preserveDataOnClose: {
      type: Boolean,
      default: true
    },
    keepDataOnPanelClose: {
      type: Boolean,
      default: true
    }
  },
  setup(props) {
    // 基础状态
    const isLoading = ref(false);
    const windLayer = ref(null);
    const windData = ref(null);
    const originalWindJsonData = ref(null); // 添加：保存原始JSON数据
    const selectedDataSource = ref('2024122600');
    const selectedColorScheme = ref('default');
    
    // 状态信息
    const statusMessage = ref('');
    const statusType = ref('info');
    const statusIcon = computed(() => {
      switch (statusType.value) {
        case 'success': return 'fas fa-check-circle';
        case 'error': return 'fas fa-exclamation-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        default: return 'fas fa-info-circle';
      }
    });
    
    // 风场配置选项 - 优化默认配置
    const windOptions = reactive({
      colorScale: [
        "rgb(36,104, 180)",
        "rgb(60,157, 194)",
        "rgb(128,205,193)",
        "rgb(151,218,168)",
        "rgb(198,231,181)",
        "rgb(238,247,217)",
        "rgb(255,238,159)",
        "rgb(252,217,125)",
        "rgb(255,182,100)",
        "rgb(252,150,75)",
        "rgb(250,112,52)",
        "rgb(245,64,32)",
        "rgb(237,45,28)",
        "rgb(220,24,32)",
        "rgb(180,0,35)"
      ],
      frameRate: 20,        // 优化帧率
      maxAge: 80,           // 增加粒子生命周期
      globalAlpha: 0.0,     // 设置透明度为0（完全不透明）
      velocityScale: 0.02,  // 适中的粒子速度
      paths: 8000           // 大幅增加粒子数量
    });
    
    // 色带配置
    const colorSchemes = {
      default: [
        "rgb(36,104, 180)", "rgb(60,157, 194)", "rgb(128,205,193)",
        "rgb(151,218,168)", "rgb(198,231,181)", "rgb(238,247,217)",
        "rgb(255,238,159)", "rgb(252,217,125)", "rgb(255,182,100)",
        "rgb(252,150,75)", "rgb(250,112,52)", "rgb(245,64,32)",
        "rgb(237,45,28)", "rgb(220,24,32)", "rgb(180,0,35)"
      ],
      rainbow: [
        "rgb(110,64,170)", "rgb(106,81,163)", "rgb(101,99,156)",
        "rgb(95,117,149)", "rgb(89,135,142)", "rgb(83,153,135)",
        "rgb(77,171,128)", "rgb(71,189,121)", "rgb(65,207,114)",
        "rgb(59,225,107)", "rgb(53,243,100)", "rgb(184,255,115)",
        "rgb(255,255,0)", "rgb(255,193,7)", "rgb(255,152,0)",
        "rgb(255,87,34)", "rgb(244,67,54)"
      ],
      temperature: [
        "rgb(26,35,126)", "rgb(26,82,118)", "rgb(2,119,189)",
        "rgb(42,161,152)", "rgb(67,192,80)", "rgb(129,212,26)",
        "rgb(255,245,157)", "rgb(255,213,79)", "rgb(255,171,64)",
        "rgb(255,112,67)", "rgb(244,81,30)", "rgb(229,57,53)",
        "rgb(183,28,28)"
      ],
      speed: [
        "rgb(247,251,255)", "rgb(222,235,247)", "rgb(198,219,239)",
        "rgb(158,202,225)", "rgb(107,174,214)", "rgb(66,146,198)",
        "rgb(33,113,181)", "rgb(8,81,156)", "rgb(8,48,107)"
      ]
    };
    
    // 风场数据信息
    const windDataInfo = computed(() => {
      if (!windData.value) return {};
      
      const field = windData.value;
      return {
        extent: `${field.xmin?.toFixed(1)}°~${field.xmax?.toFixed(1)}°, ${field.ymin?.toFixed(1)}°~${field.ymax?.toFixed(1)}°`,
        gridSize: `${field.cols} × ${field.rows}`,
        speedRange: field.range ? `${field.range[0]?.toFixed(1)} ~ ${field.range[1]?.toFixed(1)} m/s` : '计算中...',
        updateTime: selectedDataSource.value === '2024122600' ? '2024-12-26 00:00 UTC' : '自定义数据'
      };
    });
    
    // 图例渐变
    const legendGradient = computed(() => {
      const colors = windOptions.colorScale;
      const colorStops = colors.map((color, index) => {
        const percent = (index / (colors.length - 1)) * 100;
        return `${color} ${percent}%`;
      }).join(', ');
      return `linear-gradient(to right, ${colorStops})`;
    });
    
    // 设置状态信息
    const setStatus = (message, type = 'info', duration = 3000) => {
      statusMessage.value = message;
      statusType.value = type;
      
      if (duration > 0) {
        setTimeout(() => {
          if (statusMessage.value === message) {
            statusMessage.value = '';
          }
        }, duration);
      }
    };
    
    // 加载风场数据
    const loadWindData = async () => {
      if (!props.viewer) {
        setStatus('Viewer未初始化', 'error');
        return;
      }
      
      isLoading.value = true;
      setStatus('正在加载风场数据...', 'info', 0);
      
      try {
        // 动态导入CesiumWind类
        const { CesiumWind } = await import('../../utils/cesiumWind.js');
        
        // 加载风场数据
        const response = await fetch(`/2024122600.json`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const windJsonData = await response.json();
        
        // 保存原始JSON数据用于配置更新
        originalWindJsonData.value = windJsonData;
        
        console.log('风场数据加载成功，数据类型:', typeof windJsonData);
        console.log('风场数据长度:', Array.isArray(windJsonData) ? windJsonData.length : 'not array');
        
        // 验证数据格式
        if (!Array.isArray(windJsonData) || windJsonData.length === 0) {
          throw new Error('风场数据格式无效或为空');
        }
        
        // 更详细的数据结构验证
        let hasValidData = false;
        let hasWindData = false;
        
        for (let i = 0; i < windJsonData.length; i++) {
          const record = windJsonData[i];
          if (record.header && Array.isArray(record.data)) {
            hasValidData = true;
            
            const header = record.header;
            console.log(`数据记录 ${i}:`, {
              参数类别: header.parameterCategoryName,
              参数名称: header.parameterNumberName,
              参数编号: header.parameterNumber,
              网格大小: `${header.nx}×${header.ny}`,
              数据点数: record.data.length,
              单位: header.parameterUnit
            });
            
            // 检查是否包含风速数据
            if (header.parameterCategory === 2 || 
                (header.parameterNumberName && 
                 header.parameterNumberName.toLowerCase().includes('wind'))) {
              hasWindData = true;
            }
          }
        }
        
        if (!hasValidData) {
          throw new Error('风场数据结构不正确：缺少header或data字段');
        }
        
        if (!hasWindData) {
          console.warn('未检测到标准风速数据，将使用模拟风场');
          setStatus('未检测到风速数据，使用模拟风场演示', 'warning', 5000);
        }
        
        // 清除现有风场
        if (windLayer.value) {
          try {
            windLayer.value.remove();
          } catch (removeError) {
            console.warn('清除现有风场时出现警告:', removeError);
          }
        }
        
        // 验证viewer状态
        if (!props.viewer.scene || !props.viewer.camera) {
          throw new Error('Cesium viewer状态异常');
        }
        
        // 根据数据计算视角
        const firstRecord = windJsonData[0];
        const header = firstRecord.header;
        
        if (header && header.lo1 !== undefined && header.la1 !== undefined && 
            header.lo2 !== undefined && header.la2 !== undefined) {
          
          const centerLon = (header.lo1 + header.lo2) / 2;
          const centerLat = (header.la1 + header.la2) / 2;
          
          console.log(`数据中心点: 经度 ${centerLon}°, 纬度 ${centerLat}°`);
          console.log(`数据范围: 经度 ${header.lo1}°~${header.lo2}°, 纬度 ${header.la2}°~${header.la1}°`);
          
          // 根据数据范围调整视角高度
          const lonRange = Math.abs(header.lo2 - header.lo1);
          const latRange = Math.abs(header.la1 - header.la2);
          const maxRange = Math.max(lonRange, latRange);
          
          let cameraHeight = 8000000; // 默认8000km
          if (maxRange > 300) {
            cameraHeight = 15000000; // 全球数据
          } else if (maxRange > 100) {
            cameraHeight = 10000000; // 大陆数据
          } else if (maxRange > 30) {
            cameraHeight = 5000000;  // 区域数据
          } else {
            cameraHeight = 2000000;  // 局地数据
          }
          
          console.log(`设置相机高度: ${cameraHeight/1000}km`);
          
          // 飞到数据覆盖区域
          await props.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, cameraHeight),
            duration: 3.0
          });
          
          // 等待相机移动完成
          await new Promise(resolve => setTimeout(resolve, 3500));
        }
        
        // 创建新的风场图层
        try {
          // 针对实际数据优化的配置 - 更新默认值
          const optimizedWindOptions = {
            colorScale: windOptions.colorScale,
            useCoordsDraw: false, // 使用像素绘制模式
            gpet: false,
            frameRate: 25,        // 优化帧率
            paths: hasWindData ? 8000 : 5000, // 大幅增加粒子数量
            velocityScale: hasWindData ? 0.015 : 0.025, // 优化粒子速度
            globalAlpha: 1.0,     // 完全不透明
            maxAge: hasWindData ? 90 : 70,    // 增加粒子生命周期
            lineWidth: 1.2        // 稍微增加线宽
          };
          
          console.log('创建风场图层，配置:', optimizedWindOptions);
          
          windLayer.value = new CesiumWind(windJsonData, { 
            windOptions: optimizedWindOptions
          });
          
          if (!windLayer.value) {
            throw new Error('风场图层创建失败');
          }
          
          // 添加到viewer
          windLayer.value.addTo(props.viewer);
          
          // 获取风场数据对象用于信息显示
          windData.value = windLayer.value.getData();
          
          console.log('风场数据对象:', windData.value);
          
          setStatus(hasWindData ? '风场数据加载完成' : '模拟风场加载完成', 'success');
          console.log('风场图层创建完成并添加到场景');
          
        } catch (windError) {
          console.error('创建风场图层时出错:', windError);
          throw new Error(`风场图层创建失败: ${windError.message}`);
        }
        
      } catch (error) {
        console.error('加载风场数据失败:', error);
        
        // 提供更详细的错误信息
        let errorMessage = '加载失败';
        if (error.message.includes('HTTP')) {
          errorMessage = `网络错误: ${error.message}`;
        } else if (error.message.includes('JSON')) {
          errorMessage = '数据格式错误: 无法解析JSON';
        } else if (error.message.includes('缺少U或V分量')) {
          errorMessage = `数据格式错误: ${error.message}`;
        } else if (error.message.includes('Cesium')) {
          errorMessage = `Cesium API错误: ${error.message}`;
        } else {
          errorMessage = `错误: ${error.message}`;
        }
        
        setStatus(errorMessage, 'error');
        
        // 清理可能的部分状态
        windLayer.value = null;
        windData.value = null;
        originalWindJsonData.value = null;
        
      } finally {
        isLoading.value = false;
      }
    };
    
    // 清除风场图层
    const clearWindLayer = () => {
      if (windLayer.value) {
        try {
          windLayer.value.remove();
          console.log('风场图层已移除');
        } catch (error) {
          console.warn('移除风场图层时出现警告:', error);
        }
        windLayer.value = null;
        windData.value = null;
        originalWindJsonData.value = null; // 清理原始数据
        setStatus('风场已清除', 'success');
      }
    };
    
    // 处理数据源变化
    const handleDataSourceChange = () => {
      setStatus('请重新加载风场数据', 'warning');
    };
    
    // 更新风场配置 - 修复版本
    const updateWindOptions = () => {
      if (!windLayer.value || !originalWindJsonData.value) {
        console.warn('无风场图层或原始数据，跳过配置更新');
        return;
      }
      
      try {
        console.log('更新风场配置...');
        
        // 更新色带
        windOptions.colorScale = colorSchemes[selectedColorScheme.value];
        
        // 使用原始JSON数据重新创建风场图层
        windLayer.value.remove();
        
        // 使用安全的配置选项 - 优化配置限制
        const safeOptions = {
          windOptions: {
            colorScale: windOptions.colorScale,
            useCoordsDraw: false, // 强制使用像素绘制模式
            frameRate: Math.max(Number(windOptions.frameRate), 15),
            paths: Math.min(Number(windOptions.paths), 100000), // 增加粒子数量上限到100000
            velocityScale: Math.min(Number(windOptions.velocityScale), 0.1),
            globalAlpha: Math.min(Math.max(Number(windOptions.globalAlpha), 0.0), 1.0), // 允许完全不透明
            maxAge: Math.min(Math.max(Number(windOptions.maxAge), 30), 150), // 增加生命周期上限
            lineWidth: 1.2
          }
        };
        
        console.log('使用安全配置更新:', safeOptions);
        
        // 动态导入并重新创建
        import('../../utils/cesiumWind.js').then(({ CesiumWind }) => {
          try {
            // 使用原始JSON数据重新创建
            windLayer.value = new CesiumWind(originalWindJsonData.value, safeOptions);
            windLayer.value.addTo(props.viewer);
            windData.value = windLayer.value.getData();
            setStatus('风场配置已更新', 'success');
            console.log('风场配置更新完成');
          } catch (updateError) {
            console.error('更新风场配置失败:', updateError);
            setStatus('配置更新失败，请重新加载数据', 'error');
            windLayer.value = null;
            windData.value = null;
          }
        }).catch(importError => {
          console.error('导入风场模块失败:', importError);
          setStatus('模块加载失败', 'error');
        });
      } catch (error) {
        console.error('更新风场配置失败:', error);
        setStatus('配置更新失败', 'error');
      }
    };
    
    // 组件卸载时的清理处理 - 修复数据持久化问题
    onBeforeUnmount(() => {
      console.log('WindAnalysis组件即将卸载, preserveDataOnClose:', props.preserveDataOnClose);
      
      // 只有在明确设置不保留数据时才清除
      if (props.preserveDataOnClose === false) {
        console.log('清除风场数据...');
        clearWindLayer();
      } else {
        console.log('保留风场数据，不清除');
        // 不清除数据，让风场继续在地图上显示
      }
    });
    
    return {
      // 状态
      isLoading,
      windLayer,
      windData,
      selectedDataSource,
      selectedColorScheme,
      statusMessage,
      statusType,
      statusIcon,
      
      // 配置
      windOptions,
      windDataInfo,
      legendGradient,
      
      // 方法
      loadWindData,
      clearWindLayer,
      handleDataSourceChange,
      updateWindOptions
    };
  }
});
</script>

<style scoped>
.wind-analysis {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  max-height: 600px;
  overflow-y: auto;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-section {
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.control-section h4 {
  margin: 0 0 15px 0;
  color: #555;
  font-size: 14px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.control-group {
  margin-bottom: 15px;
}

.control-group label {
  display: block;
  margin-bottom: 5px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
}

.control-group select,
.control-group input[type="range"] {
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.control-group input[type="range"] {
  padding: 0;
  height: 6px;
  background: #ddd;
  outline: none;
  cursor: pointer;
}

.control-buttons {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.control-buttons button {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-danger:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.wind-info {
  padding: 15px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  margin-bottom: 20px;
}

.wind-info h4 {
  margin: 0 0 15px 0;
  color: #555;
  font-size: 14px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.info-grid {
  display: grid;
  gap: 10px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.info-value {
  font-size: 12px;
  color: #333;
  font-weight: normal;
}

.wind-legend {
  padding: 15px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  margin-bottom: 20px;
}

.wind-legend h4 {
  margin: 0 0 15px 0;
  color: #555;
  font-size: 14px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.legend-gradient {
  height: 20px;
  border-radius: 4px;
  margin-bottom: 8px;
  border: 1px solid #ddd;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #666;
}

.status-info {
  margin-top: 15px;
}

.status-message {
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f1b0b7;
}
</style>
