<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmSheet from '@/components/ConfirmSheet.vue'
import PageHeader from '@/components/PageHeader.vue'
import SafeImg from '@/components/SafeImg.vue'
import { titleCase } from '@/lib/format'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()
onMounted(() => void auth.refreshUser())

const initial = computed(() => (auth.user?.nama?.[0] ?? 'M').toUpperCase())
const phone = computed(() => (auth.user?.telepon ? '+' + auth.user.telepon : ''))

const MENU = [
  { to: '/profile', label: 'Profil', testid: 'account-profile', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-5 8-5s8 1.7 8 5' },
  { to: '/memberships', label: 'Memberships Saya', testid: 'profile-memberships', icon: 'M3 7h18v10H3zM3 11h18' },
  { to: '/leave', label: 'Cuti Membership', testid: 'profile-leave', icon: 'M10 9v6M14 9v6M5 5h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z' },
  { to: '/bills', label: 'Tagihan', testid: 'account-bills', icon: 'M5 3h14v18l-2-1.5L15 21l-2-1.5L11 21l-2-1.5L7 21l-2-1.5zM9 8h6M9 12h6' },
  { to: '/progress', label: 'Progres', testid: 'account-progress', icon: 'M4 20h16M7 20v-6M12 20V6M17 20v-9' },
  { to: '/saved-qr', label: 'QR Tersimpan (offline)', testid: 'settings-saved-qr', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3z' },
  { to: '/settings', label: 'Pengaturan', testid: 'open-settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8 2 2 0 11-2.8 2.8 1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0 1.7 1.7 0 00-2.8-1.2 2 2 0 11-2.8-2.8A1.7 1.7 0 003 14.2a2 2 0 110-4 1.7 1.7 0 001.2-2.9 2 2 0 112.8-2.8A1.7 1.7 0 009.8 3a2 2 0 014 0 1.7 1.7 0 002.9 1.2 2 2 0 112.8 2.8A1.7 1.7 0 0021 9.8a2 2 0 010 4 1.7 1.7 0 00-1.6 1.2z' },
]

const confirmOut = ref(false)
const busy = ref(false)
async function doLogout() {
  busy.value = true
  try {
    await auth.logout()
    router.replace({ name: 'login' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <PageHeader title="Profil" />

  <div class="px-4 pb-6">
    <RouterLink to="/profile" class="card flex items-center gap-4 p-4">
      <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#1B2A6B,#E0155A)] text-2xl font-extrabold text-white">
        <SafeImg v-if="auth.user?.foto" :src="auth.user.foto" :alt="auth.user?.nama ?? ''" class="h-full w-full object-cover" />
        <template v-else>{{ initial }}</template>
      </div>
      <div class="min-w-0">
        <p class="truncate font-extrabold">{{ titleCase(auth.user?.nama) }}</p>
        <p class="mt-0.5 text-sm font-semibold text-mute">{{ phone }}</p>
        <p v-if="auth.user?.kode" class="text-xs text-mute">{{ auth.user.kode }}</p>
      </div>
    </RouterLink>

    <div v-if="auth.user?.pelajar" class="card mt-3 p-4 text-sm" data-testid="student-status">
      <div class="flex items-center justify-between gap-3">
        <p class="font-bold">Status Pelajar</p>
        <span class="pill" :class="auth.user.status_pelajar === 'disetujui' ? 'pill-ok' : auth.user.status_pelajar === 'ditolak' ? 'pill-danger' : 'pill-warn'">
          {{ auth.user.status_pelajar_label ?? auth.user.status_pelajar }}
        </span>
      </div>
      <p v-if="auth.user.status_pelajar === 'ditolak' && auth.user.pelajar_alasan_tolak" class="mt-2 text-xs text-danger">{{ auth.user.pelajar_alasan_tolak }}</p>
      <p v-else-if="auth.user.status_pelajar === 'menunggu'" class="mt-2 text-xs text-mute">Menunggu persetujuan admin.</p>
    </div>

    <nav class="menu mt-3">
      <RouterLink v-for="m in MENU" :key="m.to" :to="m.to" class="menu-item" :data-testid="m.testid">
        <svg viewBox="0 0 24 24" class="h-[22px] w-[22px] shrink-0 text-grit-500" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="m.icon" /></svg>
        <span class="min-w-0 flex-1 truncate">{{ m.label }}</span>
        <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-mute" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </RouterLink>
    </nav>

    <button class="btn-ghost btn-danger mt-4 w-full" data-testid="logout" @click="confirmOut = true">Keluar</button>
  </div>

  <ConfirmSheet
    :open="confirmOut"
    title="Keluar"
    message="Data latihan di perangkat ini ikut terhapus (yang sudah tersinkron tetap aman di cloud). Lanjutkan?"
    confirm-label="Ya, Keluar"
    danger
    :busy="busy"
    @confirm="doLogout"
    @close="confirmOut = false"
  />
</template>
