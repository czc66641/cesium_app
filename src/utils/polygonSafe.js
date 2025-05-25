/**
 * 多边形处理安全工具函数
 * 提供增强的多边形绘制和分析功能，防止NaN错误
 */
import * as Cesium from 'cesium';

/**
 * 安全地获取地球表面位置
 * 确保返回有效坐标，避免NaN错误
 * @param {Cesium.Viewer} viewer Cesium查看器实例
 * @param {Cesium.Cartesian2} windowPosition 屏幕坐标
 * @returns {Cesium.Cartesian3|null} 地球表面位置或null
 */
export function getSafeEarthPosition(viewer, windowPosition) {
  if (!viewer) return null;
  
  try {
    // 射线拾取得到地表位置
    const ray = viewer.camera.getPickRay(windowPosition);
    if (!ray) return null;
    
    const position = viewer.scene.globe.pick(ray, viewer.scene);
    
    // 验证位置是否有效
    if (!position || 
        isNaN(position.x) || isNaN(position.y) || isNaN(position.z) ||
        !isFinite(position.x) || !isFinite(position.y) || !isFinite(position.z)) {
      return null;
    }
    
    return position;
  } catch (error) {
    console.warn('安全获取地球表面位置失败:', error);
    return null;
  }
}

/**
 * 创建增强版安全多边形预览
 * 使用CallbackProperty实时更新坐标，避免NaN错误
 * @param {Cesium.Viewer} viewer Cesium查看器实例
 * @param {Array<Cesium.Cartesian3>} positions 多边形顶点位置
 * @param {Cesium.Cartesian3} tempPosition 临时移动位置（可选）
 * @param {Cesium.Color} fillColor 填充颜色
 * @param {Cesium.Color} outlineColor 轮廓颜色
 * @returns {Cesium.Entity} 创建的多边形实体
 */
export function createEnhancedPolygonEntity(viewer, positionsRef, tempPositionRef = null, fillColor = Cesium.Color.BLUE.withAlpha(0.3), outlineColor = Cesium.Color.BLUE) {  
  if (!viewer) return null;
  
  try {
    // 创建回调函数获取有效坐标
    const hierarchyCallback = new Cesium.CallbackProperty(() => {
      // 获取当前位置数组的引用
      const positions = positionsRef.value || [];
      const tempPosition = tempPositionRef ? tempPositionRef.value : null;
      
      // 验证所有现有点，过滤掉无效坐标
      let validPositions = positions.filter(pos => 
        pos && !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
        isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)
      );
      
      // 如果过滤后点太少，返回空层次结构
      if (validPositions.length < 2) {
        return new Cesium.PolygonHierarchy([]);
      }
      
      // 验证临时点是否有效
      if (tempPosition) {
        if (!isNaN(tempPosition.x) && !isNaN(tempPosition.y) && !isNaN(tempPosition.z) &&
            isFinite(tempPosition.x) && isFinite(tempPosition.y) && isFinite(tempPosition.z)) {
          validPositions = [...validPositions, tempPosition];
        }
      }
      
      return new Cesium.PolygonHierarchy(validPositions);
    }, false);
    
    // 创建动态线条位置回调
    const lineCallback = new Cesium.CallbackProperty(() => {
      // 获取当前位置数组的引用
      const positions = positionsRef.value || [];
      const tempPosition = tempPositionRef ? tempPositionRef.value : null;
      
      // 验证所有现有点，过滤掉无效坐标
      let validPositions = positions.filter(pos => 
        pos && !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
        isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)
      );
      
      // 如果过滤后点太少，返回空数组
      if (validPositions.length < 1) {
        return [];
      }
      
      // 验证临时点是否有效
      if (tempPosition) {
        if (!isNaN(tempPosition.x) && !isNaN(tempPosition.y) && !isNaN(tempPosition.z) &&
            isFinite(tempPosition.x) && isFinite(tempPosition.y) && isFinite(tempPosition.z)) {
          validPositions = [...validPositions, tempPosition];
        }
      }
      
      // 闭合多边形
      if (validPositions.length > 2) {
        return [...validPositions, validPositions[0]];
      }
      
      return validPositions;
    }, false);
    
    // 创建多边形容器实体
    const polygonEntity = viewer.entities.add({
      name: 'PolygonPreviewContainer'
    });
    
    // 创建填充多边形 - 安全的平面多边形
    viewer.entities.add({
      parent: polygonEntity,
      polygon: {
        hierarchy: hierarchyCallback,
        material: fillColor,
        height: 0,
        heightReference: Cesium.HeightReference.NONE,
        outline: false
      }
    });
    
    // 添加轮廓线为单独的polyline
    viewer.entities.add({
      parent: polygonEntity,
      polyline: {
        positions: lineCallback,
        width: 2,
        material: outlineColor,
        clampToGround: true,
        classificationType: Cesium.ClassificationType.TERRAIN
      }
    });
    
    // 为每个顶点添加回调点
    const pointsEntity = viewer.entities.add({
      parent: polygonEntity,
      name: 'VertexPointsContainer'
    });
    
    // 点位置回调集合
    const pointCallbacks = [];
    const maxPoints = 50; // 限制最大点数量
    
    for (let i = 0; i < maxPoints; i++) {
      // 创建顶点位置回调
      const pointCallback = new Cesium.CallbackProperty(() => {
        const positions = positionsRef.value || [];
        if (i >= positions.length) return null;
        
        const pos = positions[i];
        if (!pos || isNaN(pos.x) || !isFinite(pos.x)) return null;
        
        return pos;
      }, false);
      
      // 创建点显示回调
      const showCallback = new Cesium.CallbackProperty(() => {
        const positions = positionsRef.value || [];
        return i < positions.length;
      }, false);
      
      // 添加点实体
      viewer.entities.add({
        parent: pointsEntity,
        position: pointCallback,
        point: {
          pixelSize: 8,
          color: Cesium.Color.WHITE,
          outlineColor: outlineColor,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 9999 // 确保点始终可见
        },
        show: showCallback
      });
      
      pointCallbacks.push(pointCallback);
    }
    
    return polygonEntity;  } catch (error) {
    console.error('创建增强多边形预览失败:', error);
    return null;
  }
}

/**
 * 创建安全的裁剪多边形
 * 使用回调属性避免NaN错误，并支持贴地
 * @param {Cesium.Viewer} viewer Cesium查看器实例
 * @param {Array<Cesium.Cartesian3>} positions 多边形顶点位置
 * @param {string} containerId 容器实体ID
 * @returns {Cesium.Entity} 分析容器实体
 */
export function createEnhancedClippingPolygon(viewer, positionsRef, containerId = 'analysis_container') {
  if (!viewer) return null;
  
  try {
    // 获取当前位置数组的引用
    const positions = positionsRef.value || [];
    
    // 验证所有位置有效性
    const validPositions = positions.filter(pos => 
      pos && !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
      isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)
    );
    
    if (validPositions.length < 3) {
      console.warn('多边形点位不足或无效，无法创建裁剪区域');
      return null;
    }
    
    // 创建回调函数获取有效坐标
    const hierarchyCallback = new Cesium.CallbackProperty(() => {
      // 获取当前位置数组的引用 - 实时更新
      const currentPositions = positionsRef.value || [];
      
      // 验证所有现有点，过滤掉无效坐标
      const validCurrentPositions = currentPositions.filter(pos => 
        pos && !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
        isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)
      );
      
      // 如果过滤后点太少，返回空层次结构
      if (validCurrentPositions.length < 3) {
        return new Cesium.PolygonHierarchy([]);
      }
      
      return new Cesium.PolygonHierarchy(validCurrentPositions);
    }, false);
    
    // 创建动态线条位置回调
    const lineCallback = new Cesium.CallbackProperty(() => {
      // 获取当前位置数组的引用 - 实时更新
      const currentPositions = positionsRef.value || [];
      
      // 验证所有现有点，过滤掉无效坐标
      const validCurrentPositions = currentPositions.filter(pos => 
        pos && !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z) &&
        isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)
      );
      
      // 如果过滤后点太少，返回空数组
      if (validCurrentPositions.length < 3) {
        return [];
      }
      
      // 闭合多边形
      return [...validCurrentPositions, validCurrentPositions[0]];
    }, false);
    
    // 创建分析容器
    const containerEntity = viewer.entities.add({
      id: containerId,
      name: 'EnhancedAnalysisContainer'
    });
    
    // 创建区域填充多边形 - 使用半透明材质和回调函数
    viewer.entities.add({
      parent: containerEntity,
      polygon: {
        hierarchy: hierarchyCallback,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.WHITE.withAlpha(0.01)),
        classificationType: Cesium.ClassificationType.TERRAIN,
        height: 0,
        heightReference: Cesium.HeightReference.NONE
      }
    });
    
    // 添加轮廓线为单独的polyline，使用回调确保实时更新
    viewer.entities.add({
      parent: containerEntity,
      polyline: {
        positions: lineCallback,
        width: 2,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.WHITE),
        clampToGround: true,
        classificationType: Cesium.ClassificationType.TERRAIN
      }
    });
    
    return containerEntity;
  } catch (error) {
    console.error('创建增强裁剪多边形失败:', error);
    return null;
  }
}

/**
 * 添加全局错误处理程序到Cesium场景
 * 捕获并处理常见的Cesium错误
 * @param {Cesium.Viewer} viewer Cesium查看器实例
 * @param {Function} errorCallback 错误处理回调函数
 * @returns {Function} 清理函数，用于移除监听器
 */
export function addCesiumErrorHandler(viewer, errorCallback) {
  if (!viewer || !viewer.scene) return () => {};
  
  const errorHandler = (error) => {
    console.error('Cesium渲染错误:', error);
    
    // 处理常见错误
    if (error.message && (
        error.message.includes('cartesian') || 
        error.message.includes('NaN') || 
        error.message.includes('undefined')
    )) {
      // 调用提供的回调函数
      if (typeof errorCallback === 'function') {
        errorCallback(error);
      }
    }
  };
  
  // 添加渲染错误监听
  viewer.scene.renderError.addEventListener(errorHandler);
  
  // 返回清理函数
  return () => {
    viewer.scene.renderError.removeEventListener(errorHandler);
  };
}

/**
 * 创建点在多边形内的检测函数 - 增强版
 * 处理边界情况和无效坐标
 * @param {Array<Cesium.Cartesian3>} positions 多边形顶点位置数组
 * @returns {Function} 点在多边形内的测试函数
 */
export function createEnhancedPointInPolygonTest(positions) {
  // 筛选有效坐标并转换为经纬度
  const polygonPoints = [];
  for (const pos of positions) {
    if (!pos || isNaN(pos.x) || !isFinite(pos.x)) continue;
    
    try {
      const cart = Cesium.Cartographic.fromCartesian(pos);
      polygonPoints.push({
        lng: Cesium.Math.toDegrees(cart.longitude),
        lat: Cesium.Math.toDegrees(cart.latitude)
      });
    } catch (e) {
      console.warn('从笛卡尔坐标转换到地理坐标失败:', e);
    }
  }
  
  // 如果多边形点太少，返回一个始终返回false的函数
  if (polygonPoints.length < 3) {
    return () => false;
  }
  
  // 返回点在多边形内的测试函数
  return (testLng, testLat) => {
    if (!isFinite(testLng) || !isFinite(testLat) || isNaN(testLng) || isNaN(testLat)) {
      return false; // 无效坐标直接返回false
    }
    
    let inside = false;
    // 射线法检测点是否在多边形内
    for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
      // 确保坐标有效
      const xi = polygonPoints[i].lng;
      const yi = polygonPoints[i].lat;
      const xj = polygonPoints[j].lng;
      const yj = polygonPoints[j].lat;
      
      if (!isFinite(xi) || !isFinite(yi) || !isFinite(xj) || !isFinite(yj) ||
          isNaN(xi) || isNaN(yi) || isNaN(xj) || isNaN(yj)) {
        continue; // 跳过无效坐标
      }
      
      // 检查是否为水平线段（两点纬度相同）
      if (Math.abs(yj - yi) < 0.000001) {
        // 如果测试点在水平线上，且在线段的x范围内
        if (Math.abs(yi - testLat) < 0.000001 && 
            testLng >= Math.min(xi, xj) && testLng <= Math.max(xi, xj)) {
          inside = !inside;
        }
      } 
      // 非水平线段：测试点与边界交点检测
      else if ((yi > testLat) !== (yj > testLat)) {
        try {
          // 计算交点的x坐标（可能因为除以0导致NaN或Infinity）
          const xIntersect = (xj - xi) * (testLat - yi) / (yj - yi) + xi;
          
          if (isFinite(xIntersect) && !isNaN(xIntersect) && testLng < xIntersect) {
            inside = !inside;
          }
        } catch (e) {
          console.warn('多边形交点计算出错', e);
        }
      }
    }
    
    return inside;
  };
}
