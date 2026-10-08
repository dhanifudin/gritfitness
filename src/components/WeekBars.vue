<script setup lang="ts">
import { computed } from 'vue'
import { parseYmd, type WeekCount } from '@/lib/tracker'

const props = defineProps<{ weeks: WeekCount[]; goal: number }>()
const max = computed(() => Math.max(props.goal, ...props.weeks.map((w) => w.count), 1))
const label = (s: string) => {
  const d = parseYmd(s)
  return `${d.getDate()}/${d.getMonth() + 1}`
}
</script>

<template>
  <div class="relative" role="img" :aria-label="`Latihan per minggu, target ${goal}`">
    <div class="pointer-events-none absolute inset-x-0 border-t border-dashed border-grit-500/60" :style="{ bottom: `calc(1.25rem + ${(goal / max) * 6}rem)` }">
      <span class="absolute -top-4 right-0 chart-label !text-grit-300">target {{ goal }}</span>
    </div>
    <div class="flex h-32 items-end gap-2">
      <div v-for="w in weeks" :key="w.weekStart" class="flex flex-1 flex-col items-center justify-end">
        <span class="chart-label mb-1">{{ w.count || '' }}</span>
        <div
          class="w-full rounded-t-md transition-all"
          :class="w.count >= goal ? 'bg-grit-500' : w.isCurrent ? 'bg-chart-2' : 'bg-white/15'"
          :style="{ height: (w.count / max) * 6 + 'rem', minHeight: w.count ? '0.25rem' : '0.125rem' }"
        />
        <span class="chart-label mt-1" :class="w.isCurrent ? 'font-semibold !text-white' : ''">{{ label(w.weekStart) }}</span>
      </div>
    </div>
  </div>
</template>
