<script setup lang="ts">
defineProps<{ loading?: boolean; error?: string; empty?: boolean; emptyText?: string; stale?: boolean; savedAt?: number }>()
defineEmits<{ retry: [] }>()

const hhmm = (t: number) => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div v-if="loading" class="space-y-3 px-4">
    <div v-for="i in 3" :key="i" class="skeleton h-24" />
  </div>
  <div v-else-if="error" class="px-4 text-center">
    <p class="text-sm text-danger">{{ error }}</p>
    <button class="btn-ghost mt-3" @click="$emit('retry')">Coba lagi</button>
  </div>
  <template v-else>
    <p v-if="stale && savedAt" class="banner banner-warn mx-4 mb-3 !px-3 !py-2 !text-xs">
      Tidak bisa memperbarui · data tersimpan {{ hhmm(savedAt) }}
    </p>
    <div v-if="empty" class="px-4 py-12 text-center">
      <svg viewBox="0 0 24 24" class="mx-auto h-12 w-12 text-line" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M3 11h18M8 3v4M16 3v4" /></svg>
      <p class="mt-2.5 text-sm text-mute">{{ emptyText ?? 'Belum ada data' }}</p>
    </div>
    <slot v-else />
  </template>
</template>
