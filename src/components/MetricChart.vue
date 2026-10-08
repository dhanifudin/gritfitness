<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ points: { date: string; value: number }[]; unit: string; target?: number | null }>()
const W = 300
const H = 110
const PAD = 8
const sorted = computed(() => [...props.points].sort((a, b) => a.date.localeCompare(b.date)))
const range = computed(() => {
  const vals = sorted.value.map((p) => p.value).concat(props.target != null ? [props.target] : [])
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pad = Math.max((hi - lo) * 0.15, 0.5)
  return { lo: lo - pad, hi: hi + pad }
})
const x = (i: number) => PAD + (sorted.value.length === 1 ? (W - 2 * PAD) / 2 : (i * (W - 2 * PAD)) / (sorted.value.length - 1))
const y = (v: number) => H - PAD - ((v - range.value.lo) / (range.value.hi - range.value.lo)) * (H - 2 * PAD)
const path = computed(() => sorted.value.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' '))
const fmt = (s: string) => {
  const [, m, d] = s.split('-')
  return `${Number(d)}/${Number(m)}`
}
</script>

<template>
  <div v-if="sorted.length" data-testid="metric-chart">
    <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img" :aria-label="`Grafik ${unit}`">
      <line v-if="target != null" :x1="PAD" :x2="W - PAD" :y1="y(target)" :y2="y(target)" stroke="var(--color-grit-500)" stroke-dasharray="4 4" stroke-opacity=".6" />
      <path v-if="sorted.length > 1" :d="path" fill="none" stroke="var(--color-chart-2)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle v-for="(p, i) in sorted" :key="p.date" :cx="x(i)" :cy="y(p.value)" r="3.5" fill="var(--color-chart-2)" stroke="var(--color-ink-950)" stroke-width="1.5" />
    </svg>
    <div class="chart-label mt-1 flex justify-between">
      <span>{{ fmt(sorted[0].date) }} · {{ sorted[0].value }} {{ unit }}</span>
      <span v-if="target != null" class="!text-grit-300">target {{ target }} {{ unit }}</span>
      <span>{{ fmt(sorted[sorted.length - 1].date) }} · {{ sorted[sorted.length - 1].value }} {{ unit }}</span>
    </div>
  </div>
</template>
