import * as Cesium from 'cesium';

/**
 * 地震核密度分析工具类
 * 实现真正的核密度估计算法来分析地震密度分布
 */
export class EarthquakeKernelDensityAnalysis {
  constructor(viewer, options = {}) {
    this.viewer = viewer;
    this.options = {
      // 核密度分析专用配置
      kernelType: 'gaussian', // gaussian, epanechnikov, quartic
      bandwidth: 'auto', // 'auto' 或具体数值
      gridResolution: 150, // 增加网格分辨率，从100提高到150
      weightField: 'magnitude', // 权重字段名
      useMagnitudeWeight: true, // 是否使用震级权重
      smoothingFactor: 1.0, // 平滑因子
      densityThreshold: 0.03, // 降低密度阈值，从0.05降到0.03，显示更多细节
      cellSizeScale: 0.6, // 新增：网格单元大小比例，小于1会让网格更细密
      ...options
    };
    
    this.dataSource = null;
    this.densityGrid = null;
    this.bounds = null;
  }

  /**
   * 生成地震核密度分析热力图
   * @param {Array} earthquakes 地震数据 [{longitude, latitude, magnitude, depth}, ...]
   */
  async generateKernelDensityHeatmap(earthquakes) {
    if (!earthquakes || earthquakes.length === 0) {
      console.warn('地震数据为空');
      return;
    }

    console.log('开始生成地震核密度分析热力图，数据量:', earthquakes.length);

    // 清除现有热力图
    this.remove();

    try {
      // 1. 预处理地震数据
      const validEarthquakes = this.preprocessEarthquakeData(earthquakes);
      if (validEarthquakes.length === 0) {
        throw new Error('没有有效的地震数据');
      }

      // 2. 计算数据边界
      this.bounds = this.calculateDataBounds(validEarthquakes);
      
      // 3. 计算最优带宽
      const bandwidth = this.calculateOptimalBandwidth(validEarthquakes);
      
      // 4. 生成密度网格
      this.densityGrid = this.generateDensityGrid(validEarthquakes, bandwidth);
      
      // 5. 创建可视化
      await this.createDensityVisualization();
      
      // 6. 飞行到热力图区域
      this.flyToHeatmap();
      
      console.log('地震核密度分析热力图生成完成');
    } catch (error) {
      console.error('生成核密度分析热力图失败:', error);
      throw error;
    }
  }

  /**
   * 预处理地震数据
   */
  preprocessEarthquakeData(earthquakes) {
    return earthquakes.filter(eq => {
      const lng = parseFloat(eq.longitude);
      const lat = parseFloat(eq.latitude);
      const mag = parseFloat(eq.magnitude);
      
      return !isNaN(lng) && !isNaN(lat) && !isNaN(mag) &&
             lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90 && mag > 0;
    }).map(eq => ({
      longitude: parseFloat(eq.longitude),
      latitude: parseFloat(eq.latitude),
      magnitude: parseFloat(eq.magnitude),
      depth: parseFloat(eq.depth || 0),
      // 计算权重：震级越大权重越大
      weight: this.options.useMagnitudeWeight ? 
        Math.pow(parseFloat(eq.magnitude), 2) : 1
    }));
  }

  /**
   * 计算数据边界
   */
  calculateDataBounds(earthquakes) {
    let west = Infinity, east = -Infinity;
    let south = Infinity, north = -Infinity;
    
    earthquakes.forEach(eq => {
      west = Math.min(west, eq.longitude);
      east = Math.max(east, eq.longitude);
      south = Math.min(south, eq.latitude);
      north = Math.max(north, eq.latitude);
    });
    
    // 添加边缘缓冲区
    const lngBuffer = (east - west) * 0.1;
    const latBuffer = (north - south) * 0.1;
    
    return {
      west: west - lngBuffer,
      east: east + lngBuffer,
      south: south - latBuffer,
      north: north + latBuffer
    };
  }

  /**
   * 计算最优带宽 - Silverman规则
   */
  calculateOptimalBandwidth(earthquakes) {
    if (this.options.bandwidth !== 'auto') {
      return this.options.bandwidth;
    }

    const n = earthquakes.length;
    
    // 计算坐标的标准差
    const lngs = earthquakes.map(eq => eq.longitude);
    const lats = earthquakes.map(eq => eq.latitude);
    
    const lngMean = lngs.reduce((sum, lng) => sum + lng, 0) / n;
    const latMean = lats.reduce((sum, lat) => sum + lat, 0) / n;
    
    const lngStd = Math.sqrt(lngs.reduce((sum, lng) => sum + Math.pow(lng - lngMean, 2), 0) / n);
    const latStd = Math.sqrt(lats.reduce((sum, lat) => sum + Math.pow(lat - latMean, 2), 0) / n);
    
    const avgStd = (lngStd + latStd) / 2;
    
    // Silverman规则: h = 1.06 * σ * n^(-1/5)
    const silvermannBandwidth = 1.06 * avgStd * Math.pow(n, -1/5);
    
    // 根据数据范围调整 - 缩小带宽以获得更精细的结果
    const maxRange = Math.max(this.bounds.east - this.bounds.west, this.bounds.north - this.bounds.south);
    const adjustedBandwidth = Math.max(
      silvermannBandwidth * this.options.smoothingFactor * 0.8, // 减少20%的平滑
      maxRange * 0.015 // 最小带宽为数据范围的1.5%（从2%减少）
    );
    
    return Math.min(adjustedBandwidth, maxRange * 0.15); // 最大带宽为数据范围的15%（从20%减少）
  }

  /**
   * 生成密度网格
   */
  generateDensityGrid(earthquakes, bandwidth) {
    // 增加基础分辨率
    const baseResolution = this.options.gridResolution;
    
    // 根据数据密度动态调整分辨率
    const dataArea = (this.bounds.east - this.bounds.west) * (this.bounds.north - this.bounds.south);
    const dataDensity = earthquakes.length / dataArea;
    
    // 数据密度越高，使用更高的分辨率
    const densityFactor = Math.max(1, Math.min(2, Math.sqrt(dataDensity * 100)));
    const resolution = Math.round(baseResolution * densityFactor);
    
    // 限制最大分辨率以保证性能
    const finalResolution = Math.min(resolution, 250);
    
    const lngStep = (this.bounds.east - this.bounds.west) / (finalResolution - 1);
    const latStep = (this.bounds.north - this.bounds.south) / (finalResolution - 1);
    
    // 应用网格缩放因子
    const scaledLngStep = lngStep * this.options.cellSizeScale;
    const scaledLatStep = latStep * this.options.cellSizeScale;
    
    const densityGrid = {
      width: finalResolution,
      height: finalResolution,
      bounds: this.bounds,
      data: new Array(finalResolution * finalResolution).fill(0),
      maxDensity: 0,
      cellSize: { lng: scaledLngStep, lat: scaledLatStep },
      originalCellSize: { lng: lngStep, lat: latStep } // 保存原始大小用于计算
    };
    
    console.log('开始计算密度网格，网格大小:', finalResolution, 'x', finalResolution);
    console.log('网格单元大小:', scaledLngStep.toFixed(6), 'x', scaledLatStep.toFixed(6), '度');
    
    // 计算每个网格点的密度
    for (let i = 0; i < finalResolution; i++) {
      for (let j = 0; j < finalResolution; j++) {
        const gridLng = this.bounds.west + i * lngStep;
        const gridLat = this.bounds.south + j * latStep;
        
        // 计算该点的核密度估计值
        let density = 0;
        earthquakes.forEach(eq => {
          const distance = this.calculateDistance(gridLng, gridLat, eq.longitude, eq.latitude);
          
          // 使用选择的核函数
          const kernelValue = this.kernelFunction(distance, bandwidth);
          
          // 应用权重
          density += kernelValue * eq.weight;
        });
        
        const index = j * finalResolution + i;
        densityGrid.data[index] = density;
        densityGrid.maxDensity = Math.max(densityGrid.maxDensity, density);
      }
      
      // 显示进度
      if (i % 20 === 0) {
        console.log(`密度计算进度: ${Math.round((i / finalResolution) * 100)}%`);
      }
    }
    
    console.log('密度网格计算完成，最大密度值:', densityGrid.maxDensity);
    return densityGrid;
  }

  /**
   * 核函数计算
   */
  kernelFunction(distance, bandwidth) {
    switch (this.options.kernelType) {
      case 'gaussian':
        return this.gaussianKernel(distance, bandwidth);
      case 'epanechnikov':
        return this.epanechnikovKernel(distance, bandwidth);
      case 'quartic':
        return this.quarticKernel(distance, bandwidth);
      default:
        return this.gaussianKernel(distance, bandwidth);
    }
  }

  /**
   * 高斯核函数
   */
  gaussianKernel(distance, bandwidth) {
    const u = distance / bandwidth;
    return Math.exp(-0.5 * u * u) / (bandwidth * Math.sqrt(2 * Math.PI));
  }

  /**
   * Epanechnikov核函数
   */
  epanechnikovKernel(distance, bandwidth) {
    const u = distance / bandwidth;
    return u <= 1 ? 0.75 * (1 - u * u) / bandwidth : 0;
  }

  /**
   * Quartic核函数
   */
  quarticKernel(distance, bandwidth) {
    const u = distance / bandwidth;
    return u <= 1 ? (15/16) * Math.pow(1 - u * u, 2) / bandwidth : 0;
  }

  /**
   * 计算两点间距离（度）
   */
  calculateDistance(lng1, lat1, lng2, lat2) {
    const dlng = lng1 - lng2;
    const dlat = lat1 - lat2;
    return Math.sqrt(dlng * dlng + dlat * dlat);
  }

  /**
   * 创建密度可视化
   */
  async createDensityVisualization() {
    if (!this.densityGrid) return;
    
    // 创建数据源
    this.dataSource = new Cesium.CustomDataSource('earthquakeKernelDensity');
    this.viewer.dataSources.add(this.dataSource);
    
    const { width, height, data, maxDensity, bounds, cellSize, originalCellSize } = this.densityGrid;
    
    // 定义密度分级颜色
    const colorLevels = [
      { threshold: 0.1, color: Cesium.Color.BLUE.withAlpha(0.4) },
      { threshold: 0.25, color: Cesium.Color.CYAN.withAlpha(0.5) },
      { threshold: 0.4, color: Cesium.Color.GREEN.withAlpha(0.6) },
      { threshold: 0.55, color: Cesium.Color.YELLOW.withAlpha(0.7) },
      { threshold: 0.7, color: Cesium.Color.ORANGE.withAlpha(0.8) },
      { threshold: 0.85, color: Cesium.Color.RED.withAlpha(0.9) },
      { threshold: 1.0, color: Cesium.Color.DARKRED.withAlpha(0.95) }
    ];
    
    let cellCount = 0;
    
    // 创建密度网格可视化 - 使用缩放后的网格大小
    for (let i = 0; i < width - 1; i++) {
      for (let j = 0; j < height - 1; j++) {
        const density = data[j * width + i];
        
        // 跳过密度过低的网格
        if (density < maxDensity * this.options.densityThreshold) continue;
        
        const normalizedDensity = density / maxDensity;
        
        // 根据密度选择颜色
        const color = this.getColorFromDensity(normalizedDensity, colorLevels);
        
        // 计算网格四个角的坐标 - 使用原始网格步长确保覆盖完整
        const lng1 = bounds.west + i * originalCellSize.lng;
        const lat1 = bounds.south + j * originalCellSize.lat;
        const lng2 = bounds.west + (i + 1) * originalCellSize.lng;
        const lat2 = bounds.south + (j + 1) * originalCellSize.lat;
        
        // 但是使用更小的显示区域来创建细密效果
        const centerLng = (lng1 + lng2) / 2;
        const centerLat = (lat1 + lat2) / 2;
        const halfScaledLng = cellSize.lng / 2;
        const halfScaledLat = cellSize.lat / 2;
        
        // 创建缩放后的网格矩形
        this.dataSource.entities.add({
          id: `density_cell_${i}_${j}`,
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(
              centerLng - halfScaledLng,
              centerLat - halfScaledLat,
              centerLng + halfScaledLng,
              centerLat + halfScaledLat
            ),
            material: color,
            height: 0,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            outline: false
          },
          properties: {
            density: density,
            normalizedDensity: normalizedDensity,
            cellType: 'kernelDensity'
          }
        });
        
        cellCount++;
      }
    }
    
    console.log(`创建了 ${cellCount} 个密度网格单元`);
    
    // 添加密度等值线 - 使用更密集的等值线
    this.addDensityContours();
  }

  /**
   * 根据密度获取颜色
   */
  getColorFromDensity(density, colorLevels) {
    for (let i = 0; i < colorLevels.length; i++) {
      if (density <= colorLevels[i].threshold) {
        if (i === 0) {
          return colorLevels[i].color;
        } else {
          // 在两个颜色之间插值
          const prevLevel = colorLevels[i - 1];
          const currLevel = colorLevels[i];
          const t = (density - prevLevel.threshold) / 
                   (currLevel.threshold - prevLevel.threshold);
          return Cesium.Color.lerp(prevLevel.color, currLevel.color, t, new Cesium.Color());
        }
      }
    }
    return colorLevels[colorLevels.length - 1].color;
  }

  /**
   * 添加密度等值线
   */
  addDensityContours() {
    const { maxDensity } = this.densityGrid;
    
    // 定义更多等值线级别（密度的百分比）
    const contourLevels = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map(level => level * maxDensity);
    
    contourLevels.forEach((level, levelIndex) => {
      const contours = this.extractContours(level);
      
      contours.forEach((contour, contourIndex) => {
        if (contour.length < 3) return;
        
        // 将网格坐标转换为经纬度
        const positions = contour.map(point => 
          Cesium.Cartesian3.fromDegrees(
            this.bounds.west + point.x * this.densityGrid.originalCellSize.lng,
            this.bounds.south + point.y * this.densityGrid.originalCellSize.lat,
            3 // 略高于地面
          )
        );
        
        // 闭合轮廓
        if (positions.length > 0) {
          positions.push(positions[0]);
        }
        
        // 根据等值线级别设置不同的线宽和透明度
        const lineWidth = levelIndex < 3 ? 1.5 : 2.5;
        const alpha = 0.6 + (levelIndex / contourLevels.length) * 0.4;
        
        // 创建等值线
        this.dataSource.entities.add({
          id: `contour_${levelIndex}_${contourIndex}`,
          polyline: {
            positions: positions,
            width: lineWidth,
            material: Cesium.Color.WHITE.withAlpha(alpha),
            clampToGround: true
          },
          properties: {
            contourLevel: level,
            cellType: 'contour'
          }
        });
      });
    });
  }

  /**
   * 提取等值线
   */
  extractContours(level) {
    const { width, height, data } = this.densityGrid;
    const contours = [];
    
    // 简化的等值线提取算法
    for (let i = 0; i < width - 1; i++) {
      for (let j = 0; j < height - 1; j++) {
        const values = [
          data[j * width + i],           // 左下
          data[j * width + i + 1],       // 右下
          data[(j + 1) * width + i + 1], // 右上
          data[(j + 1) * width + i]      // 左上
        ];
        
        // 检查是否有等值线穿过这个网格
        const hasContour = values.some(v => v >= level) && values.some(v => v < level);
        
        if (hasContour) {
          contours.push([{ x: i + 0.5, y: j + 0.5 }]);
        }
      }
    }
    
    return contours;
  }

  /**
   * 飞行到热力图区域
   */
  flyToHeatmap() {
    if (!this.bounds) return;
    
    this.viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(
        this.bounds.west,
        this.bounds.south,
        this.bounds.east,
        this.bounds.north
      ),
      duration: 2.0,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 0)
    });
  }

  /**
   * 移除热力图
   */
  remove() {
    if (this.dataSource) {
      this.viewer.dataSources.remove(this.dataSource);
      this.dataSource = null;
    }
    this.densityGrid = null;
    this.bounds = null;
  }

  /**
   * 清除热力图（别名）
   */
  clear() {
    this.remove();
  }

  /**
   * 获取密度统计信息
   */
  getDensityStats() {
    if (!this.densityGrid) return null;
    
    const { data, maxDensity } = this.densityGrid;
    const validCells = data.filter(d => d > 0);
    
    return {
      maxDensity,
      minDensity: Math.min(...validCells),
      avgDensity: validCells.reduce((sum, d) => sum + d, 0) / validCells.length,
      totalCells: data.length,
      activeCells: validCells.length
    };
  }
}

export default EarthquakeKernelDensityAnalysis;
