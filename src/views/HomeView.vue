<script setup lang="ts">
import { titleCase } from '@/lib/format'
import { computed, onMounted } from 'vue'
import { dashboard } from '@/api/endpoints'
import AvatarButton from '@/components/AvatarButton.vue'
import ConsentSheet from '@/components/ConsentSheet.vue'
import { useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'
import { prefetchAll } from '@/lib/prefetch'
import { useAuth } from '@/stores/auth'
import { useTracker } from '@/stores/tracker'

// Pure official dashboard (pages/dashboard.f7.html): header, membership hero, Kelas Berikutnya.
// Everything this app adds beyond the official one lives behind the avatar's hidden menu.
const auth = useAuth()
const tracker = useTracker()
const uid = auth.user!.id

onMounted(() => {
  tracker.init(uid)
  void tracker.sync()
  void prefetchAll({ id: uid, nama: auth.user!.nama }) // keeps the offline QR + tab caches warm
})

const { data: dash } = useAsync(dashboard, null, { key: CK.dashboard })

const first = computed(() => (auth.user!.nama.split(' ')[0] ?? '').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))
const m = computed(() => dash.value?.membership ?? null)
const heroPct = computed(() => (m.value && m.value.total_hari > 0 ? Math.round((m.value.sisa_hari / m.value.total_hari) * 100) : 0))
const next = computed(() => dash.value?.kelas_berikutnya ?? null)
const nextMeta = computed(() => (next.value ? [`${next.value.tanggal_label}, ${next.value.jam}`, next.value.ruangan, next.value.instruktur].filter(Boolean).join(' · ') : ''))

// bell dot: latest notification newer than the last time the list was opened
const hasUnread = computed(() => {
  const latest = dash.value?.notif_latest_at
  if (!latest) return false
  const seen = localStorage.getItem('grit.notifSeen')
  return !seen || new Date(latest) > new Date(seen)
})
</script>

<template>
  <div class="px-4 pt-5 pb-6">
    <!-- Header: avatar (hidden-menu toggle) + greeting + bell, exactly the official dash-header -->
    <div class="flex items-center gap-3">
      <AvatarButton :size="46" />
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-xl font-extrabold">Halo, {{ first }}!</h1>
        <p class="text-[13px] font-semibold text-mute">Yuk latihan hari ini 💪</p>
      </div>
      <RouterLink to="/notifications" class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wash text-ink" aria-label="Notifikasi" data-testid="open-notifications">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>
        <span v-if="hasUnread" class="absolute top-2 right-2 h-2 w-2 rounded-full bg-grit-500" aria-hidden="true" />
      </RouterLink>
    </div>

    <!-- Membership hero -->
    <div v-if="!dash" class="skeleton mt-3 min-h-[118px]" />
    <RouterLink v-else-if="m" to="/qr" class="hero mt-3 block" data-testid="membership-hero">
      <div class="flex items-start justify-between gap-3">
        <span class="text-[11px] font-bold tracking-[.05em] text-[#ffd0e0] uppercase">Paket {{ titleCase(m.tier) }}</span>
        <span class="shrink-0 text-xs font-semibold text-[#f0d9e2]">Aktif s.d {{ m.aktif_sampai }}</span>
      </div>
      <p class="mt-3 text-xs font-semibold text-[#f0d9e2]">Sisa masa aktif</p>
      <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/25">
        <span class="block h-full rounded-full bg-white" :style="{ width: heroPct + '%' }" />
      </div>
      <div class="mt-1.5 flex items-center justify-between">
        <span class="text-xs font-bold">{{ m.sisa_hari }} / {{ m.total_hari }} hari</span>
        <span class="flex items-center gap-1 text-xs font-semibold text-[#f0d9e2]">
          QR Absensi
          <svg viewBox="0 0 24 24" class="h-[15px] w-[15px]" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3z" /></svg>
        </span>
      </div>
    </RouterLink>
    <div v-else class="card mt-3 flex items-center justify-between gap-3 p-4" data-testid="no-membership">
      <div class="min-w-0">
        <p class="font-extrabold">Belum ada membership aktif</p>
        <p class="mt-0.5 text-sm text-mute">Ambil paket untuk mulai berlatih di GRIT.</p>
      </div>
      <RouterLink to="/packages" class="btn-primary !min-h-[42px] shrink-0 !px-5 !py-2 !text-sm">Lihat Paket</RouterLink>
    </div>

    <!-- Kelas Berikutnya -->
    <p class="mt-5 mb-2 px-0 text-[15px] font-extrabold">Kelas Berikutnya</p>
    <div v-if="!dash" class="skeleton h-[84px]" />
    <RouterLink v-else-if="next" :to="`/my-classes/${next.schedule_id}`" class="card flex items-center gap-3.5 p-4" data-testid="next-class">
      <div class="h-14 w-14 shrink-0 rounded-xl bg-[repeating-linear-gradient(45deg,#1B2A6B,#1B2A6B_6px,#26357d_6px,#26357d_12px)]" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-extrabold">{{ titleCase(next.nama) }}</p>
        <p class="mt-0.5 text-[13px] font-semibold text-mute">{{ nextMeta }}</p>
      </div>
    </RouterLink>
    <RouterLink v-else to="/classes" class="card flex items-center gap-3 p-4" data-testid="no-next-class">
      <svg viewBox="0 0 24 24" class="h-[22px] w-[22px] shrink-0 text-mute" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" /></svg>
      <p class="min-w-0 flex-1 text-sm text-mute">Belum ada kelas terjadwal.</p>
      <span class="shrink-0 text-sm font-bold text-grit-500">Booking</span>
    </RouterLink>
  </div>

  <ConsentSheet v-if="tracker.needsConsent && tracker.memberId != null" />
</template>
