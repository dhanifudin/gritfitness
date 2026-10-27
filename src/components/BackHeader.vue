<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{ title: string; subtitle?: string }>()
const router = useRouter()
const back = () => (window.history.state?.back ? router.back() : router.push('/'))
</script>

<template>
  <header class="flex min-h-[52px] items-center gap-1 px-2 pt-2 pb-1">
    <button class="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-wash" aria-label="Kembali" @click="back">
      <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
    <div class="min-w-0 flex-1">
      <h1 class="truncate text-lg font-extrabold">{{ title }}</h1>
      <p v-if="subtitle" class="truncate text-xs font-semibold text-mute">{{ subtitle }}</p>
    </div>
    <div class="flex shrink-0 gap-2 pr-2"><slot name="right" /></div>
  </header>
</template>
