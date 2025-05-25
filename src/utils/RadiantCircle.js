/**
 * 地震辐射圈效果工具类
 * 参考原始radiant.js实现，用于地震可视化
 */
import * as Cesium from 'cesium';

// 定义辐射圈材质属性类
function EarthquakeRadiantMaterialProperty(options) {
  this._definitionChanged = new Cesium.Event();
  this._color = undefined;
  this._colorSubscription = undefined;
  
  this.color = options.color || new Cesium.Color(1, 0, 0, 1);
  this.duration = Cesium.defaultValue(options.duration, 3000);
  this.count = Cesium.defaultValue(options.count, 3);
  this.gradient = Cesium.defaultValue(options.gradient, 0.5);
  
  // 限制参数范围
  if (this.count <= 0) this.count = 1;
  if (this.gradient < 0) this.gradient = 0;
  if (this.gradient > 1) this.gradient = 1;
  
  this._time = new Date().getTime();
}

// 定义材质属性
Object.defineProperties(EarthquakeRadiantMaterialProperty.prototype, {
  isConstant: {
    get: function () {
      return false;
    },
  },
  definitionChanged: {
    get: function () {
      return this._definitionChanged;
    },
  },
  color: Cesium.createPropertyDescriptor('color'),
  duration: Cesium.createPropertyDescriptor('duration'),
  count: Cesium.createPropertyDescriptor('count'),
  gradient: Cesium.createPropertyDescriptor('gradient'),
});

EarthquakeRadiantMaterialProperty.prototype.getType = function (time) {
  return 'EarthquakeRadiantMaterial';
};

EarthquakeRadiantMaterialProperty.prototype.getValue = function (time, result) {
  if (!Cesium.defined(result)) {
    result = {};
  }
  
  result.color = Cesium.Property.getValueOrClonedDefault(
    this._color,
    time,
    Cesium.Color.WHITE,
    result.color
  );
  result.time = ((new Date().getTime() - this._time) % this.duration) / this.duration;
  result.count = this.count;
  result.gradient = 1 + 10 * (1 - this.gradient);
  
  return result;
};

EarthquakeRadiantMaterialProperty.prototype.equals = function (other) {
  return this === other ||
    (other instanceof EarthquakeRadiantMaterialProperty &&
      Cesium.Property.equals(this._color, other._color));
};

// 定义辐射圈材质
let materialDefined = false;

function defineRadiantMaterial() {
  if (materialDefined) return;
  
  try {
    Cesium.Material.EarthquakeRadiantMaterialType = 'EarthquakeRadiantMaterial';
    Cesium.Material.EarthquakeRadiantSource = `
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        material.diffuse = 1.5 * color.rgb;
        vec2 st = materialInput.st;
        vec3 str = materialInput.str;
        float dis = distance(st, vec2(0.5, 0.5));
        float per = fract(time);
        
        if (abs(str.z) > 0.001) {
          discard;
        }
        if (dis > 0.5) {
          discard;
        } else {
          float perDis = 0.5 / count;
          float disNum;
          float bl = 0.0;
          for (int i = 0; i <= 9; i++) {
            if (float(i) <= count) {
              disNum = perDis * float(i) - dis + per / count;
              if (disNum > 0.0) {
                if (disNum < perDis) {
                  bl = 1.0 - disNum / perDis;
                } else if(disNum - perDis < perDis) {
                  bl = 1.0 - abs(1.0 - disNum / perDis);
                }
                material.alpha = pow(bl, gradient);
              }
            }
          }
        }
        return material;
      }
    `;

    Cesium.Material._materialCache.addMaterial(
      Cesium.Material.EarthquakeRadiantMaterialType,
      {
        fabric: {
          type: Cesium.Material.EarthquakeRadiantMaterialType,
          uniforms: {
            color: new Cesium.Color(1, 0, 0, 1),
            time: 1,
            count: 1,
            gradient: 0.1,
          },
          source: Cesium.Material.EarthquakeRadiantSource,
        },
        translucent: function (material) {
          return true;
        },
      }
    );
    
    materialDefined = true;
    console.log('辐射圈材质已成功定义');
  } catch (error) {
    console.error('定义辐射圈材质失败:', error);
  }
}

/**
 * 辐射圈管理类
 */
class RadiantCircleManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.circles = new Map(); // 存储所有辐射圈
    this.idCounter = 0;
    
    // 确保材质已定义
    defineRadiantMaterial();
  }
  
  /**
   * 创建辐射圈
   * @param {Object} earthquake - 地震数据
   * @param {number} earthquake.longitude - 经度
   * @param {number} earthquake.latitude - 纬度
   * @param {number} earthquake.magnitude - 震级
   * @param {string} earthquake.id - 地震ID
   * @returns {Object|null} 创建的实体或null
   */
  createRadiantCircle(earthquake) {
    if (!this.viewer) {
      console.error('Viewer未初始化');
      return null;
    }
    
    if (!earthquake || earthquake.magnitude < 6.0) {
      return null; // 只为6级以上地震创建辐射圈
    }
    
    try {
      // 生成唯一ID
      const circleId = `radiant_${earthquake.id}_${Date.now()}_${++this.idCounter}`;
      
      // 检查实体是否已存在，如果存在则先删除
      if (this.viewer.entities.getById(circleId)) {
        this.viewer.entities.removeById(circleId);
      }
      
      // 根据震级确定参数
      const magnitude = earthquake.magnitude;
      let radius, duration, color, waveCount;
      
      if (magnitude >= 8.0) {
        radius = 100000; // 100km
        duration = 5000;
        color = new Cesium.Color(0.8, 0, 0, 1); // 深红色
        waveCount = 4;
      } else if (magnitude >= 7.0) {
        radius = 50000; // 50km
        duration = 4000;
        color = new Cesium.Color(1, 0, 0, 1); // 红色
        waveCount = 3;
      } else if (magnitude >= 6.0) {
        radius = 30000; // 30km
        duration = 3000;
        color = new Cesium.Color(1, 0.5, 0, 1); // 橙色
        waveCount = 2;
      } else {
        return null; // 6级以下不创建辐射圈
      }
      
      // 创建辐射圈实体
      const entity = this.viewer.entities.add({
        id: circleId,
        name: `地震辐射圈 M${magnitude.toFixed(1)}`,
        position: Cesium.Cartesian3.fromDegrees(
          earthquake.longitude,
          earthquake.latitude,
          0
        ),
        ellipse: {
          semiMinorAxis: radius,
          semiMajorAxis: radius,
          height: 0,
          material: new EarthquakeRadiantMaterialProperty({
            duration: duration,
            gradient: 0.5,
            color: color,
            count: waveCount,
          }),
          outline: false,
          show: true
        }
      });
      
      // 存储辐射圈信息
      const circleInfo = {
        entity: entity,
        earthquakeId: earthquake.id,
        magnitude: magnitude,
        createdTime: Date.now()
      };
      
      this.circles.set(circleId, circleInfo);
      
      console.log(`已创建辐射圈: ${circleId}, 震级: M${magnitude.toFixed(1)}`);
      return entity;
      
    } catch (error) {
      console.error('创建辐射圈失败:', error);
      return null;
    }
  }
  
  /**
   * 移除指定地震的辐射圈
   * @param {string} earthquakeId - 地震ID
   */
  removeRadiantCircle(earthquakeId) {
    const toRemove = [];
    
    this.circles.forEach((circleInfo, circleId) => {
      if (circleInfo.earthquakeId === earthquakeId) {
        toRemove.push(circleId);
      }
    });
    
    toRemove.forEach(circleId => {
      this.removeById(circleId);
    });
  }
  
  /**
   * 通过ID移除辐射圈
   * @param {string} circleId - 辐射圈ID
   */
  removeById(circleId) {
    const circleInfo = this.circles.get(circleId);
    if (circleInfo) {
      try {
        if (this.viewer.entities.contains(circleInfo.entity)) {
          this.viewer.entities.remove(circleInfo.entity);
        }
        this.circles.delete(circleId);
        console.log(`已移除辐射圈: ${circleId}`);
      } catch (error) {
        console.error(`移除辐射圈失败 ${circleId}:`, error);
      }
    }
  }
  
  /**
   * 清除所有辐射圈
   */
  clearAll() {
    console.log(`开始清除所有辐射圈，当前数量: ${this.circles.size}`);
    
    const circleIds = Array.from(this.circles.keys());
    circleIds.forEach(circleId => {
      this.removeById(circleId);
    });
    
    // 额外安全检查：移除所有以radiant_开头的实体
    const entitiesToRemove = [];
    this.viewer.entities.values.forEach(entity => {
      if (entity.id && entity.id.toString().startsWith('radiant_')) {
        entitiesToRemove.push(entity);
      }
    });
    
    entitiesToRemove.forEach(entity => {
      try {
        this.viewer.entities.remove(entity);
      } catch (error) {
        console.warn('移除遗留辐射圈实体失败:', error);
      }
    });
    
    this.circles.clear();
    console.log('所有辐射圈已清除');
  }
  
  /**
   * 获取当前辐射圈数量
   * @returns {number}
   */
  getCount() {
    return this.circles.size;
  }
  
  /**
   * 获取指定震级范围的辐射圈
   * @param {number} minMagnitude - 最小震级
   * @param {number} maxMagnitude - 最大震级
   * @returns {Array}
   */
  getByMagnitudeRange(minMagnitude, maxMagnitude) {
    const result = [];
    this.circles.forEach((circleInfo, circleId) => {
      if (circleInfo.magnitude >= minMagnitude && circleInfo.magnitude <= maxMagnitude) {
        result.push(circleInfo);
      }
    });
    return result;
  }
  
  /**
   * 设置所有辐射圈的显示状态
   * @param {boolean} show - 是否显示
   */
  setVisible(show) {
    this.circles.forEach((circleInfo) => {
      if (circleInfo.entity && circleInfo.entity.ellipse) {
        circleInfo.entity.ellipse.show = show;
      }
    });
  }
  
  /**
   * 销毁管理器
   */
  destroy() {
    this.clearAll();
    this.viewer = null;
  }
}

export { RadiantCircleManager, EarthquakeRadiantMaterialProperty, defineRadiantMaterial };
