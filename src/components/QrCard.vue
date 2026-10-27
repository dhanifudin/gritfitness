<script setup lang="ts">
import qrcode from 'qrcode-generator'
import { computed } from 'vue'

// Renders the daily QR payload client-side, same recipe as the official app:
// qrcode(0,'M'), svg cells, navy modules on a white card.
const props = defineProps<{
  payload: string
  title: string
  sub?: string
  compact?: boolean
  tight?: boolean
}>()

const svg = computed(() => {
  try {
    const qr = qrcode(0, 'M')
    qr.addData(props.payload)
    qr.make()
    return qr.createSvgTag({ cellSize: 5, margin: 1, scalable: true })
  } catch {
    return ''
  }
})
</script>

<template>
  <div class="card bg-white p-4 text-center dark:border-transparent" :class="compact ? 'p-4' : 'p-6'">
    <div
      class="qr-svg mx-auto aspect-square"
      :class="compact ? (tight ? 'w-[min(100%,15rem,27dvh)]' : 'w-[min(100%,15rem,34dvh)]') : 'w-full max-w-60'"
      role="img"
      aria-label="QR absensi"
      v-html="svg"
    />
    <p class="font-bold text-navy" :class="compact ? 'mt-2 leading-tight' : 'mt-3'">{{ title }}</p>
    <p v-if="sub" class="text-sm text-[#6b7280]">{{ sub }}</p>
    <slot />
  </div>
</template>

<style scoped>
.qr-svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.qr-svg :deep(path) {
  fill: #1b2a6b; /* navy modules, like the official app; the white rect background stays */
}
</style>
