<template>
  <div class="analysis-section">
    <div class="section-title">高程分析</div>
    
    <!-- 地形控制选项 -->
    <div class="input-group">
      <label>地形来源:</label>
      <select v-model="terrainSource" class="select-control" @change="changeTerrainProvider">
        <option value="worldTerrain">Cesium全球地形</option>
        <option value="ellipsoid">平坦地形</option>
      </select>
    </div>
    
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

    <!-- 高程配置 -->
    <div class="input-group">
      <label>高程范围 (米):</label>
      <div class="range-inputs">
        <div class="range-input">
          <label>最小:</label>
          <input type="number" v-model.number="minHeight" step="10" />
        </div>
        <div class="range-input">
          <label>最大:</label>
          <input type="number" v-model.number="maxHeight" step="10" />
        </div>
      </div>
    </div>

    <!-- 分层设置 -->
    <div class="input-group">
      <label>分层数量: {{ levels }}</label>
      <input type="range" min="2" max="10" v-model.number="levels" class="range-slider" />
    </div>
    
    <!-- 采样密度设置 -->
    <div class="input-group">
      <label>采样密度: {{ samplingDensity }}x{{ samplingDensity }}</label>
      <input type="range" min="10" max="100" step="10" v-model.number="samplingDensity" class="range-slider" />
      <div class="small-hint">更高密度提供更精确结果，但会降低性能</div>
    </div>

    <!-- 可视化类型 -->
    <div class="input-group">
      <label>可视化方式:</label>
      <select v-model="visualizationType" class="select-control">
        <option value="colorRamp">色带渲染</option>
        <option value="contour">等高线</option>
        <option value="heatmap">热力图</option>
      </select>
    </div>

    <!-- 色带选择 -->
    <div class="input-group" v-if="visualizationType === 'colorRamp'">
      <label>高程色带:</label>
      <select v-model="selectedColorRamp" class="select-control">
        <option v-for="ramp in colorRamps" :key="ramp.name" :value="ramp">
          {{ ramp.name }}
        </option>
      </select>
      <div class="color-ramp-preview" :style="{ background: colorRampStyle }"></div>
    </div>
    
    <!-- 等高线设置 -->
    <div class="input-group" v-if="visualizationType === 'contour'">
      <label>等高线间隔: {{ contourInterval }}米</label>
      <input type="range" min="5" max="100" step="5" v-model.number="contourInterval" class="range-slider" />
    </div>

    <!-- 透明度设置 -->
    <div class="input-group">
      <label>透明度: {{ Math.round((1 - opacity) * 100) }}%</label>
      <input 
        type="range" 
        min="0" 
        max="0.9" 
        step="0.1" 
        v-model.number="opacity" 
        class="range-slider" 
      />
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

    <!-- 结果数据 -->
    <div v-if="isActive && elevationStats.sampleCount" class="result-summary">
      <div class="summary-title">高程统计</div>
      <div class="summary-row">
        <span>最低高程:</span>
        <span class="value">{{ elevationStats.minHeight.toFixed(1) }}米</span>
      </div>
      <div class="summary-row">
        <span>最高高程:</span>
        <span class="value">{{ elevationStats.maxHeight.toFixed(1) }}米</span>
      </div>
      <div class="summary-row">
        <span>平均高程:</span>
        <span class="value">{{ elevationStats.avgHeight.toFixed(1) }}米</span>
      </div>
      <div class="summary-row">
        <span>样本数量:</span>
        <span class="value">{{ elevationStats.sampleCount }}</span>
      </div>
    </div>

    <!-- 图例显示 -->
    <div v-if="isActive" class="legend-container">
      <div class="legend-title">高程分布 (米)</div>
      <div class="legend">
        <div 
          v-for="(level, index) in legendLevels" 
          :key="index" 
          class="legend-item"
          @click="onLegendItemClick(level.minLevel, level.maxLevel)"
          title="点击飞行至此高程范围"
        >
          <div class="legend-color" :style="{ backgroundColor: level.color }"></div>
          <div class="legend-range">{{ level.range }}</div>
        </div>
      </div>
      <div class="legend-hint">点击图例项可飞行至相应高程</div>
    </div>

    <!-- 状态信息 -->
    <div class="status-message" v-if="statusMsg">{{ statusMsg }}</div>

    <!-- 分析按钮 - 高级操作 -->
    <div class="additional-buttons" v-if="isActive">
      <button class="btn-extra" @click="jumpToElevation(elevationStats.minHeight)">
        查看最低点 ({{ elevationStats.minHeight.toFixed(0) }}m)
      </button>
      <button class="btn-extra" @click="jumpToElevation(elevationStats.maxHeight)">
        查看最高点 ({{ elevationStats.maxHeight.toFixed(0) }}m)
      </button>
      <button class="btn-extra" @click="exportElevationData" title="导出CSV格式的高程数据">
        导出数据
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';
import { 
  isValidCartesian, 
  createPointInPolygonTest as createPolygonTest, 
  getCenterPosition as getPolygonCenter,
  filterValidPositions 
} from '../../utils/errorHandler';
import { 
  createEnhancedPolygonEntity, 
  createEnhancedClippingPolygon, 
  getSafeEarthPosition,
  addCesiumErrorHandler,
  createEnhancedPointInPolygonTest
} from '../../utils/polygonSafe';

export default {
  name: 'HeightAnalysis',
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

    // 高程设置
    const minHeight = ref(0);
    const maxHeight = ref(1000);
    const levels = ref(5);
    const opacity = ref(0.6);
    const samplingDensity = ref(50);
    const visualizationType = ref('colorRamp');
    const contourInterval = ref(20);
    
    // 地形控制
    const terrainSource = ref('worldTerrain');
    let originalTerrainProvider = null;

    // 分析结果统计
    const elevationStats = ref({
      minHeight: 0,
      maxHeight: 0,
      avgHeight: 0,
      sampleCount: 0
    });
    
    // 采样数据缓存
    let elevationSamples = [];

    // 色带相关
    const colorRamps = [
      { 
        name: "地形经典", 
        colors: [
          Cesium.Color.fromCssColorString("#006837"),  // 深绿
          Cesium.Color.fromCssColorString("#1a9850"),  // 绿
          Cesium.Color.fromCssColorString("#66bd63"),  // 浅绿
          Cesium.Color.fromCssColorString("#a6d96a"),  // 黄绿
          Cesium.Color.fromCssColorString("#d9ef8b"),  // 淡黄
          Cesium.Color.fromCssColorString("#fee08b"),  // 浅黄
          Cesium.Color.fromCssColorString("#fdae61"),  // 浅橙
          Cesium.Color.fromCssColorString("#f46d43"),  // 橙
          Cesium.Color.fromCssColorString("#d73027"),  // 红
          Cesium.Color.WHITE                           // 白
        ]
      },
      { 
        name: "彩虹", 
        colors: [
          Cesium.Color.BLUE,
          Cesium.Color.CYAN,
          Cesium.Color.GREEN,
          Cesium.Color.YELLOW,
          Cesium.Color.RED
        ] 
      },
      { 
        name: "DEM", 
        colors: [
          Cesium.Color.fromCssColorString("#313695"),  // 深蓝
          Cesium.Color.fromCssColorString("#4575b4"),  // 蓝
          Cesium.Color.fromCssColorString("#74add1"),  // 浅蓝
          Cesium.Color.fromCssColorString("#abd9e9"),  // 淡蓝
          Cesium.Color.fromCssColorString("#e0f3f8"),  // 白蓝
          Cesium.Color.fromCssColorString("#fee090"),  // 淡黄
          Cesium.Color.fromCssColorString("#fdae61"),  // 浅橙
          Cesium.Color.fromCssColorString("#f46d43"),  // 橙
          Cesium.Color.fromCssColorString("#d73027"),  // 红
          Cesium.Color.fromCssColorString("#a50026")   // 深红
        ]
      },
      { 
        name: "黄绿蓝", 
        colors: [
          Cesium.Color.fromCssColorString("#ffffcc"),  // 淡黄
          Cesium.Color.fromCssColorString("#c2e699"),  // 淡绿
          Cesium.Color.fromCssColorString("#78c679"),  // 中绿
          Cesium.Color.fromCssColorString("#31a354"),  // 绿
          Cesium.Color.fromCssColorString("#006837")   // 深绿
        ]
      },
      { 
        name: "黄红", 
        colors: [
          Cesium.Color.fromCssColorString("#ffffb2"),
          Cesium.Color.fromCssColorString("#fed976"),
          Cesium.Color.fromCssColorString("#feb24c"),
          Cesium.Color.fromCssColorString("#fd8d3c"),
          Cesium.Color.fromCssColorString("#fc4e2a"),
          Cesium.Color.fromCssColorString("#e31a1c"),
          Cesium.Color.fromCssColorString("#b10026")
        ]
      }
    ];
    const selectedColorRamp = ref(colorRamps[0]);

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
    
    // 创建高程色带材质
    const createHeightRampMaterial = () => {
      try {
        // 生成色带Canvas
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error('无法获取canvas上下文');
          return createFallbackMaterial();
        }
        
        // 使用当前选择的色带
        const colors = selectedColorRamp.value.colors;
        
        // 创建线性渐变
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        
        // 根据色带添加颜色停止点
        colors.forEach((color, index) => {
          const stopPosition = index / (colors.length - 1);
          gradient.addColorStop(stopPosition, color.toCssColorString());
        });
        
        // 填充渐变
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, 1);
        
        // 创建材质 - 修复GLSL代码，适配不同版本
        return new Cesium.Material({
          fabric: {
            type: 'ElevationRamp',
            uniforms: {
              minimumHeight: minHeight.value,
              maximumHeight: maxHeight.value,
              image: canvas, // 使用canvas作为图像源
              alpha: opacity.value
            },
            source: `
              czm_material czm_getMaterial(czm_materialInput materialInput)
              {
                  czm_material material = czm_getDefaultMaterial(materialInput);
                  float height = materialInput.positionToEyeEC.z;
                  
                  // 限制高程在范围内
                  height = clamp(height, minimumHeight, maximumHeight);
                  
                  // 计算颜色采样位置
                  float colorPosition = (height - minimumHeight) / (maximumHeight - minimumHeight);
                  
                  // 保证colorPosition在有效范围内
                  colorPosition = clamp(colorPosition, 0.0, 1.0);
                  
                  // 采样纹理获取颜色 - 兼容不同的GLSL版本
                  vec4 rampColor = texture(image, vec2(colorPosition, 0.5));
                  
                  // 应用颜色和透明度
                  material.diffuse = rampColor.rgb;
                  material.alpha = alpha;
                  
                  return material;
              }
            `
          }
        });
      } catch (error) {
        console.error('创建高程材质失败:', error);
        return createFallbackMaterial(); // 使用备用材质
      }
    };
    
    // 创建备用材质 - 修复GLSL代码中的参数名
    const createFallbackMaterial = () => {
      try {
        // 使用内置的 Color Ramp 着色器
        const material = new Cesium.Material({
          fabric: {
            type: 'ColorRamp',
            uniforms: {
              minimumHeight: minHeight.value,
              maximumHeight: maxHeight.value,
              color1: selectedColorRamp.value.colors[0],
              color2: selectedColorRamp.value.colors[selectedColorRamp.value.colors.length - 1],
              alpha: opacity.value
            },
            source: `
              czm_material czm_getMaterial(czm_materialInput materialInput)
              {
                  czm_material material = czm_getDefaultMaterial(materialInput);
                  float height = materialInput.positionToEyeEC.z;
                  float normalized = clamp((height - minimumHeight) / (maximumHeight - minimumHeight), 0.0, 1.0);
                  vec4 finalColor = mix(color1, color2, normalized);
                  material.diffuse = finalColor.rgb;
                  material.alpha = finalColor.a * alpha;
                  return material;
              }
            `
          }
        });
        
        return material;
      } catch (error) {
        console.error('创建备用材质失败:', error);
        // 最后的备用：使用纯色材质
        return new Cesium.Material({
          fabric: {
            type: 'Color',
            uniforms: {
              color: new Cesium.Color(0.0, 0.5, 1.0, opacity.value)
            }
          }
        });
      }
    };

    // 获取颜色渐变纹理 - 修复版本
    const getColorRampTexture = () => {
      try {
        // 创建渐变Canvas
        const canvas = document.createElement('canvas');
        canvas.width = 256; // 增加分辨率，使渐变更平滑
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error('无法获取canvas上下文');
          return null;
        }
        
        // 使用当前选择的色带
        const colors = selectedColorRamp.value.colors;
        
        // 创建线性渐变
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        
        // 根据色带添加颜色停止点
        colors.forEach((color, index) => {
          const stopPosition = index / (colors.length - 1);
          gradient.addColorStop(stopPosition, color.toCssColorString());
        });
        
        // 填充渐变
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, 1);
        
        // 安全地创建纹理 - 修复使用正确的Cesium纹理创建API
        try {
          // 先检查viewer和scene是否有效
          if (!props.viewer || !props.viewer.scene || !props.viewer.scene.context) {
            console.warn('Viewer或Scene无效，无法创建纹理');
            return null;
          }
          
          // 使用正确的Cesium纹理创建API
          return new Cesium.Texture({
            context: props.viewer.scene.context,
            source: canvas,
            sampler: new Cesium.Sampler({
              minificationFilter: Cesium.TextureMinificationFilter.LINEAR,
              magnificationFilter: Cesium.TextureMagnificationFilter.LINEAR
            })
          });
        } catch (textureError) {
          console.error('创建纹理失败:', textureError);
          return null;
        }
      } catch (error) {
        console.error('生成色带纹理失败:', error);
        return null;
      }
    };

    // 改进创建等高线材质函数，避免使用"input"保留字
    const createContourMaterial = () => {
      try {
        const contourSpacing = contourInterval.value;
        
        return new Cesium.Material({
          fabric: {
            type: 'ElevationContour',
            uniforms: {
              minimumHeight: minHeight.value,
              maximumHeight: maxHeight.value,
              contourSpacing: contourSpacing,
              contourWidth: 1.0,
              contourColor: new Cesium.Color(1, 1, 1, opacity.value * 0.8),
              fillColor: new Cesium.Color(0, 0, 0, opacity.value * 0.2)
            },
            source: `
              #define PI 3.141592653589793
              czm_material czm_getMaterial(czm_materialInput materialInput)
              {
                  czm_material material = czm_getDefaultMaterial(materialInput);
                  float height = materialInput.positionToEyeEC.z;
                  float normalizedHeight = clamp((height - minimumHeight) / (maximumHeight - minimumHeight), 0.0, 1.0);
                  
                  // 计算等高线
                  float contourHeight = height / contourSpacing;
                  float quantizedContourHeight = fract(contourHeight);
                  
                  float isContour = step(0.98, smoothstep(0.0, 0.01, quantizedContourHeight));
                  
                  material.diffuse = mix(fillColor.rgb, contourColor.rgb, isContour);
                  material.alpha = mix(fillColor.a, contourColor.a, isContour);
                  
                  return material;
              }
            `
          }
        });
      } catch (error) {
        console.error('创建等高线材质失败:', error);
        return createFallbackMaterial(); // 使用备用材质
      }
    };

    // 飞行到多边形区域
    const flyToPolygon = (positions) => {
      if (!props.viewer || !positions || positions.length < 3) return;
      
      try {
        // 计算多边形的中心点
        const centerPos = getCenterPosition(positions);
        if (!centerPos) {
          console.warn('无法计算多边形中心点');
          // 如果实体存在，尝试直接飞向实体
          if (analysisEntity) {
            props.viewer.flyTo(analysisEntity);
          }
          return;
        }
        
        // 将中心点转换为地理坐标
        const centerCartographic = Cesium.Cartographic.fromCartesian(centerPos);
        const centerLongitude = Cesium.Math.toDegrees(centerCartographic.longitude);
        const centerLatitude = Cesium.Math.toDegrees(centerCartographic.latitude);
        
        // 计算适当的高度 - 使用区域的最大高程加上一定高度
        const viewHeight = elevationStats.value.maxHeight + 500;
        
        // 飞行到区域中心点上方
        props.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            centerLongitude,
            centerLatitude,
            viewHeight
          ),
          orientation: {
            heading: 0.0,
            pitch: Cesium.Math.toRadians(-45), // 俯视角度
            roll: 0.0
          },
          duration: 2.0
        });
      } catch (error) {
        console.error('飞行到多边形时出错:', error);
        // 使用实体飞行作为备选
        if (analysisEntity) {
          props.viewer.flyTo(analysisEntity);
        }
      }
    };

    // 清除分析结果但不重置状态
    const clearAnalysisResults = () => {
      try {
        // 清除全局材质
        if (props.viewer && props.viewer.scene && props.viewer.scene.globe) {
          props.viewer.scene.globe.material = undefined;
        }
        
        // 清除区域分析实体
        if (analysisEntity && props.viewer && props.viewer.entities) {
          try {
            props.viewer.entities.remove(analysisEntity);
          } catch (e) {
            console.warn('移除分析实体失败:', e);
          }
          analysisEntity = null;
        }
        
        // 查找并删除所有分析相关实体
        if (props.viewer && props.viewer.entities) {
          const entitiesToRemove = [];
          props.viewer.entities.values.forEach(entity => {
            if (entity && entity.id && entity.id.toString().includes('elevation_')) {
              entitiesToRemove.push(entity);
            }
          });
          
          entitiesToRemove.forEach(entity => {
            try {
              props.viewer.entities.remove(entity);
            } catch (error) {
              console.error('移除实体失败:', error);
            }
          });
        }
        
        // 强制重新渲染，清理任何残留效果
        if (props.viewer && props.viewer.scene) {
          props.viewer.scene.requestRender();
        }
      } catch (error) {
        console.error('清除分析结果时发生错误:', error);
      }
    };
    
    // 创建多边形裁剪区域函数
    const createClippingPolygon = (positions) => {
      // 清除现有分析结果
      clearAnalysisResults();
      
      try {
        // 根据可视化类型，为多边形创建不同的材质
        let material;
        switch (visualizationType.value) {
          case 'colorRamp':
            // 直接使用Cesium颜色作为备选 - 避免着色器错误
            material = new Cesium.Color(0.0, 0.5, 1.0, opacity.value);
            break;
          case 'contour':
            material = new Cesium.Color(0.0, 0.7, 0.7, opacity.value);
            break;
          case 'heatmap':
            material = new Cesium.Color(1.0, 0.5, 0.0, opacity.value);
            break;
          default:
            material = Cesium.Color.WHITE.withAlpha(0.5);
        }
        
        // 创建带有高程可视化效果的多边形
        analysisEntity = props.viewer.entities.add({
          id: 'elevation_analysis_container',
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: material,
            // 确保多边形贴合地形
            perPositionHeight: false,
            extrudedHeight: 0,
            outline: true,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2
          }
        });
        
        // 添加边界线
        props.viewer.entities.add({
          parent: analysisEntity,
          polyline: {
            positions: [...positions, positions[0]], // 闭合轮廓
            width: 2,
            material: Cesium.Color.WHITE,
            clampToGround: true
          }
        });
        
        // 清除全局材质，使其他区域保持正常显示
        props.viewer.scene.globe.material = undefined;
        
        // 尝试应用全局材质作为备选渲染方式
        if (true) { // 始终使用全局材质，确保有效果显示
          console.warn('使用全局材质进行渲染');
          switch (visualizationType.value) {
            case 'colorRamp':
              props.viewer.scene.globe.material = createHeightRampMaterial();
              break;
            case 'contour':
              props.viewer.scene.globe.material = createContourMaterial();
              break;
            case 'heatmap':
              props.viewer.scene.globe.material = createHeatmapMaterial();
              break;
          }
        }
        
      } catch (error) {
        console.error('创建高程分析多边形失败:', error);
        
        // 备选方案: 退回到全局材质方式
        try {
          console.warn('尝试使用全局材质作为备选...');
          // 根据可视化类型选择不同的显示方式
          switch (visualizationType.value) {
            case 'colorRamp':
              props.viewer.scene.globe.material = createHeightRampMaterial();
              break;
            case 'contour':
              props.viewer.scene.globe.material = createContourMaterial();
              break;
            case 'heatmap':
              props.viewer.scene.globe.material = createHeatmapMaterial();
              break;
          }
          
          // 创建简单的分析区域多边形来标记区域
          analysisEntity = props.viewer.entities.add({
            id: 'elevation_analysis_container',
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(positions),
              // 使用几乎透明的材质，让下面的地球材质可见
              material: Cesium.Color.WHITE.withAlpha(0.01),
              outlineColor: Cesium.Color.WHITE,
              outline: true,
              outlineWidth: 2
            }
          });
        } catch (backupError) {
          console.error('备选渲染方法也失败:', backupError);
          statusMsg.value = '高程渲染失败，请尝试其他区域或可视化方式';
        }
      }
    };

    // 设置相机位置
    const setCameraView = (position) => {
      if (!props.viewer) return;
      
      // 飞行到指定位置
      props.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.height),
        orientation: {
          heading: Cesium.Math.toRadians(position.heading),
          pitch: Cesium.Math.toRadians(position.pitch),
          roll: Cesium.Math.toRadians(position.roll)
        },
        duration: 2
      });
    };

    // 获取地球表面位置 - 安全实现
    const getEarthPosition = (windowPosition) => {
      if (!props.viewer) return null;
      
      try {
        const ray = props.viewer.camera.getPickRay(windowPosition);
        if (!ray) return null;
        
        const position = props.viewer.scene.globe.pick(ray, props.viewer.scene);
        
        // 验证位置有效性
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

    // 开始绘制多边形
    const startDrawPolygon = () => {
      if (!props.viewer || isDrawingPolygon.value) return;
      
      clearPolygon();
      isDrawingPolygon.value = true;
      polygonPositions.value = [];
      
      drawHandler = new Cesium.ScreenSpaceEventHandler(props.viewer.scene.canvas);
      
      // 添加顶点
      drawHandler.setInputAction(async (click) => {
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
    };    // 更新多边形预览，使用安全的多边形绘制工具 - 简化版，只创建必要的实体
    const updatePolygonPreview = (tempPosition = null) => {
      if (!props.viewer) return;
      
      // 移除现有预览
      if (polygonEntity.value && props.viewer.entities.contains(polygonEntity.value)) {
        props.viewer.entities.remove(polygonEntity.value);
        polygonEntity.value = null;
      }
      
      // 没有点时不创建
      if (polygonPositions.value.length < 1) return;
      
      try {
        // 使用安全的多边形创建工具
        const positions = [...polygonPositions.value];
        
        // 如果有临时点，添加到预览中
        const pointsToUse = tempPosition ? [...positions, tempPosition] : positions;
        
        // 创建一个包含所有必要元素的单一实体
        polygonEntity.value = props.viewer.entities.add({
          name: 'PolygonPreview',
          // 只有当点足够多时才添加多边形
          polygon: pointsToUse.length >= 3 ? {
            hierarchy: new Cesium.PolygonHierarchy(pointsToUse),
            material: Cesium.Color.BLUE.withAlpha(0.3),
            clampToGround: true
          } : undefined,
          // 添加轮廓线
          polyline: pointsToUse.length >= 2 ? {
            positions: pointsToUse.length >= 3 ? 
              [...pointsToUse, pointsToUse[0]] : // 如果是多边形则闭合
              pointsToUse, // 否则只显示线段
            width: 2,
            material: Cesium.Color.BLUE,
            clampToGround: true
          } : undefined
        });
        
        // 为每个实际点添加点标记
        pointsToUse.forEach((position, index) => {
          props.viewer.entities.add({
            parent: polygonEntity.value,
            position: position,
            point: {
              pixelSize: 8,
              color: index === pointsToUse.length - 1 && tempPosition ? Cesium.Color.YELLOW : Cesium.Color.RED,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
          });
        });
      } catch (error) {
        console.error('创建多边形预览失败:', error);
        statusMsg.value = '创建多边形失败，请重试或在其他区域绘制';
        setTimeout(() => {
          if (statusMsg.value === '创建多边形失败，请重试或在其他区域绘制') {
            statusMsg.value = '';
          }
        }, 3000);
      }
    };

    // 完成多边形绘制 - 修改以预加载区域地形
    const finishPolygon = () => {
      if (polygonPositions.value.length < 3) return;
      
      isDrawingPolygon.value = false;
      
      // 清理事件处理器
      if (drawHandler) {
        drawHandler.destroy();
        drawHandler = null;
      }
      
      // 最后更新一次多边形，确保闭合
      updatePolygonPreview();
      
      // 预加载多边形区域的地形数据
      if (polygonPositions.value.length >= 3) {
        statusMsg.value = '区域绘制完成，正在预加载地形数据...';
        
        // 在后台预加载地形数据
        ensureTerrainProviderReady(polygonPositions.value)
          .then(() => {
            statusMsg.value = '区域绘制完成，地形数据已预加载，可以进行分析';
          })
          .catch(error => {
            console.warn('地形预加载未完成，但仍可进行分析:', error);
            statusMsg.value = '区域绘制完成，可以进行分析';
          });
      } else {
        statusMsg.value = '区域绘制完成，可以进行分析';
      }
      
      // 清除右键菜单
      if (props.viewer && props.viewer.scene) {
        props.viewer.scene.screenSpaceCameraController.enableRightClickZoom = true;
      }
    };

    // 清除多边形
    const clearPolygon = () => {
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

    // 清除分析结果
    const clearAnalysis = () => {
      clearAnalysisResults();
      isActive.value = false;
      statusMsg.value = '';
      
      // 清除采样数据缓存
      elevationSamples = [];
      
      // 重置统计数据
      elevationStats.value = {
        minHeight: 0,
        maxHeight: 0,
        avgHeight: 0,
        sampleCount: 0
      };
    };

    // 执行高程分析 - 仅区域分析
    const performAnalysis = async () => {
      if (!props.viewer || isAnalyzing.value) return;
      
      try {
        isAnalyzing.value = true;
        statusMsg.value = '正在执行高程分析...';
        
        // 清除现有分析结果
        clearAnalysisResults();
        
        // 验证多边形是否已绘制
        if (polygonPositions.value.length < 3) {
          statusMsg.value = '请先绘制区域多边形';
          isAnalyzing.value = false;
          return;
        }
        
        // 执行区域分析
        await performRegionalAnalysis();
        
        isActive.value = true;
        statusMsg.value = '高程分析完成';
        
        // 3秒后清除状态消息
        setTimeout(() => {
          if (statusMsg.value === '高程分析完成') statusMsg.value = '';
        }, 3000);
      } catch (error) {
        console.error('执行高程分析失败:', error);
        statusMsg.value = `分析失败: ${error.message}`;
      } finally {
        isAnalyzing.value = false;
      }
    };
    
    // 执行区域高程分析
    const performRegionalAnalysis = async () => {
      if (polygonPositions.value.length < 3) return;
      
      try {
        statusMsg.value = '正在分析区域内的地形高程...';
        
        // 验证多边形点位有效性
        const positions = [...polygonPositions.value];
        const validPositions = positions.filter(pos => 
          pos && !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
          isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)
        );
        
        if (validPositions.length < 3) {
          throw new Error('多边形包含无效点位置，无法创建高程分析');
        }
        
        // 1. 对多边形区域进行密集地形采样获取实际高程数据
        const terrainSamples = await sampleTerrainInPolygon(validPositions);
        
        // 缓存采样数据供后续使用
        elevationSamples = terrainSamples;
        
        if (terrainSamples.length === 0) {
          throw new Error('无法获取区域内的地形高程数据');
        }
        
        // 2. 分析高程范围
        let minTerrainHeight = Infinity;
        let maxTerrainHeight = -Infinity;
        let sumHeight = 0;
        
        terrainSamples.forEach(sample => {
          const height = sample.height;
          minTerrainHeight = Math.min(minTerrainHeight, height);
          maxTerrainHeight = Math.max(maxTerrainHeight, height);
          sumHeight += height;
        });
        
        // 计算平均高度
        const avgHeight = sumHeight / terrainSamples.length;
        
        // 更新统计数据
        elevationStats.value = {
          minHeight: minTerrainHeight,
          maxHeight: maxTerrainHeight,
          avgHeight: avgHeight,
          sampleCount: terrainSamples.length
        };
        
        // 3. 更新高程设置以匹配实际地形
        minHeight.value = Math.floor(minTerrainHeight);
        maxHeight.value = Math.ceil(maxTerrainHeight);
        
        // 4. 创建可视化多边形
        createClippingPolygon(validPositions);
        
        // 5. 生成图例
        generateLegend();
        
        // 6. 在区域中心创建高程信息标签
        createElevationInfoLabel(validPositions, minTerrainHeight, maxTerrainHeight, avgHeight);
        
        // 7. 如果是热力图模式，添加点状采样可视化
        if (visualizationType.value === 'heatmap') {
          addSamplePointsVisualization(terrainSamples);
        }
        
        // 飞行到区域
        flyToPolygon(validPositions);
        
      } catch (error) {
        console.error('区域高程分析失败:', error);
        statusMsg.value = `区域高程分析失败: ${error.message}`;
        throw error;
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
        
        // 计算多边形边界的经纬度范围
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        
        cartographics.forEach(cart => {
          if (!isFinite(cart.longitude) || !isFinite(cart.latitude)) return;
          
          const lng = Cesium.Math.toDegrees(cart.longitude);
          const lat = Cesium.Math.toDegrees(cart.latitude);
          
          if (!isFinite(lng) || !isFinite(lat)) return;
          
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        });
        
        // 检查边界是否有效
        if (!isFinite(minLng) || !isFinite(maxLng) || !isFinite(minLat) || !isFinite(maxLat) ||
            minLng === Infinity || maxLng === -Infinity || minLat === Infinity || maxLat === -Infinity) {
          throw new Error('无法计算有效的多边形边界');
        }
        
        // 创建网格采样点
        const gridSize = Math.min(samplingDensity.value, 100); // 限制最大值以防性能问题
        const lonStep = (maxLng - minLng) / gridSize;
        const latStep = (maxLat - minLat) / gridSize;
        
        // 创建点在多边形内的检测函数 - 使用安全版本
        const isInPolygon = createEnhancedPointInPolygonTest(positions);
        
        const cartographicSamples = [];
        
        // 创建网格采样点
        for (let i = 0; i <= gridSize; i++) {
          for (let j = 0; j <= gridSize; j++) {
            const lon = minLng + i * lonStep;
            const lat = minLat + j * latStep;
            
            // 只添加多边形内部的点
            if (isInPolygon(lon, lat)) {
              cartographicSamples.push(Cesium.Cartographic.fromDegrees(lon, lat));
            }
          }
        }
        
        if (cartographicSamples.length === 0) {
          throw new Error('未生成有效的采样点');
        }
        
        // 使用地形采样获取高程 - 注意传入多边形位置以优先加载该区域
        try {
          // 显示数量提示
          statusMsg.value = `正在采样 ${cartographicSamples.length} 个点，这可能需要一些时间...`;
          
          // 检查并等待地形提供者准备就绪 - 传入多边形位置以优先加载
          const terrainProvider = await ensureTerrainProviderReady(positions);
          
          if (!terrainProvider) {
            throw new Error('无法获取有效的地形提供者');
          }
          
          // 采样地形高程
          // 分批处理以避免一次性处理过多点
          const batchSize = 500; // 每批处理的点数
          let processedSamples = [];
          
          for (let i = 0; i < cartographicSamples.length; i += batchSize) {
            const batchEnd = Math.min(i + batchSize, cartographicSamples.length);
            const currentBatch = cartographicSamples.slice(i, batchEnd);
            
            statusMsg.value = `正在采样地形... (${Math.min(100, Math.round((i / cartographicSamples.length) * 100))}%)`;
            
            try {
              const batchResults = await Cesium.sampleTerrainMostDetailed(terrainProvider, currentBatch);
              processedSamples = processedSamples.concat(batchResults);
            } catch (batchError) {
              console.warn(`批次 ${i/batchSize + 1} 采样失败:`, batchError);
              // 继续处理下一批
            }
          }
          
          // 处理采样结果
          processedSamples.forEach((cartographic) => {
            if (cartographic.height !== undefined && isFinite(cartographic.height)) {
              const lon = Cesium.Math.toDegrees(cartographic.longitude);
              const lat = Cesium.Math.toDegrees(cartographic.latitude);
              
              if (isFinite(lon) && isFinite(lat)) {
                samples.push({
                  position: Cesium.Cartesian3.fromRadians(
                    cartographic.longitude,
                    cartographic.latitude,
                    cartographic.height
                  ),
                  longitude: lon,
                  latitude: lat,
                  height: cartographic.height
                });
              }
            }
          });
          
          statusMsg.value = `地形采样完成，获得 ${samples.length} 个有效样本`;
          
          // 如果采样点太少，尝试使用射线检测作为补充
          if (samples.length < cartographicSamples.length * 0.3) {
            console.warn('有效样本数量过少，尝试补充采样...');
            await supplementWithRaycastSampling(cartographicSamples, samples);
          }
          
        } catch (error) {
          console.error('地形采样失败，将使用替代方法:', error);
          
          // 备选方案：使用射线检测
          await supplementWithRaycastSampling(cartographicSamples, samples);
        }
        
        return samples;
      } catch (error) {
        console.error('区域采样失败:', error);
        statusMsg.value = '区域采样失败，请尝试减小区域或降低采样密度';
        return samples;
      }
    };
    
    // 使用射线检测补充采样点 - 新增函数
    const supplementWithRaycastSampling = async (cartographicSamples, existingSamples) => {
      statusMsg.value = '正在使用备选采样方法...';
      
      // 跟踪已有点的位置，避免重复
      const existingPositionsMap = new Map();
      existingSamples.forEach(sample => {
        const key = `${sample.longitude.toFixed(6)}_${sample.latitude.toFixed(6)}`;
        existingPositionsMap.set(key, true);
      });
      
      // 使用更少的点进行射线采样以提高性能
      const sampleFactor = Math.max(1, Math.floor(cartographicSamples.length / 500));
      let addedCount = 0;
      
      for (let i = 0; i < cartographicSamples.length; i += sampleFactor) {
        const cartographic = cartographicSamples[i];
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        
        // 检查是否已经存在该点
        const key = `${lon.toFixed(6)}_${lat.toFixed(6)}`;
        if (existingPositionsMap.has(key)) continue;
        
        // 获取高程
        const height = await getRaycastHeight(lon, lat);
        
        if (height !== null && isFinite(height)) {
          existingSamples.push({
            position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
            longitude: lon,
            latitude: lat,
            height: height
          });
          addedCount++;
          
          // 更新采样进度
          if (addedCount % 20 === 0) {
            statusMsg.value = `备选采样中... (${Math.round(i / cartographicSamples.length * 100)}%)`;
          }
        }
      }
      
      statusMsg.value = `使用替代方法补充了 ${addedCount} 个样本点，总计 ${existingSamples.length} 个样本`;
    };

    // 确保地形提供者已经准备就绪 - 优化版本，支持区域优先加载
    const ensureTerrainProviderReady = async (polygonPositionsParam = null) => {
      if (!props.viewer || !props.viewer.scene) {
        throw new Error('Viewer或Scene未初始化');
      }
      
      const scene = props.viewer.scene;
      let terrainProvider = scene.terrainProvider;
      
      // 检查是否是平坦地形
      if (terrainProvider instanceof Cesium.EllipsoidTerrainProvider) {
        console.log('使用平坦地形进行采样');
        return terrainProvider;
      }
      
      // 确定是否有多边形区域限制
      const hasPolygon = polygonPositionsParam && polygonPositionsParam.length >= 3;
      let polygonCartographics = [];
      
      // 如果有多边形，计算其经纬度范围
      if (hasPolygon) {
        // 转换多边形顶点为地理坐标
        polygonCartographics = polygonPositionsParam.map(position => 
          Cesium.Cartographic.fromCartesian(position)
        );
        
        console.log('将优先加载多边形区域内的地形数据');
        statusMsg.value = '正在优先加载分析区域的地形数据...';
      }
      
      // 对于非平坦地形，检查准备状态
      if (!terrainProvider || !terrainProvider.ready) {
        console.log('地形提供者未准备好，尝试等待...');
        
        // 尝试重新获取/设置地形提供者
        try {
          // 先确保设置访问令牌
          const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4Njg5NmJkZS03ZjgwLTRhNWYtYWU5OC01NDRmZTYxNmQ3YmIiLCJpZCI6MjkzOTI4LCJpYXQiOjE3NDQ2MjcyMDB9.pQM7IkMb643M1hF5XHklTSAYMhjmHQDHlei0X8hsokk';
          Cesium.Ion.defaultAccessToken = accessToken;
          
          // 创建新的地形提供者
          statusMsg.value = '正在准备地形数据...';
          
          // 创建一个新的地形提供者并等待其就绪
          const newTerrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
            requestVertexNormals: true
          });
          
          // 优先预加载多边形区域的地形 - 在等待全部地形就绪之前
          if (hasPolygon && polygonCartographics.length > 0) {
            try {
              statusMsg.value = '优先加载分析区域的地形数据...';
              
              // 先对多边形区域进行地形采样，这会触发这部分区域的瓦片加载
              await Cesium.sampleTerrainMostDetailed(newTerrainProvider, polygonCartographics);
              console.log('多边形区域地形数据已预加载');
              statusMsg.value = '区域地形数据已加载，继续准备分析...';
            } catch (preloadError) {
              console.warn('区域地形预加载未完成，将继续等待全局地形:', preloadError);
            }
          }
          
          // 使用Promise等待地形提供者准备就绪，但设置更短的超时时间
          await new Promise((resolve, reject) => {
            // 如果已经预加载了区域地形，可以缩短等待时间
            const timeoutDuration = hasPolygon ? 5000 : 10000;
            
            if (newTerrainProvider.ready) {
              resolve();
            } else {
              // 设置超时
              const timeout = setTimeout(() => {
                // 如果有预加载的区域，即使全部地形未准备好也可以继续
                if (hasPolygon) {
                  console.log('全局地形未完全准备好，但区域地形已预加载，将继续分析');
                  resolve();
                } else {
                  reject(new Error('地形提供者准备超时'));
                }
              }, timeoutDuration);
              
              // 轮询检查是否就绪
              const checkReady = () => {
                if (newTerrainProvider.ready) {
                  clearTimeout(timeout);
                  resolve();
                } else {
                  setTimeout(checkReady, 500); // 每500ms检查一次
                }
              };
              
              checkReady();
            }
          });
          
          // 更新场景的地形提供者
          scene.setTerrain(new Cesium.Terrain(newTerrainProvider));
          terrainProvider = newTerrainProvider;
          
          console.log('已成功准备地形提供者');
        } catch (error) {
          console.error('准备地形提供者失败，回退到平坦地形:', error);
          
          // 回退到平坦地形
          const ellipsoidTerrainProvider = new Cesium.EllipsoidTerrainProvider();
          scene.setTerrain(new Cesium.Terrain(ellipsoidTerrainProvider));
          terrainProvider = ellipsoidTerrainProvider;
        }
      } else if (hasPolygon && polygonCartographics.length > 0) {
        // 如果地形提供者已准备好，但有特定区域，也预加载该区域
        try {
          statusMsg.value = '优先加载分析区域的地形数据...';
          await Cesium.sampleTerrainMostDetailed(terrainProvider, polygonCartographics);
          console.log('多边形区域地形数据已预加载');
          statusMsg.value = '区域地形数据已加载，继续准备分析...';
        } catch (preloadError) {
          console.warn('区域地形预加载未完成，将继续使用全局地形:', preloadError);
        }
      }
      
      return terrainProvider;
    };

    // 使用射线检测获取高程 - 增强版，添加超时和错误重试
    const getRaycastHeight = async (longitude, latitude) => {
      return new Promise(async (resolve) => {
        const maxAttempts = 3;
        let attempt = 0;
        
        const tryGetHeight = async () => {
          attempt++;
          
          try {
            // 创建射线
            const ray = props.viewer.camera.getPickRay(new Cesium.Cartesian2(
              props.viewer.canvas.clientWidth / 2,
              props.viewer.canvas.clientHeight / 2
            ));
            
            // 计算目标点
            const targetPoint = Cesium.Cartesian3.add(
              ray.origin,
              Cesium.Cartesian3.multiplyByScalar(ray.direction, 10000, new Cesium.Cartesian3()),
              new Cesium.Cartesian3()
            );
            
            // 射线检测
            const result = await Cesium.Scene.pickPosition(props.viewer.scene, ray);
            
            if (result) {
              const cartographic = Cesium.Cartographic.fromCartesian(result);
              const height = cartographic.height;
              
              if (isFinite(height)) {
                resolve(height);
                return;
              }
            }
          } catch (error) {
            console.warn('射线检测获取高程时发生错误:', error);
          }
          
          // 检查是否达到最大尝试次数
          if (attempt < maxAttempts) {
            setTimeout(tryGetHeight, 1000); // 1秒后重试
          } else {
            // 超过最大尝试次数，使用估计高度
            const estimatedHeight = estimateHeight(longitude, latitude);
            resolve(estimatedHeight);
          }
        };
        
        tryGetHeight();
      });
    };
    
    // 估计高程 - 新增函数，在无法获取精确高程时使用
    const estimateHeight = (longitude, latitude) => {
      // 简单的估计方法：返回当前设置的平均高程
      return (minHeight.value + maxHeight.value) / 2;
    };

    // 创建高程信息标签
    const createElevationInfoLabel = (positions, minTerrainHeight, maxTerrainHeight, avgHeight) => {
      try {
        // 计算多边形中心
        const centerCartesian = getCenterPosition(positions);
        if (!centerCartesian) return;
        
        // 添加高程信息标签
        props.viewer.entities.add({
          parent: analysisEntity,
          id: 'elevation_info_label',
          position: centerCartesian,
          billboard: {
            image: createInfoIcon(),
            width: 32,
            height: 32,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM
          },
          label: {
            text: `高程统计\n最低: ${minTerrainHeight.toFixed(1)}m\n最高: ${maxTerrainHeight.toFixed(1)}m\n平均: ${avgHeight.toFixed(1)}m`,
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
      } catch (error) {
        console.error('创建高程信息标签失败:', error);
      }
    };
    
    // 添加采样点可视化
    const addSamplePointsVisualization = (samples) => {
      try {
        if (samples.length === 0) return;
        
        // 计算高程范围
        const minH = elevationStats.value.minHeight;
        const maxH = elevationStats.value.maxHeight;
        const heightRange = maxH - minH;
        
        // 为防止过多实体，仅显示一部分样本点
        const displayCount = Math.min(samples.length, 500);
        const step = Math.max(1, Math.floor(samples.length / displayCount));
        
        const colors = selectedColorRamp.value.colors;
        
        for (let i = 0; i < samples.length; i += step) {
          const sample = samples[i];
          const normalizedHeight = (sample.height - minH) / heightRange;
          
          // 根据高程插值计算颜色
          const colorIndex = Math.min(
            colors.length - 1,
            Math.floor(normalizedHeight * colors.length)
          );
          
          const color = colors[colorIndex];
          
          // 添加点实体
          props.viewer.entities.add({
            parent: analysisEntity,
            id: `elevation_point_${i}`,
            position: sample.position,
            point: {
              pixelSize: 5,
              color: color,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
          });
        }
      } catch (error) {
        console.error('添加采样点可视化失败:', error);
      }
    };
    
    // 创建信息图标
    const createInfoIcon = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 24;
      canvas.height = 24;
      const context = canvas.getContext('2d');
      
      // 绘制圆形背景
      context.fillStyle = '#4285F4';
      context.beginPath();
      context.arc(16, 16, 10, 0, 2 * Math.PI);
      context.fill();
      
      // 绘制字母 "i"
      context.fillStyle = 'white';
      context.beginPath();
      context.moveTo(9, 8);
      context.lineTo(9, 16);
      context.lineTo(17, 12);
      context.closePath();
      context.fill();
      
      return canvas.toDataURL();
    };

    // 生成图例
    const generateLegend = () => {
      legendLevels.value = [];
      
      const interval = (maxHeight.value - minHeight.value) / levels.value;
      const colors = selectedColorRamp.value.colors;
      
      for (let i = 0; i < levels.value; i++) {
        const minLevel = minHeight.value + i * interval;
        const maxLevel = minHeight.value + (i + 1) * interval;
        
        // 计算层级颜色
        const colorIdx = Math.min(Math.floor(i * (colors.length / levels.value)), colors.length - 1);
        const nextColorIdx = Math.min(colorIdx + 1, colors.length - 1);
        const colorMix = (i * (colors.length / levels.value)) - colorIdx;
        
        let layerColor;
        if (colorMix > 0 && colorIdx < colors.length - 1) {
          layerColor = Cesium.Color.lerp(
            colors[colorIdx],
            colors[nextColorIdx],
            colorMix,
            new Cesium.Color()
          );
        } else {
          layerColor = colors[colorIdx];
        }
        
        legendLevels.value.push({
          range: `${minLevel.toFixed(0)} - ${maxLevel.toFixed(0)}`,
          color: layerColor.toCssColorString(),
          minLevel, // 保存原始数值，方便交互
          maxLevel  // 保存原始数值，方便交互
        });
      }
      
      // 反转图例使其从高到低显示
      legendLevels.value.reverse();
    };

    // 获取等高线位置
    const getContourPositions = (positions, height) => {
      const contourPositions = [];
      positions.forEach((position) => {
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        contourPositions.push(
          Cesium.Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            height
          )
        );
      });
      // 闭合轮廓
      if (positions.length > 0) {
        const firstCartographic = Cesium.Cartographic.fromCartesian(positions[0]);
        contourPositions.push(
          Cesium.Cartesian3.fromRadians(
            firstCartographic.longitude,
            firstCartographic.latitude,
            height
          )
        );
      }
      return contourPositions;
    };    
    
    // 获取中心点位置 - 安全实现
    const getCenterPosition = (positions) => {
      if (!positions || positions.length === 0) return null;
      
      try {
        // 使用经纬度计算中心点，而不是笛卡尔坐标
        let sumLon = 0, sumLat = 0, sumHeight = 0;
        const cartographics = [];
        
        // 将所有点转换为经纬度
        for (const position of positions) {
          if (!position || isNaN(position.x) || !isFinite(position.x)) {
            continue; // 跳过无效点
          }
          
          try {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            cartographics.push(cartographic);
            
            sumLon += cartographic.longitude;
            sumLat += cartographic.latitude;
            sumHeight += cartographic.height;
          } catch (e) {
            console.warn('处理多边形顶点时出错:', e);
          }
        }
        
        // 确保有有效的点
        if (cartographics.length === 0) return null;
        
        // 计算平均经纬度作为中心
        const avgLon = sumLon / cartographics.length;
        const avgLat = sumLat / cartographics.length;
        
        // 使用统计的平均高程或计算的平均高程
        let centerHeight;
        if (elevationStats.value && typeof elevationStats.value.avgHeight === 'number') {
          centerHeight = elevationStats.value.avgHeight + 10; // 略高于平均高程，使标签可见
        } else {
          centerHeight = (sumHeight / cartographics.length) + 10;
        }
        
        // 创建中心点
        return Cesium.Cartesian3.fromRadians(avgLon, avgLat, centerHeight);
      } catch (error) {
        console.error('计算多边形中心点失败:', error);
        return null;
      }
    };

    // 创建热力图材质
    const createHeatmapMaterial = () => {
      try {
        return new Cesium.Material({
          fabric: {
            type: 'Image',
            uniforms: {
              image: getColorRampTexture(),
              repeat: new Cesium.Cartesian2(1.0, 1.0),
              alpha: opacity.value
            },
            source: `
              czm_material czm_getMaterial(czm_materialInput materialInput)
              {
                  czm_material material = czm_getDefaultMaterial(materialInput);
                  vec2 st = materialInput.st;
                  
                  // 计算热力图纹理坐标
                  st *= repeat;
                  
                  // 采样纹理获取颜色
                  vec4 rampColor = texture(image, st);
                  
                  // 应用颜色和透明度
                  material.diffuse = rampColor.rgb;
                  material.alpha = rampColor.a * alpha;
                  
                  return material;
              }
            `
          }
        });
      } catch (error) {
        console.error('创建热力图材质失败:', error);
        return createFallbackMaterial(); // 使用备用材质
      }
    };

    // 初始化 - 修改版本，确保首次加载时获取合适的高程范围
    onMounted(() => {
      if (props.viewer) {
        // 保存原始地形提供者
        originalTerrainProvider = props.viewer.terrainProvider;
        
        // 使用Cesium全球地形
        changeTerrainProvider().then(() => {
          // 在地形准备好后调整初始高程范围
          setTimeout(() => {
            updateHeightRange();
          }, 1000);
        });
        
        // 添加Cesium渲染错误监听
        cleanupErrorHandler = addCesiumErrorHandler(props.viewer, handleCesiumError);
      }
    });

    // 监听可视化类型变化
    watch(visualizationType, () => {
      if (isActive.value) {
        // 如果已经有分析结果，立即更新
        performAnalysis();
      }
    });

    // 监听色带变化
    watch(selectedColorRamp, () => {
      if (isActive.value) {
        performAnalysis();
      }
    });
    
    // 监听等高线间隔变化
    watch(contourInterval, () => {
      if (isActive.value && visualizationType.value === 'contour') {
        performAnalysis();
      }
    });

    // 切换地形提供者的函数
    const changeTerrainProvider = async () => {
      if (!props.viewer) {
        console.error('Viewer未初始化，无法切换地形');
        return;
      }
      
      try {
        statusMsg.value = `正在切换到${terrainSource.value === 'worldTerrain' ? 'Cesium全球地形' : '平坦地形'}...`;
        
        switch (terrainSource.value) {
          case 'worldTerrain':
            // 使用Cesium全球地形 - 使用统一的授权令牌
            try {
              // 使用CesiumView.vue中相同的访问令牌
              const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4Njg5NmJkZS03ZjgwLTRhNWYtYWU5OC01NDRmZTYxNmQ3YmIiLCJpZCI6MjkzOTI4LCJpYXQiOjE3NDQ2MjcyMDB9.pQM7IkMb643M1hF5XHklTSAYMhjmHQDHlei0X8hsokk';
              
              // 确保设置了访问令牌
              Cesium.Ion.defaultAccessToken = accessToken;
              
              // 使用Cesium全球地形
              props.viewer.scene.setTerrain(
                new Cesium.Terrain(
                  await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
                    requestVertexNormals: true
                  })
                )
              );
              
              console.log('已成功切换到Cesium全球地形');
            } catch (terrainError) {
              console.error('加载Cesium全球地形失败:', terrainError);
              
              // 方案2: 使用开放地形数据源作为备选
              try {
                console.log('尝试使用备选地形数据源...');
                props.viewer.scene.setTerrain(
                  new Cesium.Terrain(
                    new Cesium.CesiumTerrainProvider({
                      url: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium",
                      requestVertexNormals: true
                    })
                  )
                );
                console.log('已切换到备选地形数据源');
              } catch (backupError) {
                console.error('备选地形数据源也失败，将使用平坦地形:', backupError);
                // 回退到平坦地形
                props.viewer.scene.setTerrain(
                  new Cesium.Terrain(
                    new Cesium.EllipsoidTerrainProvider()
                  )
                );
                statusMsg.value = '切换到全球地形失败，已使用平坦地形代替';
                setTimeout(() => {
                  if (statusMsg.value === '切换到全球地形失败，已使用平坦地形代替') {
                    statusMsg.value = '';
                  }
                }, 3000);
              }
            }
            break;
            
          case 'ellipsoid':
          default:
            // 使用平坦地形
            props.viewer.scene.setTerrain(
              new Cesium.Terrain(
                new Cesium.EllipsoidTerrainProvider()
              )
            );
            break;
        }
        
        // 如果已有分析结果，更新分析
        if (isActive.value) {
          performAnalysis();
        }
        
        statusMsg.value = `已切换到${terrainSource.value === 'worldTerrain' ? 'Cesium全球地形' : '平坦地形'}`;
        setTimeout(() => {
          if (statusMsg.value === `已切换到${terrainSource.value === 'worldTerrain' ? 'Cesium全球地形' : '平坦地形'}`) {
            statusMsg.value = '';
          }
        }, 3000);
      } catch (error) {
        console.error('切换地形提供者失败:', error);
        statusMsg.value = `切换地形失败: ${error.message}`;
        
        // 确保在错误情况下也能使用平坦地形
        try {
          props.viewer.scene.setTerrain(
            new Cesium.Terrain(
              new Cesium.EllipsoidTerrainProvider()
            )
          );
          console.log('已回退到平坦地形');
        } catch (fallbackError) {
          console.error('回退到平坦地形失败:', fallbackError);
        }
      }
    };
    
    // 相机事件监听器变量
    let cameraChangeEndEvent = null;
    // 清理错误处理器变量
    let cleanupErrorHandler = null;
    
    // 处理Cesium错误的函数
    const handleCesiumError = (error) => {
      console.error('Cesium渲染错误:', error);
    };
  
    // 相机位置变化处理函数，更新高程范围
    const updateHeightRange = () => {
      if (!props.viewer) return;
      
      try {
        // 获取当前相机高度
        const cameraHeight = props.viewer.camera.positionCartographic.height;
        
        // 获取当前视图范围内的一些高程采样点
        const width = props.viewer.canvas.width;
        const height = props.viewer.canvas.height;
        const samples = [];
        
        // 创建简单网格采样当前视图 (3x3)
        for (let x = 0; x < 3; x++) {
          for (let y = 0; y < 3; y++) {
            const pointX = width * (x / 2);
            const pointY = height * (y / 2);
            
            try {
              const ray = props.viewer.camera.getPickRay(new Cesium.Cartesian2(pointX, pointY));
              if (ray) {
                const position = props.viewer.scene.globe.pick(ray, props.viewer.scene);
                if (position) {
                  const cartographic = Cesium.Cartographic.fromCartesian(position);
                  if (cartographic && isFinite(cartographic.height)) {
                    samples.push(cartographic.height);
                  }
                }
              }
            } catch (e) {
              // 忽略单点错误
         
            }
          }
        }
        
        // 如果有采样点，使用它们来设置高程范围
        if (samples.length > 0) {
          // 计算样本高程统计
          let minSampleHeight = Math.min(...samples);
          let maxSampleHeight = Math.max(...samples);
          let avgSampleHeight = samples.reduce((a, b) => a + b, 0) / samples.length;
          
          // 根据样本和相机高度，智能调整高程范围
          if (cameraHeight > 10000000) {
            // 全球视图
            minHeight.value = Math.min(-500, Math.floor(minSampleHeight - 1000));
            maxHeight.value = Math.max(9000, Math.ceil(maxSampleHeight + 1000));
          } else if (cameraHeight > 1000000) {
            // 洲级视图
            minHeight.value = Math.min(-100, Math.floor(minSampleHeight - 500));
            maxHeight.value = Math.max(6000, Math.ceil(maxSampleHeight + 500));
          } else if (cameraHeight > 100000) {
            // 国家/省级视图
            minHeight.value = Math.floor(minSampleHeight - 200);
            maxHeight.value = Math.ceil(maxSampleHeight + 200);
          } else if (cameraHeight > 10000) {
            // 城市视图
            minHeight.value = Math.floor(minSampleHeight - 100);
            maxHeight.value = Math.ceil(maxSampleHeight + 100);
          } else {
            // 局部区域视图
            minHeight.value = Math.floor(minSampleHeight - 50);
            maxHeight.value = Math.ceil(maxSampleHeight + 50);
          }
          
          // 确保最小值小于最大值
          if (minHeight.value >= maxHeight.value) {
            minHeight.value = Math.floor(avgSampleHeight - 100);
            maxHeight.value = Math.ceil(avgSampleHeight + 100);
          }
        } else {
          // 如果没有样本点，使用默认值
          if (cameraHeight > 10000000) {
            // 全球视图
            minHeight.value = -500;
            maxHeight.value = 9000;
          } else if (cameraHeight > 1000000) {
            // 洲级视图
            minHeight.value = -100;
            maxHeight.value = 6000;
          } else if (cameraHeight > 100000) {
            // 国家/省级视图
            minHeight.value = 0;
            maxHeight.value = 5000;
          } else if (cameraHeight > 10000) {
            // 城市视图
            minHeight.value = 0;
            maxHeight.value = 2000;
          } else {
            // 局部区域视图
            minHeight.value = 0;
            maxHeight.value = 1000;
          }
        }
        
        // 如果有活跃的分析，更新
        if (isActive.value) {
          // 使用延时避免过于频繁的更新
          setTimeout(() => {
            performAnalysis();
          }, 500);
        }
      } catch (error) {
        console.error('调整高程范围时出错:', error);
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
    
      statusMsg.value = '已取消绘制';
      setTimeout(() => {
        if (statusMsg.value === '已取消绘制') {
          statusMsg.value = '';
        }
      }, 2000);
    };
  
    // 图例项点击处理函数
    const onLegendItemClick = (minLevel, maxLevel) => {
      if (!props.viewer) return;
    
      try {
        // 计算中间高程
        const centerHeight = (minLevel + maxLevel) / 2;
        
        // 获取当前视图中心位置
        const center = props.viewer.camera.positionCartographic;
        const longitude = Cesium.Math.toDegrees(center.longitude);
        const latitude = Cesium.Math.toDegrees(center.latitude);
        
        // 飞行到相应高程范围
        props.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            longitude,
            latitude,
            centerHeight + 500 // 在高程上方500米处观察
          ),
          orientation: {
            heading: props.viewer.camera.heading,
            pitch: Cesium.Math.toRadians(-45), // 俯视角度
            roll: 0
          },
          duration: 1.5
        });
        
        statusMsg.value = `飞行至高程范围: ${minLevel.toFixed(0)} - ${maxLevel.toFixed(0)}米`;
        setTimeout(() => {
          if (statusMsg.value === `飞行至高程范围: ${minLevel.toFixed(0)} - ${maxLevel.toFixed(0)}米`) {
            statusMsg.value = '';
          }
        }, 3000);
      } catch (error) {
        console.error('飞行到高程范围时出错:', error);
      }
    };
  
    // 跳转到特定高程
    const jumpToElevation = (elevation) => {
      if (!props.viewer || !elevationSamples || elevationSamples.length === 0) {
        statusMsg.value = '没有可用的高程样本数据';
        return;
      }
    
      try {
        // 查找最接近目标高程的样本点
        let closestSample = null;
        let minDiff = Infinity;
        
        elevationSamples.forEach(sample => {
          const diff = Math.abs(sample.height - elevation);
          if (diff < minDiff) {
            minDiff = diff;
            closestSample = sample;
          }
        });
        
        if (!closestSample) {
          statusMsg.value = '找不到匹配的高程点';
          return;
        }
        
        // 飞行到该位置
        props.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            closestSample.longitude,
            closestSample.latitude,
            closestSample.height + 200 // 在点上方200米处观察
          ),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-45), // 俯视角度
            roll: 0
          },
          duration: 1.5
        });
        
        // 添加临时标记
        const markerEntity = props.viewer.entities.add({
          position: closestSample.position,
          point: {
            pixelSize: 10,
            color: Cesium.Color.RED,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2
          },
          label: {
            text: `高程: ${closestSample.height.toFixed(1)}米`,
            font: '14px sans-serif',
            fillColor: Cesium.Color.WHITE,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -10)
          }
        });
        
        // 5秒后移除标记
        setTimeout(() => {
          if (props.viewer && props.viewer.entities.contains(markerEntity)) {
            props.viewer.entities.remove(markerEntity);
          }
        }, 5000);
        
        statusMsg.value = `已跳转至高程 ${closestSample.height.toFixed(1)} 米处`;
        setTimeout(() => {
          if (statusMsg.value === `已跳转至高程 ${closestSample.height.toFixed(1)} 米处`) {
            statusMsg.value = '';
          }
        }, 3000);
      } catch (error) {
        console.error('跳转到高程点时出错:', error);
        statusMsg.value = '跳转失败';
      }
    };
  
    // 导出高程数据
    const exportElevationData = () => {
      if (!elevationSamples || elevationSamples.length === 0) {
        statusMsg.value = '没有可用的高程数据';
        return;
      }
    
      try {
        // 创建CSV内容
        let csvContent = "经度,纬度,高程(米)\n";
        
        elevationSamples.forEach(sample => {
          csvContent += `${sample.longitude.toFixed(6)},${sample.latitude.toFixed(6)},${sample.height.toFixed(2)}\n`;
        });
        
        // 创建Blob对象
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // 创建下载链接
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `elevation_data_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        
        // 添加到文档并触发点击
        document.body.appendChild(link);
        link.click();
        
        // 清理
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        statusMsg.value = `已导出 ${elevationSamples.length} 条高程数据`;
        setTimeout(() => {
          if (statusMsg.value === `已导出 ${elevationSamples.length} 条高程数据`) {
            statusMsg.value = '';
          }
        }, 3000);
      } catch (error) {
        console.error('导出高程数据时出错:', error);
        statusMsg.value = '导出失败';
      }
    };

    // 组件卸载时清理
    onBeforeUnmount(() => {
      // 移除相机事件监听
      if (cameraChangeEndEvent) {
        cameraChangeEndEvent();
        cameraChangeEndEvent = null;
      }
      
      // 清除分析结果
      clearAnalysis();
      
      // 清理事件处理器
      if (drawHandler) {
        drawHandler.destroy();
        drawHandler = null;
      }
      
      // 移除错误处理器
      if (typeof cleanupErrorHandler === 'function') {
        cleanupErrorHandler();
      }
    });

    // 返回需要在模板中使用的变量和函数
    return {
      isDrawingPolygon,
      polygonPositions,
      isAnalyzing,
      isActive,
      statusMsg,
      minHeight,
      maxHeight,
      levels,
      opacity,
      samplingDensity,
      visualizationType,
      contourInterval,
      terrainSource,
      colorRamps,
      selectedColorRamp,
      legendLevels,
      colorRampStyle,
      elevationStats,
      changeTerrainProvider,
      startDrawPolygon,
      cancelDrawPolygon,
      clearPolygon,
      performAnalysis,
      clearAnalysis,
      onLegendItemClick,
      jumpToElevation,
      exportElevationData
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
  margin-bottom: 6px;
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

.range-inputs {
  display: flex;
  gap: 10px;
}

.range-input {
  flex: 1;
  display: flex;
  align-items: center;
}

.range-input label {
  min-width: 40px;
  font-size: 13px;
  font-weight: normal;
}

.range-input input {
  flex: 1;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.range-slider {
  width: 100%;
  margin: 5px 0;
}

.select-control {
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
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
  cursor: pointer;
  transition: transform 0.2s;
  border-radius: 3px;
  padding: 2px 4px;
}

.legend-item:hover {
  transform: translateX(5px);
  background-color: rgba(0,0,0,0.05);
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

.legend-hint {
  font-size: 11px;
  color: #666;
  font-style: italic;
  text-align: center;
  margin-top: 8px;
}

.additional-buttons {
  display: flex;
  gap: 8px;
  margin: 10px 0;
}

.btn-extra {
  padding: 6px 8px;
  font-size: 12px;
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1;
  transition: background 0.2s;
}

.btn-extra:hover {
  background-color: #e0e0e0;
}

.status-message {
  margin-top: 10px;
  padding: 8px;
  font-size: 13px;
  color: #666;
  text-align: center;
  font-style: italic;
}

.small-hint {
  font-size: 11px;
  color: #666;
  font-style: italic;
  margin-top: 4px;
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
</style>
