<script setup lang="ts">
import { computed, ref } from 'vue'
import { monthGrid, type Visit } from '@/lib/tracker'

const props = defineProps<{ visits: Visit[]; now: Date; planned?: string[] }>()
const emit = defineEmits<{ select: [date: string] }>()
const offset = ref(0) // months back from the current one
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const base = computed(() => new Date(props.now.getFullYear(), props.now.getMonth() - offset.value, 1))
const grid = computed(() => monthGrid(props.visits, base.value.getFullYear(), base.value.getMonth(), props.now))
const planned = computed(() => new Set(props.planned ?? []))
const total = computed(() => grid.value.flat().filter((c) => c.inMonth && c.visited).length)
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <button class="btn-ghost !px-3 !py-1" aria-label="Bulan sebelumnya" :disabled="offset >= 24" @click="offset++">‹</button>
      <p class="text-sm font-semibold">{{ MONTHS[base.getMonth()] }} {{ base.getFullYear() }} <span class="font-normal text-white/50">· {{ total }} hari</span></p>
      <button class="btn-ghost !px-3 !py-1 disabled:opacity-30" aria-label="Bulan berikutnya" :disabled="offset === 0" @click="offset--">›</button>
    </div>
    <div class="grid grid-cols-7 gap-1 text-center text-[10px] text-white/40">
      <span v-for="d in ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']" :key="d">{{ d }}</span>
    </div>
    <div class="mt-1 grid grid-cols-7 gap-1" data-testid="heatmap">
      <template v-for="row in grid" :key="row[0].date">
        <button
          v-for="c in row" :key="c.date" type="button" :disabled="c.future"
          class="relative flex aspect-square items-center justify-center rounded-lg text-xs transition active:scale-95"
          :class="[c.visited ? 'bg-lime-grit font-bold text-black' : c.other ? 'bg-white/5 text-white/80 ring-1 ring-inset ring-lime-grit/60' : c.inMonth ? 'bg-white/5 text-white/70' : 'text-white/20', c.isToday ? 'ring-2 ring-brand-300' : '', c.future ? 'opacity-40' : '']"
          :data-visited="c.visited || undefined" :data-other="c.other || undefined" :data-date="c.date" :aria-label="`${c.date}${c.visited ? ', latihan' : c.other ? ', aktivitas lain' : ''}`"
          @click="emit('select', c.date)"
        >
          {{ c.day }}
          <span v-if="!c.visited && !c.other && planned.has(c.date)" class="absolute bottom-1 h-1 w-1 rounded-full bg-brand-300" />
        </button>
      </template>
    </div>
  </div>
</template>
