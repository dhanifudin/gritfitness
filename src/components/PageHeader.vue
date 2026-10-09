<script setup lang="ts">
import ProfileButton from '@/components/ProfileButton.vue'
import SettingsButton from '@/components/SettingsButton.vue'

defineProps<{ title: string; subtitle?: string; gear?: boolean }>()
</script>

<template>
  <header class="flex items-start justify-between gap-3 px-5 pt-8 pb-3">
    <div class="min-w-0">
      <h1 class="font-display text-2xl font-semibold">{{ title }}</h1>
      <p v-if="subtitle" class="mt-0.5 text-sm text-white/50">{{ subtitle }}</p>
    </div>
    <div v-if="gear" class="flex shrink-0 gap-2"><ProfileButton /><SettingsButton /></div>
  </header>
</template>
