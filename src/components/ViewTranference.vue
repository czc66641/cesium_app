<!-- ViewTranference.vue -->
<template>
  <div class="view-control-panel">
    <div class="panel-header">
      <h3>视角控制</h3>
    </div>
    
    <!-- 高度控制 -->
    <div class="control-group">
      <label>视角高度:</label>
      <div class="button-group">
        <button @click="changeAltitude(1000)">1km</button>
        <button @click="changeAltitude(5000)">5km</button>
        <button @click="changeAltitude(10000)">10km</button>
        <button @click="changeAltitude(50000)">50km</button>
      </div>
    </div>
    
    <!-- 视角控制 -->
    <div class="control-group">
      <label>视角方向:</label>
      <div class="button-group">
        <button @click="changePerspective(0, -90)">俯视</button>
        <button @click="changePerspective(0, -45)">倾斜</button>
        <button @click="changePerspective(0, 0)">水平</button>
      </div>
    </div>
    
    <!-- 场景模式 -->
    <div class="control-group">
      <label>场景模式:</label>
      <div class="button-group">
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
  top: 60px;
  left: 340px;
  z-index: 1000;
  background-color: rgba(248, 249, 250, 0.95);
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  min-width: 200px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.panel-header h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.control-group {
  margin-bottom: 15px;
}

.control-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  font-size: 14px;
  color: #555;
}

.button-group {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.button-group button {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  background-color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.button-group button:hover {
  background-color: #f0f0f0;
  border-color: #bbb;
}

.button-group button:active {
  background-color: #e0e0e0;
}
</style>