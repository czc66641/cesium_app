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
  console.error('Vue错误:', err);
  console.error('组件:', vm);
  console.error('错误信息:', info);
};

// 挂载应用
app.mount('#app');

// 移除这行代码，因为它可能导致资源加载问题
// Cesium.buildModuleUrl.setBaseUrl('./assets/cesium/');

// 在控制台添加调试信息以确认应用正确加载
console.log('应用已启动，Cesium 版本:', Cesium.VERSION);
