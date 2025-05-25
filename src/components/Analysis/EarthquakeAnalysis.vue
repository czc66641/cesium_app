<template>
  <div class="earthquake-analysis">
    <h2>地震分析</h2>
    
    <div class="controls">
      <button @click="loadEarthquakeData" class="load-button">
        <i class="fas fa-cloud-download-alt"></i>
        加载地震数据
      </button>
    </div>
    
    <div v-if="isLoading" class="loading">
      <i class="fas fa-spinner fa-spin"></i>
      加载中...
    </div>
    
    <div v-else-if="earthquakeData.length === 0" class="no-data">
      暂无地震数据
    </div>
    
    <div v-else class="data-table">
      <div class="table-header">
        <div class="table-row">
          <div class="table-cell">时间</div>
          <div class="table-cell">位置</div>
          <div class="table-cell">深度 (km)</div>
          <div class="table-cell">震级</div>
        </div>
      </div>
      <div class="table-body">
        <div class="table-row" v-for="quake in earthquakeData" :key="quake.id">
          <div class="table-cell">{{ new Date(quake.date).toLocaleString() }}</div>
          <div class="table-cell">{{ quake.location }}</div>
          <div class="table-cell">{{ quake.depth }}</div>
          <div class="table-cell">{{ quake.magnitude }}</div>
        </div>
      </div>
    </div>
    
    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'EarthquakeAnalysis',
  props: {
    viewer: {
      type: Object,
      required: true
    }
  },
  emits: ['earthquake-data-loaded'],
  setup(props, { emit }) {
    const isLoading = ref(false);
    const earthquakeData = ref([]);
    const message = ref('');
    const messageType = ref('success');
    
    const loadEarthquakeData = async () => {
      try {
        isLoading.value = true;
        
        const mockEarthquakes = [
          {
            id: 1,
            date: '2024-01-15T08:30:00Z',
            latitude: 39.9042,
            longitude: 116.4074,
            depth: 15.5,
            magnitude: 5.2,
            location: '北京市海淀区'
          },
          {
            id: 2,
            date: '2024-01-20T14:22:00Z',
            latitude: 31.2304,
            longitude: 121.4737,
            depth: 8.3,
            magnitude: 4.8,
            location: '上海市浦东新区'
          },
          {
            id: 3,
            date: '2024-02-01T03:45:00Z',
            latitude: 34.2619,
            longitude: 108.9419,
            depth: 22.1,
            magnitude: 6.1,
            location: '陕西省西安市'
          },
          {
            id: 4,
            date: '2024-02-10T19:15:00Z',
            latitude: 30.5728,
            longitude: 104.0668,
            depth: 35.7,
            magnitude: 7.2,
            location: '四川省成都市'
          },
          {
            id: 5,
            date: '2024-02-15T11:28:00Z',
            latitude: 36.0611,
            longitude: 103.8343,
            depth: 18.9,
            magnitude: 5.8,
            location: '甘肃省兰州市'
          }
        ];
        
        earthquakeData.value = mockEarthquakes;
        emit('earthquake-data-loaded', mockEarthquakes);
        
        message.value = `成功加载 ${mockEarthquakes.length} 条地震数据`;
        messageType.value = 'success';
      } catch (error) {
        console.error('加载地震数据失败:', error);
        message.value = '加载地震数据失败，请重试';
        messageType.value = 'error';
      } finally {
        isLoading.value = false;
      }
    };
    
    return {
      isLoading,
      earthquakeData,
      message,
      messageType,
      loadEarthquakeData
    };
  }
});
</script>

<style scoped>
.earthquake-analysis {
  padding: 15px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.controls {
  margin-bottom: 15px;
}

.load-button {
  background-color: #4285f4;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.load-button:hover {
  background-color: #357ae8;
}

.loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
}

.no-data {
  color: #999;
  text-align: center;
  padding: 20px 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.table-header {
  background-color: #f5f5f5;
  font-weight: bold;
}

.table-row {
  border-bottom: 1px solid #ddd;
}

.table-cell {
  padding: 10px;
  text-align: left;
}

.message {
  margin-top: 15px;
  padding: 10px;
  border-radius: 4px;
}

.message.success {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.message.error {
  background-color: #fce4e4;
  color: #c62828;
}
</style>