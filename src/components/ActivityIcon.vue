<script setup lang="ts">
// One small stroke icon per activity type — replaces the emoji so type markers match the app's icon set.
const PATHS: Record<string, string> = {
  gym: 'M4 9v6M20 9v6M7 12h10M7 8.5v7M17 8.5v7', // barbell
  class: 'M12 5v5M7 8l5 2.5L17 8M9 20l3-7 3 7', // figure
  pt: 'M16 8a4 4 0 10-8 0 4 4 0 008 0zM4 21c0-3.9 3.6-7 8-7s8 3.1 8 7', // person
  recovery: 'M3 10c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 15c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0', // waves
  other: 'M12 3l2.5 5.4 5.9.7-4.4 4 1.2 5.9L12 16l-5.2 3 1.2-5.9-4.4-4 5.9-.7z', // star
}
defineProps<{ kind: string }>()
</script>

<template>
  <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="PATHS[kind] ?? PATHS.other" />
  </svg>
</template>
