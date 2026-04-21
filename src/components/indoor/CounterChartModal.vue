<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import 'chartjs-adapter-date-fns'
import { useCemDataStore } from '@/stores/cemDataStore'
import { cemService } from '@/services/cem.service'
import { toTimeSeries, toLineChartData, toConsumption, toBarChartData, type ConsumptionSeries } from '@/utils/readingProcessors'
import { canPredict, predict } from '@/utils/readingPrediction'
import type { CemCounter, TimeSeries } from '@/types/cem'
import { useBuildingStore } from '@/stores/buildingStore'

Chart.register(...registerables)

const props = defineProps<{
  varId: number
  unitId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const cemStore = useCemDataStore()
const buildingStore = useBuildingStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

// Resolve default chart mode from unit's counterLayers
const defaultMode = computed<'trend' | 'consumption'>(() => {
  const unit = buildingStore.building.units.find(u => u.id === props.unitId)
  const assignment = unit?.counterLayers?.find(a => a.varId === props.varId)
  return assignment?.defaultChart ?? 'trend'
})

const isLoading = ref(false)
const series = ref<TimeSeries | null>(null)
const consumption = ref<ConsumptionSeries | null>(null)
const chartMode = ref<'trend' | 'consumption'>(defaultMode.value)
const interpolate = ref(true)
const showPrediction = ref(false)

// Date range: default 48h
const now = new Date()
const dateFrom = ref(new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10))
const dateTo = ref(now.toISOString().slice(0, 10))
const activeRange = ref(2) // tracks active quick-range (days)

// Quick range buttons
const ranges = [
  { label: '24h', days: 1 },
  { label: '48h', days: 2 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

// Find counter metadata
const counter = computed<CemCounter | null>(() => {
  for (const counters of cemStore.countersByMeterId.values()) {
    const c = counters.find(c => c.id === props.varId)
    if (c) return c
  }
  return null
})

// Find meter for this counter
const meter = computed(() => {
  if (!counter.value) return null
  return cemStore.meters.find(m => m.id === counter.value!.meterId) ?? null
})

// Find CEM object (install point) for this meter
const cemObject = computed(() => {
  if (!meter.value) return null
  return cemStore.objects.find(o => o.id === meter.value!.objectId) ?? null
})

function setRange(days: number) {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86400000)
  dateFrom.value = from.toISOString().slice(0, 10)
  dateTo.value = to.toISOString().slice(0, 10)
  activeRange.value = days
}

async function loadData() {
  if (!counter.value) return
  isLoading.value = true
  try {
    const from = dateFrom.value + 'T00:00:00'
    const to = dateTo.value + 'T23:59:59'
    const readings = await cemService.getSingleReadings(props.varId, from, to)
    series.value = toTimeSeries(readings, counter.value, { interpolate: interpolate.value })
    consumption.value = toConsumption(readings, counter.value, { interpolate: interpolate.value })
  } catch (e) {
    console.error('Failed to load readings:', e)
    series.value = null
    consumption.value = null
  } finally {
    isLoading.value = false
  }
}

// Plugin: draw red hatched zones for data gaps
import type { GapInfo } from '@/utils/readingProcessors'

const gapPlugin = {
  id: 'gapZones',
  beforeDraw(chartInstance: Chart, _args: any, _options: any) {
    const gaps: GapInfo[] = (chartInstance as any)._gapData ?? []
    if (gaps.length === 0) return
    const { ctx, chartArea, scales } = chartInstance
    if (!chartArea || !scales['x']) return
    const xScale = scales['x']!

    ctx.save()
    for (const gap of gaps) {
      const x1 = xScale.getPixelForValue(gap.fromTimestamp)
      const x2 = xScale.getPixelForValue(gap.toTimestamp)
      // Red hatched background
      ctx.fillStyle = 'rgba(239, 68, 68, 0.08)'
      ctx.fillRect(x1, chartArea.top, x2 - x1, chartArea.bottom - chartArea.top)
      // Dashed borders
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(x1, chartArea.top)
      ctx.lineTo(x1, chartArea.bottom)
      ctx.moveTo(x2, chartArea.top)
      ctx.lineTo(x2, chartArea.bottom)
      ctx.stroke()
      ctx.setLineDash([])
      // Label
      const midX = (x1 + x2) / 2
      const hours = Math.round(gap.duration / 3600000)
      const label = hours >= 24 ? `${Math.round(hours / 24)}d` : `${hours}h`
      ctx.fillStyle = 'rgba(239, 68, 68, 0.5)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`gap ${label}`, midX, chartArea.top + 12)
    }
    ctx.restore()
  },
}

const timeScaleConfig = {
  type: 'time' as const,
  time: {
    tooltipFormat: 'dd.MM.yyyy HH:mm',
    displayFormats: {
      hour: 'HH:mm',
      day: 'dd.MM.',
      week: 'dd.MM.',
      month: 'MM.yyyy',
    },
  },
  ticks: { color: '#999', font: { size: 10 }, maxRotation: 0 },
  grid: { color: 'rgba(255,255,255,0.05)' },
}

const yScaleConfig = (unit: string) => ({
  ticks: { color: '#999', font: { size: 10 } },
  grid: { color: 'rgba(255,255,255,0.05)' },
  title: { display: true, text: unit, color: '#999' },
})

function renderChart() {
  if (!canvasRef.value) return

  if (chart) chart.destroy()

  if (chartMode.value === 'consumption' && consumption.value && consumption.value.points.length > 0) {
    const chartData = toBarChartData(consumption.value)
    chart = new Chart(canvasRef.value, {
      type: 'bar',
      data: { labels: chartData.labels, datasets: chartData.datasets },
      plugins: [gapPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false } },
        scales: { x: timeScaleConfig, y: yScaleConfig(consumption.value.unit) },
      },
    })
    return
  }

  if (!series.value) return

  const seriesList: any[] = [series.value]

  if (showPrediction.value && canPredict(series.value.points)) {
    const prediction = predict(series.value.points, undefined, props.varId)
    if (prediction.points.length > 0) {
      seriesList.push({
        varId: props.varId,
        label: `${series.value.label} (predikce R²=${prediction.confidence})`,
        unit: series.value.unit,
        color: series.value.color + '80',
        points: [...series.value.points.slice(-1), ...prediction.points],
        interval: series.value.interval,
      })
    }
  }

  const chartData = toLineChartData(seriesList)

  chart = new Chart(canvasRef.value, {
    type: 'line',
    data: { labels: chartData.labels, datasets: chartData.datasets },
    plugins: [gapPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: seriesList.length > 1 },
      },
      scales: { x: timeScaleConfig, y: yScaleConfig(series.value.unit) },
    },
  })

  // Attach gap data for the plugin
  ;(chart as any)._gapData = chartData.gaps ?? []
}

watch([dateFrom, dateTo, interpolate], () => loadData())
watch([series, chartMode], () => nextTick(renderChart))
watch(showPrediction, () => nextTick(renderChart))

onMounted(() => loadData())
onUnmounted(() => { chart?.destroy(); chart = null })

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title-area">
          <h3 class="modal-title">{{ cemObject?.name ?? 'Objekt' }}</h3>
          <div class="modal-meta">
            <span v-if="meter?.serial" class="modal-meta-item">SN: {{ meter.serial }}</span>
            <span v-if="meter?.meterTypeName" class="modal-meta-item">{{ meter.meterTypeName }}</span>
            <span class="modal-meta-item">{{ counter?.typeName ?? 'Počitadlo' }} &middot; {{ counter?.unit }} &middot; var_id: {{ varId }}</span>
          </div>
        </div>
        <button class="modal-close" @click="emit('close')">&times;</button>
      </div>

      <!-- Controls -->
      <div class="modal-controls">
        <div class="mode-buttons">
          <button class="mode-btn" :class="{ active: chartMode === 'trend' }" @click="chartMode = 'trend'">Trend</button>
          <button class="mode-btn" :class="{ active: chartMode === 'consumption' }" @click="chartMode = 'consumption'">Spotřeba</button>
        </div>
        <div class="range-buttons">
          <button v-for="r in ranges" :key="r.days" class="range-btn" :class="{ active: activeRange === r.days }" @click="setRange(r.days)">{{ r.label }}</button>
        </div>
        <input v-model="dateFrom" type="date" class="date-input" @change="activeRange = 0" />
        <span class="date-sep">&mdash;</span>
        <input v-model="dateTo" type="date" class="date-input" @change="activeRange = 0" />
        <label class="toggle-label">
          <input type="checkbox" v-model="interpolate" /> Interpolace
        </label>
        <label class="toggle-label">
          <input type="checkbox" v-model="showPrediction" /> Predikce
        </label>
      </div>

      <!-- Chart -->
      <div class="chart-area">
        <div v-if="isLoading" class="chart-loading">Načítám data...</div>
        <div v-else-if="!series || series.points.length === 0" class="chart-empty">Žádná data pro zvolené období</div>
        <canvas ref="canvasRef" />
      </div>

      <!-- Stats -->
      <div v-if="chartMode === 'trend' && series && series.points.length > 0" class="modal-stats">
        <span>Bodů: {{ series.points.length }}</span>
        <span>Min: {{ Math.min(...series.points.filter(p => !isNaN(p.value)).map(p => p.value)).toFixed(2) }} {{ series.unit }}</span>
        <span>Avg: {{ (series.points.filter(p => !isNaN(p.value)).reduce((s, p) => s + p.value, 0) / series.points.filter(p => !isNaN(p.value)).length).toFixed(2) }} {{ series.unit }}</span>
        <span>Max: {{ Math.max(...series.points.filter(p => !isNaN(p.value)).map(p => p.value)).toFixed(2) }} {{ series.unit }}</span>
        <span>Posl.: {{ series.points[series.points.length - 1]?.value.toFixed(2) }} {{ series.unit }}</span>
      </div>
      <div v-else-if="chartMode === 'consumption' && consumption && consumption.points.length > 0" class="modal-stats">
        <span>Bodů: {{ consumption.points.length }}</span>
        <span>Celkem: {{ consumption.total.toFixed(2) }} {{ consumption.unit }}</span>
        <span>Min: {{ Math.min(...consumption.points.map(p => p.value)).toFixed(2) }} {{ consumption.unit }}</span>
        <span>Průměr: {{ (consumption.total / consumption.points.length).toFixed(2) }} {{ consumption.unit }}</span>
        <span>Max: {{ Math.max(...consumption.points.map(p => p.value)).toFixed(2) }} {{ consumption.unit }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: var(--bg-primary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 12px;
  width: 90vw;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 20px 10px;
  border-bottom: 1px solid var(--border-color, #333);
}

.modal-title { font-size: 16px; font-weight: 700; color: var(--text-primary, #eee); margin: 0; }

.modal-meta {
  display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 4px;
}

.modal-meta-item {
  font-size: 11px; color: var(--text-muted, #999); white-space: nowrap;
}

.modal-close {
  background: none; border: none; color: var(--text-muted, #999); font-size: 24px; cursor: pointer; padding: 0 4px; line-height: 1;
}
.modal-close:hover { color: #ef4444; }

.modal-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  flex-wrap: wrap;
}

.mode-buttons {
  display: flex; gap: 0; border: 1px solid var(--border-color, #444); border-radius: 5px; overflow: hidden;
}

.mode-btn {
  padding: 3px 12px; border: none; background: transparent; color: var(--text-muted, #999);
  font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s;
}

.mode-btn.active { background: var(--accent, #2196F3); color: white; }
.mode-btn:not(.active):hover { background: var(--btn-hover, #333); color: var(--text-primary, #eee); }

.range-buttons { display: flex; gap: 4px; }

.range-btn {
  padding: 3px 10px; border: 1px solid var(--border-color, #444); border-radius: 4px;
  background: transparent; color: var(--text-muted, #999); font-size: 11px; cursor: pointer;
}
.range-btn:hover { border-color: var(--accent, #2196F3); color: var(--text-primary, #eee); }
.range-btn.active { background: var(--accent, #2196F3); color: white; border-color: var(--accent, #2196F3); }

.date-input {
  height: 28px; background: var(--input-bg, #2a2a2a); border: 1px solid var(--input-border, #444);
  border-radius: 4px; color: var(--input-text, #eee); font-size: 11px; padding: 0 6px;
}

.date-sep { color: var(--text-muted, #999); font-size: 12px; }

.toggle-label {
  display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted, #999); cursor: pointer;
}
.toggle-label input { accent-color: var(--accent, #2196F3); }

.chart-area {
  flex: 1;
  min-height: 300px;
  padding: 10px 20px;
  position: relative;
}

.chart-loading, .chart-empty {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 13px; color: var(--text-muted, #999);
}

.modal-stats {
  display: flex; gap: 16px; padding: 8px 20px 12px;
  font-size: 11px; font-family: monospace; color: var(--text-muted, #999);
  border-top: 1px solid var(--border-color, #333);
}
</style>
