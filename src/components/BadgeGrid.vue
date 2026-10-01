<script setup lang="ts">
import { badgeEmoji } from '@/lib/badgeEmoji'
import type { Badge } from '@/lib/tracker'

defineProps<{ badges: Badge[] }>()
</script>

<template>
  <ul class="grid grid-cols-2 gap-3">
    <li v-for="b in badges" :key="b.key" class="card p-3" :class="b.unlocked ? 'border-lime-grit/30' : ''" :data-unlocked="b.unlocked">
      <div class="text-3xl" :class="b.unlocked ? '' : 'opacity-30 grayscale'" aria-hidden="true">{{ badgeEmoji(b.key) }}</div>
      <p class="mt-1 text-sm font-semibold" :class="b.unlocked ? '' : 'text-white/50'">{{ b.title }}</p>
      <p class="text-[11px] leading-snug text-white/45">{{ b.desc }}</p>
      <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div class="h-full rounded-full" :class="b.unlocked ? 'bg-lime-grit' : 'bg-brand-400'" :style="{ width: Math.round((b.value / b.target) * 100) + '%' }" />
      </div>
      <p class="mt-1 text-[10px] text-white/40">{{ b.unlocked ? 'Terbuka' : `${b.value}/${b.target}` }}</p>
    </li>
  </ul>
</template>
