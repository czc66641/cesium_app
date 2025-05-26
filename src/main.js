import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// 设置 Cesium Ion 访问令牌
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmMzQ5NjA3Ny1iYzdkLTRhYWQtODhjOS0xMDM5ZDU2MDc5NWYiLCJpZCI6MjkzOTI4LCJpYXQiOjE3NDQ2Mjc0MzJ9.5B7kUdXIlR3RrzCEs58kNEFzEgihL6ezYuCjsU6WvXw';

// 设置Cesium的基础路径
window.CESIUM_BASE_URL = '/node_modules/cesium/Build/Cesium/';

// Excel时间处理相关常量和函数
const excelEpoch = new Date(1900, 0, 1); // Excel的起始日期
const daysSince1900 = 0; // 这里应该是实际的天数值

window.testTimeFormat = (timeInput) => {
  if (typeof timeInput === 'number') {
    // 修正Excel日期序列号转换
    const excelDate = new Date((timeInput - 25569) * 86400 * 1000); // Excel日期转JavaScript日期
    console.log('转换后日期:', excelDate.toISOString());
    return excelDate;
  } else if (typeof timeInput === 'string') {
    console.log('检测到字符串时间:', timeInput);
    const parsedDate = new Date(timeInput);
    console.log('解析后日期:', parsedDate.toISOString());
    return parsedDate;
  }
  
  return null;
};

// 简化的台风可视化工具 - 仅保留基础功能
window.typhoonVisualEnhancer = {
  // 创建简单的台风眼效果
  createTyphoonEye: (viewer, position, intensity) => {
    const eyeRadius = Math.max(10, 50 - intensity * 5);
    const validRadius = Math.max(eyeRadius * 1000, 1000);
    
    return viewer.entities.add({
      position: position,
      ellipse: {
        semiMajorAxis: validRadius,
        semiMinorAxis: validRadius,
        material: new Cesium.ColorMaterialProperty(
          new Cesium.CallbackProperty(() => {
            const time = viewer.clock.currentTime;
            const seconds = Cesium.JulianDate.secondsDifference(time, viewer.clock.startTime || time);
            const alpha = (Math.sin(seconds * 0.5) + 1) * 0.3 + 0.2;
            return Cesium.Color.BLACK.withAlpha(alpha);
          }, false)
        ),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
        height: 0
      }
    });
  },
  
  // 创建简单的降水效果
  createRainfallEffect: (viewer, center, intensity) => {
    const rainEntities = [];
    const particleCount = Math.min(100, intensity * 20); // 减少粒子数量
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 50000; // 50km范围
      
      const rainLng = center.lng + (distance * Math.cos(angle)) / 111000;
      const rainLat = center.lat + (distance * Math.sin(angle)) / 111000;
      
      const rainEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(rainLng, rainLat, Math.random() * 5000),
        point: {
          pixelSize: 2,
          color: Cesium.Color.CYAN.withAlpha(0.6),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      });
      
      rainEntities.push(rainEntity);
    }
    
    return rainEntities;
  }
};

// 创建Vue应用
const app = createApp(App);

// 添加全局错误处理以便于调试
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue应用错误:', err);
  console.error('错误详情:', err.stack || err.message);
  console.error('组件信息:', info);
  console.error('Vue实例:', vm);
};

// 添加全局未捕获的Promise错误处理
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise错误:', event.reason);
  console.error('错误堆栈:', event.reason?.stack);
  event.preventDefault();
});

// 挂载应用
app.mount('#app');

// 在控制台添加调试信息以确认应用正确加载
console.log('应用已启动，Cesium 版本:', Cesium.VERSION);
