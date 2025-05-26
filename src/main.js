import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// 设置 Cesium Ion 访问令牌
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmMzQ5NjA3Ny1iYzdkLTRhYWQtODhjOS0xMDM5ZDU2MDc5NWYiLCJpZCI6MjkzOTI4LCJpYXQiOjE3NDQ2Mjc0MzJ9.5B7kUdXIlR3RrzCEs58kNEFzEgihL6ezYuCjsU6WvXw';

// 创建并挂载应用
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

// 添加专门的时间解析测试函数（开发时使用）
window.testTimeFormat = (timeInput) => {
  console.log('测试时间格式:', timeInput, '类型:', typeof timeInput);
  
  if (typeof timeInput === 'number') {
    console.log('检测到Excel序列号:', timeInput);
    // Excel序列号转换测试
    const excelEpoch = new Date(1900, 0, 1);
    const daysSince1900 = timeInput - 2;
    const convertedDate = new Date(excelEpoch.getTime() + daysSince1900 * 24 * 60 * 60 * 1000);
    console.log('转换结果:', convertedDate.toISOString());
    console.log('可读格式:', convertedDate.toLocaleString('zh-CN'));
  } else if (typeof timeInput === 'string') {
    console.log('检测到字符串格式');
    const cleaned = timeInput.trim().replace(/\s+/g, ' ');
    console.log('清理后:', cleaned);
    console.log('分割结果:', cleaned.split(' '));
  }
};

// 添加Excel序列号批量测试
window.testExcelDates = () => {
  const testNumbers = [40206.62681712963, 44500, 45000]; // 示例Excel序列号
  testNumbers.forEach(num => {
    console.log('测试序列号:', num);
    window.testTimeFormat(num);
  });
};

// 确保在挂载前设置Cesium基础配置
window.CESIUM_BASE_URL = '/cesium/';

// 挂载应用
app.mount('#app');

// 在控制台添加调试信息以确认应用正确加载
console.log('应用已启动，Cesium 版本:', Cesium.VERSION);
