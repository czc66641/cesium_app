/**
 * 3D 视域分析工具类
 * 基于 Cesium 的真实3D可视域分析实现
 */
import * as Cesium from 'cesium';

class ViewshedAnalysis3D {
  constructor(viewer, options) {
    this.viewer = viewer;
    
    // 默认参数
    this.options = {
      viewPosition: null,                         // 观察点位置
      viewPositionEnd: null,                      // 视线方向终点位置
      viewDistance: 1000.0,                       // 可视域距离
      viewHeading: 0.0,                           // 可视域方向
      viewPitch: 0.0,                             // 可视域俯仰角
      horizontalViewAngle: 120.0,                 // 水平视角
      verticalViewAngle: 90.0,                    // 垂直视角
      visibleAreaColor: Cesium.Color.GREEN.withAlpha(0.5),   // 可见区域颜色
      invisibleAreaColor: Cesium.Color.RED.withAlpha(0.5),   // 不可见区域颜色
      analysisDensity: 15                         // 分析密度
    };

    // 合并用户配置
    Object.assign(this.options, options);

    // 视域分析相关对象
    this.viewshedPrimitive = null;
    this.entities = [];
    
    // 分析结果
    this.visiblePoints = [];
    this.invisiblePoints = [];
    this.frustumOutline = [];
    
    // 实体ID前缀，用于清理
    this.entityIdPrefix = `viewshed3d_${Date.now()}`;
  }

  /**
   * 添加视域分析
   */
  add() {
    if (!this.viewer) {
      console.error('Viewer未初始化');
      return false;
    }
    
    try {
      // 确保观察点位置有效
      if (!this.options.viewPosition) {
        console.error('观察点位置未设置');
        return false;
      }

      console.log('开始执行3D视域分析...');
      
      // 分析观察点位置的3D视野
      this.analyzeVisibility3D();
      
      // 添加观察点标记
      this.addObserverMarker();
      
      // 创建3D视锥体轮廓，帮助用户理解分析范围
      this.createFrustumOutline();
      
      // 可视化分析结果 - 真3D结果
      this.visualize3DResults();
      
      console.log('3D视域分析已完成，考虑地形高度');
      return true;
    } catch (error) {
      console.error('添加3D视域分析失败:', error);
      return false;
    }
  }

  /**
   * 分析3D视域可见性
   */
  analyzeVisibility3D() {
    // 解析观察点位置
    const viewPosition = this.options.viewPosition;
    const cartographic = Cesium.Cartographic.fromCartesian(viewPosition);
    const lng = Cesium.Math.toDegrees(cartographic.longitude);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const height = cartographic.height;
    
    // 计算参数
    const radius = this.options.viewDistance;
    const horizontalAngle = this.options.horizontalViewAngle;
    const verticalAngle = this.options.verticalViewAngle;
    const heading = this.options.viewHeading;
    const pitch = this.options.viewPitch || 0;
    
    console.log('3D分析参数:', {观察点: {lng, lat, height}, 方向: heading, 俯仰角: pitch, 距离: radius, 
                            水平角度: horizontalAngle, 垂直角度: verticalAngle});
    
    // 清除之前的分析结果
    this.visiblePoints = [];
    this.invisiblePoints = [];
    
    // 根据分析密度确定采样步长
    const density = this.options.analysisDensity;
    const horizontalStep = horizontalAngle / density;
    const verticalStep = verticalAngle / density;
    const distanceStep = radius / density;
    
    // 计算俯仰角范围
    const minPitch = pitch - verticalAngle / 2;
    const maxPitch = pitch + verticalAngle / 2;
    
    // 从观察点开始，向视锥体内各个方向发射射线
    for (let h = -horizontalAngle / 2; h <= horizontalAngle / 2; h += horizontalStep) {
      for (let v = minPitch; v <= maxPitch; v += verticalStep) {
        for (let dist = distanceStep; dist <= radius; dist += distanceStep) {
          // 计算射线方向 - 使用heading和pitch
          const rayHeading = Cesium.Math.toRadians(heading + h);
          const rayPitch = Cesium.Math.toRadians(v);
          
          // 计算目标点的球面坐标 - 考虑高度
          const targetDistance = dist;
          let targetHeight;
          
          // 计算水平距离
          const horizontalDistance = targetDistance * Math.cos(rayPitch);
          
          // 目标高度需计入垂直距离
          const verticalDistance = targetDistance * Math.sin(rayPitch);
          targetHeight = height + verticalDistance;
          
          // 根据heading和水平距离计算目标点经纬度
          const targetLng = lng + (horizontalDistance * Math.sin(rayHeading)) / (111000 * Math.cos(Cesium.Math.toRadians(lat)));
          const targetLat = lat + (horizontalDistance * Math.cos(rayHeading)) / 111000;
          
          // 创建目标点
          const targetPoint = Cesium.Cartesian3.fromDegrees(targetLng, targetLat, targetHeight);
          
          // 检查从观察点到目标点的可见性
          const visible = this.checkVisibility(viewPosition, targetPoint);
          
          // 保存分析结果
          const point = {
            position: targetPoint,
            isVisible: visible,
            distance: dist,
            heading: heading + h,
            pitch: v
          };
          
          if (visible) {
            this.visiblePoints.push(point);
          } else {
            this.invisiblePoints.push(point);
          }
        }
      }
    }
    
    console.log(`3D视域分析完成: ${this.visiblePoints.length} 个可见点, ${this.invisiblePoints.length} 个不可见点`);
  }

  /**
   * 检查从起点到终点的可见性
   * @returns {boolean} 是否可见
   */
  checkVisibility(fromPosition, toPosition) {
    // 计算总距离
    const totalDistance = Cesium.Cartesian3.distance(fromPosition, toPosition);
    
    try {
      // 计算从起点到终点的方向向量
      const direction = Cesium.Cartesian3.subtract(toPosition, fromPosition, new Cesium.Cartesian3());
      Cesium.Cartesian3.normalize(direction, direction);
      
      // 设置射线
      const ray = new Cesium.Ray(fromPosition, direction);
      
      // 使用globe.pick检查射线与地形的交点
      const position = this.viewer.scene.globe.pick(ray, this.viewer.scene);
      
      // 如果找到交点，检查它是否在起点和终点之间
      if (position) {
        // 计算从起点到交点的距离
        const intersectionDistance = Cesium.Cartesian3.distance(fromPosition, position);
        
        // 如果交点在起点和终点之间，则视线被阻挡
        return intersectionDistance >= totalDistance * 0.98; // 允许一点误差
      }
      
      // 没有交点，视线通畅
      return true;
    } catch (error) {
      console.warn('可见性检查失败:', error);
      return true; // 出错时默认为可见
    }
  }
  
  /**
   * 添加观察点标记
   */
  addObserverMarker() {
    const viewPosition = this.options.viewPosition;
    const observerEntity = this.viewer.entities.add({
      id: `${this.entityIdPrefix}_observer`,
      position: viewPosition,
      point: {
        pixelSize: 12,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2
      },
      label: {
        text: '观察点',
        font: '16px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        outlineColor: Cesium.Color.BLACK,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -14),
        disableDepthTestDistance: Number.POSITIVE_INFINITY // 确保标签总是可见
      }
    });
    
    this.entities.push(observerEntity);
  }
  
  /**
   * 创建视锥体轮廓
   */
  createFrustumOutline() {
    // 获取观察点位置
    const viewPosition = this.options.viewPosition;
    const cartographic = Cesium.Cartographic.fromCartesian(viewPosition);
    const lng = Cesium.Math.toDegrees(cartographic.longitude);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const height = cartographic.height;
    
    // 计算参数
    const radius = this.options.viewDistance;
    const horizontalAngle = this.options.horizontalViewAngle;
    const verticalAngle = this.options.verticalViewAngle;
    const heading = this.options.viewHeading;
    const pitch = this.options.viewPitch || 0;
    
    // 计算俯仰角范围
    const minPitch = pitch - verticalAngle / 2;
    const maxPitch = pitch + verticalAngle / 2;
    
    // 存储视锥体顶点用于可视化
    this.frustumOutline = [];
    
    // 添加观察方向线 - 中央射线
    const centerRayHeading = Cesium.Math.toRadians(heading);
    const centerRayPitch = Cesium.Math.toRadians(pitch);
    const horizontalDistance = radius * Math.cos(centerRayPitch);
    const verticalDistance = radius * Math.sin(centerRayPitch);
    const centerTargetHeight = height + verticalDistance;
    
    const centerTargetLng = lng + (horizontalDistance * Math.sin(centerRayHeading)) / (111000 * Math.cos(Cesium.Math.toRadians(lat)));
    const centerTargetLat = lat + (horizontalDistance * Math.cos(centerRayHeading)) / 111000;
    
    const directionLineEntity = this.viewer.entities.add({
      id: `${this.entityIdPrefix}_direction`,
      polyline: {
        positions: [
          viewPosition,
          Cesium.Cartesian3.fromDegrees(centerTargetLng, centerTargetLat, centerTargetHeight)
        ],
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.YELLOW.withAlpha(0.8)
        }),
        clampToGround: false
      }
    });
    
    this.entities.push(directionLineEntity);
    
    // 创建视锥体边界
    // 这里创建一个更完整的视锥体轮廓，增强立体感
    
    // 1. 获取视锥体的四个角
    const corners = [];
    
    // 左下角
    {
      const rayHeading = Cesium.Math.toRadians(heading - horizontalAngle / 2);
      const rayPitch = Cesium.Math.toRadians(minPitch);
      const hDistance = radius * Math.cos(rayPitch);
      const vDistance = radius * Math.sin(rayPitch);
      const targetHeight = height + vDistance;
      const targetLng = lng + (hDistance * Math.sin(rayHeading)) / (111000 * Math.cos(Cesium.Math.toRadians(lat)));
      const targetLat = lat + (hDistance * Math.cos(rayHeading)) / 111000;
      corners.push(Cesium.Cartesian3.fromDegrees(targetLng, targetLat, targetHeight));
    }
    
    // 右下角
    {
      const rayHeading = Cesium.Math.toRadians(heading + horizontalAngle / 2);
      const rayPitch = Cesium.Math.toRadians(minPitch);
      const hDistance = radius * Math.cos(rayPitch);
      const vDistance = radius * Math.sin(rayPitch);
      const targetHeight = height + vDistance;
      const targetLng = lng + (hDistance * Math.sin(rayHeading)) / (111000 * Math.cos(Cesium.Math.toRadians(lat)));
      const targetLat = lat + (hDistance * Math.cos(rayHeading)) / 111000;
      corners.push(Cesium.Cartesian3.fromDegrees(targetLng, targetLat, targetHeight));
    }
    
    // 右上角
    {
      const rayHeading = Cesium.Math.toRadians(heading + horizontalAngle / 2);
      const rayPitch = Cesium.Math.toRadians(maxPitch);
      const hDistance = radius * Math.cos(rayPitch);
      const vDistance = radius * Math.sin(rayPitch);
      const targetHeight = height + vDistance;
      const targetLng = lng + (hDistance * Math.sin(rayHeading)) / (111000 * Math.cos(Cesium.Math.toRadians(lat)));
      const targetLat = lat + (hDistance * Math.cos(rayHeading)) / 111000;
      corners.push(Cesium.Cartesian3.fromDegrees(targetLng, targetLat, targetHeight));
    }
    
    // 左上角
    {
      const rayHeading = Cesium.Math.toRadians(heading - horizontalAngle / 2);
      const rayPitch = Cesium.Math.toRadians(maxPitch);
      const hDistance = radius * Math.cos(rayPitch);
      const vDistance = radius * Math.sin(rayPitch);
      const targetHeight = height + vDistance;
      const targetLng = lng + (hDistance * Math.sin(rayHeading)) / (111000 * Math.cos(Cesium.Math.toRadians(lat)));
      const targetLat = lat + (hDistance * Math.cos(rayHeading)) / 111000;
      corners.push(Cesium.Cartesian3.fromDegrees(targetLng, targetLat, targetHeight));
    }
    
    // 2. 创建视锥轮廓线
    // 从观察点到四个角的线
    for (let i = 0; i < corners.length; i++) {
      const edge = this.viewer.entities.add({
        id: `${this.entityIdPrefix}_edge_${i}`,
        polyline: {
          positions: [viewPosition, corners[i]],
          width: 1.5,
          material: Cesium.Color.YELLOW.withAlpha(0.6)
        }
      });
      this.entities.push(edge);
    }
    
    // 连接四个角形成视锥底面
    const baseFace = [...corners, corners[0]]; // 封闭底面
    const baseEntity = this.viewer.entities.add({
      id: `${this.entityIdPrefix}_base`,
      polyline: {
        positions: baseFace,
        width: 1.5,
        material: Cesium.Color.YELLOW.withAlpha(0.6)
      }
    });
    this.entities.push(baseEntity);
    
    // 存储角点，在可视化结果时使用
    this.frustumOutline = corners;
  }
  
  /**
   * 可视化3D分析结果
   */
  visualize3DResults() {
    try {
      // 改进可视化效果：使用三角形面片而不是点云

      // 先划分可见和不可见区域的点
      console.log(`准备可视化: ${this.visiblePoints.length} 个可见点, ${this.invisiblePoints.length} 个不可见点`);
      
      // 1. 创建可见区域
      if (this.visiblePoints.length > 0) {
        // 分层创建可见区域，以获得更好的视觉效果
        this.createVisibilityLayers(this.visiblePoints, true, 5); // 分5层
      }
      
      // 2. 创建不可见区域
      if (this.invisiblePoints.length > 0) {
        // 分层创建不可见区域
        this.createVisibilityLayers(this.invisiblePoints, false, 5); // 分5层
      }
    } catch (error) {
      console.error('可视化3D结果失败:', error);
    }
  }
  
  /**
   * 分层创建可视化区域，避免大型多边形的问题
   */
  createVisibilityLayers(points, isVisible, numLayers) {
    // 按距离对点进行分组
    const sortedPoints = [...points].sort((a, b) => a.distance - b.distance);
    
    // 计算每层的距离范围
    const minDistance = sortedPoints[0].distance;
    const maxDistance = sortedPoints[sortedPoints.length - 1].distance;
    const distanceStep = (maxDistance - minDistance) / numLayers;
    
    // 创建每一层
    for (let i = 0; i < numLayers; i++) {
      const startDist = minDistance + i * distanceStep;
      const endDist = startDist + distanceStep;
      
      // 获取这一层的点
      const layerPoints = sortedPoints.filter(p => 
        p.distance >= startDist && p.distance < endDist
      );
      
      if (layerPoints.length < 3) continue; // 需要至少3个点才能形成多边形
      
      // 创建这一层的可视化
      this.createVisibilityVolume(layerPoints, isVisible, i);
    }
  }
  
  /**
   * 创建可视/不可视区域体积表示 - 优化版
   */
  createVisibilityVolume(points, isVisible, layerIndex = 0) {
    try {
      if (points.length < 3) return; // 需要至少3个点
      
      // 获取所有点的位置
      let positions = points.map(p => p.position);
      
      // 如果点太多，进行抽样以提高性能
      if (positions.length > 50) {
        positions = this.samplePoints(positions, 50);
      }
      
      // 添加观察点作为中心点
      const viewPosition = this.options.viewPosition;
      positions.push(viewPosition);
            
      // 根据可见性确定颜色和透明度
      const color = isVisible ? 
        this.options.visibleAreaColor.withAlpha(0.6 - layerIndex * 0.08) : // 可见区域更透明
        this.options.invisibleAreaColor.withAlpha(0.4 - layerIndex * 0.06); // 不可见区域稍微透明
      
      // 创建多边形
      const entity = this.viewer.entities.add({
        id: `${this.entityIdPrefix}_volume_${isVisible ? 'visible' : 'invisible'}_${layerIndex}`,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          material: color,
          perPositionHeight: true, // 使用每个点的实际高度
          outline: layerIndex === 0, // 只给最外层添加边框
          outlineColor: isVisible ? 
            Cesium.Color.LIME.withAlpha(0.8) : 
            Cesium.Color.RED.withAlpha(0.8),
          outlineWidth: 1.5
        }
      });
      
      this.entities.push(entity);
      
      // 如果是可见区域的第一层，将其设置为主视域实体（用于相机定位）
      if (isVisible && layerIndex === 0) {
        this.viewshedPrimitive = entity;
      }
      
      // 为每个角落添加视觉效果，显示视域边界
      if (layerIndex === 0) {
        // 在观察点位置添加向下的柱状指示器
        const cartographic = Cesium.Cartographic.fromCartesian(viewPosition);
        const lng = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const height = cartographic.height;
                
        // 柱状指示器
        const cylinder = this.viewer.entities.add({
          id: `${this.entityIdPrefix}_observer_marker`,
          position: Cesium.Cartesian3.fromDegrees(lng, lat, height / 2),
          cylinder: {
            length: height,
            topRadius: 1.5,
            bottomRadius: 1.5,
            material: Cesium.Color.YELLOW.withAlpha(0.6),
            outline: true,
            outlineColor: Cesium.Color.YELLOW
          }
        });
        
        this.entities.push(cylinder);
      }
      
    } catch (error) {
      console.error(`创建${isVisible ? '可见' : '不可见'}区域体积表示失败:`, error);
    }
  }
  
  /**
   * 对点进行采样，减少点的数量
   */
  samplePoints(points, maxPoints) {
    if (!Array.isArray(points) || points.length <= maxPoints) {
      return points;
    }
    
    const step = Math.ceil(points.length / maxPoints);
    const sampledPoints = [];
    
    for (let i = 0; i < points.length; i += step) {
      sampledPoints.push(points[i]);
    }
    
    return sampledPoints;
  }

  /**
   * 清除视域分析
   */
  clear() {
    if (!this.viewer) return;
    
    try {
      console.log(`开始清除3D视域分析，实体数量: ${this.entities.length}`);
      
      // 移除所有添加的实体
      for (let i = this.entities.length - 1; i >= 0; i--) {
        const entity = this.entities[i];
        if (entity && this.viewer.entities.contains(entity)) {
          this.viewer.entities.remove(entity);
        }
      }
      
      // 清空实体数组
      this.entities = [];
      
      // 查找并清除所有以前缀开头的实体，以防止遗漏
      const entitiesToRemove = [];
      this.viewer.entities.values.forEach(entity => {
        if (entity.id && entity.id.toString().startsWith('viewshed3d_')) {
          entitiesToRemove.push(entity);
        }
      });
      
      entitiesToRemove.forEach(entity => {
        try {
          this.viewer.entities.remove(entity);
        } catch (e) {
          console.warn('无法移除实体:', e);
        }
      });
      
      // 重置其他属性
      this.viewshedPrimitive = null;
      this.visiblePoints = [];
      this.invisiblePoints = [];
      this.frustumOutline = [];
      
      // 强制刷新场景
      this.viewer.scene.requestRender();
      
      console.log('3D视域分析已完全清除');
      return true;
    } catch (error) {
      console.error('清除3D视域分析失败:', error);
      return false;
    }
  }

  /**
   * 更新视域分析参数
   */
  update(options) {
    // 更新参数
    Object.assign(this.options, options);
    
    // 重新添加视域分析
    this.clear();
    this.add();
  }
}

export default ViewshedAnalysis3D;
