<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BackHeader from '@/components/BackHeader.vue'
import { useSyncLabel } from '@/composables/useSyncLabel'
import { getTheme, setTheme } from '@/lib/theme'
import { useTracker } from '@/stores/tracker'

const tracker = useTracker()
onMounted(() => tracker.init())
const syncLabel = useSyncLabel()
const version = __APP_VERSION__
const hour = computed(() => String(tracker.settings.reminder_hour ?? 17).padStart(2, '0'))

const dark = ref(getTheme() === 'dark')
function toggleDark() {
  dark.value = !dark.value
  setTheme(dark.value ? 'dark' : 'light')
}

const items = computed(() => [
  { to: '/settings/target', title: 'Target & pengingat', hint: `${tracker.settings.goal_per_week}x seminggu · pengingat ${hour.value}.00` },
  { to: '/settings/data', title: 'Data & sinkronisasi', hint: syncLabel.value },
  { to: '/settings/app', title: 'Aplikasi & akun', hint: `Versi ${version.sha}` },
  { to: '/saved-qr', title: 'QR Tersimpan (offline)', hint: 'Buka QR member tanpa login.' },
])
</script>

<template>
  <BackHeader title="Pengaturan" />
  <div class="px-4 pb-6">
    <button type="button" class="card flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left" data-testid="theme-toggle" @click="toggleDark">
      <div class="min-w-0">
        <p class="font-bold">Mode Gelap</p>
        <p class="truncate text-xs text-mute">{{ dark ? 'Aktif' : 'Nonaktif' }}</p>
      </div>
      <span class="switch" :class="dark ? 'switch-on' : ''">
        <span class="absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition" :class="dark ? 'translate-x-5' : ''" />
      </span>
    </button>

    <ul class="mt-3 space-y-3">
      <li v-for="i in items" :key="i.to">
        <RouterLink :to="i.to" class="card flex min-h-16 items-center justify-between gap-3 px-4 py-3" :data-testid="`settings-${i.to.split('/').pop()}`">
          <div class="min-w-0">
            <p class="font-bold">{{ i.title }}</p>
            <p class="truncate text-xs text-mute">{{ i.hint }}</p>
          </div>
          <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-mute" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
