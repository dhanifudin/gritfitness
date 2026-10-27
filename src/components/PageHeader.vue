<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <header class="flex min-h-[52px] items-center justify-between gap-3 px-4 pt-4 pb-2">
    <div class="min-w-0">
      <h1 class="text-lg font-extrabold">{{ title }}</h1>
      <p v-if="subtitle" class="mt-0.5 text-sm font-semibold text-mute">{{ subtitle }}</p>
    </div>
    <div class="flex shrink-0 gap-2"><slot name="right" /></div>
  </header>
</template>
