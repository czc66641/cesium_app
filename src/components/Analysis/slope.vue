<template>
  <div class="analysis-section">
    <div class="section-title">坡度分析</div>
    
    <!-- 区域绘制控制 -->
    <div class="input-group">
      <div v-if="!isDrawingPolygon && polygonPositions.length < 3">
        <button @click="startDrawPolygon" class="btn-primary full-width-btn">
          绘制分析区域
        </button>
      </div>
      <div v-else-if="isDrawingPolygon" class="active-analysis">
        <div class="status-badge">绘制区域中</div>
        <p class="instruction-text">点击地图添加顶点，双击结束，右键删除上一点</p>
        <button @click="cancelDrawPolygon" class="btn-secondary full-width-btn">
          取消绘制
        </button>
      </div>
      <div v-else>
        <div class="status-badge success">分析区域已绘制</div>
        <button @click="clearPolygon" class="btn-secondary full-width-btn">
          清除区域
        </button>
      </div>
    </div>

    <!-- 坡度等级设置 -->
    <div class="input-group">
      <label>坡度分级方式:</label>
      <select v-model="slopeClassification" class="select-control">
        <option value="natural">自然分类</option>
        <option value="equal">等间隔分类</option>
      </select>
    </div>

    <!-- 采样密度设置 -->
    <div class="input-group">
      <label>采样密度: {{ samplingDensity }}</label>
      <input 
        type="range" 
        min="10" 
        max="100" 
        step="10" 
        v-model.number="samplingDensity" 
        class="range-slider" 
      />
    </div>

    <!-- 色带选择 -->
    <div class="input-group">
      <label>坡度色带:</label>
      <select v-model="selectedColorRamp" class="select-control">
        <option v-for="ramp in colorRamps" :key="ramp.name" :value="ramp">
          {{ ramp.name }}
        </option>
      </select>
      <div class="color-ramp-preview" :style="{ background: colorRampStyle }"></div>
    </div>

    <!-- 操作按钮 -->
    <div class="control-buttons">
      <button 
        @click="performAnalysis" 
        class="btn-primary" 
        :disabled="isAnalyzing || polygonPositions.length < 3">
        {{ isActive ? '更新分析' : '开始分析' }}
      </button>
      <button 
        @click="clearAnalysis" 
        class="btn-secondary"
        :disabled="!isActive">
        清除分析
      </button>
    </div>

    <!-- 分析结果 -->
    <div v-if="isActive && analysisSummary.sampleCount > 0" class="result-summary">
      <div class="summary-title">坡度统计</div>
      <div class="summary-row">
        <span>平均坡度:</span>
        <span class="value">{{ analysisSummary.avgSlope.toFixed(2) }}°</span>
      </div>
      <div class="summary-row">
        <span>最大坡度:</span>
        <span class="value">{{ analysisSummary.maxSlope.toFixed(2) }}°</span>
      </div>
      <div class="summary-row">
        <span>最小坡度:</span>
        <span class="value">{{ analysisSummary.minSlope.toFixed(2) }}°</span>
      </div>
      <div class="summary-row">
        <span>样本数量:</span>
        <span class="value">{{ analysisSummary.sampleCount }}</span>
      </div>
    </div>

    <!-- 图例显示 -->
    <div v-if="isActive" class="legend-container">
      <div class="legend-title">坡度分级 (°)</div>
      <div class="legend">
        <div 
          v-for="(level, index) in legendLevels" 
          :key="index" 
          class="legend-item"
        >
          <div class="legend-color" :style="{ backgroundColor: level.color }"></div>
          <div class="legend-range">{{ level.range }}</div>
        </div>
      </div>
    </div>

    <!-- 状态信息 -->
    <div class="status-message" v-if="statusMsg">{{ statusMsg }}</div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';

export default {
  name: 'SlopeAnalysis',
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
  setup(props) {
    // 状态变量
    const isDrawingPolygon = ref(false);
    const polygonPositions = ref([]);
    const polygonEntity = ref(null);
    const isAnalyzing = ref(false);
    const isActive = ref(false);
    const statusMsg = ref('');
    const samplingDensity = ref(30);
    
    // 分析参数
    const slopeClassification = ref('natural');
    
    // 色带
    const colorRamps = [
      { 
        name: "坡度经典", 
        colors: [
          Cesium.Color.fromCssColorString("#267300"), // 平缓 - 深绿
          Cesium.Color.fromCssColorString("#4CE600"), // 轻坡 - 淡绿
          Cesium.Color.fromCssColorString("#FFFF00"), // 中坡 - 黄色
          Cesium.Color.fromCssColorString("#FF7F00"), // 陡坡 - 橙色
          Cesium.Color.fromCssColorString("#FF0000")  // 峭壁 - 红色
        ]
      },
      { 
        name: "热力图", 
        colors: [
          Cesium.Color.BLUE,
          Cesium.Color.CYAN,
          Cesium.Color.GREEN,
          Cesium.Color.YELLOW,
          Cesium.Color.RED
        ] 
      },
      { 
        name: "单色渐变", 
        colors: [
          Cesium.Color.fromCssColorString("#ffffcc"), // 极浅黄
          Cesium.Color.fromCssColorString("#a1dab4"), // 淡绿
          Cesium.Color.fromCssColorString("#41b6c4"), // 淡蓝
          Cesium.Color.fromCssColorString("#2c7fb8"), // 蓝色 
          Cesium.Color.fromCssColorString("#253494")  // 深蓝
        ]
      }
    ];
    const selectedColorRamp = ref(colorRamps[0]);
    
    // 分析结果
    const analysisSummary = ref({
      avgSlope: 0,
      maxSlope: 0,
      minSlope: 0,
      sampleCount: 0
    });
    
    // 图例相关
    const legendLevels = ref([]);
    
    // 分析结果实体
    let analysisEntity = null;
    let drawHandler = null;
    
    // 创建色带渐变样式
    const colorRampStyle = computed(() => {
      const colors = selectedColorRamp.value.colors;
      const colorStops = colors.map((color, index) => {
        const percent = (index / (colors.length - 1)) * 100;
        return `${color.toCssColorString()} ${percent}%`;
      }).join(', ');
      
      return `linear-gradient(to top, ${colorStops})`;
    });

    // 开始绘制多边形
    const startDrawPolygon = () => {
      if (!props.viewer || isDrawingPolygon.value) return;
      
      clearPolygon();
      isDrawingPolygon.value = true;
      polygonPositions.value = [];
      
      drawHandler = new Cesium.ScreenSpaceEventHandler(props.viewer.scene.canvas);
      
      // 添加顶点
      drawHandler.setInputAction((click) => {
        const earthPosition = getEarthPosition(click.position);
        if (earthPosition) {
          polygonPositions.value.push(earthPosition);
          updatePolygonPreview();
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      
      // 移动时更新预览
      drawHandler.setInputAction((movement) => {
        const earthPosition = getEarthPosition(movement.endPosition);
        if (earthPosition) {
          updatePolygonPreview(earthPosition);
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      
      // 删除上一个顶点
      drawHandler.setInputAction(() => {
        if (polygonPositions.value.length > 0) {
          polygonPositions.value.pop();
          updatePolygonPreview();
        }
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
      
      // 完成绘制
      drawHandler.setInputAction(() => {
        if (polygonPositions.value.length >= 3) {
          finishPolygon();
        } else {
          statusMsg.value = '多边形需要至少3个顶点';
        }
      }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    };
    
    // 获取地球表面位置
    const getEarthPosition = (windowPosition) => {
      if (!props.viewer) return null;
      
      try {
        const ray = props.viewer.camera.getPickRay(windowPosition);
        const position = props.viewer.scene.globe.pick(ray, props.viewer.scene);
        
        if (!position || 
            isNaN(position.x) || isNaN(position.y) || isNaN(position.z) ||
            !isFinite(position.x) || !isFinite(position.y) || !isFinite(position.z)) {
          return null;
        }
        
        return position;
      } catch (error) {
        console.error('获取地球表面位置失败:', error);
        return null;
      }
    };
    
    // 更新多边形预览
    const updatePolygonPreview = (tempPosition = null) => {
      if (!props.viewer) return;
      
      if (polygonEntity.value) {
        props.viewer.entities.remove(polygonEntity.value);
        polygonEntity.value = null;
      }
      
      if (polygonPositions.value.length < 1) return;
      
      try {
        let positions = [...polygonPositions.value];
        
        positions = positions.filter(pos => 
          pos && !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
          isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)
        );
        
        if (positions.length < 2) return;
        
        if (tempPosition) {
          if (!isNaN(tempPosition.x) && !isNaN(tempPosition.y) && !isNaN(tempPosition.z) &&
              isFinite(tempPosition.x) && isFinite(tempPosition.y) && isFinite(tempPosition.z)) {
            positions.push(tempPosition);
          }
        }
        
        polygonEntity.value = props.viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: Cesium.Color.BLUE.withAlpha(0.3),
            perPositionHeight: false,
            outline: true,
            outlineColor: Cesium.Color.BLUE,
            outlineWidth: 2,
            classificationType: Cesium.ClassificationType.TERRAIN
          }
        });
        
        // 顶点标记
        positions.forEach(position => {
          props.viewer.entities.add({
            position: position,
            point: {
              pixelSize: 8,
              color: Cesium.Color.RED,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
          });
        });
      } catch (error) {
        console.error('创建多边形预览失败:', error);
        statusMsg.value = '创建多边形失败，请重试';
      }
    };
    
    // 完成多边形绘制
    const finishPolygon = () => {
      if (polygonPositions.value.length < 3) return;
      
      isDrawingPolygon.value = false;
      
      if (drawHandler) {
        drawHandler.destroy();
        drawHandler = null;
      }
      
      updatePolygonPreview();
      
      statusMsg.value = '区域绘制完成，可以进行分析';
    };
    
    // 取消多边形绘制
    const cancelDrawPolygon = () => {
      isDrawingPolygon.value = false;
      polygonPositions.value = [];
      
      if (drawHandler) {
        drawHandler.destroy();
        drawHandler = null;
      }
      
      if (polygonEntity.value && props.viewer) {
        props.viewer.entities.remove(polygonEntity.value);
        polygonEntity.value = null;
      }
    };
    
    // 清除多边形
    const clearPolygon = () => {
      polygonPositions.value = [];
      
      if (drawHandler) {
        drawHandler.destroy();
        drawHandler = null;
      }
      
      if (polygonEntity.value && props.viewer) {
        props.viewer.entities.remove(polygonEntity.value);
        polygonEntity.value = null;
      }
      
      isDrawingPolygon.value = false;
    };
    
    // 清除分析结果
    const clearAnalysis = () => {
      if (!isActive.value) return;
      
      // 清除区域分析实体
      if (analysisEntity && props.viewer) {
        props.viewer.entities.remove(analysisEntity);
        analysisEntity = null;
      }
      
      isActive.value = false;
      statusMsg.value = '';
      
      // 重置分析结果
      analysisSummary.value = {
        avgSlope: 0,
        maxSlope: 0,
        minSlope: 0,
        sampleCount: 0
      };
      
      legendLevels.value = [];
    };
    
    // 执行坡度分析
    const performAnalysis = async () => {
      if (!props.viewer || isAnalyzing.value || polygonPositions.value.length < 3) return;
      
      try {
        isAnalyzing.value = true;
        statusMsg.value = '正在执行坡度分析...';
        
        // 清除现有分析结果
        clearAnalysis();
        
        // 验证多边形点位有效性
        const positions = [...polygonPositions.value];
        const validPositions = positions.filter(pos => 
          pos && !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
          isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)
        );
        
        if (validPositions.length < 3) {
          throw new Error('多边形包含无效点位置，无法进行分析');
        }
        
        // 1. 采样区域地形
        const terrainSamples = await sampleTerrainInPolygon(validPositions);
        
        if (terrainSamples.length === 0) {
          throw new Error('无法获取区域内的地形样本');
        }
        
        // 2. 计算坡度
        const slopeData = calculateRegionalSlopes(terrainSamples);
        
        if (slopeData.length === 0) {
          throw new Error('坡度计算失败');
        }
        
        // 3. 分析结果并可视化
        analyzeAndVisualizeSlopeData(slopeData, validPositions);
        
        isActive.value = true;
        statusMsg.value = '坡度分析完成';
        
        setTimeout(() => {
          if (statusMsg.value === '坡度分析完成') statusMsg.value = '';
        }, 3000);
      } catch (error) {
        console.error('坡度分析失败:', error);
        statusMsg.value = `分析失败: ${error.message}`;
      } finally {
        isAnalyzing.value = false;
      }
    };
    
    // 对多边形区域进行采样
    const sampleTerrainInPolygon = async (positions) => {
      const samples = [];
      
      try {
        // 计算多边形边界
        const cartographics = positions.map(position => 
          Cesium.Cartographic.fromCartesian(position)
        );
        
        // 计算边界经纬度范围
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        
        cartographics.forEach(cartographic => {
          const lng = Cesium.Math.toDegrees(cartographic.longitude);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);
          
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        });
        
        // 采样网格大小
        const gridSize = Math.max(10, Math.min(50, samplingDensity.value));
        
        // 计算采样步长
        const lngStep = (maxLng - minLng) / gridSize;
        const latStep = (maxLat - minLat) / gridSize;
        
        // 采样点
        const cartographicSamples = [];
        
        // 在边界盒内生成采样网格
        for (let lng = minLng; lng <= maxLng; lng += lngStep) {
          for (let lat = minLat; lat <= maxLat; lat += latStep) {
            cartographicSamples.push(Cesium.Cartographic.fromDegrees(lng, lat));
          }
        }
        
        // 获取高程数据
        for (const cartographic of cartographicSamples) {
          const height = await sampleTerrainHeight(
            cartographic.longitude,
            cartographic.latitude
          );
          
          if (height !== undefined) {
            cartographic.height = height;
            samples.push({
              position: Cesium.Cartesian3.fromRadians(
                cartographic.longitude,
                cartographic.latitude,
                cartographic.height
              ),
              longitude: Cesium.Math.toDegrees(cartographic.longitude),
              latitude: Cesium.Math.toDegrees(cartographic.latitude),
              height: cartographic.height
            });
          }
        }
        
        return samples;
      } catch (error) {
        console.error('区域采样失败:', error);
        return samples;
      }
    };
    
    // 获取地形高程
    const sampleTerrainHeight = async (longitude, latitude) => {
      return new Promise(resolve => {
        try {
          const position = Cesium.Cartesian3.fromRadians(longitude, latitude, 10000);
          const direction = Cesium.Cartesian3.normalize(
            Cesium.Cartesian3.negate(Cesium.Cartesian3.fromRadians(longitude, latitude, 0), new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
          );
          
          const ray = new Cesium.Ray(position, direction);
          const hit = props.viewer.scene.globe.pick(ray, props.viewer.scene);
          
          if (hit) {
            const cartographic = Cesium.Cartographic.fromCartesian(hit);
            resolve(cartographic.height);
          } else {
            resolve(0);
          }
        } catch (error) {
          console.warn('获取高程失败:', error);
          resolve(0);
        }
      });
    };
    
    // 计算区域坡度
    const calculateRegionalSlopes = (samples) => {
      const slopeData = [];
      
      try {
        if (samples.length < 4) return slopeData;
        
        // 对每个样本点计算坡度
        for (let i = 0; i < samples.length; i++) {
          const currentPoint = samples[i];
          let nearestPoints = [];
          
          // 寻找最近的4个点
          for (let j = 0; j < samples.length; j++) {
            if (i === j) continue;
            
            const distance = Cesium.Cartesian3.distance(
              currentPoint.position, 
              samples[j].position
            );
            
            nearestPoints.push({
              point: samples[j],
              distance: distance
            });
          }
          
          // 按距离排序
          nearestPoints.sort((a, b) => a.distance - b.distance);
          
          // 取最近的4个点
          nearestPoints = nearestPoints.slice(0, 4);
          
          // 计算与每个邻近点的坡度
          const slopes = [];
          
          for (const neighbor of nearestPoints) {
            const slope = calculateSlope(currentPoint.position, neighbor.point.position);
            slopes.push(slope);
          }
          
          // 取平均坡度
          const avgSlope = slopes.length > 0 ? 
                          slopes.reduce((sum, val) => sum + val, 0) / slopes.length : 0;
          
          slopeData.push({
            position: currentPoint.position,
            longitude: currentPoint.longitude,
            latitude: currentPoint.latitude,
            height: currentPoint.height,
            slope: avgSlope
          });
        }
      } catch (error) {
        console.error('计算区域坡度失败:', error);
      }
      
      return slopeData;
    };
    
    // 计算两点间坡度 (度)
    const calculateSlope = (pos1, pos2) => {
      try {
        // 转换为经纬度高程
        const cart1 = Cesium.Cartographic.fromCartesian(pos1);
        const cart2 = Cesium.Cartographic.fromCartesian(pos2);
        
        // 计算水平距离 (米)
        const p1 = Cesium.Cartesian3.fromRadians(cart1.longitude, cart1.latitude, 0);
        const p2 = Cesium.Cartesian3.fromRadians(cart2.longitude, cart2.latitude, 0);
        const horizontalDistance = Cesium.Cartesian3.distance(p1, p2);
        
        // 计算高程差 (米)
        const verticalDistance = Math.abs(cart1.height - cart2.height);
        
        // 避免除以零
        if (horizontalDistance < 0.001) {
          return 90; // 近乎垂直
        }
        
        // 计算坡度 (度)
        const slopeRadians = Math.atan(verticalDistance / horizontalDistance);
        const slopeDegrees = Cesium.Math.toDegrees(slopeRadians);
        
        return slopeDegrees;
      } catch (error) {
        console.error('计算坡度失败:', error);
        return 0;
      }
    };
    
    // 分析并可视化坡度数据
    const analyzeAndVisualizeSlopeData = (slopeData, boundaryPositions) => {
      try {
        // 计算坡度统计
        let totalSlope = 0;
        let maxSlope = 0;
        let minSlope = 90;
        
        slopeData.forEach(data => {
          totalSlope += data.slope;
          maxSlope = Math.max(maxSlope, data.slope);
          minSlope = Math.min(minSlope, data.slope);
        });
        
        const avgSlope = totalSlope / slopeData.length;
        
        // 更新统计结果
        analysisSummary.value = {
          avgSlope,
          maxSlope,
          minSlope,
          sampleCount: slopeData.length
        };
        
        // 生成坡度分级
        let slopeLevels;
        
        if (slopeClassification.value === 'natural') {
          // 自然断点分类法简化版
          slopeLevels = [0, 5, 15, 30, 45, 90];
        } else {
          // 等间隔分类
          const interval = maxSlope / 5;
          slopeLevels = [0];
          for (let i = 1; i <= 5; i++) {
            slopeLevels.push(Math.ceil(interval * i));
          }
        }
        
        // 生成图例
        generateSlopeLegend(slopeLevels);
        
        // 创建坡度可视化
        createSlopeVisualization(slopeData, boundaryPositions, slopeLevels);
        
      } catch (error) {
        console.error('坡度数据分析失败:', error);
        throw error;
      }
    };
    
    // 生成坡度图例
    const generateSlopeLegend = (slopeLevels) => {
      legendLevels.value = [];
      const colors = selectedColorRamp.value.colors;
      
      for (let i = 0; i < slopeLevels.length - 1; i++) {
        const minLevel = slopeLevels[i];
        const maxLevel = slopeLevels[i + 1];
        
        // 计算颜色索引
        const colorIdx = Math.min(i, colors.length - 1);
        
        legendLevels.value.push({
          range: `${minLevel}° - ${maxLevel}°`,
          color: colors[colorIdx].toCssColorString(),
          minLevel,
          maxLevel
        });
      }
    };
    
    // 创建坡度可视化
    const createSlopeVisualization = (slopeData, boundaryPositions, slopeLevels) => {
      // 创建分析容器
      analysisEntity = props.viewer.entities.add({
        name: 'SlopeAnalysis'
      });
      
      // 创建边界多边形
      props.viewer.entities.add({
        parent: analysisEntity,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(boundaryPositions),
          material: new Cesium.ColorMaterialProperty(Cesium.Color.WHITE.withAlpha(0.1)),
          outline: true,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          perPositionHeight: false,
          classificationType: Cesium.ClassificationType.TERRAIN
        }
      });
      
      // 创建坡度点集合
      const colors = selectedColorRamp.value.colors;
      
      slopeData.forEach((data, index) => {
        // 确定坡度级别和颜色
        const slope = data.slope;
        let colorIndex = 0;
        
        for (let i = 0; i < slopeLevels.length - 1; i++) {
          if (slope >= slopeLevels[i] && slope < slopeLevels[i + 1]) {
            colorIndex = i;
            break;
          }
        }
        
        const color = colors[Math.min(colorIndex, colors.length - 1)];
        
        // 每隔几个点添加一个可视化点以减少实体数量
        if (index % 3 === 0) {
          props.viewer.entities.add({
            parent: analysisEntity,
            position: data.position,
            point: {
              pixelSize: 6,
              color: color,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
          });
        }
        
        // 每隔一定数量的点添加标签
        if (index % 15 === 0) {
          props.viewer.entities.add({
            parent: analysisEntity,
            position: data.position,
            label: {
              text: `${data.slope.toFixed(1)}°`,
              font: '10px sans-serif',
              fillColor: Cesium.Color.WHITE,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              outlineWidth: 2,
              outlineColor: Cesium.Color.BLACK,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -6),
              showBackground: true,
              backgroundColor: Cesium.Color.BLACK.withAlpha(0.7)
            }
          });
        }
      });
      
      // 添加区域中心的信息标签
      const centerPos = getCenterPosition(boundaryPositions);
      if (centerPos) {
        props.viewer.entities.add({
          parent: analysisEntity,
          position: centerPos,
          billboard: {
            image: createInfoIcon(),
            width: 32,
            height: 32,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM
          },
          label: {
            text: `坡度统计\n平均: ${analysisSummary.value.avgSlope.toFixed(1)}°\n最大: ${analysisSummary.value.maxSlope.toFixed(1)}°`,
            font: '12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            pixelOffset: new Cesium.Cartesian2(20, 0),
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.7)
          }
        });
      }
      
      // 飞行到分析区域
      if (polygonEntity.value) {
        props.viewer.flyTo(polygonEntity.value);
      }
    };
    
    // 获取中心点位置
    const getCenterPosition = (positions) => {
      if (!positions || positions.length === 0) return null;
      
      let sumX = 0, sumY = 0, sumZ = 0;
      positions.forEach(position => {
        sumX += position.x;
        sumY += position.y;
        sumZ += position.z;
      });
      
      return new Cesium.Cartesian3(
        sumX / positions.length,
        sumY / positions.length,
        sumZ / positions.length
      );
    };
    
    // 创建信息图标
    const createInfoIcon = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      
      // 绘制图标
      ctx.fillStyle = '#4285f4';
      ctx.beginPath();
      ctx.arc(16, 16, 14, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('i', 16, 16);
      
      return canvas.toDataURL();
    };
    
    // 资源清理
    onBeforeUnmount(() => {
      if (drawHandler) {
        drawHandler.destroy();
      }
      
      clearAnalysis();
      clearPolygon();
    });
    
    return {
      isDrawingPolygon,
      polygonPositions,
      isAnalyzing,
      isActive,
      statusMsg,
      slopeClassification,
      samplingDensity,
      colorRamps,
      selectedColorRamp,
      colorRampStyle,
      analysisSummary,
      legendLevels,
      startDrawPolygon,
      cancelDrawPolygon,
      clearPolygon,
      performAnalysis,
      clearAnalysis
    };
  }
}
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

.select-control {
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.range-slider {
  width: 100%;
  margin: 5px 0;
}

.color-ramp-preview {
  height: 20px;
  border-radius: 4px;
  margin-top: 5px;
  border: 1px solid #ddd;
}

.control-buttons {
  display: flex;
  gap: 8px;
  margin: 15px 0;
}

button {
  padding: 8px 12px;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #4285f4;
  color: white;
  border-color: #3367d6;
  flex: 1;
}

.btn-primary:hover:not(:disabled) {
  background-color: #3367d6;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border-color: #5a6268;
  flex: 1;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.full-width-btn {
  width: 100%;
}

.active-analysis {
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 10px;
  text-align: center;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  background-color: #17a2b8;
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 8px;
}

.status-badge.success {
  background-color: #28a745;
}

.instruction-text {
  font-size: 12px;
  color: #666;
  margin-bottom: 10px;
}

.result-summary {
  background-color: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 12px;
  margin: 10px 0;
}

.summary-title {
  font-weight: bold;
  font-size: 13px;
  margin-bottom: 8px;
  text-align: center;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 12px;
}

.summary-row .value {
  font-weight: bold;
}

.legend-container {
  margin-top: 15px;
  padding: 10px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.legend-title {
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 10px;
  text-align: center;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.legend-color {
  width: 20px;
  height: 15px;
  border: 1px solid #ddd;
}

.legend-range {
  font-size: 12px;
  flex: 1;
}

.status-message {
  margin-top: 10px;
  padding: 8px;
  font-size: 13px;
  color: #666;
  text-align: center;
  font-style: italic;
}
</style>
