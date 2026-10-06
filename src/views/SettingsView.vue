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
          <p class="truncate text-xs text-white/55">{{ i.hint }}</p>
        </div>
        <span class="text-white/40" aria-hidden="true">›</span>
      </RouterLink>
    </li>
  </ul>
</template>
