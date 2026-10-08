<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{ title: string; subtitle?: string }>()
const router = useRouter()
const back = () => (window.history.state?.back ? router.back() : router.push('/'))
</script>

<template>
  <header class="flex items-center gap-2 px-3 pt-8 pb-3">
    <button class="flex h-11 w-11 items-center justify-center rounded-full text-white/70 active:bg-white/10" aria-label="Kembali" @click="back">
      <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
    <div class="min-w-0">
      <h1 class="truncate font-display text-xl font-semibold">{{ title }}</h1>
      <p v-if="subtitle" class="truncate text-xs text-white/50">{{ subtitle }}</p>
    </div>
  </header>
</template>
