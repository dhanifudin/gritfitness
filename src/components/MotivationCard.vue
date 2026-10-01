<script setup lang="ts">
import type { Motivation } from '@/lib/tracker'

defineProps<{ m: Motivation }>()
const tone = {
  good: 'border-emerald-400',
  push: 'border-pink-grit',
  neutral: 'border-brand-400',
} as const
</script>

<template>
  <div class="border-l-2 bg-white/5 px-4 py-3" :class="tone[m.tone]">
    <p class="text-[15px] leading-snug font-semibold">{{ m.text }}</p>
  </div>
</template>
