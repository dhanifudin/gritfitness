<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { classQrs, memberAktif, memberPtAktif } from '@/api/endpoints'
import CheckInButton from '@/components/CheckInButton.vue'
import QrCard from '@/components/QrCard.vue'
import ProfileButton from '@/components/ProfileButton.vue'
import SettingsButton from '@/components/SettingsButton.vue'
import { titleCase } from '@/lib/format'
import { hasValidQr, loadClassQrs, loadQr, preselectQr, syncClassQrs, syncQr, type ClassQrEntry, type QrEntry, type QrKind } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'
import { useWakeLock } from '@/composables/useWakeLock'

// Live QR (needs a session). Every successful load refreshes the cache that SavedQrView shows.
const auth = useAuth()
const router = useRouter()
useWakeLock() // this is the gym-door screen: don't let it dim/sleep mid-scan

const kinds = [
  { key: 'gym', label: 'Membership', fetch: memberAktif },
  { key: 'pt', label: 'Personal Trainer', fetch: memberPtAktif },
] as const

const items = ref<Record<QrKind, QrEntry | null>>({ gym: loadQr('gym'), pt: loadQr('pt') })
const classes = ref<ClassQrEntry[]>(loadClassQrs())
const serverSaid = ref<Record<QrKind, string>>({ gym: '', pt: '' }) // {error} text when the server says no package
const active = ref<string>(preselectQr(classes.value) ?? (items.value.gym || !items.value.pt ? 'gym' : 'pt'))
const loading = ref(!items.value.gym && !items.value.pt)
const failed = ref(false)

async function load() {
  if (!auth.loggedIn || !auth.user) {
    // session ran out while the app was open
    router.replace(hasValidQr() ? { name: 'saved-qr' } : { name: 'login', query: { redirect: '/qr' } })
    return
  }
  const user = { id: auth.user.id, nama: auth.user.nama }
  failed.value = false
  loading.value = !items.value.gym && !items.value.pt
  await Promise.all([
    ...kinds.map(async (k) => {
      try {
        const res = await k.fetch(user.id)
        syncQr(user, k.key, res)
        items.value[k.key] = loadQr(k.key)
        serverSaid.value[k.key] = res.error ?? ''
      } catch {
        failed.value = true // offline / server down: keep whatever the cache holds
      }
    }),
    (async () => {
      try {
        syncClassQrs(user, await classQrs(user.id))
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
/** Everything the member can open with: membership/PT, plus one QR per registered class. */
const options = computed(() => [
  ...(items.value.gym ? [{ key: 'gym', label: 'Membership', hint: items.value.gym.tanggal_selesai ? `s.d. ${items.value.gym.tanggal_selesai}` : '' }] : []),
  ...(items.value.pt ? [{ key: 'pt', label: 'Personal Trainer', hint: items.value.pt.tanggal_selesai ? `s.d. ${items.value.pt.tanggal_selesai}` : '' }] : []),
  ...classes.value.map((c) => ({ key: 'c' + c.id, label: titleCase(c.nama_jadwal_kelas), hint: `Hari ini · ${timeShort(c.jam_awal)}` })),
])
/** everything except the QR currently shown, as a collapsed list under the card */
const collapsed = computed(() => options.value.filter((o) => o.key !== active.value))
const curClass = computed(() => (active.value.startsWith('c') ? classes.value.find((c) => 'c' + c.id === active.value) ?? null : null))
const cur = computed(() => (curClass.value ? null : items.value[active.value as QrKind]))
const many = computed(() => options.value.length > 1)
const stamp = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const noPackageText = computed(() => (serverSaid.value[active.value as QrKind] === 'Cuti' ? 'Anda sedang cuti' : 'Tidak ada paket aktif'))
</script>

<template>
  <div class="flex h-full flex-col px-5 pt-5">
    <div class="flex items-center justify-between gap-3">
      <p class="min-w-0 truncate font-display text-lg font-semibold">{{ auth.user?.nama }}</p>
      <div class="flex shrink-0 gap-2"><ProfileButton /><SettingsButton /></div>
    </div>

    <div v-if="loading" class="mt-3 rounded-3xl bg-white p-4">
      <div class="mx-auto aspect-square w-[min(100%,18rem,34dvh)] animate-pulse rounded-xl bg-ink-900/10" />
    </div>
    <QrCard
      v-else-if="curClass"
      :entry="curClass"
      compact
      :tight="many"
      :title="titleCase(curClass.nama_jadwal_kelas)"
      :sub="`${curClass.tanggal} · ${curClass.jam_awal.slice(0, 5)}–${curClass.jam_akhir.slice(0, 5)}`"
      class="mt-3"
      data-testid="class-qr"
    />
    <QrCard v-else-if="cur" :entry="cur" compact :tight="many" class="mt-3" />
    <div v-else class="mt-3 rounded-3xl bg-white p-6 py-8 text-center text-ink-900">
      <svg viewBox="0 0 24 24" class="mx-auto h-10 w-10 text-ink-700/40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 14v3h-3M14 20h3" /></svg>
      <p class="mt-3 font-semibold">{{ noPackageText }}</p>
      <RouterLink to="/packages" class="btn-primary mt-4">Lihat paket</RouterLink>
    </div>

    <div v-if="cur || curClass" class="mt-2 flex items-center justify-center gap-2 text-xs text-white/50">
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
        <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-white/50" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3z" /></svg>
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ o.label }}</span>
        <span class="shrink-0 text-xs text-white/50">{{ o.hint }}</span>
      </button>
    </div>
    <CheckInButton minimal class="mt-2" />
  </div>
</template>
