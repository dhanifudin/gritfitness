<script setup lang="ts">
import type { QrEntry } from '@/lib/qrCache'

defineProps<{ entry: QrEntry }>()
</script>

<template>
  <div class="rounded-3xl bg-white p-6 text-center text-ink-900">
    <img :src="`data:image/svg+xml;base64,${entry.qr_code}`" alt="QR Member" class="mx-auto w-full max-w-72" />
    <p class="mt-3 font-semibold">{{ entry.nama_paket }}</p>
    <p class="text-sm text-ink-700/80">{{ entry.tanggal_mulai }} – {{ entry.tanggal_selesai }}</p>
    <slot />
  </div>
</template>
