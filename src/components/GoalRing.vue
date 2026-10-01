<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ count: number; goal: number; label?: string }>()
const R = 52
const C = 2 * Math.PI * R
const ratio = computed(() => Math.min(1, props.goal ? props.count / props.goal : 0))
const met = computed(() => props.count >= props.goal)
</script>

<template>
  <div class="relative h-32 w-32 shrink-0" role="img" :aria-label="`${count} dari ${goal} latihan minggu ini`">
    <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90">
      <circle cx="60" cy="60" :r="R" fill="none" stroke="currentColor" stroke-width="10" class="text-white/10" />
      <circle
        cx="60" cy="60" :r="R" fill="none" stroke-width="10" stroke-linecap="round"
        :stroke="met ? '#c8f560' : '#6f63f0'"
        :stroke-dasharray="C" :stroke-dashoffset="C * (1 - ratio)"
        style="transition: stroke-dashoffset .6s ease"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span class="font-display text-3xl leading-none" :class="met ? 'text-lime-grit' : ''">{{ count }}<span class="text-lg text-white/50">/{{ goal }}</span></span>
      <span class="mt-1 text-[11px] text-white/55">{{ label ?? 'minggu ini' }}</span>
    </div>
  </div>
</template>
