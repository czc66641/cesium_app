/**
 * 多边形工具类 - 用于处理多边形的创建和与地形的交互问题
 */
import * as Cesium from 'cesium';

/**
 * 创建不贴地的多边形，避免轮廓警告
 * @param {Cesium.Viewer} viewer Cesium查看器
 * @param {Array} positions 多边形顶点位置
 * @param {Object} options 多边形配置选项
 * @returns {Object} 包含多边形和轮廓线的容器实体
 */
export function createSafePolygon(viewer, positions, options = {}) {
  if (!viewer || !positions || positions.length < 3) {
    console.error('无效的参数：需要viewer和至少3个顶点位置');
    return null;
  }

  const defaultOptions = {
    fillColor: Cesium.Color.BLUE.withAlpha(0.3),
    outlineColor: Cesium.Color.WHITE,
    outlineWidth: 2,
    showVertices: true,
    vertexColor: Cesium.Color.RED,
    vertexSize: 8,
    name: 'SafePolygon'
  };

  // 合并选项
  const mergedOptions = { ...defaultOptions, ...options };

  try {
    // 创建容器实体
    const containerEntity = viewer.entities.add({
      name: mergedOptions.name
    });

    // 创建填充多边形 - 不使用轮廓，设置高度为0避免警告
    viewer.entities.add({
      parent: containerEntity,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: mergedOptions.fillColor,
        height: 0, // 明确设置高度为0
        heightReference: Cesium.HeightReference.NONE // 不贴合地形
      }
    });

    // 单独添加轮廓线作为polyline
    viewer.entities.add({
      parent: containerEntity,
      polyline: {
        positions: [...positions, positions[0]], // 闭合多边形
        width: mergedOptions.outlineWidth,
        material: mergedOptions.outlineColor,
        clampToGround: true
      }
    });

    // 如果需要显示顶点
    if (mergedOptions.showVertices) {
      positions.forEach((position) => {
        viewer.entities.add({
          parent: containerEntity,
          position: position,
          point: {
            pixelSize: mergedOptions.vertexSize,
            color: mergedOptions.vertexColor,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          }
        });
      });
    }

    return containerEntity;
  } catch (error) {
    console.error('创建多边形失败:', error);
    return null;
  }
}

/**
 * 创建可视化面板
 * @param {HTMLCanvasElement|Array} colorSource 颜色源(Canvas或颜色数组)
 * @param {Object} options 配置选项
 * @returns {HTMLCanvasElement} 渐变Canvas
 */
export function createColorRampCanvas(colorSource, options = {}) {
  const defaultOptions = {
    width: 256,
    height: 1,
    horizontal: true,
  };

  const mergedOptions = { ...defaultOptions, ...options };
  const { width, height, horizontal } = mergedOptions;

  // 创建Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.error('无法获取canvas上下文');
    return null;
  }

  // 如果传入的是Canvas，直接使用它
  if (colorSource instanceof HTMLCanvasElement) {
    ctx.drawImage(colorSource, 0, 0, width, height);
    return canvas;
  }

  // 如果传入的是颜色数组
  if (Array.isArray(colorSource) && colorSource.length > 0) {
    // 创建线性渐变
    const gradient = horizontal 
      ? ctx.createLinearGradient(0, 0, width, 0)
      : ctx.createLinearGradient(0, 0, 0, height);
    
    // 添加颜色停止点
    colorSource.forEach((color, index) => {
      const stopPosition = index / (colorSource.length - 1);
      // 处理不同类型的颜色输入
      if (typeof color === 'string') {
        gradient.addColorStop(stopPosition, color);
      } else if (color && typeof color.toCssColorString === 'function') {
        gradient.addColorStop(stopPosition, color.toCssColorString());
      } else if (color && color.r !== undefined && color.g !== undefined && color.b !== undefined) {
        const alpha = color.a !== undefined ? color.a : 1.0;
        gradient.addColorStop(stopPosition, `rgba(${color.r*255},${color.g*255},${color.b*255},${alpha})`);
      }
    });
    
    // 填充渐变
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    return canvas;
  }

  // 默认返回灰度渐变
  const gradient = horizontal 
    ? ctx.createLinearGradient(0, 0, width, 0)
    : ctx.createLinearGradient(0, 0, 0, height);
  
  gradient.addColorStop(0, 'black');
  gradient.addColorStop(1, 'white');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  return canvas;
}

/**
 * 创建安全的材质用于高程分析
 * @param {HTMLCanvasElement} colorRampCanvas 颜色渐变Canvas
 * @param {Number} minHeight 最小高度
 * @param {Number} maxHeight 最大高度
 * @param {Number} opacity 不透明度
 * @returns {Cesium.Material} Cesium材质
 */
export function createHeightRampMaterial(colorRampCanvas, minHeight, maxHeight, opacity = 0.7) {
  // 确保输入有效
  if (!colorRampCanvas || !(colorRampCanvas instanceof HTMLCanvasElement)) {
    console.warn('无效的颜色渐变Canvas，使用默认渐变');
    colorRampCanvas = createColorRampCanvas([
      Cesium.Color.BLUE,
      Cesium.Color.CYAN,
      Cesium.Color.GREEN, 
      Cesium.Color.YELLOW, 
      Cesium.Color.RED
    ]);
  }

  try {
    return new Cesium.Material({
      fabric: {
        type: 'ElevationRamp',
        uniforms: {
          minimumHeight: minHeight,
          maximumHeight: maxHeight,
          image: colorRampCanvas,
          alpha: opacity
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
              
              // 获取颜色 - 使用texture替代texture2D
              vec4 rampColor = texture(image, vec2(colorPosition, 0.5));
              
              // 应用颜色和透明度
              material.diffuse = rampColor.rgb;
              material.alpha = rampColor.a * alpha;
              
              return material;
          }
        `
      }
    });
  } catch (error) {
    console.error('创建高程材质失败:', error);
    
    // 创建备用材质
    return new Cesium.Material({
      fabric: {
        type: 'Color',
        uniforms: {
          color: new Cesium.Color(0.0, 0.5, 1.0, opacity)
        }
      }
    });
  }
}

export default {
  createSafePolygon,
  createColorRampCanvas,
  createHeightRampMaterial
};
