import * as Cesium from 'cesium';

/**
 * Cesium热力图工具类
 * 基于Canvas 2D和WebGL渲染的热力图实现
 */
export class CesiumHeatmap {
  constructor(viewer, options = {}) {
    this.viewer = viewer;
    this.options = {
      // 默认配置
      radius: 50,
      maxOpacity: 0.8,
      minOpacity: 0.0,
      blur: 0.85,
      gradient: {
        0.25: "rgb(0,0,255)",
        0.55: "rgb(0,255,0)", 
        0.85: "rgb(255,255,0)",
        1.0: "rgb(255,0,0)"
      },
      ...options
    };
    
    this.canvas = null;
    this.context = null;
    this.dataSource = null;
    this.entity = null;
    this.bounds = null;
    this.points = [];
  }

  /**
   * 设置热力图数据点
   * @param {Array} points 数据点数组 [{x: lng, y: lat, value: intensity}, ...]
   */
  setData(points) {
    this.points = points || [];
    
    if (this.points.length === 0) {
      console.warn('热力图数据为空');
      return;
    }

    // 计算数据边界
    this.bounds = this.calculateBounds(this.points);
    
    // 生成热力图
    this.generateHeatmap();
  }

  /**
   * 计算数据点边界
   */
  calculateBounds(points) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minValue = Infinity, maxValue = -Infinity;

    points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      minValue = Math.min(minValue, point.value || 0);
      maxValue = Math.max(maxValue, point.value || 0);
    });

    // 添加边距
    const paddingX = (maxX - minX) * 0.1;
    const paddingY = (maxY - minY) * 0.1;

    return {
      west: minX - paddingX,
      east: maxX + paddingX,
      south: minY - paddingY,
      north: maxY + paddingY,
      minValue,
      maxValue
    };
  }

  /**
   * 生成热力图
   */
  generateHeatmap() {
    // 创建Canvas
    this.createCanvas();
    
    // 渲染热力图到Canvas
    this.renderToCanvas();
    
    // 将Canvas添加到Cesium场景
    this.addToScene();
  }

  /**
   * 创建Canvas
   */
  createCanvas() {
    const width = 1024;
    const height = Math.round(width * 
      (this.bounds.north - this.bounds.south) / 
      (this.bounds.east - this.bounds.west)
    );

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.context = this.canvas.getContext('2d');
  }

  /**
   * 渲染热力图到Canvas
   */
  renderToCanvas() {
    const ctx = this.context;
    const { width, height } = this.canvas;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 创建阴影层
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = width;
    shadowCanvas.height = height;
    const shadowCtx = shadowCanvas.getContext('2d');
    
    // 绘制热力点到阴影层
    this.renderPointsToShadow(shadowCtx);
    
    // 颜色化处理
    this.colorize(shadowCtx, ctx);
  }

  /**
   * 将数据点渲染到阴影层
   */
  renderPointsToShadow(shadowCtx) {
    const { width, height } = this.canvas;
    const { bounds } = this;
    
    this.points.forEach(point => {
      // 转换地理坐标到屏幕坐标
      const x = ((point.x - bounds.west) / (bounds.east - bounds.west)) * width;
      const y = height - ((point.y - bounds.south) / (bounds.north - bounds.south)) * height;
      
      // 计算点的强度 (0-1)
      const intensity = (point.value - bounds.minValue) / 
                       (bounds.maxValue - bounds.minValue);
      
      // 绘制径向渐变圆
      this.drawRadialPoint(shadowCtx, x, y, this.options.radius, intensity);
    });
  }

  /**
   * 绘制径向渐变点
   */
  drawRadialPoint(ctx, x, y, radius, intensity) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    
    gradient.addColorStop(0, `rgba(0,0,0,${intensity})`);
    gradient.addColorStop(this.options.blur, `rgba(0,0,0,${intensity * 0.8})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 颜色化处理
   */
  colorize(shadowCtx, targetCtx) {
    const { width, height } = this.canvas;
    
    // 获取阴影层图像数据
    const imageData = shadowCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // 创建调色板
    const palette = this.createPalette();
    
    // 处理每个像素
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]; // 透明度值作为强度
      
      if (alpha > 0) {
        const colorIndex = Math.floor(alpha * (palette.length / 4 - 1)) * 4;
        
        data[i] = palette[colorIndex];     // R
        data[i + 1] = palette[colorIndex + 1]; // G
        data[i + 2] = palette[colorIndex + 2]; // B
        data[i + 3] = this.calculateFinalAlpha(alpha); // A
      }
    }
    
    // 将处理后的图像绘制到目标Canvas
    targetCtx.putImageData(imageData, 0, 0);
  }

  /**
   * 创建调色板
   */
  createPalette() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    
    // 应用渐变色
    Object.keys(this.options.gradient).forEach(stop => {
      gradient.addColorStop(parseFloat(stop), this.options.gradient[stop]);
    });
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);
    
    return ctx.getImageData(0, 0, 256, 1).data;
  }

  /**
   * 计算最终透明度
   */
  calculateFinalAlpha(alpha) {
    const normalizedAlpha = alpha / 255;
    const finalAlpha = this.options.minOpacity + 
                      (this.options.maxOpacity - this.options.minOpacity) * normalizedAlpha;
    return Math.round(finalAlpha * 255);
  }

  /**
   * 将热力图添加到Cesium场景
   */
  addToScene() {
    // 清除现有的热力图
    this.remove();
    
    // 创建数据源
    this.dataSource = new Cesium.CustomDataSource('heatmap');
    this.viewer.dataSources.add(this.dataSource);
    
    // 创建矩形实体来显示热力图
    this.entity = this.dataSource.entities.add({
      id: 'heatmap_entity',
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(
          this.bounds.west,
          this.bounds.south,
          this.bounds.east,
          this.bounds.north
        ),
        material: new Cesium.ImageMaterialProperty({
          image: this.canvas,
          transparent: true
        }),
        height: 0,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    });
    
    console.log('热力图已添加到场景');
  }

  /**
   * 更新热力图配置
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    
    if (this.points.length > 0) {
      this.generateHeatmap();
    }
  }

  /**
   * 飞行到热力图区域
   */
  flyTo(duration = 2.0) {
    if (!this.bounds) return;
    
    this.viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(
        this.bounds.west,
        this.bounds.south,
        this.bounds.east,
        this.bounds.north
      ),
      duration
    });
  }

  /**
   * 移除热力图
   */
  remove() {
    if (this.dataSource) {
      this.viewer.dataSources.remove(this.dataSource);
      this.dataSource = null;
      this.entity = null;
    }
  }

  /**
   * 获取Canvas的Data URL
   */
  getDataURL() {
    return this.canvas ? this.canvas.toDataURL() : null;
  }
}

export default CesiumHeatmap;
