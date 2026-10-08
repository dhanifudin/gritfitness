<script setup lang="ts">
defineProps<{ loading?: boolean; error?: string; empty?: boolean; emptyText?: string; stale?: boolean; savedAt?: number }>()
defineEmits<{ retry: [] }>()

const hhmm = (t: number) => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div v-if="loading" class="space-y-3 px-5">
    <div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-2xl bg-white/5" />
  </div>
  <div v-else-if="error" class="px-5 text-center">
    <p class="text-sm text-red-300">{{ error }}</p>
    <button class="btn-ghost mt-3" @click="$emit('retry')">Coba lagi</button>
  </div>
  <template v-else>
    <p v-if="stale && savedAt" class="banner banner-warn mx-5 mb-3 !px-3 !py-2 !text-xs">
      Tidak bisa memperbarui · data tersimpan {{ hhmm(savedAt) }}
    </p>
    <div v-if="empty" class="px-5 py-10 text-center">
      <svg viewBox="0 0 24 24" class="mx-auto h-8 w-8 text-white/35" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M3 11h18M8 3v4M16 3v4" /></svg>
      <p class="mt-2 text-sm text-white/50">{{ emptyText ?? 'Belum ada data' }}</p>
    </div>
    <slot v-else />
  </template>
</template>
