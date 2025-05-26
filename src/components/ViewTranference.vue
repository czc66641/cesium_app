<!-- ViewTranference.vue -->
<template>
  <div class="view-transference-panel">
    <div class="section-title">视角控制</div>
    
    <!-- 高度控制 -->
    <div class="input-group">
      <label>相机高度 (米):</label>
      <input type="number" v-model.number="height" @change="changeAltitude(height)" />
    </div>
    
    <!-- 视角控制 -->
    <div class="input-group">
      <label>方向角 (度):</label>
      <input type="number" v-model.number="heading" @change="changePerspective(heading, pitch)" />
    </div>
    
    <div class="input-group">
      <label>俯仰角 (度):</label>
      <input type="number" v-model.number="pitch" @change="changePerspective(heading, pitch)" />
    </div>
    
    <!-- 场景模式控制 -->
    <div class="input-group">
      <label>场景模式:</label>
      <select v-model="sceneMode" @change="changeSceneMode(sceneMode)">
        <option :value="Cesium.SceneMode.SCENE3D">3D模式</option>
        <option :value="Cesium.SceneMode.SCENE2D">2D模式</option>
        <option :value="Cesium.SceneMode.COLUMBUS_VIEW">哥伦布视图</option>
      </select>
    </div>
    
    <!-- 相机飞行控制 -->
    <div class="input-group">
      <label>快速定位:</label>
      <div class="location-buttons">
        <button @click="flyToBeijing" class="location-btn">北京</button>
        <button @click="flyToShanghai" class="location-btn">上海</button>
        <button @click="flyToGuangzhou" class="location-btn">广州</button>
        <button @click="flyToShenzhen" class="location-btn">深圳</button>
      </div>
    </div>

    <!-- 相机操作按钮 -->
    <div class="input-group">
      <div class="camera-controls">
        <button @click="saveCurrentView" class="control-btn">保存视角</button>
        <button @click="restoreSavedView" class="control-btn" :disabled="!savedView">恢复视角</button>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, watch } from 'vue';
import * as Cesium from 'cesium';

export default defineComponent({
  name: 'ViewTranference',
  props: {
    viewer: {
      type: Object,
      required: true
    },
    currentLocation: {
      type: Object,
      required: true
    }
  },
  emits: ['update-location'],
  setup(props, { emit }) {
    const height = ref(15000000);
    const heading = ref(0);
    const pitch = ref(-90);
    const sceneMode = ref(Cesium.SceneMode.SCENE3D);
    const savedView = ref(null);

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
        console.error('切换场景模式失败:', error);
      }
    };

    // 快速定位函数
    const flyToLocation = (longitude, latitude, height = 1000000, duration = 3.0) => {
      if (!props.viewer) return;
      
      props.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0
        },
        duration: duration
      });
    };

    const flyToBeijing = () => flyToLocation(116.4074, 39.9042);
    const flyToShanghai = () => flyToLocation(121.4737, 31.2304);
    const flyToGuangzhou = () => flyToLocation(113.2644, 23.1291);
    const flyToShenzhen = () => flyToLocation(114.0579, 22.5431);

    // 保存当前视角
    const saveCurrentView = () => {
      if (!props.viewer) return;
      
      const camera = props.viewer.camera;
      savedView.value = {
        position: camera.position.clone(),
        heading: camera.heading,
        pitch: camera.pitch,
        roll: camera.roll
      };
      console.log('当前视角已保存');
    };

    // 恢复保存的视角
    const restoreSavedView = () => {
      if (!props.viewer || !savedView.value) return;
      
      props.viewer.camera.setView({
        destination: savedView.value.position,
        orientation: {
          heading: savedView.value.heading,
          pitch: savedView.value.pitch,
          roll: savedView.value.roll
        }
      });
      console.log('视角已恢复');
    };

    // 监听当前位置变化
    watch(() => props.currentLocation, (newLocation) => {
      if (newLocation) {
        height.value = newLocation.height;
        heading.value = newLocation.heading;
        pitch.value = newLocation.pitch;
      }
    }, { immediate: true });

    return {
      height,
      heading,
      pitch,
      sceneMode,
      savedView,
      changeAltitude,
      changePerspective,
      changeSceneMode,
      flyToBeijing,
      flyToShanghai,
      flyToGuangzhou,
      flyToShenzhen,
      saveCurrentView,
      restoreSavedView,
      Cesium
    };
  }
});
</script>

<style scoped>
.view-transference-panel {
  position: absolute;
  top: 60px;
  left: 330px; /* 调整位置，避免与图层管理器重叠 */
  width: 280px;
  background: rgba(42, 42, 42, 0.9);
  border-radius: 8px;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 999; /* 确保层级低于图层管理器 */
}

.section-title {
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 15px;
  color: #fff;
  text-align: center;
  border-bottom: 1px solid #555;
  padding-bottom: 8px;
}

.input-group {
  margin-bottom: 15px;
}

.input-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: #ccc;
}

.input-group input,
.input-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #555;
  border-radius: 4px;
  background-color: #333;
  color: white;
  font-size: 14px;
}

.input-group input:focus,
.input-group select:focus {
  outline: none;
  border-color: #4CAF50;
}

.location-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.location-btn {
  padding: 8px 12px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.location-btn:hover {
  background-color: #45a049;
}

.camera-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  flex: 1;
  padding: 8px 12px;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}

.control-btn:hover:not(:disabled) {
  background-color: #1976D2;
}

.control-btn:disabled {
  background-color: #555;
  cursor: not-allowed;
}
</style>