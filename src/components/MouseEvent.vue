<!-- MouseEvent.vue -->
<template>
  <div class="mouse-event-container">
    <!-- 鼠标位置显示 -->
    <div class="mouse-position-display">
      <div class="display-title">鼠标位置</div>
      <div class="coordinate-item">
        <span class="label">经度:</span>
        <span class="value">{{ mousePosition.lon?.toFixed(6) || 'N/A' }}</span>
      </div>
      <div class="coordinate-item">
        <span class="label">纬度:</span>
        <span class="value">{{ mousePosition.lat?.toFixed(6) || 'N/A' }}</span>
      </div>
      <div class="coordinate-item">
        <span class="label">高程:</span>
        <span class="value">{{ mousePosition.height?.toFixed(2) || 'N/A' }}m</span>
      </div>
      <div class="coordinate-item">
        <span class="label">X坐标:</span>
        <span class="value">{{ mousePosition.cartesian?.x?.toFixed(2) || 'N/A' }}</span>
      </div>
      <div class="coordinate-item">
        <span class="label">Y坐标:</span>
        <span class="value">{{ mousePosition.cartesian?.y?.toFixed(2) || 'N/A' }}</span>
      </div>
      <div class="coordinate-item">
        <span class="label">Z坐标:</span>
        <span class="value">{{ mousePosition.cartesian?.z?.toFixed(2) || 'N/A' }}</span>
      </div>
    </div>

    <!-- 点击位置记录 -->
    <div v-if="clickedPosition.cartesian" class="clicked-position-display">
      <div class="display-title">点击位置</div>
      <div class="coordinate-item">
        <span class="label">经度:</span>
        <span class="value">{{ clickedPosition.lon?.toFixed(6) || 'N/A' }}</span>
      </div>
      <div class="coordinate-item">
        <span class="label">纬度:</span>
        <span class="value">{{ clickedPosition.lat?.toFixed(6) || 'N/A' }}</span>
      </div>
      <div class="coordinate-item">
        <span class="label">高程:</span>
        <span class="value">{{ clickedPosition.height?.toFixed(2) || 'N/A' }}m</span>
      </div>
      <div class="coordinate-item">
        <span class="label">X坐标:</span>
        <span class="value">{{ clickedPosition.cartesian?.x?.toFixed(2) || 'N/A' }}</span>
      </div>
      <div class="coordinate-item">
        <span class="label">Y坐标:</span>
        <span class="value">{{ clickedPosition.cartesian?.y?.toFixed(2) || 'N/A' }}</span>
      </div>
      <div class="coordinate-item">
        <span class="label">Z坐标:</span>
        <span class="value">{{ clickedPosition.cartesian?.z?.toFixed(2) || 'N/A' }}</span>
      </div>
      <div class="clear-clicked">
        <button @click="clearClickedPosition" class="clear-btn">清除点击记录</button>
      </div>
    </div>

    <!-- 相机位置显示 -->
    <div class="camera-position-display">
      <div class="display-title">相机位置</div>
      <div class="coordinate-item">
        <span class="label">经度:</span>
        <span class="value">{{ cameraPosition.longitude?.toFixed(6) || 'N/A' }}</span>
      </div>
      <div class="coordinate-item">
        <span class="label">纬度:</span>
        <span class="value">{{ cameraPosition.latitude?.toFixed(6) || 'N/A' }}</span>
      </div>
      <div class="coordinate-item">
        <span class="label">高度:</span>
        <span class="value">{{ formatHeight(cameraPosition.height) }}</span>
      </div>
      <div class="coordinate-item">
        <span class="label">方向:</span>
        <span class="value">{{ cameraPosition.heading?.toFixed(1) || 'N/A' }}°</span>
      </div>
      <div class="coordinate-item">
        <span class="label">俯仰:</span>
        <span class="value">{{ cameraPosition.pitch?.toFixed(1) || 'N/A' }}°</span>
      </div>
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
      required: true
    },
    currentLocation: {
      type: Object,
      required: true
    }
  },
  emits: ['update-location'],
  setup(props, { emit }) {
    const mousePosition = ref({
      lon: null,
      lat: null,
      height: null,
      cartesian: null
    });

    const clickedPosition = ref({
      lon: null,
      lat: null,
      height: null,
      cartesian: null
    });

    const cameraPosition = ref({
      longitude: null,
      latitude: null,
      height: null,
      heading: null,
      pitch: null,
      roll: null
    });

    let handler = null;
    let cameraChangeListener = null;

    const initMouseEvents = () => {
      if (!props.viewer) {
        console.warn('Viewer未初始化，无法设置鼠标事件');
        return;
      }

      try {
        handler = new Cesium.ScreenSpaceEventHandler(props.viewer.scene.canvas);

        // 鼠标移动事件 - 实时显示鼠标位置
        handler.setInputAction((movement) => {
          try {
            const ray = props.viewer.camera.getPickRay(movement.endPosition);
            if (!ray) return;

            // 优先尝试地形拾取
            const position = props.viewer.scene.globe.pick(ray, props.viewer.scene);
            
            if (position) {
              // 成功拾取到地形
              const cartographic = Cesium.Cartographic.fromCartesian(position);
              
              mousePosition.value = {
                lat: Cesium.Math.toDegrees(cartographic.latitude),
                lon: Cesium.Math.toDegrees(cartographic.longitude),
                height: cartographic.height,
                cartesian: {
                  x: position.x,
                  y: position.y,
                  z: position.z
                }
              };
            } else {
              // 地形拾取失败，使用椭球体拾取
              const ellipsoidPosition = props.viewer.camera.pickEllipsoid(
                movement.endPosition, 
                props.viewer.scene.globe.ellipsoid
              );
              
              if (ellipsoidPosition) {
                const cartographic = Cesium.Cartographic.fromCartesian(ellipsoidPosition);
                
                mousePosition.value = {
                  lat: Cesium.Math.toDegrees(cartographic.latitude),
                  lon: Cesium.Math.toDegrees(cartographic.longitude),
                  height: 0, // 椭球体表面高度为0
                  cartesian: {
                    x: ellipsoidPosition.x,
                    y: ellipsoidPosition.y,
                    z: ellipsoidPosition.z
                  }
                };
              } else {
                // 完全无法拾取，清空位置信息
                mousePosition.value = {
                  lat: null,
                  lon: null,
                  height: null,
                  cartesian: null
                };
              }
            }
          } catch (error) {
            console.error('鼠标移动事件处理失败:', error);
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // 左键点击事件 - 记录点击位置
        handler.setInputAction((click) => {
          try {
            const ray = props.viewer.camera.getPickRay(click.position);
            if (!ray) return;

            // 尝试地形拾取
            const position = props.viewer.scene.globe.pick(ray, props.viewer.scene);
            
            if (position) {
              const cartographic = Cesium.Cartographic.fromCartesian(position);
              
              clickedPosition.value = {
                lat: Cesium.Math.toDegrees(cartographic.latitude),
                lon: Cesium.Math.toDegrees(cartographic.longitude),
                height: cartographic.height,
                cartesian: {
                  x: position.x,
                  y: position.y,
                  z: position.z
                }
              };
              
              console.log('点击位置记录:', {
                经度: clickedPosition.value.lon.toFixed(6),
                纬度: clickedPosition.value.lat.toFixed(6),
                高程: clickedPosition.value.height.toFixed(2) + 'm',
                笛卡尔坐标: `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`
              });
              
              // 显示点击信息弹窗
              showCoordinateInfo(
                clickedPosition.value.lon,
                clickedPosition.value.lat,
                clickedPosition.value.height,
                click.position
              );
            }
          } catch (error) {
            console.error('左键点击事件处理失败:', error);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 右键点击事件 - 显示详细坐标信息
        handler.setInputAction((click) => {
          try {
            const ray = props.viewer.camera.getPickRay(click.position);
            if (!ray) return;

            const position = props.viewer.scene.globe.pick(ray, props.viewer.scene);
            
            if (position) {
              const cartographic = Cesium.Cartographic.fromCartesian(position);
              const longitude = Cesium.Math.toDegrees(cartographic.longitude);
              const latitude = Cesium.Math.toDegrees(cartographic.latitude);
              const height = cartographic.height;

              console.log('右键点击详细信息:', {
                经度: longitude.toFixed(6),
                纬度: latitude.toFixed(6),
                高程: height.toFixed(2) + 'm',
                笛卡尔坐标: `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`
              });
              
              // 显示详细坐标信息弹窗
              showDetailedCoordinateInfo(longitude, latitude, height, position, click.position);
            }
          } catch (error) {
            console.error('右键点击事件处理失败:', error);
          }
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

        console.log('鼠标事件已初始化');
      } catch (error) {
        console.error('初始化鼠标事件失败:', error);
      }
    };

    const initCameraEvents = () => {
      if (!props.viewer) return;

      try {
        // 相机移动事件监听
        cameraChangeListener = props.viewer.camera.moveEnd.addEventListener(() => {
          updateCameraPosition();
        });

        // 初始更新一次相机位置
        updateCameraPosition();
        
        console.log('相机事件已初始化');
      } catch (error) {
        console.error('初始化相机事件失败:', error);
      }
    };

    const updateCameraPosition = () => {
      if (!props.viewer) return;

      try {
        const camera = props.viewer.camera;
        const cartographic = camera.positionCartographic;

        cameraPosition.value = {
          longitude: Cesium.Math.toDegrees(cartographic.longitude),
          latitude: Cesium.Math.toDegrees(cartographic.latitude),
          height: cartographic.height,
          heading: Cesium.Math.toDegrees(camera.heading),
          pitch: Cesium.Math.toDegrees(camera.pitch),
          roll: Cesium.Math.toDegrees(camera.roll)
        };

        // 发射位置更新事件
        emit('update-location', cameraPosition.value);
      } catch (error) {
        console.error('更新相机位置失败:', error);
      }
    };

    const showCoordinateInfo = (longitude, latitude, height, screenPosition) => {
      const infoDiv = document.createElement('div');
      infoDiv.className = 'coordinate-info-popup';
      infoDiv.style.cssText = `
        position: absolute;
        left: ${screenPosition.x + 10}px;
        top: ${screenPosition.y - 60}px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        border: 1px solid #4CAF50;
      `;
      
      infoDiv.innerHTML = `
        <div style="color: #4CAF50; font-weight: bold; margin-bottom: 4px;">点击位置</div>
        <div>经度: ${longitude.toFixed(6)}</div>
        <div>纬度: ${latitude.toFixed(6)}</div>
        <div>高程: ${height.toFixed(2)}m</div>
      `;

      document.body.appendChild(infoDiv);

      setTimeout(() => {
        if (infoDiv.parentNode) {
          infoDiv.parentNode.removeChild(infoDiv);
        }
      }, 3000);
    };

    const showDetailedCoordinateInfo = (longitude, latitude, height, cartesian, screenPosition) => {
      const infoDiv = document.createElement('div');
      infoDiv.className = 'detailed-coordinate-popup';
      infoDiv.style.cssText = `
        position: absolute;
        left: ${Math.min(screenPosition.x + 10, window.innerWidth - 250)}px;
        top: ${Math.max(screenPosition.y - 120, 10)}px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 12px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
        border: 1px solid #2196F3;
        min-width: 200px;
      `;
      
      infoDiv.innerHTML = `
        <div style="color: #2196F3; font-weight: bold; margin-bottom: 6px;">详细坐标信息</div>
        <div>经度: ${longitude.toFixed(6)}°</div>
        <div>纬度: ${latitude.toFixed(6)}°</div>
        <div>高程: ${height.toFixed(2)} m</div>
        <div style="margin-top: 6px; color: #FFC107; font-weight: bold;">笛卡尔坐标:</div>
        <div>X: ${cartesian.x.toFixed(2)}</div>
        <div>Y: ${cartesian.y.toFixed(2)}</div>
        <div>Z: ${cartesian.z.toFixed(2)}</div>
      `;

      document.body.appendChild(infoDiv);

      setTimeout(() => {
        if (infoDiv.parentNode) {
          infoDiv.parentNode.removeChild(infoDiv);
        }
      }, 5000);
    };

    const clearClickedPosition = () => {
      clickedPosition.value = {
        lon: null,
        lat: null,
        height: null,
        cartesian: null
      };
      console.log('点击位置记录已清除');
    };

    const formatHeight = (height) => {
      if (height === null || height === undefined) return 'N/A';
      
      if (height > 1000000) {
        return `${(height / 1000000).toFixed(1)} M km`;
      } else if (height > 1000) {
        return `${(height / 1000).toFixed(1)} km`;
      } else {
        return `${height.toFixed(2)} m`;
      }
    };

    onMounted(() => {
      console.log('MouseEvent组件已挂载，开始初始化事件');
      initMouseEvents();
      initCameraEvents();
    });

    onBeforeUnmount(() => {
      console.log('MouseEvent组件卸载，清理事件监听');
      
      if (handler && !handler.isDestroyed()) {
        handler.destroy();
        handler = null;
      }
      
      if (cameraChangeListener) {
        cameraChangeListener();
        cameraChangeListener = null;
      }
    });

    return {
      mousePosition,
      clickedPosition,
      cameraPosition,
      clearClickedPosition,
      formatHeight
    };
  }
});
</script>

<style scoped>
.mouse-event-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 280px;
  pointer-events: auto;
}

.mouse-position-display,
.clicked-position-display,
.camera-position-display {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 12px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  min-width: 220px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(5px);
}

.display-title {
  font-weight: bold;
  margin-bottom: 8px;
  text-align: center;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
}

.mouse-position-display .display-title {
  color: #4CAF50;
}

.clicked-position-display {
  border-color: #4CAF50;
}

.clicked-position-display .display-title {
  color: #4CAF50;
}

.camera-position-display .display-title {
  color: #2196F3;
}

.coordinate-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  align-items: center;
}

.coordinate-item:last-child {
  margin-bottom: 0;
}

.label {
  color: #ccc;
  font-weight: bold;
  min-width: 50px;
}

.value {
  color: #fff;
  font-weight: normal;
  text-align: right;
  font-family: 'Courier New', monospace;
}

.clear-clicked {
  margin-top: 8px;
  text-align: center;
}

.clear-btn {
  background: #f44336;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  transition: background-color 0.2s;
}

.clear-btn:hover {
  background: #d32f2f;
}

/* 全局样式 - 坐标信息弹窗 */
:global(.coordinate-info-popup) {
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 10000;
  pointer-events: none;
  font-family: 'Courier New', monospace;
  border: 1px solid #4CAF50;
}

:global(.detailed-coordinate-popup) {
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  z-index: 10000;
  pointer-events: none;
  font-family: 'Courier New', monospace;
  border: 1px solid #2196F3;
  min-width: 200px;
}
</style>