<script setup lang="ts">
defineProps<{ loading?: boolean; error?: string; empty?: boolean; emptyText?: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="loading" class="space-y-3 px-5">
    <div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-2xl bg-white/5" />
  </div>
  <div v-else-if="error" class="px-5 text-center">
    <p class="text-sm text-red-300">{{ error }}</p>
    <button class="btn-ghost mt-3" @click="$emit('retry')">Coba lagi</button>
  </div>
  <p v-else-if="empty" class="px-5 py-10 text-center text-sm text-white/50">{{ emptyText ?? 'Belum ada data' }}</p>
  <slot v-else />
</template>
