<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBuildingStore } from '@/stores/buildingStore'
import type { MeterType, MeterConfig } from '@/types/indoor'

const props = defineProps<{
  unitId: string
  meterType: MeterType
  config: MeterConfig
}>()

const buildingStore = useBuildingStore()

const icons: Record<MeterType, string> = {
  water: '\uD83D\uDCA7',
  electric: '\u26A1',
  cooling: '\uD83D\uDD35',
  heating: '\uD83D\uDD34',
}

const labels: Record<MeterType, string> = {
  water: 'Vodoměr',
  electric: 'Elektroměr',
  cooling: 'Chlazení',
  heating: 'Topení',
}

const currentValue = computed(() =>
  buildingStore.getMeterValue(props.unitId, props.meterType)
)

const formattedValue = computed(() => {
  if (currentValue.value == null) return '--'
  return `${currentValue.value.toFixed(1)} ${props.config.unit}`
})

// Trend tracking
const history = ref<number[]>([])

watch(currentValue, (val) => {
  if (val != null) {
    history.value.push(val)
    if (history.value.length > 10) history.value.shift()
  }
})

const trend = computed(() => {
  const h = history.value
  if (h.length < 2) return 'stable'
  const diff = h[h.length - 1] - h[h.length - 2]
  if (diff > 0.05) return 'up'
  if (diff < -0.05) return 'down'
  return 'stable'
})

const trendIcon = computed(() => {
  switch (trend.value) {
    case 'up': return '\u2191'
    case 'down': return '\u2193'
    default: return '\u2192'
  }
})

// Progress bar
const progressPercent = computed(() => {
  if (!props.config.dailyLimit || currentValue.value == null) return null
  return Math.min((currentValue.value / props.config.dailyLimit) * 100, 100)
})

const progressColor = computed(() => {
  const p = progressPercent.value
  if (p == null) return ''
  if (p > 90) return '#ef4444'
  if (p > 70) return '#f59e0b'
  return '#22c55e'
})
</script>

<template>
  <div class="meter-widget">
    <div class="meter-row">
      <span class="meter-icon">{{ icons[meterType] }}</span>
      <span class="meter-label">{{ labels[meterType] }}</span>
      <span class="meter-value">{{ formattedValue }}</span>
      <span class="meter-trend" :class="trend">{{ trendIcon }}</span>
    </div>
    <div v-if="progressPercent != null" class="meter-progress">
      <div
        class="meter-progress-bar"
        :style="{ width: progressPercent + '%', background: progressColor }"
      />
    </div>
  </div>
</template>

<style scoped>
.meter-widget {
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color, #333);
}

.meter-widget:last-child {
  border-bottom: none;
}

.meter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meter-icon {
  font-size: 16px;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
}

.meter-label {
  font-size: 12px;
  color: var(--text-muted, #999);
  flex: 1;
}

.meter-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #eee);
  font-family: monospace;
}

.meter-trend {
  font-size: 14px;
  width: 20px;
  text-align: center;
  font-weight: 700;
}

.meter-trend.up {
  color: #ef4444;
}

.meter-trend.down {
  color: #22c55e;
}

.meter-trend.stable {
  color: #6b7280;
}

.meter-progress {
  height: 3px;
  background: var(--input-border, #444);
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.meter-progress-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease, background 0.3s ease;
}
</style>
