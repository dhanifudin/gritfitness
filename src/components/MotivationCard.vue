<script setup lang="ts">
import type { Motivation } from '@/lib/tracker'

defineProps<{ m: Motivation }>()
const tone = {
  good: 'from-emerald-500/25 to-ink-900 border-emerald-400/30',
  push: 'from-pink-grit/20 to-ink-900 border-pink-grit/30',
  neutral: 'from-brand-500/30 to-ink-900 border-white/10',
} as const
</script>

<template>
  <div class="rounded-2xl border bg-gradient-to-br p-4" :class="tone[m.tone]">
    <p class="text-[15px] leading-snug font-semibold">{{ m.text }}</p>
    <p class="mt-2 text-xs leading-relaxed text-white/55"><span aria-hidden="true">💡</span> {{ m.tip }}</p>
  </div>
</template>
