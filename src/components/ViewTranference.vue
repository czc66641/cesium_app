<!-- ViewTranference.vue -->
<template>
    <div class="view-control-panel">
      <div class="view-control-title">视角控制</div>
  
      <!-- 视角高度切换 -->
      <div class="view-control-section">
        <div class="view-section-title">高度</div>
        <div class="view-control-buttons">
          <button @click="changeAltitude(5000000)">高空</button>
          <button @click="changeAltitude(1000000)">中空</button>
          <button @click="changeAltitude(100000)">低空</button>
        </div>
      </div>
  
      <!-- 视角类型切换 -->
      <div class="view-control-section">
        <div class="view-section-title">视角</div>
        <div class="view-control-buttons">
          <button @click="changePerspective(0, -90)">正视图</button>
          <button @click="changePerspective(0, -45)">斜视图</button>
          <button @click="changePerspective(0, -20)">地平视图</button>
        </div>
      </div>
  
      <!-- 2D/3D切换 -->
      <div class="view-control-section">
        <div class="view-section-title">模式</div>
        <div class="view-control-buttons">
          <button @click="changeSceneMode(Cesium.SceneMode.SCENE3D)">3D</button>
          <button @click="changeSceneMode(Cesium.SceneMode.SCENE2D)">2D</button>
          <button @click="changeSceneMode(Cesium.SceneMode.COLUMBUS_VIEW)">哥伦布</button>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import { defineComponent } from 'vue';
  import * as Cesium from 'cesium';
  
  export default defineComponent({
    name: 'ViewTranference',
    props: {
      viewer: {
        type: Object,
        required: true,
      },
      currentLocation: {
        type: Object,
        required: true,
      },
    },
    emits: ['update-location'],
    setup(props, { emit }) {
      // 改变高度
      const changeAltitude = (height) => {
        if (!props.viewer) {
          console.error('Viewer is not initialized in changeAltitude');
          return;
        }
  
        const newLocation = {
          ...props.currentLocation,
          height,
        };
  
        emit('update-location', newLocation);
      };
  
      // 改变视角
      const changePerspective = (heading, pitch) => {
        if (!props.viewer) {
          console.error('Viewer is not initialized in changePerspective');
          return;
        }
  
        const newLocation = {
          ...props.currentLocation,
          heading,
          pitch,
        };
  
        emit('update-location', newLocation);
      };
  
      // 改变场景模式
      const changeSceneMode = (sceneMode) => {
        if (!props.viewer) {
          console.error('Viewer is not initialized in changeSceneMode');
          return;
        }
  
        try {
          switch (sceneMode) {
            case Cesium.SceneMode.SCENE3D:
              props.viewer.scene.morphTo3D(2.0);
              break;
            case Cesium.SceneMode.SCENE2D:
              props.viewer.scene.morphTo2D(2.0);
              break;
            case Cesium.SceneMode.COLUMBUS_VIEW:
              props.viewer.scene.morphToColumbusView(2.0);
              break;
          }
        } catch (error) {
          console.error('Error changing scene mode:', error);
        }
      };
  
      return {
        changeAltitude,
        changePerspective,
        changeSceneMode,
        Cesium,
      };
    },
  });
  </script>
  
  <style scoped>
  .view-control-panel {
    position: absolute;
    top: 60px; /* 调整位置，放在导航栏下方 */
    left: 340px; /* 不覆盖文件导入面板 */
    z-index: 1000;
    background-color: rgba(248, 249, 250, 0.95);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    width: 300px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.3s ease;
    cursor: default;
  }
  
  .view-control-title {
    font-weight: bold;
    font-size: 15px;
    margin-bottom: 8px;
    text-align: center;
    border-bottom: 1px solid #ccc;
    padding-bottom: 5px;
  }
  
  .view-control-section {
    margin-bottom: 10px;
  }
  
  .view-section-title {
    font-weight: bold;
    font-size: 14px;
    margin-bottom: 5px;
  }
  
  .view-control-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  
  .view-control-buttons button {
    flex: 1;
    min-width: 70px;
    padding: 5px 8px;
    background-color: rgba(240, 240, 240, 0.8);
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
  }
  
  .view-control-buttons button:hover {
    background-color: rgba(220, 220, 220, 0.95);
  }
  </style>