<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: string }>()
const tone = computed(() => {
  const s = props.status.toLowerCase()
  if (['lunas', 'dibayar', 'aktif', 'disetujui', 'approved'].includes(s)) return 'bg-emerald-500/20 text-emerald-300'
  if (['belum lunas', 'menunggu', 'pending', 'tidak aktif', 'proses'].includes(s)) return 'bg-amber-500/20 text-amber-300'
  if (['expired', 'belum dibayar', 'ditolak', 'batal', 'dibatalkan'].includes(s)) return 'bg-red-500/20 text-red-300'
  return 'bg-white/10 text-white/70'
})
</script>

<template>
  <span class="inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" :class="tone">{{ status }}</span>
</template>
