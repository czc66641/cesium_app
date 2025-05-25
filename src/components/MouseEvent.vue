<!-- MouseEvent.vue -->
<template>
  <div class="mouse-info-panel">
    <div class="info-row">
      <span class="label">经度:</span>
      <span class="value">{{ mousePosition.lon ? mousePosition.lon.toFixed(6) : '--' }}°</span>
    </div>
    <div class="info-row">
      <span class="label">纬度:</span>
      <span class="value">{{ mousePosition.lat ? mousePosition.lat.toFixed(6) : '--' }}°</span>
    </div>
    <div class="info-row">
      <span class="label">高程:</span>
      <span class="value">{{ mousePosition.height ? mousePosition.height.toFixed(2) : '--' }}m</span>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, onBeforeUnmount } from 'vue';
import * as Cesium from 'cesium';

export default defineComponent({
  name: 'MouseEvent',
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
    const mousePosition = ref({
      lon: null,
      lat: null,
      height: null,
      cartesian: null
    });

    let handler = null;

    const initMouseEvents = () => {
      if (!props.viewer) return;

      handler = new Cesium.ScreenSpaceEventHandler(props.viewer.scene.canvas);

      // 鼠标移动事件
      handler.setInputAction((movement) => {
        try {
          // 使用射线检测拾取地形
          const ray = props.viewer.camera.getPickRay(movement.endPosition);
          const position = props.viewer.scene.globe.pick(ray, props.viewer.scene);
          
          if (position) {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            mousePosition.value.lat = Cesium.Math.toDegrees(cartographic.latitude);
            mousePosition.value.lon = Cesium.Math.toDegrees(cartographic.longitude);
            mousePosition.value.height = cartographic.height;
            mousePosition.value.cartesian = position;
          } else {
            // 如果地形拾取失败，回退到椭球体拾取
            const ellipsoidCartesian = props.viewer.camera.pickEllipsoid(
              movement.endPosition,
              props.viewer.scene.globe.ellipsoid
            );
            
            if (ellipsoidCartesian) {
              const cartographic = Cesium.Cartographic.fromCartesian(ellipsoidCartesian);
              mousePosition.value.lat = Cesium.Math.toDegrees(cartographic.latitude);
              mousePosition.value.lon = Cesium.Math.toDegrees(cartographic.longitude);
              mousePosition.value.height = 0;
              mousePosition.value.cartesian = ellipsoidCartesian;
            } else {
              mousePosition.value.lat = null;
              mousePosition.value.lon = null;
              mousePosition.value.height = null;
              mousePosition.value.cartesian = null;
            }
          }
        } catch (error) {
          console.error('鼠标移动事件处理失败:', error);
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      // 鼠标左键点击事件
      handler.setInputAction((click) => {
        try {
          const ray = props.viewer.camera.getPickRay(click.position);
          const position = props.viewer.scene.globe.pick(ray, props.viewer.scene);
          
          if (position) {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            const height = cartographic.height;
            
            emit('update-location', {
              longitude,
              latitude,
              height
            });
          }
        } catch (error) {
          console.error('鼠标点击事件处理失败:', error);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    };

    const destroyMouseEvents = () => {
      if (handler && !handler.isDestroyed()) {
        handler.destroy();
        handler = null;
      }
    };

    onMounted(() => {
      initMouseEvents();
    });

    onBeforeUnmount(() => {
      destroyMouseEvents();
    });

    return {
      mousePosition,
    };
  },
});
</script>

<style scoped>
.mouse-info-panel {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 5px;
  font-family: monospace;
  font-size: 12px;
  z-index: 1000;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3px;
  min-width: 150px;
}

.label {
  margin-right: 10px;
}

.value {
  font-weight: bold;
}
</style>