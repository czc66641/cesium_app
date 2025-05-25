<template>
  <div class="analysis-section">
    <div class="section-title">视域分析</div>
    
    <!-- 分析类型选择 -->
    <div class="input-group">
      <label>分析类型:</label>
      <div class="button-group">
        <button 
          :class="{ active: analysisType === 'viewshed' }" 
          @click="setAnalysisType('viewshed')">
          可视区域分析
        </button>
        <button 
          :class="{ active: analysisType === 'sightline' }" 
          @click="setAnalysisType('sightline')">
          视线分析
        </button>
      </div>
    </div>

    <!-- 操作指引 -->
    <div class="analysis-instructions">
      <div v-if="!isAnalyzing">
        <button @click="startAnalysis" class="btn-primary full-width-btn">
          {{ analysisType === 'viewshed' ? '开始可视域分析' : '开始视线分析' }}
        </button>
        <p class="instruction-text">点击上方按钮开始，然后在地图上选择观察点</p>
      </div>
      <div v-else class="active-analysis">
        <div class="status-badge">{{ analysisStatusText }}</div>
        <button @click="cancelAnalysis" class="btn-secondary full-width-btn">
          取消分析
        </button>
      </div>
    </div>
    
    <!-- 3D 视域分析开关 -->
    <div v-if="analysisType === 'viewshed'" class="input-group">
      <label class="checkbox-label">
        <input type="checkbox" v-model="use3DViewshed"> 使用3D可视域分析
      </label>
      <div class="param-hint" v-if="use3DViewshed">
        <span>3D可视域分析能够对建筑、地形等进行真实遮挡分析，但可能占用更多资源</span>
      </div>
    </div>
    
    <!-- 结果显示 (仅视线分析) -->
    <div v-if="analysisType === 'sightline' && sightlineResult !== null" class="result-display">
      <div :class="['result-box', sightlineResult.visible ? 'visible' : 'invisible']">
        <span v-if="sightlineResult.visible">目标点可见</span>
        <span v-else>目标点不可见</span>
      </div>
      <div v-if="!sightlineResult.visible && sightlineResult.obstacleInfo" class="obstacle-info">
        <span>障碍点: {{ formatCoordinate(sightlineResult.obstacleInfo.position) }}</span>
        <span>距离: {{ formatDistance(sightlineResult.obstacleInfo.distance) }}</span>
      </div>
    </div>

    <!-- 显示设置 -->
    <div class="input-group">
      <label>显示设置:</label>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" v-model="showViewerPoint"> 显示观察点
        </label>
        <label class="checkbox-label" v-if="analysisType === 'sightline'">
          <input type="checkbox" v-model="showTargetPoint"> 显示目标点
        </label>
        <label class="checkbox-label" v-if="analysisType === 'sightline'">
          <input type="checkbox" v-model="showSightline"> 显示视线
        </label>
        <label class="checkbox-label" v-if="analysisType === 'sightline'">
          <input type="checkbox" v-model="showObstaclePoint"> 显示障碍点
        </label>
      </div>
    </div>

    <!-- 颜色设置 -->
    <div v-if="analysisType === 'viewshed'" class="input-group">
      <label>颜色设置:</label>
      <div class="color-grid">
        <div class="color-item">
          <label>可见区域</label>
          <input type="color" v-model="viewshedColors.visible">
        </div>
        <div class="color-item">
          <label>不可见区域</label>
          <input type="color" v-model="viewshedColors.invisible">
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="control-buttons">
      <button @click="clearAnalysis" class="btn-secondary">清除分析</button>
    </div>

    <div class="status-message" v-if="statusMessage">{{ statusMessage }}</div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import * as Cesium from 'cesium';
import ViewshedAnalysis3D from './ViewshedAnalysis3D.js';

export default defineComponent({
  name: 'VisibilityAnalysis',
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
  setup(props) {
    // 分析类型：viewshed (可视区域分析) 或 sightline (视线分析)
    const analysisType = ref('viewshed');

    // 是否使用3D可视域分析
    const use3DViewshed = ref(false);
    
    // 分析状态控制
    const isAnalyzing = ref(false);
    const analysisStep = ref(0); // 0: 未开始, 1: 等待选择观察点, 2: 等待选择目标点/方向
    
    // 分析状态文本
    const analysisStatusText = computed(() => {
      if (analysisStep.value === 1) {
        return "请点击地图选择观察点";
      } else if (analysisStep.value === 2) {
        if (analysisType.value === 'viewshed') {
          return "移动鼠标设置视域方向和范围，点击确认";
        } else {
          return "移动鼠标选择目标点，点击确认";
        }
      }
      return "";
    });
    
    // 3D视域分析实例
    let viewshed3D = null;

    // 观察点和目标点
    const viewerPoint = ref({ lng: '', lat: '', height: '1.8' });
    const targetPoint = ref({ lng: '', lat: '', height: '0' });

    // 可视域分析参数 - 现在由鼠标位置动态计算
    const viewshedParams = ref({
      horizontalAngle: 120,
      verticalAngle: 90,
      radius: 2000,
      direction: 0
    });

    // 视线分析结果
    const sightlineResult = ref(null);

    // 显示设置
    const showViewerPoint = ref(true);
    const showTargetPoint = ref(true);
    const showSightline = ref(true);
    const showObstaclePoint = ref(true);

    // 色彩设置
    const viewshedColors = ref({
      visible: '#4CAF50',    // 绿色
      invisible: '#F44336'   // 红色
    });

    // 临时预览实体
    let previewEntity = null;

    // 状态消息
    const statusMessage = ref('');

    // 实体引用
    let viewerPointEntity = null;
    let targetPointEntity = null;
    let sightlineEntity = null;
    let viewshedEntity = null;
    let obstaclePointEntity = null;
    
    // 事件处理器
    let analysisHandler = null;
    
    // 上一次相机状态 - 用于恢复视角
    let previousCameraPosition = null;
    let previousCameraHeading = null;
    let previousCameraPitch = null;
    let previousCameraRoll = null;

    // 设置分析类型
    const setAnalysisType = (type) => {
      if (analysisType.value !== type) {
        analysisType.value = type;
        clearAnalysis();
      }
    };

    // 保存当前相机状态
    const saveCameraState = () => {
      if (!props.viewer) return;
      
      const camera = props.viewer.camera;
      previousCameraPosition = camera.position.clone();
      previousCameraHeading = camera.heading;
      previousCameraPitch = camera.pitch;
      previousCameraRoll = camera.roll;
    };

    // 恢复相机状态
    const restoreCameraState = () => {
      if (!props.viewer || !previousCameraPosition) return;
      
      props.viewer.camera.setView({
        destination: previousCameraPosition,
        orientation: {
          heading: previousCameraHeading,
          pitch: previousCameraPitch,
          roll: previousCameraRoll
        }
      });
    };
    
    // 开始分析流程
    const startAnalysis = () => {
      if (isAnalyzing.value) return;
      
      clearAnalysis();
      isAnalyzing.value = true;
      analysisStep.value = 1;
      statusMessage.value = "请点击地图选择观察点";
      
      initAnalysisHandler();
    };
    
    // 取消分析
    const cancelAnalysis = () => {
      isAnalyzing.value = false;
      analysisStep.value = 0;
      removePreviewEntities();
      destroyAnalysisHandler();
      statusMessage.value = "分析已取消";
    };
    
    // 改进版：透过地表检查视线
    const checkLineOfSightAlongTerrain = (viewerLng, viewerLat, viewerHeight, targetLng, targetLat, targetHeight) => {
      // 起点和终点的笛卡尔坐标
      const viewerCartesian = Cesium.Cartesian3.fromDegrees(viewerLng, viewerLat, viewerHeight);
      const targetCartesian = Cesium.Cartesian3.fromDegrees(targetLng, targetLat, targetHeight);
      
      // 计算总距离
      const totalDistance = Cesium.Cartesian3.distance(viewerCartesian, targetCartesian);
      
      // 初始化结果
      sightlineResult.value = {
        visible: true,
        obstacleInfo: null,
      };
      
      try {
        // 计算从观察点到目标点的方向向量
        const direction = Cesium.Cartesian3.subtract(targetCartesian, viewerCartesian, new Cesium.Cartesian3());
        Cesium.Cartesian3.normalize(direction, direction);
        
        // 设置射线
        const ray = new Cesium.Ray(viewerCartesian, direction);
        
        // 创建一个新的检测函数，先尝试使用ray-casting
        const scene = props.viewer.scene;
        let position;
        
        // 先尝试针对地形的拾取，这会考虑地形的曲面
        position = scene.globe.pick(ray, scene);
        
        // 如果找到交点，检查是否在观察点和目标点之间
        if (position) {
          const intersectionDistance = Cesium.Cartesian3.distance(viewerCartesian, position);
          
          // 如果交点在观察点和目标点之间，则表示视线被阻挡
          if (intersectionDistance < totalDistance * 0.99) { // 添加一点容差
            // 获取交点的经纬度高度
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            
            sightlineResult.value.visible = false;
            sightlineResult.value.obstacleInfo = {
              position: {
                lng: Cesium.Math.toDegrees(cartographic.longitude),
                lat: Cesium.Math.toDegrees(cartographic.latitude),
                height: cartographic.height
              },
              distance: intersectionDistance
            };
            
            // 添加调试消息
            console.log('视线被阻挡，障碍点信息:', sightlineResult.value.obstacleInfo);
            statusMessage.value = '找到障碍点';
          } else {
            sightlineResult.value.visible = true;
            sightlineResult.value.obstacleInfo = null;
            console.log('视线畅通 - 交点在目标之后');
            statusMessage.value = '视线畅通';
          }
        } else {
          // 如果没有拾取到点，则视线畅通
          sightlineResult.value.visible = true;
          sightlineResult.value.obstacleInfo = null;
          console.log('视线畅通 - 无交点');
          statusMessage.value = '视线畅通';
        }
      } catch (error) {
        console.error('视线分析过程中发生错误:', error);
        statusMessage.value = '视线分析出错';
        
        // 默认为可见
        sightlineResult.value.visible = true;
        sightlineResult.value.obstacleInfo = null;
      }
      
      return sightlineResult.value;
    };

    // 执行视线分析
    const performSightlineAnalysis = () => {
      if (!props.viewer) {
        statusMessage.value = 'Viewer未初始化';
        return;
      }
      
      const viewerLng = parseFloat(viewerPoint.value.lng);
      const viewerLat = parseFloat(viewerPoint.value.lat);
      const viewerHeight = parseFloat(viewerPoint.value.height);
      
      const targetLng = parseFloat(targetPoint.value.lng);
      const targetLat = parseFloat(targetPoint.value.lat);
      const targetHeight = parseFloat(targetPoint.value.height);
      
      if (isNaN(viewerLng) || isNaN(viewerLat) || isNaN(viewerHeight) ||
          isNaN(targetLng) || isNaN(targetLat) || isNaN(targetHeight)) {
        statusMessage.value = '观察点或目标点坐标无效，请检查输入';
        console.error('坐标无效:', { viewerPoint: viewerPoint.value, targetPoint: targetPoint.value });
        return;
      }
      
      statusMessage.value = '正在执行视线分析...';
      console.log('开始视线分析 - 观察点:', viewerPoint.value, '目标点:', targetPoint.value);
      
      // 移除预览实体
      removePreviewEntities();
      
      // 添加观察点和目标点标记
      addViewerPointMarker();
      addTargetPointMarker();
      
      // 计算视线可见性 - 沿地形分析
      const result = checkLineOfSightAlongTerrain(
        viewerLng, viewerLat, viewerHeight,
        targetLng, targetLat, targetHeight
      );
      
      console.log('视线分析结果:', result);
      
      // 添加视线
      addSightline();
      
      // 如果有障碍点，添加障碍点标记
      if (result && !result.visible && result.obstacleInfo) {
        addObstaclePointMarker();
        statusMessage.value = '视线分析完成 - 发现障碍';
      } else {
        statusMessage.value = '视线分析完成 - 视线畅通';
      }
    };

    // 初始化分析事件处理器
    const initAnalysisHandler = () => {
      destroyAnalysisHandler();
      
      analysisHandler = new Cesium.ScreenSpaceEventHandler(props.viewer.scene.canvas);
      
      // 左键点击 - 选择点位
      analysisHandler.setInputAction((click) => {
        console.log('分析步骤:', analysisStep.value);
        
        // 保存当前相机状态
        saveCameraState();
        
        try {
          // 使用射线拾取，确保包含地形
          const ray = props.viewer.camera.getPickRay(click.position);
          const position = props.viewer.scene.globe.pick(ray, props.viewer.scene);
          
          if (!position) {
            statusMessage.value = "点击位置无效，请重试";
            console.error('点击位置无效 - 未能拾取地形点');
            return;
          }
          
          const cartographic = Cesium.Cartographic.fromCartesian(position);
          const lng = Cesium.Math.toDegrees(cartographic.longitude);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);
          const height = cartographic.height;
          
          console.log('选择点位:', { lng, lat, height });
          
          // 处理第一步 - 选择观察点
          if (analysisStep.value === 1) {
            console.log('设置观察点');
            viewerPoint.value = {
              lng: lng,
              lat: lat,
              // 默认观察点位置高于地面1.8米，模拟人眼高度
              height: height + 1.8
            };
            
            // 添加观察点标记
            addViewerPointMarker();
            
            // 进入第二步
            analysisStep.value = 2;
            
            // 根据分析类型显示不同提示
            if (analysisType.value === 'viewshed') {
              statusMessage.value = "移动鼠标设置视域方向和范围，点击确认";
            } else {
              statusMessage.value = "移动鼠标选择目标点，点击确认";
            }
          }
          // 处理第二步 - 选择目标点/确认方向和范围
          else if (analysisStep.value === 2) {
            // 对于视线分析，设置目标点
            if (analysisType.value === 'sightline') {
              console.log('设置目标点并执行视线分析');
              targetPoint.value = {
                lng: lng,
                lat: lat,
                height: height
              };
              
              // 执行视线分析
              performSightlineAnalysis();
            }
            // 对于可视域分析，确认当前方向和范围
            else {
              console.log('执行可视域分析');
              performViewshedAnalysis();
            }
            
            // 分析完成，重置状态
            isAnalyzing.value = false;
            analysisStep.value = 0;
            destroyAnalysisHandler();
          } else {
            console.error('未知的分析步骤:', analysisStep.value);
          }
        } catch (error) {
          console.error('处理点击事件时出错:', error);
          statusMessage.value = `发生错误: ${error.message}`;
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      
      // 鼠标移动 - 实时预览
      analysisHandler.setInputAction((movement) => {
        if (analysisStep.value !== 2) return;
        
        const ray = props.viewer.camera.getPickRay(movement.endPosition);
        const position = props.viewer.scene.globe.pick(ray, props.viewer.scene);
        
        if (!position) return;
        
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        const lng = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const height = cartographic.height;
        
        if (analysisType.value === 'sightline') {
          // 视线分析 - 预览从观察点到当前鼠标位置的视线
          previewSightline({
            lng: lng,
            lat: lat,
            height: height
          });
        } else {
          // 可视域分析 - 计算方向和距离，预览可视域
          const viewerPos = Cesium.Cartesian3.fromDegrees(
            parseFloat(viewerPoint.value.lng),
            parseFloat(viewerPoint.value.lat),
            parseFloat(viewerPoint.value.height)
          );
          
          const direction = calculateDirection(viewerPos, position);
          const distance = Cesium.Cartesian3.distance(viewerPos, position);
          
          // 更新预览参数
          viewshedParams.value.direction = direction;
          viewshedParams.value.radius = Math.max(100, Math.min(10000, distance));
          
          // 更新预览效果
          previewViewshed();
        }
        
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    };
    
    // 销毁分析事件处理器
    const destroyAnalysisHandler = () => {
      if (analysisHandler) {
        analysisHandler.destroy();
        analysisHandler = null;
      }
    };

    // 移除预览实体
    const removePreviewEntities = () => {
      if (previewEntity && props.viewer.entities.contains(previewEntity)) {
        props.viewer.entities.remove(previewEntity);
        previewEntity = null;
      }
      
      // 额外查找并移除所有预览相关实体
      const previewsToRemove = [];
      props.viewer.entities.values.forEach(entity => {
        if (entity.id && (entity.id.includes('preview_'))) {
          previewsToRemove.push(entity);
        }
      });
      
      previewsToRemove.forEach(entity => {
        try {
          props.viewer.entities.remove(entity);
        } catch (error) {
          console.error('移除预览实体失败:', error);
        }
      });
    };

    // 计算方位角
    const calculateDirection = (fromPoint, toPoint) => {
      // 转换为经纬度计算方位角
      const fromCartographic = Cesium.Cartographic.fromCartesian(fromPoint);
      const toCartographic = Cesium.Cartographic.fromCartesian(toPoint);
      
      const fromLng = Cesium.Math.toDegrees(fromCartographic.longitude);
      const fromLat = Cesium.Math.toDegrees(fromCartographic.latitude);
      const toLng = Cesium.Math.toDegrees(toCartographic.longitude);
      const toLat = Cesium.Math.toDegrees(toCartographic.latitude);
      
      // 计算方位角
      const y = Math.sin(Cesium.Math.toRadians(toLng - fromLng)) * Math.cos(Cesium.Math.toRadians(toLat));
      const x = Math.cos(Cesium.Math.toRadians(fromLat)) * Math.sin(Cesium.Math.toRadians(toLat)) -
                Math.sin(Cesium.Math.toRadians(fromLat)) * Math.cos(Cesium.Math.toRadians(toLat)) * 
                Math.cos(Cesium.Math.toRadians(toLng - fromLng));
      let bearing = Cesium.Math.toDegrees(Math.atan2(y, x));
      
      // 转换为0-360度
      return (bearing + 360) % 360;
    };
    
    // 预览视线分析
    const previewSightline = (targetPos) => {
      // 移除旧的预览
      removePreviewEntities();
      
      if (!viewerPoint.value.lng) return;
      
      const viewerLng = parseFloat(viewerPoint.value.lng);
      const viewerLat = parseFloat(viewerPoint.value.lat);
      const viewerHeight = parseFloat(viewerPoint.value.height);
      
      const targetLng = parseFloat(targetPos.lng);
      const targetLat = parseFloat(targetPos.lat);
      const targetHeight = parseFloat(targetPos.height);
      
      if (isNaN(viewerLng) || isNaN(viewerLat) || isNaN(viewerHeight) ||
          isNaN(targetLng) || isNaN(targetLat) || isNaN(targetHeight)) {
        return;
      }
      
      // 创建容器实体
      previewEntity = props.viewer.entities.add({
        id: `preview_sightline_container_${Date.now()}`,
        name: 'Preview Sight Line Container',
      });
      
      // 添加视线预览
      props.viewer.entities.add({
        id: `preview_sightline_${Date.now()}`,
        name: 'Preview Sight Line',
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights([
            viewerLng, viewerLat, viewerHeight,
            targetLng, targetLat, targetHeight
          ]),
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.YELLOW.withAlpha(0.7),
            dashLength: 8.0
          })
        },
        parent: previewEntity
      });
      
      // 添加目标点预览
      props.viewer.entities.add({
        id: `preview_target_point_${Date.now()}`,
        name: 'Preview Target Point',
        position: Cesium.Cartesian3.fromDegrees(targetLng, targetLat, targetHeight),
        point: {
          pixelSize: 8,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2
        },
        parent: previewEntity
      });
      
      // 检查地表是否阻挡视线
      checkLineOfSightAlongTerrain(
        viewerLng, viewerLat, viewerHeight,
        targetLng, targetLat, targetHeight
      );
    };

    // 预览可视域分析
    const previewViewshed = () => {
      // 移除旧的预览
      removePreviewEntities();
      
      if (!viewerPoint.value.lng) return;
      
      const viewerLng = parseFloat(viewerPoint.value.lng);
      const viewerLat = parseFloat(viewerPoint.value.lat);
      const viewerHeight = parseFloat(viewerPoint.value.height);
      const direction = viewshedParams.value.direction;
      const horizAngle = viewshedParams.value.horizontalAngle;
      const radius = viewshedParams.value.radius;
      
      if (isNaN(viewerLng) || isNaN(viewerLat) || isNaN(viewerHeight)) {
        return;
      }
      
      // 计算可视域扇形区域
      const positions = calculateViewshedArea(
        viewerLng, viewerLat, viewerHeight, 
        direction, horizAngle, radius
      );
      
      // 创建容器实体
      previewEntity = props.viewer.entities.add({
        id: `preview_viewshed_container_${Date.now()}`,
        name: 'Preview Viewshed Container',
      });
      
      // 添加扇区预览
      props.viewer.entities.add({
        id: `preview_viewshed_area_${Date.now()}`,
        name: 'Preview Viewshed Area',
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: Cesium.Color.YELLOW.withAlpha(0.3),
          outline: true,
          outlineColor: Cesium.Color.YELLOW,
          outlineWidth: 2,
          perPositionHeight: false, // 贴地分析
          classificationType: Cesium.ClassificationType.BOTH
        },
        parent: previewEntity
      });
      
      // 添加方向线
      props.viewer.entities.add({
        id: `preview_direction_line_${Date.now()}`,
        name: 'Preview Direction Line',
        polyline: {
          positions: calculateDirectionLine(
            viewerLng, viewerLat, viewerHeight, direction, radius
          ),
          width: 3,
          material: Cesium.Color.YELLOW
        },
        parent: previewEntity
      });
    };

    // 添加观察点标记
    const addViewerPointMarker = () => {
      if (!props.viewer || !showViewerPoint.value) return;
      
      removeEntity(viewerPointEntity);
      
      const lng = parseFloat(viewerPoint.value.lng);
      const lat = parseFloat(viewerPoint.value.lat);
      const height = parseFloat(viewerPoint.value.height);
      
      if (isNaN(lng) || isNaN(lat) || isNaN(height)) return;
      
      viewerPointEntity = props.viewer.entities.add({
        id: `viewer_point_${Date.now()}`,
        name: 'Observer Point',
        position: Cesium.Cartesian3.fromDegrees(lng, lat, height),
        billboard: {
          image: buildViewerPointImage(),
          width: 24,
          height: 24,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM
        },
        label: {
          text: '观察点',
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -32),
          heightReference: Cesium.HeightReference.NONE
        }
      });
    };

    // 创建观察点图标
    const buildViewerPointImage = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 24;
      canvas.height = 24;
      const context = canvas.getContext('2d');
      
      // 绘制摄像头图标
      context.fillStyle = '#4285F4';
      context.beginPath();
      context.arc(12, 12, 10, 0, 2 * Math.PI);
      context.fill();
      
      context.fillStyle = 'white';
      context.beginPath();
      context.moveTo(9, 8);
      context.lineTo(9, 16);
      context.lineTo(17, 12);
      context.closePath();
      context.fill();
      
      return canvas.toDataURL();
    };

    // 添加目标点标记
    const addTargetPointMarker = () => {
      if (!props.viewer || !showTargetPoint.value || analysisType.value !== 'sightline') return;
      
      removeEntity(targetPointEntity);
      
      const lng = parseFloat(targetPoint.value.lng);
      const lat = parseFloat(targetPoint.value.lat);
      const height = parseFloat(targetPoint.value.height);
      
      if (isNaN(lng) || isNaN(lat) || isNaN(height)) return;
      
      targetPointEntity = props.viewer.entities.add({
        id: `target_point_${Date.now()}`,
        name: 'Target Point',
        position: Cesium.Cartesian3.fromDegrees(lng, lat, height),
        point: {
          pixelSize: 10,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE
        },
        label: {
          text: '目标点',
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          heightReference: Cesium.HeightReference.NONE
        }
      });
    };

    // 添加视线
    const addSightline = () => {
      if (!props.viewer || !showSightline.value || analysisType.value !== 'sightline') return;
      
      removeEntity(sightlineEntity);
      
      const viewerLng = parseFloat(viewerPoint.value.lng);
      const viewerLat = parseFloat(viewerPoint.value.lat);
      const viewerHeight = parseFloat(viewerPoint.value.height);
      
      const targetLng = parseFloat(targetPoint.value.lng);
      const targetLat = parseFloat(targetPoint.value.lat);
      const targetHeight = parseFloat(targetPoint.value.height);
      
      if (isNaN(viewerLng) || isNaN(viewerLat) || isNaN(viewerHeight) || 
          isNaN(targetLng) || isNaN(targetLat) || isNaN(targetHeight)) return;
      
      sightlineEntity = props.viewer.entities.add({
        id: `sightline_container_${Date.now()}`,
        name: 'Sight Line Container',
        position: Cesium.Cartesian3.fromDegrees(viewerLng, viewerLat, viewerHeight),
      });
      
      // 如果有障碍物，分段显示视线
      if (sightlineResult.value && !sightlineResult.value.visible && sightlineResult.value.obstacleInfo) {
        // 可见部分 - 从观察点到障碍点
        props.viewer.entities.add({
          id: `sightline_visible_${Date.now()}`,
          name: 'Visible Sight Line',
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights([
              viewerLng, viewerLat, viewerHeight,
              sightlineResult.value.obstacleInfo.position.lng,
              sightlineResult.value.obstacleInfo.position.lat,
              sightlineResult.value.obstacleInfo.position.height
            ]),
            width: 3,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: Cesium.Color.GREEN.withAlpha(0.8)
            })
          },
          parent: sightlineEntity
        });
        
        // 不可见部分 - 从障碍点到目标点
        props.viewer.entities.add({
          id: `sightline_invisible_${Date.now()}`,
          name: 'Invisible Sight Line',
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights([
              sightlineResult.value.obstacleInfo.position.lng,
              sightlineResult.value.obstacleInfo.position.lat,
              sightlineResult.value.obstacleInfo.position.height,
              targetLng, targetLat, targetHeight
            ]),
            width: 3,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: Cesium.Color.RED.withAlpha(0.8)
            })
          },
          parent: sightlineEntity
        });
      } else {
        // 无障碍或完全不可见情况
        const lineColor = sightlineResult.value && sightlineResult.value.visible ? 
          Cesium.Color.GREEN.withAlpha(0.8) : 
          Cesium.Color.RED.withAlpha(0.8);
        
        props.viewer.entities.add({
          id: `sightline_full_${Date.now()}`,
          name: 'Full Sight Line',
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArrayHeights([
              viewerLng, viewerLat, viewerHeight,
              targetLng, targetLat, targetHeight
            ]),
            width: 3,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: lineColor
            })
          },
          parent: sightlineEntity
        });
      }
    };

    // 添加障碍点标记
    const addObstaclePointMarker = () => {
      if (!props.viewer || !showObstaclePoint.value || analysisType.value !== 'sightline') return;
      if (!sightlineResult.value || !sightlineResult.value.obstacleInfo) return;
      
      removeEntity(obstaclePointEntity);
      
      const { lng, lat, height } = sightlineResult.value.obstacleInfo.position;
      
      obstaclePointEntity = props.viewer.entities.add({
        id: `obstacle_point_${Date.now()}`,
        name: 'Obstacle Point',
        position: Cesium.Cartesian3.fromDegrees(lng, lat, height),
        point: {
          pixelSize: 10,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE
        },
        label: {
          text: '障碍点',
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          heightReference: Cesium.HeightReference.NONE
        }
      });
    };

    // 执行可视区域分析
    const performViewshedAnalysis = () => {
      if (!props.viewer) {
        statusMessage.value = 'Viewer未初始化，无法执行视域分析';
        console.error('Viewer未初始化，无法执行视域分析');
        return;
      }
      
      const viewerLng = parseFloat(viewerPoint.value.lng);
      const viewerLat = parseFloat(viewerPoint.value.lat);
      const viewerHeight = parseFloat(viewerPoint.value.height);
      
      if (isNaN(viewerLng) || isNaN(viewerLat) || isNaN(viewerHeight)) {
        statusMessage.value = '观察点坐标无效，请检查输入';
        console.error('观察点坐标无效:', viewerPoint.value);
        return;
      }
      
      // 移除预览实体
      removePreviewEntities();
      
      // 添加观察点标记
      showViewerPoint.value = true;
      addViewerPointMarker();
      
      console.log('正在执行可视域分析...', {
        观察点: viewerPoint.value,
        方向: viewshedParams.value.direction,
        水平角度: viewshedParams.value.horizontalAngle,
        垂直角度: viewshedParams.value.verticalAngle,
        半径: viewshedParams.value.radius,
        使用3D分析: use3DViewshed.value
      });
      
      statusMessage.value = '正在计算可视域，请稍候...';
      
      // 视域分析参数
      const horizontalAngle = viewshedParams.value.horizontalAngle;
      const verticalAngle = viewshedParams.value.verticalAngle;
      const radius = viewshedParams.value.radius;
      const direction = viewshedParams.value.direction;
      
      // 根据选择的执行不同的可视域分析
      try {
        if (use3DViewshed.value) {
          // 延迟执行以允许界面更新
          setTimeout(() => {
            try {
              // 执行3D可视域分析
              console.log('执行3D可视域分析...');
              perform3DViewshedAnalysis(viewerLng, viewerLat, viewerHeight, direction, horizontalAngle, verticalAngle, radius);
              statusMessage.value = '可视区域分析完成';
              console.log('3D可视域分析完成');
            } catch (error) {
              console.error('3D可视域分析执行失败:', error);
              statusMessage.value = `可视域分析失败: ${error.message}`;
            }
          }, 100);
        } else {
          // 延迟执行以允许界面更新
          setTimeout(() => {
            try {
              // 执行传统可视域分析
              console.log('执行传统可视域分析...');
              createViewshed(viewerLng, viewerLat, viewerHeight, direction, horizontalAngle, verticalAngle, radius);
              statusMessage.value = '可视区域分析完成';
              console.log('传统可视域分析完成');
            } catch (error) {
              console.error('传统可视域分析执行失败:', error);
              statusMessage.value = `可视域分析失败: ${error.message}`;
            }
          }, 100);
        }
      } catch (error) {
        console.error('可视域分析执行失败:', error);
        statusMessage.value = `可视域分析失败: ${error.message}`;
      }
    };
    
    // 执行3D可视域分析
    const perform3DViewshedAnalysis = (lng, lat, height, direction, horizontalAngle, verticalAngle, radius) => {
      // 清除现有的3D视域分析实例
      if (viewshed3D) {
        viewshed3D.clear();
        viewshed3D = null;
      }
      
      statusMessage.value = '执行3D视域分析中，这可能需要几秒钟...';
      
      // 确保地形提供者已加载
      if (!props.viewer.terrainProvider || !props.viewer.terrainProvider.ready) {
        console.warn('地形提供者未准备好，可能无法正确考虑地形');
      }
      
      // 计算视线终点位置
      const radians = Cesium.Math.toRadians(direction);
      const endLng = lng + radius * Math.sin(radians) / 111000;
      const endLat = lat + radius * Math.cos(radians) / (111000 * Math.cos(Cesium.Math.toRadians(lat)));
      
      // 分析密度根据半径动态调整
      const analysisDensity = Math.max(10, Math.min(20, Math.floor(radius / 300)));
      
      // 创建可视域分析
      viewshed3D = new ViewshedAnalysis3D(props.viewer, {
        viewPosition: Cesium.Cartesian3.fromDegrees(lng, lat, height),
        viewPositionEnd: Cesium.Cartesian3.fromDegrees(endLng, endLat, height),
        viewDistance: radius,
        viewHeading: direction,
        viewPitch: -10, // 给定一个下倾的俯仰角，让视域分析更符合实际观察
        horizontalViewAngle: horizontalAngle,
        verticalViewAngle: verticalAngle,
        visibleAreaColor: Cesium.Color.fromCssColorString(viewshedColors.value.visible),
        invisibleAreaColor: Cesium.Color.fromCssColorString(viewshedColors.value.invisible),
        analysisDensity: analysisDensity
      });
      
      // 添加可视域分析效果
      const success = viewshed3D.add();
      
      if (!success) {
        statusMessage.value = '添加3D视域分析失败';
        throw new Error('添加3D视域分析失败');
      }
      
      statusMessage.value = '可视域分析完成';
      
      // 缩放到可视区域范围
      setTimeout(() => {
        if (viewshed3D && viewshed3D.viewshedPrimitive) {
          props.viewer.flyTo(viewshed3D.viewshedPrimitive, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(
              Cesium.Math.toRadians(direction),
              Cesium.Math.toRadians(-45),
              radius * 1.5
            )
          });
        }
      }, 200);
    };
    
    // 创建可视区域
    const createViewshed = (lng, lat, height, direction, horizontalAngle, verticalAngle, radius) => {
      try {
        console.log('开始创建可视区域...', {lng, lat, height, direction, horizontalAngle, verticalAngle, radius});
        
        // 计算可视区域的扇形
        const positions = calculateViewshedArea(lng, lat, height, direction, horizontalAngle, radius);
        
        // 定义可见区域颜色
        const visibleColor = Cesium.Color.fromCssColorString(viewshedColors.value.visible).withAlpha(0.5);
        
        // 创建视域分析容器
        viewshedEntity = props.viewer.entities.add({
          id: `viewshed_container_${Date.now()}`,
          name: 'Viewshed Container',
          position: Cesium.Cartesian3.fromDegrees(lng, lat, height),
        });
        
        // 创建可视区域多边形 - 修改为不使用轮廓
        props.viewer.entities.add({
          id: `viewshed_area_${Date.now()}`,
          name: 'Viewshed Area',
          parent: viewshedEntity,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: visibleColor,
            height: 0, // 明确设置高度为0，避免警告
            heightReference: Cesium.HeightReference.NONE, // 不贴合地形
            classificationType: Cesium.ClassificationType.BOTH
          }
        });
        
        // 单独添加轮廓线作为polyline
        props.viewer.entities.add({
          id: `viewshed_outline_${Date.now()}`,
          name: 'Viewshed Outline',
          parent: viewshedEntity,
          polyline: {
            positions: positions,
            width: 2,
            material: Cesium.Color.WHITE,
            clampToGround: true
          }
        });
        
        // 添加视角方向线
        props.viewer.entities.add({
          id: `viewshed_direction_${Date.now()}`,
          name: 'Viewshed Direction',
          parent: viewshedEntity,
          polyline: {
            positions: calculateDirectionLine(lng, lat, height, direction, radius),
            width: 3,
            material: Cesium.Color.YELLOW
          }
        });
        
        // 添加视锥体边界线
        const leftEdge = direction - horizontalAngle / 2;
        const rightEdge = direction + horizontalAngle / 2;
        
        const leftRadians = Cesium.Math.toRadians(leftEdge);
        const rightRadians = Cesium.Math.toRadians(rightEdge);
        
        const leftX = lng + radius * Math.sin(leftRadians) / 111000;
        const leftY = lat + radius * Math.cos(leftRadians) / (111000 * Math.cos(Cesium.Math.toRadians(lat)));
        
        const rightX = lng + radius * Math.sin(rightRadians) / 111000;
        const rightY = lat + radius * Math.cos(rightRadians) / (111000 * Math.cos(Cesium.Math.toRadians(lat)));
        
        // 添加左边界线
        props.viewer.entities.add({
          id: `viewshed_left_edge_${Date.now()}`,
          name: 'Viewshed Left Edge',
          parent: viewshedEntity,
          polyline: {
            positions: [
              Cesium.Cartesian3.fromDegrees(lng, lat, height),
              Cesium.Cartesian3.fromDegrees(leftX, leftY, height)
            ],
            width: 2,
            material: Cesium.Color.WHITE
          }
        });
        
        // 添加右边界线
        props.viewer.entities.add({
          id: `viewshed_right_edge_${Date.now()}`,
          name: 'Viewshed Right Edge',
          parent: viewshedEntity,
          polyline: {
            positions: [
              Cesium.Cartesian3.fromDegrees(lng, lat, height),
              Cesium.Cartesian3.fromDegrees(rightX, rightY, height)
            ],
            width: 2,
            material: Cesium.Color.WHITE
          }
        });
        
        // 缩放至当前视域区域
        props.viewer.flyTo(viewshedEntity, {
          duration: 1.5,
          offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), radius * 1.5)
        });
        
        console.log('可视区域创建成功');
      } catch (error) {
        console.error('创建可视区域失败:', error);
        throw error;
      }
    };

    // 计算可视区域的点
    const calculateViewshedArea = (lng, lat, height, direction, horizontalAngle, radius) => {
      const positions = [];
      const origin = Cesium.Cartesian3.fromDegrees(lng, lat, height);
      positions.push(origin);
      
      const startAngle = direction - horizontalAngle / 2;
      const endAngle = direction + horizontalAngle / 2;
      const angleStep = 1; // 每隔1度取一个点
      
      for (let angle = startAngle; angle <= endAngle; angle += angleStep) {
        const radians = Cesium.Math.toRadians(angle);
        const x = lng + radius * Math.sin(radians) / 111000;
        const y = lat + radius * Math.cos(radians) / (111000 * Math.cos(Cesium.Math.toRadians(lat)));
        positions.push(Cesium.Cartesian3.fromDegrees(x, y, 0)); // 边缘点高度设为0使其贴地
      }
      
      positions.push(origin); // 闭合多边形
      
      return positions;
    };
    
    // 计算方向指示线
    const calculateDirectionLine = (lng, lat, height, direction, radius) => {
      const origin = Cesium.Cartesian3.fromDegrees(lng, lat, height);
      const radians = Cesium.Math.toRadians(direction);
      const x = lng + radius * Math.sin(radians) / 111000;
      const y = lat + radius * Math.cos(radians) / (111000 * Math.cos(Cesium.Math.toRadians(lat)));
      const end = Cesium.Cartesian3.fromDegrees(x, y, height);
      
      return [origin, end];
    };

    // 执行视线分析
    const executePerformSightlineAnalysis = () => {
      if (!props.viewer) {
        statusMessage.value = 'Viewer未初始化';
        return;
      }
      
      const viewerLng = parseFloat(viewerPoint.value.lng);
      const viewerLat = parseFloat(viewerPoint.value.lat);
      const viewerHeight = parseFloat(viewerPoint.value.height);
      
      const targetLng = parseFloat(targetPoint.value.lng);
      const targetLat = parseFloat(targetPoint.value.lat);
      const targetHeight = parseFloat(targetPoint.value.height);
      
      if (isNaN(viewerLng) || isNaN(viewerLat) || isNaN(viewerHeight) ||
          isNaN(targetLng) || isNaN(targetLat) || isNaN(targetHeight)) {
        statusMessage.value = '观察点或目标点坐标无效，请检查输入';
        console.error('坐标无效:', { viewerPoint: viewerPoint.value, targetPoint: targetPoint.value });
        return;
      }
      
      statusMessage.value = '正在执行视线分析...';
      console.log('开始视线分析 - 观察点:', viewerPoint.value, '目标点:', targetPoint.value);
      
      // 移除预览实体
      removePreviewEntities();
      
      // 添加观察点和目标点标记
      addViewerPointMarker();
      addTargetPointMarker();
      
      // 计算视线可见性 - 沿地形分析
      const result = checkLineOfSightAlongTerrain(
        viewerLng, viewerLat, viewerHeight,
        targetLng, targetLat, targetHeight
      );
      
      console.log('视线分析结果:', result);
      
      // 添加视线
      addSightline();
      
      // 如果有障碍点，添加障碍点标记
      if (result && !result.visible && result.obstacleInfo) {
        addObstaclePointMarker();
        statusMessage.value = '视线分析完成 - 发现障碍';
      } else {
        statusMessage.value = '视线分析完成 - 视线畅通';
      }
    };

    // 格式化坐标显示 - 新增
    const formatCoordinate = (position) => {
      if (!position) return '未知';
      return `${parseFloat(position.lng).toFixed(6)}°, ${parseFloat(position.lat).toFixed(6)}°`;
    };

    // 格式化距离显示 - 新增
    const formatDistance = (meters) => {
      if (meters === null || meters === undefined) return '未知';
      return meters > 1000 ? `${(meters / 1000).toFixed(2)} 公里` : `${meters.toFixed(2)} 米`;
    };

    // 清除分析数据和显示 - 加强版
    const clearAnalysis = () => {
      // 移除预览实体
      removePreviewEntities();
      
      // 移除所有分析相关实体
      if (props.viewer) {
        try {
          // 移除观察点
          if (viewerPointEntity) {
            removeEntity(viewerPointEntity);
            viewerPointEntity = null;
          }
          
          // 移除目标点
          if (targetPointEntity) {
            removeEntity(targetPointEntity);
            targetPointEntity = null;
          }
          
          // 移除视线
          if (sightlineEntity) {
            removeEntity(sightlineEntity);
            sightlineEntity = null;
          }
          
          // 移除障碍点
          if (obstaclePointEntity) {
            removeEntity(obstaclePointEntity);
            obstaclePointEntity = null;
          }
          
          // 移除视域分析实体
          if (viewshedEntity) {
            removeEntity(viewshedEntity);
            viewshedEntity = null;
          }
          
          // 清除3D视域分析
          if (viewshed3D) {
            const cleared = viewshed3D.clear();
            if (cleared) {
              console.log('3D视域分析已清除');
            } else {
              console.warn('3D视域分析清除可能不完整');
              
              // 尝试捕捉并清除可能遗漏的实体
              const entitiesToRemove = [];
              props.viewer.entities.values.forEach(entity => {
                if (entity.id && entity.id.toString().includes('viewshed')) {
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
            viewshed3D = null;
          }
          
          // 强制刷新场景
          props.viewer.scene.requestRender();
        } catch (error) {
          console.error('清除分析时出错:', error);
        }
      }
      
      // 重置分析结果
      sightlineResult.value = null;
      statusMessage.value = '';
      
      console.log('分析已完全清除');
    };

    // 通用实体移除函数 - 新增
    const removeEntity = (entity) => {
      if (entity && props.viewer && props.viewer.entities.contains(entity)) {
        props.viewer.entities.remove(entity);
        return true;
      }
      return false;
    };

    // 初始化事件
    onMounted(() => {
      if (props.viewer) {
        // 初始化
      }
    });

    // 清理事件
    onBeforeUnmount(() => {
      destroyAnalysisHandler();
      clearAnalysis();
    });

    // 监听视图变化
    watch(() => props.viewer, (newViewer) => {
      if (newViewer) {
        // 重新初始化
      }
    });

    // 监听颜色变化 - 如果3D视域分析正在运行，则更新颜色
    watch([
      () => viewshedColors.value.visible,
      () => viewshedColors.value.invisible
    ], () => {
      if (viewshed3D && use3DViewshed.value) {
        performViewshedAnalysis();
      }
    });

    return {
      analysisType,
      viewerPoint,
      targetPoint,
      viewshedParams,
      sightlineResult,
      showViewerPoint,
      showTargetPoint,
      showSightline,
      showObstaclePoint,
      viewshedColors,
      statusMessage,
      use3DViewshed,
      isAnalyzing,
      analysisStep,
      analysisStatusText,
      setAnalysisType,
      startAnalysis,
      cancelAnalysis,
      performViewshedAnalysis,
      performSightlineAnalysis: executePerformSightlineAnalysis, // 修改返回的函数引用
      clearAnalysis,
      formatCoordinate,
      formatDistance
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

.input-group > label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: bold;
}

.button-group {
  display: flex;
  gap: 8px;
}

.button-group button {
  flex: 1;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
}

.button-group button.active {
  background-color: #4285f4;
  color: white;
  font-weight: bold;
  border-color: #3367d6;
}

.analysis-instructions {
  margin: 15px 0;
  text-align: center;
}

.full-width-btn {
  width: 100%;
  margin-bottom: 8px;
  padding: 8px 12px;
  font-weight: bold;
}

.instruction-text {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.active-analysis {
  padding: 10px;
  background-color: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 10px;
}

.status-badge {
  display: inline-block;
  padding: 5px 10px;
  background-color: #3498db;
  color: white;
  border-radius: 15px;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: bold;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 5px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  cursor: pointer;
}

.color-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 8px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.color-item label {
  font-size: 12px;
  color: #666;
}

.color-item input[type="color"] {
  width: 90%;
  height: 24px;
  border: none;
  padding: 0;
}

.control-buttons {
  display: flex;
  gap: 8px;
  margin: 15px 0 10px;
}

button {
  padding: 6px 10px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

button:hover {
  background-color: #e9e9e9;
}

.btn-primary {
  background-color: #4285f4;
  color: white;
  border-color: #3367d6;
}

.btn-primary:hover {
  background-color: #3367d6;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border-color: #5a6268;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.result-display {
  margin: 10px 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-box {
  display: inline-block;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
}

.result-box.visible {
  background-color: rgba(76, 175, 80, 0.2);
  color: #2e7d32;
  border: 1px solid #4caf50;
}

.result-box.invisible {
  background-color: rgba(244, 67, 54, 0.2);
  color: #c62828;
  border: 1px solid #f44336;
}

.obstacle-info {
  background-color: rgba(255, 235, 59, 0.2);
  border: 1px solid #fbc02d;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-message {
  margin-top: 10px;
  padding: 6px;
  font-size: 12px;
  color: #666;
  text-align: center;
  font-style: italic;
}

.param-hint {
  font-size: 12px;
  font-style: italic;
  color: #666;
  margin-top: 5px;
}
</style>
