<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CheckInButton from '@/components/CheckInButton.vue'
import QrCard from '@/components/QrCard.vue'
import { titleCase } from '@/lib/format'
import { cachedQrOwner, daysLeft, loadClassQrs, loadQr, preselectQr, qrStale, type ClassQrEntry, type QrEntry } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'
import { useWakeLock } from '@/composables/useWakeLock'

// Cache-only view: reads what earlier successful loads stored, never calls the API,
// so it works offline and after the login session has expired. The membership QR payload
// rotates daily, so an old one is shown with a staleness warning rather than hidden.
const auth = useAuth()
useWakeLock() // this is the gym-door screen too (the offline fallback): don't let it dim/sleep mid-scan

const gym = ref<QrEntry | null>(null)
const classes = ref<ClassQrEntry[]>([])
const owner = ref<{ userId: number; nama: string } | null>(null)
const active = ref<string>('gym')

const timeShort = (t: string) => t.slice(0, 5).replace(':', '.')
const options = computed(() => [
  ...(gym.value ? [{ key: 'gym', label: 'Membership', hint: gym.value.aktif_sampai ? `s.d. ${gym.value.aktif_sampai}` : '' }] : []),
  ...classes.value.map((c) => ({ key: 'c' + c.schedule_id, label: titleCase(c.nama), hint: `${c.tanggal_label} · ${timeShort(c.jam_mulai)}` })),
])
const collapsed = computed(() => options.value.filter((o) => o.key !== active.value))

function refresh() {
  gym.value = loadQr() // drops entries past the membership's end date
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

const curClass = computed(() => (active.value.startsWith('c') ? classes.value.find((c) => 'c' + c.schedule_id === active.value) ?? null : null))
const cur = computed(() => (curClass.value ? null : gym.value))
const left = computed(() => (cur.value ? daysLeft(cur.value) : null))
const stamp = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex h-full flex-col px-4 pt-5">
    <div class="flex items-center justify-between gap-3">
      <p class="min-w-0 truncate text-lg font-extrabold">{{ owner?.nama }}</p>
      <span v-if="!auth.loggedIn" class="pill pill-mute shrink-0">Tanpa login</span>
    </div>

    <template v-if="cur || curClass">
      <QrCard
        v-if="curClass"
        :payload="curClass.payload"
        compact
        :tight="options.length > 1"
        :title="titleCase(curClass.nama)"
        :sub="`${curClass.tanggal_label} · ${curClass.jam_mulai.slice(0, 5)}–${curClass.jam_selesai.slice(0, 5)}`"
        class="mt-3"
        data-testid="class-qr"
      />
      <QrCard v-else :payload="cur!.payload" compact :tight="options.length > 1" :title="titleCase(cur!.tier)" :sub="`Aktif s.d ${cur!.aktif_sampai}`" class="mt-3">
        <p
          v-if="left !== null"
          class="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold"
          :class="left <= 7 ? 'bg-(--warn-bg) text-warn' : 'bg-(--ok-bg) text-ok'"
        >
          {{ left === 0 ? 'Berakhir hari ini' : `Sisa ${left} hari` }}
        </p>
      </QrCard>

      <p v-if="cur && qrStale(cur)" class="banner banner-warn mt-2 !py-2 !text-xs" data-testid="qr-stale">
        QR ini dari {{ cur.tanggal }} — sambungkan internet dan masuk untuk QR hari ini.
      </p>
      <p class="mt-2 text-center text-xs text-mute">Disimpan {{ stamp((curClass ?? cur)!.savedAt) }}</p>
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
    </template>

    <div v-else class="card mt-6 p-6 text-center">
      <svg viewBox="0 0 24 24" class="mx-auto h-10 w-10 text-line" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 14v3h-3M14 20h3" /></svg>
      <p class="mt-3 font-bold">Belum ada QR tersimpan</p>
      <p class="mt-1 text-sm text-mute">Masuk sekali dan buka QR Anda, maka QR akan tersimpan untuk dipakai tanpa masuk lagi.</p>
    </div>
  </div>
</template>
