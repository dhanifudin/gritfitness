<script setup lang="ts">
defineProps<{ label: string; value?: string | number | null }>()
</script>

<template>
  <div class="flex items-start justify-between gap-4 py-2.5 text-sm">
    <dt class="shrink-0 text-white/50">{{ label }}</dt>
    <dd class="text-right"><slot>{{ value ?? '-' }}</slot></dd>
  </div>
</template>
