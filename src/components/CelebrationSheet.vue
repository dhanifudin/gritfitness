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
<Transition name="sheet" appear>    <div v-if="b" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-6" role="dialog" aria-modal="true" aria-label="Pencapaian baru" data-testid="celebration">
      <div class="sheet-panel w-full max-w-sm rounded-3xl border border-grit-500/30 bg-ink-900 p-7 text-center">
        <div class="text-6xl" aria-hidden="true">{{ badgeEmoji(b.key) }}</div>
        <p class="mt-3 text-xs font-semibold text-grit-300">Pencapaian baru</p>
        <h2 class="mt-1 font-display text-xl font-semibold">{{ b.title }}</h2>
        <p class="mt-1 text-sm text-white/70">{{ b.desc }}</p>
        <p v-if="tracker.newBadges.length > 1" class="mt-2 text-xs text-white/50">+ {{ tracker.newBadges.length - 1 }} pencapaian lainnya</p>
        <button class="btn-primary mt-6 w-full" @click="done">Mantap!</button>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>
