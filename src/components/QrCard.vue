<script setup lang="ts">
import type { QrEntry } from '@/lib/qrCache'

defineProps<{ entry: QrEntry; compact?: boolean }>()
</script>

<template>
  <div class="relative">
    <!-- scanner-style corner brackets: this is the one screen a member holds up at the door -->
    <span class="pointer-events-none absolute -top-1.5 -left-1.5 h-6 w-6 rounded-tl-lg border-t-2 border-l-2 border-lime-grit" aria-hidden="true" />
    <span class="pointer-events-none absolute -top-1.5 -right-1.5 h-6 w-6 rounded-tr-lg border-t-2 border-r-2 border-lime-grit" aria-hidden="true" />
    <span class="pointer-events-none absolute -bottom-1.5 -left-1.5 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-lime-grit" aria-hidden="true" />
    <span class="pointer-events-none absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-lime-grit" aria-hidden="true" />
    <div class="rounded-3xl bg-white text-center text-ink-900" :class="compact ? 'p-4' : 'p-6'">
      <img
        :src="`data:image/svg+xml;base64,${entry.qr_code}`"
        alt="QR Member"
        class="mx-auto aspect-square"
        :class="compact ? 'w-[min(100%,18rem,34dvh)]' : 'w-full max-w-72'"
      />
      <p class="font-semibold" :class="compact ? 'mt-2 leading-tight' : 'mt-3'">{{ entry.nama_paket }}</p>
      <p class="text-sm text-ink-700/80">{{ entry.tanggal_mulai }} – {{ entry.tanggal_selesai }}</p>
      <slot />
    </div>
  </div>
</template>
