<script setup lang="ts">
import { ref, watch } from 'vue'

// An <img> that never shows the browser's broken-image icon: a missing src, a 404 or an offline miss
// all fall back to a same-box placeholder (the caller's class sizes whichever one renders).
const props = defineProps<{ src?: string | null; alt?: string }>()
const failed = ref(false)
watch(() => props.src, () => (failed.value = false))
</script>

<template>
  <img v-if="src && !failed" :src="src" :alt="alt ?? ''" loading="lazy" @error="failed = true" />
  <div v-else class="flex items-center justify-center bg-white/5 text-white/25" role="img" :aria-label="alt || 'Foto belum tersedia'" data-testid="img-placeholder">
    <svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2.5 10v4M21.5 10v4M6 7v10M18 7v10M6 12h12" />
    </svg>
  </div>
</template>
