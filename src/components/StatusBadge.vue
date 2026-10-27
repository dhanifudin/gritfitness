<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: string }>()
const tone = computed(() => {
  const s = props.status.toLowerCase()
  if (['lunas', 'dibayar', 'aktif', 'disetujui', 'approved', 'hadir', 'terkonfirmasi'].includes(s)) return 'pill-ok'
  if (['belum lunas', 'menunggu', 'pending', 'tidak aktif', 'proses', 'belum bayar', 'izin'].includes(s)) return 'pill-warn'
  if (['expired', 'belum dibayar', 'ditolak', 'batal', 'dibatalkan', 'terlambat', 'tidak hadir', 'no show'].includes(s)) return 'pill-danger'
  return 'pill-mute'
})
</script>

<template>
  <span class="pill shrink-0" :class="tone"><span class="pill-dot" aria-hidden="true" />{{ status }}</span>
</template>
