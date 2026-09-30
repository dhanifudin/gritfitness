<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <header class="px-5 pt-8 pb-3">
    <h1 class="font-display text-2xl font-semibold">{{ title }}</h1>
    <p v-if="subtitle" class="mt-0.5 text-sm text-white/55">{{ subtitle }}</p>
  </header>
</template>
