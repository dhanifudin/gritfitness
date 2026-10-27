<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { membershipActive, myClasses, myClassDetail } from '@/api/endpoints'
import type { ActiveMembership } from '@/api/types'
import BackHeader from '@/components/BackHeader.vue'
import QrCard from '@/components/QrCard.vue'
import { titleCase } from '@/lib/format'
import { hasValidQr, loadClassQrs, loadQr, preselectQr, pruneClassQrs, qrStale, syncClassQr, syncQr, type ClassQrEntry, type QrEntry } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'
import { useWakeLock } from '@/composables/useWakeLock'

// Official "Paket Aktif" screen (pages/membership.f7.html): hero, membership info rows, QR Absensi —
// plus our extras underneath: per-booking class QRs and the offline cache/staleness handling.
// Every successful load refreshes the cache that SavedQrView shows; the payload rotates daily.
const auth = useAuth()
const router = useRouter()
useWakeLock() // this is the gym-door screen: don't let it dim/sleep mid-scan

const live = ref<ActiveMembership | null>(null)
const gym = ref<QrEntry | null>(loadQr())
const classes = ref<ClassQrEntry[]>(loadClassQrs())
const active = ref<string>(preselectQr(classes.value) ?? 'gym')
const loading = ref(!gym.value && !classes.value.length)
const failed = ref(false)

async function load() {
  if (!auth.loggedIn || !auth.user) {
    // session ran out while the app was open
    router.replace(hasValidQr() ? { name: 'saved-qr' } : { name: 'login', query: { redirect: '/qr' } })
    return
  }
  const user = { id: auth.user.id, nama: auth.user.nama }
  failed.value = false
  loading.value = !gym.value && !classes.value.length
  await Promise.all([
    (async () => {
      try {
        const res = await membershipActive()
        live.value = res
        syncQr(user, res)
        gym.value = loadQr()
      } catch {
        failed.value = true // offline / server down: keep whatever the cache holds
      }
    })(),
    (async () => {
      try {
        const r = await myClasses()
        pruneClassQrs(user, r.mendatang.map((m) => m.schedule_id))
        for (const m of r.mendatang) {
          try {
            syncClassQr(user, m.schedule_id, await myClassDetail(m.schedule_id))
          } catch {
            /* that one stays cached as-is */
          }
        }
        classes.value = loadClassQrs()
      } catch {
        failed.value = true
      }
    })(),
  ])
  if (!options.value.some((o) => o.key === active.value)) active.value = preselectQr(classes.value) ?? options.value[0]?.key ?? 'gym'
  loading.value = false
}

const onVisible = () => document.visibilityState === 'visible' && load()
onMounted(() => {
  void load()
  document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => document.removeEventListener('visibilitychange', onVisible))

const m = computed(() => live.value?.membership ?? null)
const heroPct = computed(() => (m.value && m.value.total_hari > 0 ? Math.round((m.value.sisa_hari / m.value.total_hari) * 100) : 0))

const timeShort = (t: string) => t.slice(0, 5).replace(':', '.')
/** Everything the member can open with: the membership QR plus one QR per booked class. */
const options = computed(() => [
  ...(gym.value ? [{ key: 'gym', label: 'Membership', hint: gym.value.aktif_sampai ? `s.d. ${gym.value.aktif_sampai}` : '' }] : []),
  ...classes.value.map((c) => ({ key: 'c' + c.schedule_id, label: titleCase(c.nama), hint: `${c.tanggal_label} · ${timeShort(c.jam_mulai)}` })),
])
const collapsed = computed(() => options.value.filter((o) => o.key !== active.value))
const curClass = computed(() => (active.value.startsWith('c') ? classes.value.find((c) => 'c' + c.schedule_id === active.value) ?? null : null))
const cur = computed(() => (curClass.value ? null : gym.value))
const stamp = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <BackHeader title="Paket Aktif" />

  <div v-if="loading" class="space-y-3 px-4">
    <div class="skeleton h-[118px]" />
    <div class="skeleton h-[120px]" />
  </div>
  <div v-else-if="live && !live.aktif && !gym" class="px-4 py-12 text-center">
    <svg viewBox="0 0 24 24" class="mx-auto h-12 w-12 text-line" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
    <p class="mt-2.5 text-sm text-mute">Belum ada membership aktif.</p>
    <RouterLink to="/packages" class="btn-primary mt-4 inline-flex !px-6">Lihat Paket</RouterLink>
  </div>
  <div v-else class="px-4 pb-6">
    <!-- hero, exactly the official Paket Aktif header -->
    <div v-if="m" class="hero" data-testid="membership-hero">
      <div class="flex items-start justify-between gap-3">
        <span class="text-[11px] font-bold tracking-[.05em] text-[#ffd0e0] uppercase">Paket {{ titleCase(m.tier) }}</span>
        <span class="pill shrink-0 !bg-white/20 !text-white">{{ m.status }}</span>
      </div>
      <p class="mt-3 text-xs font-semibold text-[#f0d9e2]">Sisa masa aktif</p>
      <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/25">
        <span class="block h-full rounded-full bg-white" :style="{ width: heroPct + '%' }" />
      </div>
      <p class="mt-1.5 text-xs font-bold">{{ m.sisa_hari }} / {{ m.total_hari }} hari</p>
    </div>

    <div v-if="m" class="card mt-3 p-4 text-sm">
      <div class="flex justify-between border-b border-line py-[7px] text-[13px]"><span class="font-semibold text-mute">Nama</span><span class="font-bold">{{ titleCase(m.nama) }}</span></div>
      <div class="flex justify-between border-b border-line py-[7px] text-[13px]"><span class="font-semibold text-mute">Kode Member</span><span class="font-bold">{{ m.kode_member }}</span></div>
      <div class="flex justify-between border-b border-line py-[7px] text-[13px]"><span class="font-semibold text-mute">Mulai</span><span class="font-bold">{{ m.tanggal_mulai }}</span></div>
      <div class="flex justify-between py-[7px] text-[13px]"><span class="font-semibold text-mute">Aktif sampai</span><span class="font-bold">{{ m.aktif_sampai }}</span></div>
    </div>

    <p class="mt-5 mb-2 text-[15px] font-extrabold">QR Absensi</p>
    <QrCard
      v-if="curClass"
      :payload="curClass.payload"
      compact
      :title="titleCase(curClass.nama)"
      :sub="`${curClass.tanggal_label} · ${curClass.jam_mulai.slice(0, 5)}–${curClass.jam_selesai.slice(0, 5)}`"
      data-testid="class-qr"
    />
    <QrCard v-else-if="cur" :payload="cur.payload" compact :title="titleCase(cur.tier)" :sub="`Aktif s.d ${cur.aktif_sampai}`" data-testid="gym-qr" />
    <div v-else class="card p-6 text-center text-sm text-mute">QR belum tersedia.</div>

    <p v-if="cur && qrStale(cur)" class="banner banner-warn mt-2 !py-2 !text-xs" data-testid="qr-stale">
      QR ini dari {{ cur.tanggal }} — sambungkan internet dan buka ulang untuk QR hari ini.
    </p>
    <p v-if="cur || curClass" class="mt-2 flex items-center justify-center gap-2 text-center text-xs text-mute">
      Disimpan {{ stamp((curClass ?? cur)!.savedAt) }}<template v-if="failed"> · mode offline</template>
      <button v-if="failed" class="btn-sm" @click="load">Coba lagi</button>
    </p>

    <div v-if="collapsed.length" class="mt-2 space-y-2" data-testid="qr-rows">
      <button
        v-for="o in collapsed"
        :key="o.key"
        type="button"
        class="card flex min-h-12 w-full items-center gap-2.5 px-4 py-2 text-left"
        data-testid="qr-row"
        @click="active = o.key"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-mute" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3z" /></svg>
        <span class="min-w-0 flex-1 truncate text-sm font-bold">{{ o.label }}</span>
        <span class="shrink-0 text-xs text-mute">{{ o.hint }}</span>
      </button>
    </div>
  </div>
</template>
