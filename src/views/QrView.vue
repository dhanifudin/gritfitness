<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { membershipActive, myClasses, myClassDetail } from '@/api/endpoints'
import CheckInButton from '@/components/CheckInButton.vue'
import QrCard from '@/components/QrCard.vue'
import { titleCase } from '@/lib/format'
import { daysLeft, hasValidQr, loadClassQrs, loadQr, preselectQr, pruneClassQrs, qrStale, syncClassQr, syncQr, type ClassQrEntry, type QrEntry } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'
import { useWakeLock } from '@/composables/useWakeLock'

// Live QR (needs a session). Every successful load refreshes the cache that SavedQrView shows.
// The membership QR payload rotates daily, so each open re-fetches today's.
const auth = useAuth()
const router = useRouter()
useWakeLock() // this is the gym-door screen: don't let it dim/sleep mid-scan

const gym = ref<QrEntry | null>(loadQr())
const classes = ref<ClassQrEntry[]>(loadClassQrs())
const noPackage = ref(false)
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
        syncQr(user, res)
        gym.value = loadQr()
        noPackage.value = !res.aktif
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

const timeShort = (t: string) => t.slice(0, 5).replace(':', '.')
/** Everything the member can open with: the membership QR plus one QR per booked class. */
const options = computed(() => [
  ...(gym.value ? [{ key: 'gym', label: 'Membership', hint: gym.value.aktif_sampai ? `s.d. ${gym.value.aktif_sampai}` : '' }] : []),
  ...classes.value.map((c) => ({ key: 'c' + c.schedule_id, label: titleCase(c.nama), hint: `${c.tanggal_label} · ${timeShort(c.jam_mulai)}` })),
])
/** everything except the QR currently shown, as a collapsed list under the card */
const collapsed = computed(() => options.value.filter((o) => o.key !== active.value))
const curClass = computed(() => (active.value.startsWith('c') ? classes.value.find((c) => 'c' + c.schedule_id === active.value) ?? null : null))
const cur = computed(() => (curClass.value ? null : gym.value))
const many = computed(() => options.value.length > 1)
const left = computed(() => (cur.value ? daysLeft(cur.value) : null))
const stamp = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex h-full flex-col px-4 pt-5">
    <div class="flex items-center justify-between gap-3">
      <p class="min-w-0 truncate text-lg font-extrabold">{{ auth.user?.nama }}</p>
    </div>

    <div v-if="loading" class="skeleton mt-3 p-4">
      <div class="mx-auto aspect-square w-[min(100%,15rem,34dvh)]" />
    </div>
    <QrCard
      v-else-if="curClass"
      :payload="curClass.payload"
      compact
      :tight="many"
      :title="titleCase(curClass.nama)"
      :sub="`${curClass.tanggal_label} · ${curClass.jam_mulai.slice(0, 5)}–${curClass.jam_selesai.slice(0, 5)}`"
      class="mt-3"
      data-testid="class-qr"
    />
    <QrCard v-else-if="cur" :payload="cur.payload" compact :tight="many" :title="titleCase(cur.tier)" :sub="`Aktif s.d ${cur.aktif_sampai}`" class="mt-3" data-testid="gym-qr">
      <p
        v-if="left !== null"
        class="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold"
        :class="left <= 7 ? 'bg-(--warn-bg) text-warn' : 'bg-(--ok-bg) text-ok'"
      >
        {{ left === 0 ? 'Berakhir hari ini' : `Sisa ${left} hari` }}
      </p>
    </QrCard>
    <div v-else class="card mt-3 p-6 py-8 text-center">
      <svg viewBox="0 0 24 24" class="mx-auto h-10 w-10 text-line" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 14v3h-3M14 20h3" /></svg>
      <p class="mt-3 font-bold">{{ noPackage ? 'Tidak ada paket aktif' : 'QR belum tersedia' }}</p>
      <RouterLink to="/packages" class="btn-primary mt-4">Lihat paket</RouterLink>
    </div>

    <p v-if="cur && qrStale(cur)" class="banner banner-warn mt-2 !py-2 !text-xs" data-testid="qr-stale">
      QR ini dari {{ cur.tanggal }} — sambungkan internet dan buka ulang untuk QR hari ini.
    </p>
    <div v-if="cur || curClass" class="mt-2 flex items-center justify-center gap-2 text-xs text-mute">
      <span>Disimpan {{ stamp((curClass ?? cur)!.savedAt) }}<template v-if="failed"> · mode offline</template></span>
      <button v-if="failed" class="btn-sm" @click="load">Coba lagi</button>
    </div>
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
    <CheckInButton minimal class="mt-2" />
  </div>
</template>
