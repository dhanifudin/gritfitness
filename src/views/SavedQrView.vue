<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CheckInButton from '@/components/CheckInButton.vue'
import QrCard from '@/components/QrCard.vue'
import { titleCase } from '@/lib/format'
import { cachedQrOwner, daysLeft, loadClassQrs, loadQr, preselectQr, type ClassQrEntry, type QrEntry, type QrKind } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'
import { useWakeLock } from '@/composables/useWakeLock'

// Cache-only view: reads what earlier successful loads stored, never calls the API,
// so it works offline and after the login session has expired.
const auth = useAuth()
useWakeLock() // this is the gym-door screen too (the offline fallback): don't let it dim/sleep mid-scan

const items = ref<Record<QrKind, QrEntry | null>>({ gym: null, pt: null })
const classes = ref<ClassQrEntry[]>([])
const owner = ref<{ userId: number; nama: string } | null>(null)
const active = ref<string>('gym')

const timeShort = (t: string) => t.slice(0, 5).replace(':', '.')
const options = computed(() => [
  ...(items.value.gym ? [{ key: 'gym', label: 'Membership', hint: items.value.gym.tanggal_selesai ? `s.d. ${items.value.gym.tanggal_selesai}` : '' }] : []),
  ...(items.value.pt ? [{ key: 'pt', label: 'Personal Trainer', hint: items.value.pt.tanggal_selesai ? `s.d. ${items.value.pt.tanggal_selesai}` : '' }] : []),
  ...classes.value.map((c) => ({ key: 'c' + c.id, label: titleCase(c.nama_jadwal_kelas), hint: `Hari ini · ${timeShort(c.jam_awal)}` })),
])
const collapsed = computed(() => options.value.filter((o) => o.key !== active.value))

function refresh() {
  items.value = { gym: loadQr('gym'), pt: loadQr('pt') } // loadQr drops entries past their end date
  classes.value = loadClassQrs()
  owner.value = cachedQrOwner()
  if (!options.value.some((o) => o.key === active.value)) active.value = preselectQr(classes.value) ?? options.value[0]?.key ?? 'gym'
}
active.value = preselectQr(loadClassQrs()) ?? 'gym'
refresh()

let timer: ReturnType<typeof setInterval>
const onVisible = () => document.visibilityState === 'visible' && refresh()
onMounted(() => {
  timer = setInterval(refresh, 60_000) // a QR disappears as soon as the membership's last day is over
  document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisible)
})

const curClass = computed(() => (active.value.startsWith('c') ? classes.value.find((c) => 'c' + c.id === active.value) ?? null : null))
const cur = computed(() => (curClass.value ? null : items.value[active.value as QrKind]))
const left = computed(() => (cur.value ? daysLeft(cur.value) : null))
const stamp = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex h-full flex-col px-5 pt-5">
    <div class="flex items-center justify-between gap-3">
      <p class="min-w-0 truncate font-display text-lg font-semibold">{{ owner?.nama }}</p>
      <span v-if="!auth.loggedIn" class="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/50">Tanpa login</span>
    </div>

    <template v-if="cur || curClass">
      <QrCard
        v-if="curClass"
        :entry="curClass"
        compact
        :tight="options.length > 1"
        :title="titleCase(curClass.nama_jadwal_kelas)"
        :sub="`${curClass.tanggal} · ${curClass.jam_awal.slice(0, 5)}–${curClass.jam_akhir.slice(0, 5)}`"
        class="mt-3"
        data-testid="class-qr"
      />
      <QrCard v-else :entry="cur!" compact :tight="options.length > 1" class="mt-3">
        <p
          v-if="left !== null"
          class="mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold"
          :class="left <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'"
        >
          {{ left === 0 ? 'Berakhir hari ini' : `Sisa ${left} hari` }}
        </p>
      </QrCard>

      <p class="mt-2 text-center text-xs text-white/50">Disimpan {{ stamp((curClass ?? cur)!.savedAt) }}</p>
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
    </template>

    <div v-else class="mt-6 card p-6 text-center">
      <svg viewBox="0 0 24 24" class="mx-auto h-10 w-10 text-white/35" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 14v3h-3M14 20h3" /></svg>
      <p class="mt-3 font-semibold">Belum ada QR tersimpan</p>
      <p class="mt-1 text-sm text-white/50">Masuk sekali dan buka QR Anda, maka QR akan tersimpan untuk dipakai tanpa masuk lagi.</p>
    </div>
  </div>
</template>
