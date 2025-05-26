<template>
  <div class="typhoon-analysis">
    <div class="section-title">
      <i class="fas fa-hurricane"></i>
      台风分析
    </div>
    
    <!-- 控制面板 -->
    <div class="control-section">
      <h4>台风数据控制</h4>
      <div class="control-buttons">
        <button 
          @click="loadTyphoonData" 
          :disabled="isLoading"
          class="btn-primary"
        >
          <i class="fas fa-download"></i>
          {{ isLoading ? '加载中...' : '加载台风数据' }}
        </button>
        <button 
          @click="clearTyphoon" 
          :disabled="!typhoonLoaded"
          class="btn-danger"
        >
          <i class="fas fa-trash"></i>
          清除台风
        </button>
      </div>
    </div>
    
    <!-- 台风显示控制 -->
    <div class="control-section" v-if="typhoonLoaded">
      <h4>显示控制</h4>
      <div class="control-group">
        <label class="control-option">
          <input type="checkbox" v-model="showOptions.warningLines" @change="toggleWarningLines">
          <span>显示警戒线</span>
        </label>
        <label class="control-option">
          <input type="checkbox" v-model="showOptions.typhoonPath" @change="toggleTyphoonPath">
          <span>显示台风路径</span>
        </label>
        <label class="control-option">
          <input type="checkbox" v-model="showOptions.forecast" @change="toggleForecast">
          <span>显示预测路径</span>
        </label>
        <label class="control-option">
          <input type="checkbox" v-model="showOptions.typhoonEye" @change="toggleTyphoonEye">
          <span>显示台风眼动画</span>
        </label>
        <label class="control-option">
          <input type="checkbox" v-model="showOptions.windCircles" @change="toggleWindCircles">
          <span>显示风圈</span>
        </label>
      </div>
    </div>
    
    <!-- 台风强度图例 -->
    <div class="typhoon-legend" v-if="typhoonLoaded">
      <h4>台风强度等级</h4>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-color" style="background: green;"></span>
          <span>热带低压</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: blue;"></span>
          <span>热带风暴</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: yellow;"></span>
          <span>强热带风暴</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #FBC712;"></span>
          <span>台风</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: red;"></span>
          <span>超强台风</span>
        </div>
      </div>
    </div>
    
    <!-- 状态信息 -->
    <div class="status-info" v-if="statusMessage">
      <div :class="['status-message', statusType]">
        <i :class="statusIcon"></i>
        {{ statusMessage }}
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, reactive, computed, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';

export default defineComponent({
  name: 'TyphoonAnalysis',
  props: {
    viewer: {
      type: Object,
      required: true
    },
    currentLocation: {
      type: Object,
      required: true
    },
    preserveDataOnClose: {
      type: Boolean,
      default: true
    }
  },
  setup(props) {
    // 基础状态
    const isLoading = ref(false);
    const typhoonLoaded = ref(false);
    const statusMessage = ref('');
    const statusType = ref('info');
    
    // 显示选项
    const showOptions = reactive({
      warningLines: true,
      typhoonPath: true,
      forecast: true,
      typhoonEye: true,
      windCircles: true
    });
    
    // 台风数据存储
    let myEntityCollection = null;
    let typhoonInterval = null;
    let tbentity = null;
    let typhoonModel = null; // 添加3D模型引用
    let fengquanLayers = [];
    let iii = 0;
    let currentPointObj = null;
    let typhoonPoints = [];
    
    // 状态图标
    const statusIcon = computed(() => {
      switch (statusType.value) {
        case 'success': return 'fas fa-check-circle';
        case 'error': return 'fas fa-exclamation-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        default: return 'fas fa-info-circle';
      }
    });
    
    // 设置状态信息
    const setStatus = (message, type = 'info', duration = 3000) => {
      statusMessage.value = message;
      statusType.value = type;
      
      if (duration > 0) {
        setTimeout(() => {
          if (statusMessage.value === message) {
            statusMessage.value = '';
          }
        }, duration);
      }
    };
    
    // 初始化警戒线
    const initWarningLines = () => {
      if (!showOptions.warningLines) return;
      
      // 24小时警戒线
      props.viewer.entities.add({
        name: '24小时警戒线',
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([
            127, 34, 127, 22, 119, 18, 119, 11, 113, 4.5, 105, 0
          ]),
          width: 2,
          material: Cesium.Color.RED,
          clampToGround: true,
        }
      });

      // 48小时警戒线
      props.viewer.entities.add({
        name: '48小时警戒线',
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([
            132, 34, 132, 22, 119, 0, 105, 0
          ]),
          width: 2,
          material: Cesium.Color.YELLOW,
          clampToGround: true,
        }
      });

      // 警戒线标签
      props.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(126.129019, 29.104287),
        label: {
          fillColor: Cesium.Color.RED,
          text: '24小时警戒线',
          font: '14pt monospace',
        }
      });

      props.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(132, 20),
        label: {
          fillColor: Cesium.Color.YELLOW,
          text: '48小时警戒线',
          font: '14pt monospace',
        }
      });
    };
    
    // 获取台风强度对应颜色
    const getTyphoonColor = (strong) => {
      switch (strong) {
        case "热带低压": return Cesium.Color.GREEN;
        case "热带风暴": return Cesium.Color.BLUE;
        case "强热带风暴": return Cesium.Color.YELLOW;
        case "台风": return Cesium.Color.fromCssColorString("#FBC712");
        case "强台风": return Cesium.Color.PLUM;
        case "超强台风": return Cesium.Color.RED;
        default: return Cesium.Color.RED;
      }
    };
    
    // 加载台风数据
    const loadTyphoonData = async () => {
      if (!props.viewer) {
        setStatus('Viewer未初始化', 'error');
        return;
      }
      
      isLoading.value = true;
      setStatus('正在加载台风数据...', 'info', 0);
      
      try {
        // 飞行到台风区域
        props.viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(120, 20, 4025692.0)
        });
        
        // 初始化警戒线
        if (showOptions.warningLines) {
          initWarningLines();
        }
        
        // 创建台风数据集合
        myEntityCollection = new Cesium.CustomDataSource("typhoonCollection");
        props.viewer.dataSources.add(myEntityCollection);
        
        // 修复：使用正确的台风数据路径
        let data = null;
        const possiblePaths = [
          '/typhoon.json',
          './typhoon.json',
          'typhoon.json'
        ];
        
        for (const path of possiblePaths) {
          try {
            console.log(`尝试加载台风数据: ${path}`);
            const response = await fetch(path);
            
            if (response.ok) {
              try {
                data = await response.json();
                console.log(`台风数据加载成功: ${path}`, data);
                break;
              } catch (parseError) {
                console.warn(`${path} JSON解析失败:`, parseError.message);
              }
            } else {
              console.warn(`${path} 请求失败，状态码: ${response.status}`);
            }
          } catch (err) {
            console.warn(`无法从 ${path} 加载数据:`, err.message);
          }
        }
        
        // 如果所有路径都失败，使用模拟数据
        if (!data) {
          console.warn('无法加载台风数据文件，使用模拟数据');
          data = generateMockTyphoonData();
        }
        
        typhoonPoints = data.points || data;
        
        if (!typhoonPoints || typhoonPoints.length === 0) {
          throw new Error('台风数据为空或格式错误');
        }
        
        console.log(`加载了 ${typhoonPoints.length} 个台风数据点`);
        
        // 绘制台风路径和历史点
        if (showOptions.typhoonPath) {
          drawTyphoonPath(typhoonPoints);
        }
        
        // 绘制预测路径
        if (showOptions.forecast && typhoonPoints.length > 0) {
          drawForecastPath(typhoonPoints[typhoonPoints.length - 1]);
        }
        
        // 启动台风眼动画（优先使用3D模型）
        if (showOptions.typhoonEye) {
          await initTyphoonEye();
          startTyphoonAnimation(typhoonPoints);
        }
        
        typhoonLoaded.value = true;
        setStatus('台风数据加载完成', 'success');
        
      } catch (error) {
        console.error('加载台风数据失败:', error);
        setStatus(`加载失败: ${error.message}`, 'error');
        
        // 如果加载失败，清理已创建的数据
        if (myEntityCollection) {
          props.viewer.dataSources.remove(myEntityCollection);
          myEntityCollection = null;
        }
      } finally {
        isLoading.value = false;
      }
    };
    
    // 绘制台风路径
    const drawTyphoonPath = (points) => {
      const lineArr = [];
      
      points.forEach(element => {
        const color = getTyphoonColor(element.strong);
        lineArr.push(Number(element.lng));
        lineArr.push(Number(element.lat));
        
        // 添加台风点
        const entity = new Cesium.Entity({
          position: Cesium.Cartesian3.fromDegrees(Number(element.lng), Number(element.lat)),
          point: {
            pixelSize: 5,
            color: color
          },
        });
        
        myEntityCollection.entities.add(entity);
      });
      
      // 添加台风路径线
      props.viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(lineArr),
          width: 3,
          clampToGround: true,
          material: Cesium.Color.RED,
        }
      });
    };
    
    // 添加：生成模拟台风数据
    const generateMockTyphoonData = () => {
      console.log('生成模拟台风数据...');
      
      const mockPoints = [];
      const startLon = 135;
      const startLat = 15;
      const pointCount = 100;
      
      // 台风强度等级
      const intensityLevels = ["热带低压", "热带风暴", "强热带风暴", "台风", "强台风", "超强台风"];
      
      for (let i = 0; i < pointCount; i++) {
        const progress = i / pointCount;
        
        // 模拟台风路径：从东南向西北移动，带有一些弯曲
        const lon = startLon - progress * 20 + Math.sin(progress * Math.PI * 2) * 3;
        const lat = startLat + progress * 15 + Math.cos(progress * Math.PI * 3) * 2;
        
        // 随机强度
        const intensityIndex = Math.floor(Math.random() * intensityLevels.length);
        const strong = intensityLevels[intensityIndex];
        
        // 模拟风速和气压
        const windSpeed = 30 + Math.random() * 100;
        const pressure = 900 + Math.random() * 100;
        
        const point = {
          lng: lon.toFixed(6),
          lat: lat.toFixed(6),
          strong: strong,
          speed: windSpeed.toFixed(1),
          pressure: pressure.toFixed(1),
          time: new Date(Date.now() - (pointCount - i) * 3600000).toISOString(), // 每小时一个点
        };
        
        // 为最后一个点添加预测数据
        if (i === pointCount - 1) {
          point.forecast = [
            {
              name: "中央气象台",
              forecastpoints: [
                { lng: (lon - 2).toFixed(6), lat: (lat + 2).toFixed(6), time: "12小时后" },
                { lng: (lon - 4).toFixed(6), lat: (lat + 4).toFixed(6), time: "24小时后" },
                { lng: (lon - 6).toFixed(6), lat: (lat + 6).toFixed(6), time: "48小时后" },
              ]
            },
            {
              name: "日本气象厅",
              forecastpoints: [
                { lng: (lon - 1.8).toFixed(6), lat: (lat + 2.2).toFixed(6), time: "12小时后" },
                { lng: (lon - 3.8).toFixed(6), lat: (lat + 4.2).toFixed(6), time: "24小时后" },
                { lng: (lon - 5.8).toFixed(6), lat: (lat + 6.2).toFixed(6), time: "48小时后" },
              ]
            }
          ];
        }
        
        mockPoints.push(point);
      }
      
      return { points: mockPoints };
    };
    
    // 修复：绘制预测路径
    const drawForecastPath = (lastPoint) => {
      if (!lastPoint.forecast) {
        console.warn('最后一个台风点没有预测数据');
        return;
      }
      
      const forecast = lastPoint.forecast;
      const colorArr = [
        Cesium.Color.fromCssColorString("#2D12FB"),
        Cesium.Color.fromCssColorString("#15E5E7"),
        Cesium.Color.fromCssColorString("#15E74A"),
        Cesium.Color.fromCssColorString("#E76F15"),
        Cesium.Color.fromCssColorString("#15D9E7"),
      ];
      
      forecast.forEach((ele, ii) => {
        if (!ele.forecastpoints || ele.forecastpoints.length === 0) {
          return;
        }
        
        const lineArr = [];
        
        // 添加起点（当前台风位置）
        lineArr.push(Number(lastPoint.lng));
        lineArr.push(Number(lastPoint.lat));
        
        ele.forecastpoints.forEach((e) => {
          lineArr.push(Number(e.lng));
          lineArr.push(Number(e.lat));
          
          // 添加预测点
          const entity = new Cesium.Entity({
            position: Cesium.Cartesian3.fromDegrees(Number(e.lng), Number(e.lat)),
            point: {
              pixelSize: 8,
              color: colorArr[ii % colorArr.length],
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2
            },
            label: {
              text: e.time || `预测点${ii + 1}`,
              font: '12pt monospace',
              fillColor: colorArr[ii % colorArr.length],
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              pixelOffset: new Cesium.Cartesian2(0, -30),
              showBackground: true,
              backgroundColor: Cesium.Color.BLACK.withAlpha(0.7)
            }
          });
          myEntityCollection.entities.add(entity);
        });
        
        // 添加预测路径线
        if (lineArr.length >= 4) { // 至少需要两个点
          const entity = props.viewer.entities.add({
            name: `预测路径-${ele.name || '机构' + (ii + 1)}`,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(lineArr),
              width: 3,
              clampToGround: true,
              material: new Cesium.PolylineDashMaterialProperty({
                color: colorArr[ii % colorArr.length],
                dashLength: 16
              }),
            }
          });
          myEntityCollection.entities.add(entity);
        }
      });
    };
    
    // 修复：初始化台风眼（优先使用3D模型）
    const initTyphoonEye = async () => {
      try {
        // 首先尝试加载3D模型
        console.log('尝试加载台风3D模型...');
        
        const modelPaths = [
          '/data/harricane_typhoon_weather_map.glb',
          './data/harricane_typhoon_weather_map.glb',
          'data/harricane_typhoon_weather_map.glb'
        ];
        
        let modelLoaded = false;
        
        for (const modelPath of modelPaths) {
          try {
            console.log(`尝试加载模型: ${modelPath}`);
            
            // 测试模型文件是否存在
            const response = await fetch(modelPath, { method: 'HEAD' });
            if (response.ok) {
              // 创建3D模型实体
              typhoonModel = props.viewer.entities.add({
                name: '台风3D模型',
                position: Cesium.Cartesian3.fromDegrees(120, 20, 10000),
                model: {
                  uri: modelPath,
                  minimumPixelSize: 64,
                  maximumScale: 50000,
                  scale: 1000,
                  show: true,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                }
              });
              
              console.log('台风3D模型加载成功');
              modelLoaded = true;
              break;
            }
          } catch (modelError) {
            console.warn(`模型 ${modelPath} 加载失败:`, modelError.message);
          }
        }
        
        // 如果3D模型加载失败，使用GIF动画作为备用
        if (!modelLoaded) {
          console.log('3D模型加载失败，使用GIF动画作为备用');
          
          return new Promise((resolve) => {
            const div = document.createElement("div");
            const img = document.createElement("img");
            div.appendChild(img);
            
            // 尝试多个可能的图片路径
            const imagePaths = [
              '/images/tf.gif',
              './images/tf.gif',
              'images/tf.gif',
              '/data/tf.gif'
            ];
            
            let imageIndex = 0;
            
            const tryNextImage = () => {
              if (imageIndex < imagePaths.length) {
                img.src = imagePaths[imageIndex];
                imageIndex++;
              } else {
                // 所有图片路径都失败，使用简单的圆形标记
                console.warn('台风图片加载失败，使用简单标记');
                tbentity = props.viewer.entities.add({
                  position: Cesium.Cartesian3.fromDegrees(120, 20, 1000),
                  ellipse: {
                    semiMinorAxis: 50000,
                    semiMajorAxis: 50000,
                    material: Cesium.Color.RED.withAlpha(0.5),
                    outline: true,
                    outlineColor: Cesium.Color.RED
                  }
                });
                resolve(tbentity);
              }
            };
            
            img.onload = () => {
              tbentity = props.viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(120, 20, 1000),
                billboard: {
                  image: img.src,
                  scale: 0.1,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                },
              });
              resolve(tbentity);
            };
            
            img.onerror = () => {
              console.warn(`台风图片加载失败: ${img.src}`);
              tryNextImage();
            };
            
            tryNextImage();
          });
        }
        
        return typhoonModel || tbentity;
        
      } catch (error) {
        console.error('台风眼初始化失败:', error);
        
        // 最后的备用方案：简单的圆形标记
        tbentity = props.viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(120, 20, 1000),
          ellipse: {
            semiMinorAxis: 50000,
            semiMajorAxis: 50000,
            material: Cesium.Color.RED.withAlpha(0.5),
            outline: true,
            outlineColor: Cesium.Color.RED
          }
        });
        
        return tbentity;
      }
    };
    
    // 修复：启动台风动画（支持3D模型）
    const startTyphoonAnimation = (data) => {
      typhoonInterval = setInterval(() => {
        const kkk = iii * 2;
        currentPointObj = {
          lon: Number(data[iii].lng),
          lat: Number(data[iii].lat),
          circle7: {
            radius1: 350 - kkk,
            radius2: 450 - kkk,
            radius3: 400 - kkk,
            radius4: 350 - kkk,
          },
          circle10: {
            radius1: 250 - kkk,
            radius2: 270 - kkk,
            radius3: 250 - kkk,
            radius4: 220 - kkk,
          },
          circle12: {
            radius1: 170 - kkk,
            radius2: 150 - kkk,
            radius3: 150 - kkk,
            radius4: 170 - kkk,
          }
        };
        
        const newPosition = Cesium.Cartesian3.fromDegrees(
          Number(data[iii].lng), 
          Number(data[iii].lat),
          10000 // 台风模型高度
        );
        
        // 更新3D模型或GIF动画位置
        if (typhoonModel) {
          typhoonModel.position = newPosition;
        } else if (tbentity) {
          tbentity.position = newPosition;
        }
        
        if (iii > data.length - 1) {
          iii = 0;
        } else {
          iii = iii + 1;
        }
        
        if (showOptions.windCircles) {
          removeWindCircles();
          addWindCircles();
        }
      }, 200);
    };
    
    // 移除风圈
    const removeWindCircles = () => {
      fengquanLayers.forEach(layer => {
        props.viewer.entities.remove(layer);
      });
      fengquanLayers = [];
    };
    
    // 添加风圈
    const addWindCircles = () => {
      const circles = ["circle7", "circle10", "circle12"];
      circles.forEach(item => {
        const entity = props.viewer.entities.add({
          id: `tf_polygon_${item}`,
          name: `tf_polygon_${item}`,
          polygon: {
            hierarchy: new Cesium.CallbackProperty(() => {
              let points = [];
              if (currentPointObj && currentPointObj[item]) {
                points = getTyphoonPolygonPoints(currentPointObj, item);
              }
              return new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(points));
            }, false),
            material: Cesium.Color.ORANGE.withAlpha(0.05),
            extrudedHeight: 1000,
            outline: true,
            outlineColor: Cesium.Color.ORANGE,
            outlineWidth: 2,
          }
        });
        fengquanLayers.push(entity);
      });
    };
    
    // 获取台风圈坐标点
    const getTyphoonPolygonPoints = (pointObj, cNum) => {
      const points = [];
      const center = [pointObj.lon * 1, pointObj.lat * 1];
      const radiusList = [
        pointObj[cNum]['radius1'],
        pointObj[cNum]['radius2'],
        pointObj[cNum]['radius3'],
        pointObj[cNum]['radius4'],
      ];
      
      const startAngleList = [0, 90, 180, 270];
      let fx, fy;
      
      startAngleList.forEach((startAngle, index) => {
        const radius = radiusList[index] / 100;
        const pointNum = 90;
        const endAngle = startAngle + 90;
        
        for (let i = 0; i <= pointNum; i++) {
          const angle = startAngle + ((endAngle - startAngle) * i) / pointNum;
          const sin = Math.sin((angle * Math.PI) / 180);
          const cos = Math.cos((angle * Math.PI) / 180);
          const x = center[0] + radius * sin;
          const y = center[1] + radius * cos;
          points.push(x, y);
          
          if (startAngle === 0 && i === 0) {
            fx = x;
            fy = y;
          }
        }
      });
      
      points.push(fx, fy);
      return points;
    };
    
    // 清除台风数据
    const clearTyphoon = () => {
      // 清除风圈
      removeWindCircles();
      
      // 清除数据集合
      if (myEntityCollection) {
        props.viewer.dataSources.remove(myEntityCollection);
        myEntityCollection = null;
      }
      
      // 清除动画
      if (typhoonInterval) {
        clearInterval(typhoonInterval);
        typhoonInterval = null;
      }
      
      // 清除台风眼（包括3D模型）
      if (typhoonModel) {
        props.viewer.entities.remove(typhoonModel);
        typhoonModel = null;
      }
      
      if (tbentity) {
        props.viewer.entities.remove(tbentity);
        tbentity = null;
      }
      
      // 清除警戒线
      const entities = props.viewer.entities.values;
      for (let i = entities.length - 1; i >= 0; i--) {
        const entity = entities[i];
        if (entity.name && (
          entity.name.includes('警戒线') || 
          entity.name.includes('24') || 
          entity.name.includes('48')
        )) {
          props.viewer.entities.remove(entity);
        }
      }
      
      iii = 0;
      typhoonLoaded.value = false;
      setStatus('台风数据已清除', 'success');
    };
    
    // 切换控制函数
    const toggleWarningLines = () => {
      console.log('切换警戒线显示:', showOptions.warningLines);
    };
    
    const toggleTyphoonPath = () => {
      console.log('切换台风路径显示:', showOptions.typhoonPath);
    };
    
    const toggleForecast = () => {
      console.log('切换预测路径显示:', showOptions.forecast);
    };
    
    const toggleTyphoonEye = () => {
      console.log('切换台风眼显示:', showOptions.typhoonEye);
    };
    
    const toggleWindCircles = () => {
      console.log('切换风圈显示:', showOptions.windCircles);
      if (!showOptions.windCircles) {
        removeWindCircles();
      }
    };
    
    // 组件销毁时清理
    onBeforeUnmount(() => {
      if (!props.preserveDataOnClose) {
        clearTyphoon();
      }
    });
    
    return {
      // 状态
      isLoading,
      typhoonLoaded,
      statusMessage,
      statusType,
      statusIcon,
      showOptions,
      
      // 方法
      loadTyphoonData,
      clearTyphoon,
      toggleWarningLines,
      toggleTyphoonPath,
      toggleForecast,
      toggleTyphoonEye,
      toggleWindCircles
    };
  }
});
</script>

<style scoped>
.typhoon-analysis {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  max-height: 600px;
  overflow-y: auto;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-section {
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.control-section h4 {
  margin: 0 0 15px 0;
  color: #555;
  font-size: 14px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.control-buttons {
  display: flex;
  gap: 10px;
}

.control-buttons button {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-danger:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.control-option input[type="checkbox"] {
  margin: 0;
}

.typhoon-legend {
  padding: 15px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  margin-bottom: 20px;
}

.typhoon-legend h4 {
  margin: 0 0 15px 0;
  color: #555;
  font-size: 14px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid #ccc;
}

.status-info {
  margin-top: 15px;
}

.status-message {
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f1b0b7;
}
</style>
