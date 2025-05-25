/**
 * Cesium错误处理工具函数
 * 提供通用的错误处理和验证函数
 */
import * as Cesium from 'cesium';

/**
 * 验证Cesium Cartesian3坐标是否有效
 * @param {Cesium.Cartesian3} position 待验证的笛卡尔坐标
 * @returns {boolean} 如果坐标有效返回true，否则返回false
 */
export function isValidCartesian(position) {
  return position && 
         !isNaN(position.x) && !isNaN(position.y) && !isNaN(position.z) &&
         isFinite(position.x) && isFinite(position.y) && isFinite(position.z);
}

/**
 * 安全地将笛卡尔坐标转换为地理坐标
 * @param {Cesium.Cartesian3} cartesian 笛卡尔坐标
 * @returns {Cesium.Cartographic|null} 地理坐标或null（如果转换失败）
 */
export function safeCartographicFromCartesian(cartesian) {
  if (!isValidCartesian(cartesian)) return null;
  
  try {
    return Cesium.Cartographic.fromCartesian(cartesian);
  } catch (error) {
    console.warn('从笛卡尔坐标转换到地理坐标失败:', error);
    return null;
  }
}

/**
 * 创建增强的点在多边形内测试函数
 * 处理边界情况和无效坐标
 * @param {Array<Cesium.Cartesian3>} positions 多边形顶点位置数组
 * @returns {Function} 点在多边形内的测试函数
 */
export function createPointInPolygonTest(positions) {
  // 筛选有效坐标并转换为经纬度
  const polygonPoints = [];
  for (const pos of positions) {
    const cart = safeCartographicFromCartesian(pos);
    if (cart) {
      polygonPoints.push({
        lng: Cesium.Math.toDegrees(cart.longitude),
        lat: Cesium.Math.toDegrees(cart.latitude)
      });
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

/**
 * 计算多边形中心点位置（安全实现）
 * @param {Array<Cesium.Cartesian3>} positions 多边形顶点位置数组
 * @param {number} [additionalHeight=10] 额外添加的高度（以便标签可见）
 * @returns {Cesium.Cartesian3|null} 中心点位置或null（如果计算失败）
 */
export function getCenterPosition(positions, additionalHeight = 10) {
  if (!positions || positions.length === 0) return null;
  
  try {
    // 使用经纬度计算中心点，而不是笛卡尔坐标
    let sumLon = 0, sumLat = 0, sumHeight = 0;
    const cartographics = [];
    
    // 将所有点转换为经纬度
    for (const position of positions) {
      if (!isValidCartesian(position)) {
        continue; // 跳过无效点
      }
      
      const cartographic = safeCartographicFromCartesian(position);
      if (cartographic) {
        cartographics.push(cartographic);
        sumLon += cartographic.longitude;
        sumLat += cartographic.latitude;
        sumHeight += cartographic.height;
      }
    }
    
    // 确保有有效的点
    if (cartographics.length === 0) return null;
    
    // 计算平均经纬度作为中心
    const avgLon = sumLon / cartographics.length;
    const avgLat = sumLat / cartographics.length;
    const avgHeight = (sumHeight / cartographics.length) + additionalHeight;
    
    // 创建中心点
    return Cesium.Cartesian3.fromRadians(avgLon, avgLat, avgHeight);
  } catch (error) {
    console.error('计算多边形中心点失败:', error);
    return null;
  }
}

/**
 * 过滤有效的多边形顶点位置
 * @param {Array<Cesium.Cartesian3>} positions 多边形顶点位置数组
 * @param {number} [minPoints=3] 最小有效点数（默认为3，形成三角形）
 * @returns {Array<Cesium.Cartesian3>} 有效的顶点位置数组
 */
export function filterValidPositions(positions, minPoints = 3) {
  if (!positions || positions.length === 0) return [];
  
  const validPositions = positions.filter(pos => isValidCartesian(pos));
  
  if (validPositions.length < minPoints) {
    console.warn(`多边形点位不足，需要至少${minPoints}个有效点，当前有${validPositions.length}个`);
  }
  
  return validPositions;
}

/**
 * 全局错误处理函数 - 处理Cesium中常见的NaN和Infinity错误
 * @param {Error} error 捕获的错误
 * @param {string} [source='未知'] 错误来源
 * @param {Function} [callback=null] 可选的回调函数，用于自定义错误处理
 */
export function handleCesiumError(error, source = '未知', callback = null) {
  let errorType = '未知错误';
  let isCritical = false;
  
  // 检测常见的Cesium错误类型
  if (error.message && error.message.includes('NaN')) {
    errorType = 'NaN坐标错误';
  } else if (error.message && error.message.includes('Infinity')) {
    errorType = '无限大坐标错误';
  } else if (error.message && error.message.includes('undefined')) {
    errorType = '未定义值错误';
  } else if (error.message && error.message.includes('cartesian')) {
    errorType = '笛卡尔坐标错误';
  }
  
  // 记录错误信息
  console.error(`Cesium错误(${source}): ${errorType}`, error);
  
  // 如果提供了回调，则执行
  if (typeof callback === 'function') {
    try {
      callback(error, errorType, isCritical);
    } catch (callbackError) {
      console.error('错误处理回调执行失败:', callbackError);
    }
  }
  
  return {
    errorType,
    isCritical,
    message: error.message,
    source: source
  };
}

export default {
  isValidCartesian,
  safeCartographicFromCartesian,
  createPointInPolygonTest,
  getCenterPosition,
  filterValidPositions,
  handleCesiumError
};
