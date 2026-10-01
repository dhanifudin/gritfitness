<script setup lang="ts">
import { computed } from 'vue'
import { badgeEmoji } from '@/lib/badgeEmoji'
import { useTracker } from '@/stores/tracker'

const tracker = useTracker()
const b = computed(() => tracker.newBadges[0])
const done = () => tracker.ackBadges(tracker.newBadges.map((x) => x.key))
</script>

<template>
  <Teleport to="body">
    <div v-if="b" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-6" role="dialog" aria-modal="true" aria-label="Pencapaian baru" data-testid="celebration">
      <div class="w-full max-w-sm rounded-3xl border border-lime-grit/30 bg-ink-900 p-7 text-center">
        <div class="text-6xl" aria-hidden="true">{{ badgeEmoji(b.key) }}</div>
        <p class="mt-3 text-xs font-semibold tracking-widest text-lime-grit uppercase">Pencapaian baru</p>
        <h2 class="mt-1 font-display text-2xl">{{ b.title }}</h2>
        <p class="mt-1 text-sm text-white/65">{{ b.desc }}</p>
        <p v-if="tracker.newBadges.length > 1" class="mt-2 text-xs text-white/45">+ {{ tracker.newBadges.length - 1 }} pencapaian lainnya</p>
        <button class="btn-primary mt-6 w-full" @click="done">Mantap!</button>
      </div>
    </div>
  </Teleport>
</template>
