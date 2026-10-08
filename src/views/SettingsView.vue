<script setup lang="ts">
import { computed, onMounted } from 'vue'
import BackHeader from '@/components/BackHeader.vue'
import { useSyncLabel } from '@/composables/useSyncLabel'
import { useTracker } from '@/stores/tracker'

const tracker = useTracker()
onMounted(() => tracker.init())
const syncLabel = useSyncLabel()
const version = __APP_VERSION__
const hour = computed(() => String(tracker.settings.reminder_hour ?? 17).padStart(2, '0'))

const items = computed(() => [
  { to: '/settings/target', title: 'Target & pengingat', hint: `${tracker.settings.goal_per_week}x seminggu · pengingat ${hour.value}.00` },
  { to: '/settings/data', title: 'Data & sinkronisasi', hint: syncLabel.value },
  { to: '/settings/app', title: 'Aplikasi & akun', hint: `Versi ${version.sha}` },
])
</script>

<template>
  <BackHeader title="Pengaturan" />
  <ul class="space-y-3 px-5">
    <li v-for="i in items" :key="i.to">
      <RouterLink :to="i.to" class="card flex min-h-16 items-center justify-between gap-3 px-4 py-3" :data-testid="`settings-${i.to.split('/').pop()}`">
        <div class="min-w-0">
          <p class="font-semibold">{{ i.title }}</p>
          <p class="truncate text-xs text-white/50">{{ i.hint }}</p>
        </div>
        <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-white/35" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </RouterLink>
    </li>
  </ul>
</template>
