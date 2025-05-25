<!-- 实现洪水模拟分析-->
<template>
  <div class="analysis-section">
    <div class="section-title">洪水淹没分析</div>
    
    <!-- 区域绘制控制 -->
    <div class="input-group">
      <div v-if="!isDrawingPolygon && polygonPositions.length < 3">
        <button @click="startDrawPolygon" class="btn-primary full-width-btn">
          绘制淹没区域
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
        <div class="status-badge success">淹没区域已绘制</div>
        <button @click="clearPolygon" class="btn-secondary full-width-btn">
          清除区域
        </button>
      </div>
    </div>

    <!-- 水位设置 -->
    <div class="input-group">
      <label>最大水位高程 (米): {{ maxWaterLevel }}</label>
      <input type="range" :min="minHeight" :max="maxHeight" v-model.number="maxWaterLevel" class="range-slider" />
      <div class="range-labels">
        <span>{{ minHeight }}米</span>
        <span>{{ maxHeight }}米</span>
      </div>
    </div>
    
    <!-- 淹没过程设置 -->
    <div class="input-group">
      <label>淹没过程:</label>
      <div class="animation-controls">
        <button @click="toggleFloodAnimation" class="control-btn">
          {{ isAnimating ? '暂停' : '播放' }}
        </button>
        <button @click="resetFlood" class="control-btn" :disabled="!isActive">
          重置
        </button>
        <div class="animation-speed">
          <label>速度:</label>
          <select v-model="animationSpeed">
            <option value="0.5">慢速</option>
            <option value="1">正常</option>
            <option value="2">快速</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 水体样式设置 -->
    <div class="input-group">
      <label>水体样式:</label>
      <select v-model="selectedWaterStyle" class="select-control">
        <option v-for="style in waterStyles" :key="style.name" :value="style">
          {{ style.name }}
        </option>
      </select>
      <div class="water-style-preview" :style="{background: selectedWaterStyle.color}"></div>
    </div>

    <!-- 透明度设置 -->
    <div class="input-group">
      <label>水体透明度: {{ Math.round((1 - waterOpacity) * 100) }}%</label>
      <input 
        type="range" 
        min="0.3" 
        max="0.9" 
        step="0.1" 
        v-model.number="waterOpacity" 
        class="range-slider" 
      />
    </div>

    <!-- 操作按钮 -->
    <div class="control-buttons">
      <button 
        @click="startFloodAnalysis" 
        class="btn-primary" 
        :disabled="isAnalyzing || polygonPositions.length < 3">
        {{ isActive ? '更新分析' : '开始分析' }}
      </button>
      <button 
        @click="clearFloodAnalysis" 
        class="btn-secondary"
        :disabled="!isActive">
        清除分析
      </button>
    </div>

    <!-- 淹没统计信息 -->
    <div v-if="isActive && floodStats.areaSize" class="result-summary">
      <div class="summary-title">洪水统计</div>
      <div class="summary-row">
        <span>淹没面积:</span>
        <span class="value">{{ formatArea(floodStats.areaSize) }}</span>
      </div>
      <div class="summary-row">
        <span>当前水位:</span>
        <span class="value">{{ currentWaterLevel.toFixed(1) }}米</span>
      </div>
      <div class="summary-row">
        <span>最大淹没深度:</span>
        <span class="value">{{ floodStats.maxDepth.toFixed(1) }}米</span>
      </div>
      <div class="summary-row">
        <span>平均淹没深度:</span>
        <span class="value">{{ floodStats.avgDepth.toFixed(1) }}米</span>
      </div>
    </div>

    <!-- 状态信息 -->
    <div class="status-message" v-if="statusMsg">{{ statusMsg }}</div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';

export default {
  name: 'FloodAnalysis',
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
    const isDrawingPolygon = ref(false);
    const polygonPositions = ref([]);
    const polygonEntity = ref(null);
    const isAnalyzing = ref(false);
    const isActive = ref(false);
    const statusMsg = ref('');
    
    // 水位设置
    const minHeight = ref(0);
    const maxHeight = ref(1000);
    const maxWaterLevel = ref(50);
    const currentWaterLevel = ref(0);
    
    // 动画控制
    const isAnimating = ref(false);
    const animationSpeed = ref("1");
    
    // 水体样式
    const waterStyles = [
      { name: "标准蓝", color: "#1E90FF60" },
      { name: "深海蓝", color: "#00008B60" },
      { name: "淡蓝绿", color: "#20B2AA60" },
      { name: "清澈蓝", color: "#87CEEB60" },
      { name: "绿湖色", color: "#2F4F4F60" }
    ];
    const selectedWaterStyle = ref(waterStyles[0]);
    const waterOpacity = ref(0.7);
    
    // 洪水统计信息
    const floodStats = ref({
      areaSize: null,
      maxDepth: 0,
      avgDepth: 0,
      affectedCount: 0
    });
    
    // 分析控制变量
    let floodEntity = null;
    let drawHandler = null;
    let animationHandler = null;
    
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
      
      // 添加函数处理双击完成绘制
      drawHandler.setInputAction((click) => {
        if (polygonPositions.value.length >= 3) {
          finishDrawing();
        }
      }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      // 添加右键删除最后一个顶点
      drawHandler.setInputAction(() => {
        if (polygonPositions.value.length > 0) {
          polygonPositions.value.pop();
          updatePolygonPreview();
        }
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };

    // 获取地球表面位置
    const getEarthPosition = (windowPosition) => {
      if (!props.viewer) return null;
      
      try {
        const ray = props.viewer.camera.getPickRay(windowPosition);
        if (!ray) return null;
        
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
    
    // 更新多边形预览函数 - 修改为贴合地形
    const updatePolygonPreview = (tempPosition = null) => {
      if (!props.viewer) return;
      
      // 移除现有预览
      if (polygonEntity.value && props.viewer.entities.contains(polygonEntity.value)) {
        props.viewer.entities.remove(polygonEntity.value);
        polygonEntity.value = null;
      }
      
      // 如果没有点或只有一个点，不显示多边形
      if (polygonPositions.value.length < 1) return;
      
      // 创建多边形容器
      polygonEntity.value = props.viewer.entities.add({
        name: 'FloodPolygonContainer'
      });
      
      // 准备点位
      let positions = [...polygonPositions.value];
      if (tempPosition && polygonPositions.value.length > 0) {
        positions.push(tempPosition);
      }
      
      // 如果有足够的点创建多边形
      if (positions.length >= 3) {
        // 填充多边形 - 设置为贴合地形
        props.viewer.entities.add({
          parent: polygonEntity.value,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: Cesium.Color.BLUE.withAlpha(0.3),
            classificationType: Cesium.ClassificationType.TERRAIN, // 关键属性：贴合地形
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND // 确保高度贴地
          }
        });
        
        // 单独添加轮廓线作为polyline - 贴地
        props.viewer.entities.add({
          parent: polygonEntity.value,
          polyline: {
            positions: [...positions, positions[0]], // 闭合多边形
            width: 2,
            material: Cesium.Color.BLUE,
            clampToGround: true // 确保线条贴地
          }
        });
      } else if (positions.length === 2) {
        // 如果只有两个点，绘制线段 - 贴地
        props.viewer.entities.add({
          parent: polygonEntity.value,
          polyline: {
            positions: positions,
            width: 2,
            material: Cesium.Color.BLUE,
            clampToGround: true // 确保线条贴地
          }
        });
      }
      
      // 为每个顶点添加标记点 - 贴地
      positions.forEach((position, index) => {
        props.viewer.entities.add({
          parent: polygonEntity.value,
          position: position,
          point: {
            pixelSize: 8,
            color: index === positions.length - 1 && tempPosition ? Cesium.Color.YELLOW : Cesium.Color.RED,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND // 确保点贴地
          }
        });
      });
    };
    
    // 完成绘制函数
    const finishDrawing = () => {
      if (polygonPositions.value.length < 3) return;
      
      isDrawingPolygon.value = false;
      
      // 移除事件处理器
      if (drawHandler) {
        drawHandler.destroy();
        drawHandler = null;
      }
      
      // 最终更新多边形
      updatePolygonPreview();
      
      // 分析区域的高程范围
      analyzeTerrainElevation();
    };

    // 分析区域的高程范围
    const analyzeTerrainElevation = async () => {
      if (!props.viewer || polygonPositions.value.length < 3) return;
      
      try {
        statusMsg.value = "正在分析区域高程...";
        
        // 对区域进行采样以获得高程范围
        const positions = [...polygonPositions.value];
        const validPositions = positions.filter(pos => 
          pos && !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
          isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)
        );
        
        // 采样区域高程
        const cartographics = validPositions.map(position => 
          Cesium.Cartographic.fromCartesian(position)
        );
        
        let minTerrainHeight = Infinity;
        let maxTerrainHeight = -Infinity;
        
        // 分析顶点高程
        for (const cartographic of cartographics) {
          const height = cartographic.height;
          minTerrainHeight = Math.min(minTerrainHeight, height);
          maxTerrainHeight = Math.max(maxTerrainHeight, height);
        }
        
        // 添加额外的采样点 - 使用边界矩形内的网格点
        const boundingPositions = calculateBoundingRectangle(validPositions);
        
        if (boundingPositions && boundingPositions.length > 0) {
          // 对边界矩形内的点进行地形采样
          const sampleCartographics = [];
          
          // 将边界矩形的顶点转换为地理坐标
          for (const position of boundingPositions) {
            sampleCartographics.push(Cesium.Cartographic.fromCartesian(position));
          }
          
          // 在边界内创建网格采样点
          const westCart = sampleCartographics[0];
          const eastCart = sampleCartographics[1];
          const northCart = sampleCartographics[0];
          const southCart = sampleCartographics[2];
          
          const west = westCart.longitude;
          const east = eastCart.longitude;
          const north = northCart.latitude;
          const south = southCart.latitude;
          
          // 创建网格采样点
          const gridSize = 10; // 10x10 网格
          const lonStep = (east - west) / gridSize;
          const latStep = (north - south) / gridSize;
          
          const gridCartographics = [];
          for (let i = 0; i <= gridSize; i++) {
            for (let j = 0; j <= gridSize; j++) {
              const lon = west + i * lonStep;
              const lat = south + j * latStep;
              gridCartographics.push(new Cesium.Cartographic(lon, lat));
            }
          }
          
          // 使用地形高程采样
          try {
            const terrainProvider = props.viewer.scene.terrainProvider;
            if (terrainProvider.ready) {
              const sampledHeights = await Cesium.sampleTerrainMostDetailed(terrainProvider, gridCartographics);
              
              // 更新高程范围
              for (const sampledPosition of sampledHeights) {
                if (sampledPosition.height !== undefined && isFinite(sampledPosition.height)) {
                  minTerrainHeight = Math.min(minTerrainHeight, sampledPosition.height);
                  maxTerrainHeight = Math.max(maxTerrainHeight, sampledPosition.height);
                }
              }
            }
          } catch (error) {
            console.warn('地形采样失败，仅使用顶点高程:', error);
          }
        }
        
        console.log('地形高程范围:', { min: minTerrainHeight, max: maxTerrainHeight });
        
        // 更新高程设置
        minHeight.value = Math.floor(minTerrainHeight);
        maxHeight.value = Math.ceil(maxTerrainHeight + 200); // 添加一些余量
        
        // 设置初始水位为中间值
        maxWaterLevel.value = Math.floor(minHeight.value + (maxHeight.value - minHeight.value) * 0.5);
        currentWaterLevel.value = minHeight.value;
        
        statusMsg.value = "区域高程分析完成";
        setTimeout(() => {
          if (statusMsg.value === "区域高程分析完成") {
            statusMsg.value = "";
          }
        }, 2000);
        
      } catch (error) {
        console.error('分析地形高程范围失败:', error);
        statusMsg.value = "高程分析失败，请重试";
      }
    };
    
    // 计算边界矩形以增加采样点
    const calculateBoundingRectangle = (positions) => {
      try {
        if (!positions || positions.length < 3) return null;
        
        // 转换为地理坐标以计算边界
        const cartographics = positions.map(position => 
          Cesium.Cartographic.fromCartesian(position)
        );
        
        // 找出最小和最大的经纬度
        let minLon = Infinity, maxLon = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        
        cartographics.forEach(cart => {
          minLon = Math.min(minLon, cart.longitude);
          maxLon = Math.max(maxLon, cart.longitude);
          minLat = Math.min(minLat, cart.latitude);
          maxLat = Math.max(maxLat, cart.latitude);
        });
        
        // 创建边界矩形的四个角
        const boundingPositions = [
          Cesium.Cartesian3.fromRadians(minLon, maxLat), // 西北角
          Cesium.Cartesian3.fromRadians(maxLon, maxLat), // 东北角
          Cesium.Cartesian3.fromRadians(maxLon, minLat), // 东南角
          Cesium.Cartesian3.fromRadians(minLon, minLat)  // 西南角
        ];
        
        return boundingPositions;
        
      } catch (error) {
        console.error('计算边界矩形失败:', error);
        return null;
      }
    };

    // 取消多边形绘制
    const cancelDrawPolygon = () => {
      isDrawingPolygon.value = false;
      
      // 清理事件处理器
      if (drawHandler) {
        drawHandler.destroy();
        drawHandler = null;
      }
      
      // 清除多边形点位
      polygonPositions.value = [];
      
      // 移除多边形预览
      if (polygonEntity.value && props.viewer) {
        props.viewer.entities.remove(polygonEntity.value);
        polygonEntity.value = null;
      }
      
      statusMsg.value = "已取消绘制";
      setTimeout(() => {
        if (statusMsg.value === "已取消绘制") {
          statusMsg.value = "";
        }
      }, 1500);
    };

    // 清除多边形
    const clearPolygon = () => {
      // 清除点位
      polygonPositions.value = [];
      
      // 清理事件处理器
      if (drawHandler) {
        drawHandler.destroy();
        drawHandler = null;
      }
      
      // 移除多边形实体
      if (polygonEntity.value && props.viewer) {
        props.viewer.entities.remove(polygonEntity.value);
        polygonEntity.value = null;
      }
      
      isDrawingPolygon.value = false;
    };
    
    // 启动洪水分析
    const startFloodAnalysis = () => {
      if (isAnalyzing.value) return;
      
      try {
        isAnalyzing.value = true;
        statusMsg.value = "正在分析淹没区域...";
        
        // 清除现有分析
        if (isActive.value) {
          clearExistingFlood();
        }
        
        // 检查多边形是否已绘制
        if (polygonPositions.value.length < 3) {
          statusMsg.value = "请先绘制淹没区域";
          isAnalyzing.value = false;
          return;
        }
        
        performRegionalFloodAnalysis();
        
        // 分析完成
        isActive.value = true;
        isAnalyzing.value = false;
        statusMsg.value = "洪水淹没分析已创建";
        
        // 3秒后清除状态消息
        setTimeout(() => {
          if (statusMsg.value === "洪水淹没分析已创建") {
            statusMsg.value = "";
          }
        }, 3000);
        
      } catch (error) {
        console.error('执行洪水分析失败:', error);
        statusMsg.value = `分析失败: ${error.message}`;
        isAnalyzing.value = false;
      }
    };
    
    // 执行区域洪水分析 - 修改为更好地贴合地形的实现
    const performRegionalFloodAnalysis = () => {
      // 确保有效的多边形
      if (polygonPositions.value.length < 3) return;
      
      // 确保水位在合理范围内
      const waterLevel = Math.max(minHeight.value, Math.min(maxWaterLevel.value, maxHeight.value));
      
      // 获取地形高程和颜色信息
      const [r, g, b] = parseColor(selectedWaterStyle.value.color);
      const waterColor = new Cesium.Color(r, g, b, waterOpacity.value);
      
      // 创建区域洪水实体 - 改进版贴合地形
      floodEntity = props.viewer.entities.add({
        name: 'RegionalFlood',
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(polygonPositions.value),
          material: waterColor,
          // 以下属性确保洪水贴合地形
          height: minHeight.value,
          extrudedHeight: waterLevel,
          extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          classificationType: Cesium.ClassificationType.BOTH, // 同时贴合地形和3D瓦片
          outline: true,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
          outlineWidth: 2,
          shadows: Cesium.ShadowMode.ENABLED
        }
      });
      
      // 添加水面反射效果
      props.viewer.scene.globe.depthTestAgainstTerrain = true;
      
      // 更新当前水位
      currentWaterLevel.value = minHeight.value; // 开始动画时从最低水位开始
      
      // 计算洪水统计信息
      updateFloodStatistics();
      
      // 启动洪水动画
      startFloodAnimation();
      
      // 调整视角以查看洪水区域
      flyToFloodArea();
    };

    // 解析CSS颜色字符串为RGB数组
    const parseColor = (cssColor) => {
      // 处理十六进制颜色 #RRGGBB 或 #RRGGBBAA
      let hex = cssColor.trim();
      
      if (hex.startsWith('#')) {
        hex = hex.substring(1);
      }
      
      // 解析RGB值
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      
      return [r, g, b];
    };
    
    // 开始洪水动画 - 修改实现，确保动画贴合地形
    const startFloodAnimation = () => {
      // 停止现有动画
      stopFloodAnimation();
      
      // 设置动画状态
      isAnimating.value = true;
      
      // 保存初始水位
      const startLevel = currentWaterLevel.value || minHeight.value;
      const targetLevel = maxWaterLevel.value;
      const startTime = Date.now();
      let lastUpdateTime = startTime;
      
      // 计算动画时长 - 根据高度差和速度
      const animationDuration = 5000 / parseFloat(animationSpeed.value); // 基础5秒，根据速度调整
      
      // 创建动画帧处理函数
      const animateFrame = () => {
        // 如果动画已停止，不再继续
        if (!isAnimating.value || !floodEntity || !props.viewer.entities.contains(floodEntity)) {
          animationHandler = null;
          return;
        }
        
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / animationDuration);
        
        // 计算当前水位
        const newWaterLevel = startLevel + progress * (targetLevel - startLevel);
        currentWaterLevel.value = newWaterLevel;
        
        // 更新洪水多边形高度
        if (floodEntity.polygon) {
          floodEntity.polygon.extrudedHeight = new Cesium.ConstantProperty(newWaterLevel);
          
          // 改善贴合地形效果
          if (progress > 0.1 && progress < 0.9) {
            // 动态调整透明度，使水面效果更真实
            const dynamicAlpha = waterOpacity.value * (0.8 + Math.sin(progress * Math.PI) * 0.2);
            const [r, g, b] = parseColor(selectedWaterStyle.value.color);
            floodEntity.polygon.material = new Cesium.ColorMaterialProperty(
              new Cesium.Color(r, g, b, dynamicAlpha)
            );
            
            // 强制场景更新以确保贴合地形效果正确显示
            props.viewer.scene.requestRender();
          }
        }
        
        // 每500毫秒更新一次统计信息
        if (currentTime - lastUpdateTime > 500) {
          lastUpdateTime = currentTime;
          updateFloodStatistics();
        }
        
        // 如果动画未完成，请求下一帧
        if (progress < 1) {
          animationHandler = requestAnimationFrame(animateFrame);
        } else {
          // 动画完成
          isAnimating.value = false;
          animationHandler = null;
          // 确保最终水位正确
          currentWaterLevel.value = targetLevel;
          updateFloodStatistics();
        }
      };
      
      // 启动动画循环
      animationHandler = requestAnimationFrame(animateFrame);
    };
    
    // 停止洪水动画
    const stopFloodAnimation = () => {
      if (animationHandler) {
        cancelAnimationFrame(animationHandler);
        animationHandler = null;
      }
      isAnimating.value = false;
    };
    
    // 切换洪水动画播放状态
    const toggleFloodAnimation = () => {
      if (!isActive.value) return;
      
      if (isAnimating.value) {
        stopFloodAnimation();
      } else {
        // 如果已经达到最大水位，重新开始
        if (currentWaterLevel.value >= maxWaterLevel.value) {
          resetFlood();
        }
        startFloodAnimation();
      }
    };
    
    // 重置洪水水位
    const resetFlood = () => {
      if (!isActive.value || !floodEntity) return;
      
      // 停止动画
      stopFloodAnimation();
      
      // 重置水位到最低
      currentWaterLevel.value = minHeight.value;
      
      // 更新洪水多边形高度
      if (floodEntity.polygon) {
        floodEntity.polygon.extrudedHeight = new Cesium.ConstantProperty(minHeight.value);
      }
      
      // 更新统计数据
      updateFloodStatistics();
    };
    
    // 更新洪水统计信息 - 基于地形
    const updateFloodStatistics = () => {
      // 计算淹没面积
      let area = 0;
      let maxDepth = 0;
      let totalDepth = 0;
      let pointCount = 0;
      
      try {
        // 将顶点转换为地理坐标
        const positions = [...polygonPositions.value];
        const cartographics = positions.map(position => 
          Cesium.Cartographic.fromCartesian(position)
        );
        
        // 计算面积 - 使用平面多边形近似
        area = computePolygonArea(cartographics);
        
        // 估算最大淹没深度和平均深度
        // 使用当前水位减去区域内的最低高程
        const waterLevel = currentWaterLevel.value;
        const areaMinHeight = minHeight.value;
        
        maxDepth = Math.max(0, waterLevel - areaMinHeight);
        
        // 简单估算平均深度 (最大深度的一半)
        const avgDepth = maxDepth / 2;
        
        // 更新统计
        floodStats.value = {
          areaSize: area,
          maxDepth: maxDepth,
          avgDepth: avgDepth,
          affectedCount: Math.floor(area / 1000) // 估算受影响的人数(每平方千米)
        };
      } catch (error) {
        console.error('计算洪水统计信息失败:', error);
        
        // 提供一些默认值
        floodStats.value = {
          areaSize: area || 1000000,
          maxDepth: maxDepth || 5,
          avgDepth: maxDepth / 2 || 2.5,
          affectedCount: 100
        };
      }
    };
    
    // 计算多边形面积
    const computePolygonArea = (cartographics) => {
      try {
        if (!cartographics || cartographics.length < 3) return 0;
        
        // 转换为投影坐标以计算面积
        const projectedPoints = cartographics.map(cart => {
          const lon = Cesium.Math.toDegrees(cart.longitude);
          const lat = Cesium.Math.toDegrees(cart.latitude);
          
          // 简单的平面投影
          const x = lon * 111000 * Math.cos(Cesium.Math.toRadians(lat));
          const y = lat * 111000;
          
          return { x, y };
        });
        
        // 使用叉积公式计算多边形面积
        let area = 0;
        for (let i = 0; i < projectedPoints.length; i++) {
          const j = (i + 1) % projectedPoints.length;
          area += projectedPoints[i].x * projectedPoints[j].y;
          area -= projectedPoints[j].x * projectedPoints[i].y;
        }
        
        area = Math.abs(area) / 2; // 平方米
        return area;
        
      } catch (error) {
        console.error('计算多边形面积失败:', error);
        return 1000000; // 默认值
      }
    };
    
    // 格式化面积显示
    const formatArea = (areaInSquareMeters) => {
      if (areaInSquareMeters < 10000) {
        // 小于1公顷，显示平方米
        return `${Math.round(areaInSquareMeters)} 平方米`;
      } else if (areaInSquareMeters < 1000000) {
        // 小于1平方公里，显示公顷
        return `${(areaInSquareMeters / 10000).toFixed(2)} 公顷`;
      } else {
        // 大于1平方公里
        return `${(areaInSquareMeters / 1000000).toFixed(2)} 平方公里`;
      }
    };
    
    // 清除现有洪水
    const clearExistingFlood = () => {
      stopFloodAnimation();
      
      if (floodEntity && props.viewer) {
        props.viewer.entities.remove(floodEntity);
        floodEntity = null;
      }
      
      // 重置当前水位
      currentWaterLevel.value = minHeight.value;
    };
    
    // 清除洪水分析
    const clearFloodAnalysis = () => {
      clearExistingFlood();
      isActive.value = false;
      statusMsg.value = "";
      
      // 重置统计信息
      floodStats.value = {
        areaSize: null,
        maxDepth: 0,
        avgDepth: 0,
        affectedCount: 0
      };
    };
    
    // 调整视角到洪水区域
    const flyToFloodArea = () => {
      if (!props.viewer) return;
      
      try {
        if (analysisMode.value === 'regional' && polygonPositions.value.length >= 3) {
          // 计算多边形中心和适当高度
          const positions = [...polygonPositions.value];
          
          // 计算多边形的中心
          const center = calculatePolygonCenter(positions);
          if (!center) return;
          
          const height = Math.max(maxWaterLevel.value, maxHeight.value) + 500; // 在最高水位上方500米
          
          // 飞行到洪水区域上方
          props.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, height),
            orientation: {
              heading: 0,
              pitch: Cesium.Math.toRadians(-45),
              roll: 0
            }
          });
        }
      } catch (error) {
        console.error('飞行到洪水区域失败:', error);
      }
    };
    
    // 计算多边形中心
    const calculatePolygonCenter = (positions) => {
      try {
        if (!positions || positions.length === 0) return null;
        
        // 使用平均值计算中心点
        let sumX = 0, sumY = 0, sumZ = 0;
        
        positions.forEach(pos => {
          sumX += pos.x;
          sumY += pos.y;
          sumZ += pos.z;
        });
        
        const centerPosition = new Cesium.Cartesian3(
          sumX / positions.length,
          sumY / positions.length,
          sumZ / positions.length
        );
        
        // 转为经纬度
        const cartographic = Cesium.Cartographic.fromCartesian(centerPosition);
        return {
          longitude: Cesium.Math.toDegrees(cartographic.longitude),
          latitude: Cesium.Math.toDegrees(cartographic.latitude)
        };
        
      } catch (error) {
        console.error('计算多边形中心失败:', error);
        return null;
      }
    };
    
    // 组件卸载时清理
    onBeforeUnmount(() => {
      // 停止动画
      stopFloodAnimation();
      
      // 清除多边形绘制处理器
      if (drawHandler) {
        drawHandler.destroy();
        drawHandler = null;
      }
      
      // 清除实体
      clearFloodAnalysis();
      clearPolygon();
    });
    
    return {
      isDrawingPolygon,
      polygonPositions,
      isAnalyzing,
      isActive,
      statusMsg,
      minHeight,
      maxHeight,
      maxWaterLevel,
      currentWaterLevel,
      isAnimating,
      animationSpeed,
      waterStyles,
      selectedWaterStyle,
      waterOpacity,
      floodStats,
      startDrawPolygon,
      cancelDrawPolygon,
      clearPolygon,
      startFloodAnalysis,
      clearFloodAnalysis,
      toggleFloodAnimation,
      resetFlood,
      formatArea
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

.button-group {
  display: flex;
  gap: 8px;
}

.button-group button {
  flex: 1;
  padding: 6px 0;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.button-group button.active {
  background-color: #4285f4;
  color: white;
  border-color: #3367d6;
}

.button-group button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.range-slider {
  width: 100%;
  margin: 5px 0;
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

.animation-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-btn {
  padding: 6px 12px;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.animation-speed {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
}

.animation-speed label {
  font-size: 12px;
}

.animation-speed select {
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.select-control {
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 5px;
}

.water-style-preview {
  height: 20px;
  border-radius: 4px;
  margin-top: 5px;
}

.control-buttons {
  display: flex;
  gap: 8px;
  margin-top: 15px;
}

.btn-primary {
  background-color: #4285f4;
  color: white;
  border-color: #3367d6;
  flex: 1;
  padding: 8px 0;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background-color: #3367d6;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border-color: #5a6268;
  flex: 1;
  padding: 8px 0;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  border: none;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  background-color: #17a2b8;
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 5px;
}

.status-badge.success {
  background-color: #28a745;
}

.instruction-text {
  font-size: 12px;
  color: #666;
  margin: 5px 0;
}

.result-summary {
  background-color: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 12px;
  margin: 15px 0;
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
  margin-bottom: 5px;
  font-size: 12px;
}

.summary-row .value {
  font-weight: bold;
}

.status-message {
  margin-top: 10px;
  padding: 8px;
  font-size: 12px;
  color: #666;
  text-align: center;
  font-style: italic;
}
</style>