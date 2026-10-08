<script setup lang="ts">
import type { Motivation } from '@/lib/tracker'

defineProps<{ m: Motivation }>()
const tone = {
  good: 'banner-ok !text-white',
  push: 'banner-info',
  neutral: 'banner-info',
} as const
</script>

<template>
  <div class="banner" :class="tone[m.tone]">
    <p class="leading-snug font-semibold">{{ m.text }}</p>
  </div>
</template>
