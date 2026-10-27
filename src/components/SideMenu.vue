<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ActivitySheet from '@/components/ActivitySheet.vue'
import SafeImg from '@/components/SafeImg.vue'
import { useInstall } from '@/composables/useSw'
import { useSideMenu } from '@/composables/useSideMenu'
import { getTheme, setTheme } from '@/lib/theme'
import { titleCase } from '@/lib/format'
import { useAuth } from '@/stores/auth'
import { useTracker } from '@/stores/tracker'

// The hidden menu: everything this app adds on top of the official one, in one right-side
// drawer so the four official tabs stay pixel-exact. Toggled by the avatar button.
const auth = useAuth()
const tracker = useTracker()
const menu = useSideMenu()
const router = useRouter()
const install = useInstall()

const initial = computed(() => (auth.user?.nama?.[0] ?? 'M').toUpperCase())
const checkIn = ref(false)

const dark = ref(getTheme() === 'dark')
function toggleDark() {
  dark.value = !dark.value
  setTheme(dark.value ? 'dark' : 'light')
}

function openCheckIn() {
  menu.close()
  tracker.init()
  checkIn.value = true
}

// close when the route changes some other way (back button etc.)
watch(() => router.currentRoute.value.fullPath, () => menu.close())

const ITEMS = [
  { to: '/qr', label: 'QR Absensi', testid: 'menu-qr', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3z' },
  { to: '/saved-qr', label: 'QR Tersimpan (offline)', testid: 'menu-saved-qr', icon: 'M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M8 8h3v3H8zM13 8h3M8 13h3M13 13h3v3h-3z' },
  { action: openCheckIn, label: 'Catat Latihan', testid: 'menu-checkin', icon: 'M4 9v6M20 9v6M7 12h10M7 8v8M17 8v8' },
  { to: '/auto-booking', label: 'Booking Otomatis', testid: 'menu-auto-booking', icon: 'M12 8v4l2.5 2.5M21 12a9 9 0 11-9-9c2.5 0 4.8 1 6.4 2.6L21 8M21 3v5h-5' },
  { to: '/my-classes', label: 'Kelas Saya', testid: 'menu-my-classes', icon: 'M12 3l9 6-9 6-9-6zM5 13v4l7 4 7-4v-4' },
  { to: '/progress', label: 'Progres', testid: 'menu-progress', icon: 'M4 20h16M7 20v-6M12 20V6M17 20v-9' },
  { to: '/settings/target', label: 'Target & Pengingat', testid: 'menu-target', icon: 'M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0M12 12m-6 0a6 6 0 1012 0 6 6 0 10-12 0M12 12m-10 0a10 10 0 1020 0 10 10 0 10-20 0' },
  { to: '/settings/data', label: 'Data & Sinkronisasi', testid: 'menu-data', icon: 'M20 17a4 4 0 00-1-7.9A6 6 0 007.3 7.9 4.5 4.5 0 008 17z M12 12v6M9.5 15.5L12 18l2.5-2.5' },
] as const
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="menu.open.value" class="fixed inset-0 z-50 bg-black/60" role="dialog" aria-modal="true" aria-label="Menu lainnya" @click.self="menu.close()">
        <div class="drawer-panel safe-t safe-b ml-auto flex h-full w-[82%] max-w-xs flex-col overflow-y-auto bg-page shadow-[-8px_0_32px_rgba(27,42,107,.15)]" data-testid="side-menu">
          <div class="flex items-center gap-3 border-b border-line p-4">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#1B2A6B,#E0155A)] text-lg font-extrabold text-white">
              <SafeImg v-if="auth.user?.foto" :src="auth.user.foto" :alt="auth.user?.nama ?? ''" class="h-full w-full object-cover" />
              <template v-else>{{ initial }}</template>
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-extrabold">{{ titleCase(auth.user?.nama) }}</p>
              <p class="text-xs font-semibold text-mute">{{ auth.user?.kode }}</p>
            </div>
            <button class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-soft active:bg-wash" aria-label="Tutup menu" @click="menu.close()">
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <nav class="menu m-3">
            <template v-for="m in ITEMS" :key="m.label">
              <component
                :is="'to' in m ? 'RouterLink' : 'button'"
                v-bind="'to' in m ? { to: m.to } : { type: 'button' }"
                class="menu-item"
                :data-testid="m.testid"
                @click="'action' in m ? m.action() : menu.close()"
              >
                <svg viewBox="0 0 24 24" class="h-[22px] w-[22px] shrink-0 text-grit-500" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="m.icon" /></svg>
                <span class="min-w-0 flex-1 truncate">{{ m.label }}</span>
                <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-mute" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
              </component>
            </template>
            <button type="button" class="menu-item" data-testid="menu-dark" @click="toggleDark">
              <svg viewBox="0 0 24 24" class="h-[22px] w-[22px] shrink-0 text-grit-500" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" /></svg>
              <span class="min-w-0 flex-1 truncate">Mode Gelap</span>
              <span class="switch !h-6 !w-10" :class="dark ? 'switch-on' : ''">
                <span class="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition" :class="dark ? 'translate-x-4' : ''" />
              </span>
            </button>
          </nav>

          <button v-if="install.canInstall()" class="btn-ghost mx-3 mb-3" @click="install.install()">Pasang aplikasi di layar utama</button>
          <p v-else-if="install.showIosHint()" class="mx-4 mb-3 text-xs text-mute">Untuk memasang: ketuk tombol Bagikan lalu “Tambah ke Layar Utama”.</p>
        </div>
      </div>
    </Transition>
  </Teleport>
  <ActivitySheet v-if="checkIn" @close="checkIn = false" />
</template>
