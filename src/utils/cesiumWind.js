/*!
 * Wind visualization for Cesium
 * Based on cesium-wind by QJvic
 */

import * as Cesium from "cesium";

// 默认风场配置
const defaultOptions = {
  globalAlpha: 0.9,
  lineWidth: 1,
  colorScale: "#fff",
  velocityScale: 1 / 25,
  maxAge: 90,
  paths: 800,
  frameRate: 20,
  useCoordsDraw: true,
  gpet: true,
};

// 工具函数
function isArray(obj) {
  return Object.prototype.toString.call(obj) === "[object Array]";
}

function isFunction(obj) {
  return typeof obj === "function";
}

function isNumber(obj) {
  return typeof obj === "number";
}

function isString(obj) {
  return typeof obj === "string";
}

function isValide(val) {
  return val !== undefined && val !== null && !isNaN(val);
}

function floorMod(a, n) {
  return a - n * Math.floor(a / n);
}

function assign(target, ...sources) {
  sources.forEach(source => {
    if (source) {
      Object.keys(source).forEach(key => {
        target[key] = source[key];
      });
    }
  });
  return target;
}

// WindField 类
class WindField {
  constructor(options) {
    this.grid = options.grid;
    this.xmin = options.xmin;
    this.xmax = options.xmax;
    this.ymin = options.ymin;
    this.ymax = options.ymax;
    this.cols = options.cols;
    this.rows = options.rows;
    this.dx = options.dx;
    this.dy = options.dy;
    this.range = options.range;
    this.scanMode = options.scanMode || 0;
  }

  getWind(lon, lat) {
    if (lon < this.xmin || lon > this.xmax || lat < this.ymin || lat > this.ymax) {
      return null;
    }

    const i = Math.floor((lon - this.xmin) / this.dx);
    const j = Math.floor((this.ymax - lat) / this.dy);

    if (i < 0 || i >= this.cols || j < 0 || j >= this.rows) {
      return null;
    }

    const index = j * this.cols + i;
    const windData = this.grid[index];

    if (windData && windData.u !== undefined && windData.v !== undefined) {
      return {
        u: windData.u,
        v: windData.v,
        speed: Math.sqrt(windData.u * windData.u + windData.v * windData.v)
      };
    }

    return null;
  }

  contains(lon, lat) {
    return lon >= this.xmin && lon <= this.xmax && lat >= this.ymin && lat <= this.ymax;
  }
}

// CesiumWind主类
export class CesiumWind {
  constructor(data, options) {
    this.options = options.windOptions;
    this.viewer = null;
    this.canvas = null;
    this.ctx = null;
    this.field = null;
    this.particles = [];
    this.animationFrame = null;
    this.isAnimating = false;
    this._then = Date.now();
    
    // 绑定方法到实例
    this.render = this.render.bind(this);
    this.animate = this.animate.bind(this);
    this.prerender = this.prerender.bind(this);
    
    console.log('CesiumWind初始化，配置:', this.options);
    
    try {
      this.field = this._parseWindJSON(data);
      console.log('风场数据解析成功:', this.field);
    } catch (error) {
      console.error('风场数据解析失败:', error);
      throw error;
    }
  }

  _parseWindJSON(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('无效的风场数据格式');
    }

    console.log('解析风场数据，数据长度:', data.length);

    // 查找U分量数据（经向风速）
    const uComponent = data.find(record => 
      record.header && 
      record.header.parameterCategory === 2 && 
      record.header.parameterNumber === 2
    );
    
    // 查找V分量数据（纬向风速）
    const vComponent = data.find(record => 
      record.header && 
      record.header.parameterCategory === 2 && 
      record.header.parameterNumber === 3
    );

    // 如果没有找到标准的风速分量，创建模拟风场数据
    if (!uComponent || !vComponent) {
      console.warn('未找到U或V风速分量，将基于现有数据创建模拟风场');
      return this._createMockWindField(data[0]);
    }

    console.log('找到U分量:', uComponent.header.parameterNumberName);
    console.log('找到V分量:', vComponent.header.parameterNumberName);

    return this._processWindComponents(uComponent, vComponent);
  }

  _createMockWindField(sampleData) {
    console.log('创建模拟风场数据...');
    
    const header = sampleData.header;
    const cols = header.nx;
    const rows = header.ny;
    
    let xmin = header.lo1;
    let xmax = header.lo2;
    let ymin = header.la2;
    let ymax = header.la1;
    
    if (ymin > ymax) {
      const temp = ymin;
      ymin = ymax;
      ymax = temp;
    }
    
    const dx = header.dx;
    const dy = header.dy;
    
    const grid = [];
    let minSpeed = 0;
    let maxSpeed = 25;
    
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const lon = xmin + i * dx;
        const lat = ymax - j * dy;
        
        const westerly = 8 + 12 * Math.sin((lat - 30) * Math.PI / 180);
        const monsoon = 5 * Math.sin(2 * lon * Math.PI / 180) * Math.cos(lat * Math.PI / 180);
        const localCirculation = 3 * Math.cos(3 * lon * Math.PI / 180) * Math.sin(2 * lat * Math.PI / 180);
        const turbulence = (Math.random() - 0.5) * 4;
        
        const u = westerly + monsoon + turbulence;
        const v = localCirculation + (Math.random() - 0.5) * 6;
        
        const index = j * cols + i;
        grid[index] = { u, v };
      }
    }
    
    return new WindField({
      grid,
      xmin,
      xmax,
      ymin,
      ymax,
      cols,
      rows,
      dx,
      dy,
      range: [minSpeed, maxSpeed],
      scanMode: header.scanMode || 0
    });
  }

  _processWindComponents(uComponent, vComponent) {
    const header = uComponent.header;
    const cols = header.nx;
    const rows = header.ny;
    
    let xmin = header.lo1;
    let xmax = header.lo2;
    let ymin = header.la2;
    let ymax = header.la1;
    
    if (ymin > ymax) {
      const temp = ymin;
      ymin = ymax;
      ymax = temp;
    }
    
    const dx = header.dx;
    const dy = header.dy;

    const grid = [];
    let minSpeed = Infinity;
    let maxSpeed = -Infinity;
    let validPoints = 0;

    for (let i = 0; i < Math.min(uComponent.data.length, vComponent.data.length); i++) {
      const u = uComponent.data[i];
      const v = vComponent.data[i];
      
      if (u !== null && v !== null && !isNaN(u) && !isNaN(v)) {
        const speed = Math.sqrt(u * u + v * v);
        minSpeed = Math.min(minSpeed, speed);
        maxSpeed = Math.max(maxSpeed, speed);
        grid[i] = { u, v };
        validPoints++;
      } else {
        grid[i] = null;
      }
    }

    if (validPoints === 0) {
      throw new Error('没有找到有效的风速数据');
    }

    return new WindField({
      grid,
      xmin,
      xmax,
      ymin,
      ymax,
      cols,
      rows,
      dx,
      dy,
      range: [minSpeed, maxSpeed],
      scanMode: header.scanMode || 0
    });
  }

  addTo(viewer) {
    try {
      console.log('开始添加风场图层到viewer');
      this.viewer = viewer;
      
      this.createCanvas();
      this.appendCanvas();
      this.initParticles();
      this.startAnimation();
      
      console.log('风场图层添加成功');
    } catch (error) {
      console.error('添加风场图层失败:', error);
      throw error;
    }
  }

  createCanvas() {
    if (this.canvas) {
      console.log('画布已存在，跳过创建');
      return;
    }
    
    this.canvas = document.createElement("canvas");
    this.canvas.className = "cesium-wind-j";
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0px";
    this.canvas.style.left = "0px";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "1";
    
    this.ctx = this.canvas.getContext("2d");
    
    if (!this.ctx) {
      throw new Error('无法获取2D渲染上下文');
    }
    
    console.log('风场画布创建成功');
  }

  appendCanvas() {
    if (!this.viewer || !this.canvas) {
      throw new Error('viewer或canvas未初始化');
    }
    
    const existingCanvas = document.querySelector(".cesium-wind-j");
    if (existingCanvas && existingCanvas !== this.canvas) {
      console.log('风场画布已存在，移除旧画布');
      existingCanvas.remove();
    }
    
    this.adjustSize();
    
    try {
      const cesiumContainer = this.viewer.container;
      const cesiumWidget = cesiumContainer.querySelector('.cesium-widget') || cesiumContainer;
      cesiumWidget.appendChild(this.canvas);
      console.log('风场画布已添加到Cesium容器');
    } catch (error) {
      console.error('添加风场画布失败:', error);
      throw error;
    }
  }

  adjustSize() {
    if (!this.viewer || !this.viewer.canvas || !this.canvas) {
      console.warn('调整画布尺寸失败：缺少必要的元素');
      return;
    }
    
    const { width, height } = this.viewer.canvas;
    
    // 不使用devicePixelRatio缩放，避免坐标偏移
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";
    
    // 重置变换矩阵，确保坐标系统一致
    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  initParticles() {
    console.log('开始初始化粒子...');
    this.particles = [];
    
    if (!this.field) {
      console.warn('风场数据未加载，无法初始化粒子');
      return;
    }
    
    const particleCount = this.options.paths || 1000;
    console.log(`初始化${particleCount}个粒子`);
    
    for (let i = 0; i < particleCount; i++) {
      this.particles.push(this.randomizeParticle({}));
    }
    
    console.log(`粒子初始化完成，共${this.particles.length}个粒子`);
  }

  randomizeParticle(particle) {
    if (!this.field) return particle;
    
    const lon = Math.random() * (this.field.xmax - this.field.xmin) + this.field.xmin;
    const lat = Math.random() * (this.field.ymax - this.field.ymin) + this.field.ymin;
    
    particle.x = lon;
    particle.y = lat;
    particle.age = Math.floor(Math.random() * this.options.maxAge);
    particle.xt = lon;
    particle.yt = lat;
    particle.m = 0;
    
    return particle;
  }

  startAnimation() {
    if (this.isAnimating) {
      console.log('动画已在运行');
      return;
    }
    
    console.log('开始风场动画');
    this.isAnimating = true;
    this._then = Date.now();
    
    if (this.viewer && this.viewer.scene) {
      this.viewer.scene.preRender.addEventListener(this.prerender);
    }
    
    this.animate();
  }

  prerender() {
    if (this.isAnimating && this.canvas && this.viewer) {
      this.adjustSize();
    }
  }

  animate() {
    if (!this.isAnimating) return;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.animationFrame = requestAnimationFrame(this.animate);
    
    const now = Date.now();
    const delta = now - this._then;
    
    if (delta > this.options.frameRate) {
      this._then = now - (delta % this.options.frameRate);
      
      try {
        this.updateParticles();
        this.render();
      } catch (error) {
        console.error('动画更新出错:', error);
      }
    }
  }

  updateParticles() {
    if (!this.field || !this.particles) return;
    
    const velocityScale = this.options.velocityScale || 0.01;
    
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      
      if (particle.age > this.options.maxAge) {
        this.randomizeParticle(particle);
        continue;
      }
      
      const wind = this.field.getWind(particle.x, particle.y);
      if (wind) {
        const deltaLon = (wind.u * velocityScale) / Math.cos(particle.y * Math.PI / 180);
        const deltaLat = wind.v * velocityScale;
        
        particle.xt = particle.x + deltaLon;
        particle.yt = particle.y + deltaLat;
        
        if (particle.xt < this.field.xmin || particle.xt > this.field.xmax ||
            particle.yt < this.field.ymin || particle.yt > this.field.ymax) {
          this.randomizeParticle(particle);
        } else {
          particle.m = Math.sqrt(wind.u * wind.u + wind.v * wind.v);
        }
      } else {
        this.randomizeParticle(particle);
      }
      
      particle.age++;
    }
  }

  render() {
    if (!this.ctx || !this.canvas || !this.viewer) {
      return;
    }
    
    try {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.globalAlpha = this.options.globalAlpha || 0.9;
      this.drawParticles();
    } catch (error) {
      console.error('渲染出错:', error);
    }
  }

  drawParticles() {
    if (!this.particles || this.particles.length === 0 || !this.viewer) return;
    
    this.ctx.lineWidth = this.options.lineWidth || 1;
    this.ctx.globalCompositeOperation = 'source-over';
    
    let min = 0, max = 10;
    if (this.field && this.field.range) {
      [min, max] = this.field.range;
    }
    
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      
      if (particle.age <= this.options.maxAge && 
          particle.xt !== undefined && particle.yt !== undefined) {
        this.drawGeographicParticle(particle, min, max);
      }
    }
  }

  drawGeographicParticle(particle, min, max) {
    if (!particle || particle.age > this.options.maxAge) return;
    
    const viewer = this.viewer;
    if (!viewer || !viewer.camera || !viewer.scene) return;
    
    try {
      if (!isFinite(particle.x) || !isFinite(particle.y) || 
          !isFinite(particle.xt) || !isFinite(particle.yt)) {
        return;
      }
      
      const currentPos = Cesium.Cartesian3.fromDegrees(particle.x, particle.y, 0);
      const targetPos = Cesium.Cartesian3.fromDegrees(particle.xt, particle.yt, 0);
      
      const currentScreen = viewer.scene.cartesianToCanvasCoordinates(currentPos);
      const targetScreen = viewer.scene.cartesianToCanvasCoordinates(targetPos);
      
      if (!currentScreen || !targetScreen) {
        return;
      }
      
      if (!isFinite(currentScreen.x) || !isFinite(currentScreen.y) ||
          !isFinite(targetScreen.x) || !isFinite(targetScreen.y)) {
        return;
      }
      
      const canvas = this.canvas;
      const margin = 50;
      
      if (currentScreen.x >= -margin && currentScreen.x <= canvas.width + margin &&
          currentScreen.y >= -margin && currentScreen.y <= canvas.height + margin) {
        
        this.ctx.beginPath();
        this.ctx.moveTo(currentScreen.x, currentScreen.y);
        this.ctx.lineTo(targetScreen.x, targetScreen.y);
        
        if (Array.isArray(this.options.colorScale) && particle.m !== undefined) {
          const normalizedSpeed = Math.max(0, Math.min(1, (particle.m - min) / (max - min)));
          const colorIdx = Math.floor(normalizedSpeed * (this.options.colorScale.length - 1));
          const safeIdx = Math.max(0, Math.min(colorIdx, this.options.colorScale.length - 1));
          this.ctx.strokeStyle = this.options.colorScale[safeIdx] || '#ffffff';
        } else {
          this.ctx.strokeStyle = this.options.colorScale || '#ffffff';
        }
        
        this.ctx.stroke();
      }
      
      particle.x = particle.xt;
      particle.y = particle.yt;
      
    } catch (error) {
      console.warn('绘制地理粒子失败:', error);
    }
  }

  remove() {
    console.log('开始移除风场图层');
    
    this.isAnimating = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.viewer && this.viewer.scene && this.prerender) {
      this.viewer.scene.preRender.removeEventListener(this.prerender);
    }
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.viewer = null;
    
    console.log('风场图层移除完成');
  }

  getData() {
    return this.field;
  }
}
