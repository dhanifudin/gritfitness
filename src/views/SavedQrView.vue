<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CheckInButton from '@/components/CheckInButton.vue'
import QrCard from '@/components/QrCard.vue'
import { cachedQrOwner, daysLeft, loadQr, type QrEntry, type QrKind } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'
import { useWakeLock } from '@/composables/useWakeLock'

// Cache-only view: reads what earlier successful loads stored, never calls the API,
// so it works offline and after the login session has expired.
const auth = useAuth()
useWakeLock() // this is the gym-door screen too (the offline fallback): don't let it dim/sleep mid-scan

const kinds = [
  { key: 'gym', label: 'Membership' },
  { key: 'pt', label: 'Personal Trainer' },
] as const

const items = ref<Record<QrKind, QrEntry | null>>({ gym: null, pt: null })
const owner = ref<{ userId: number; nama: string } | null>(null)
const active = ref<QrKind>('gym')

function refresh() {
  items.value = { gym: loadQr('gym'), pt: loadQr('pt') } // loadQr drops entries past their end date
  owner.value = cachedQrOwner()
  if (!items.value[active.value]) active.value = items.value.gym ? 'gym' : 'pt'
}
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

const available = computed(() => kinds.filter((k) => items.value[k.key]))
const cur = computed(() => items.value[active.value])
const left = computed(() => (cur.value ? daysLeft(cur.value) : null))
const stamp = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="flex h-full flex-col px-5 pt-5">
    <div class="flex items-center justify-between gap-3">
      <p class="min-w-0 truncate font-display text-lg font-semibold">{{ owner?.nama }}</p>
      <span v-if="!auth.loggedIn" class="shrink-0 rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-medium text-white/60">Tanpa login</span>
    </div>

    <template v-if="cur">
      <div v-if="available.length > 1" class="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
        <button
          v-for="k in available"
          :key="k.key"
          class="min-h-10 rounded-lg text-sm font-semibold transition"
          :class="active === k.key ? 'bg-brand-400 text-white' : 'text-white/60'"
          @click="active = k.key"
        >
          {{ k.label }}
        </button>
      </div>

      <QrCard :entry="cur" compact :tight="available.length > 1" class="mt-3">
        <p
          v-if="left !== null"
          class="mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold"
          :class="left <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'"
        >
          {{ left === 0 ? 'Berakhir hari ini' : `Sisa ${left} hari` }}
        </p>
      </QrCard>

      <p class="mt-2 text-center text-xs text-white/45">Disimpan {{ stamp(cur.savedAt) }}</p>
      <CheckInButton minimal class="mt-2" />
    </template>

    <div v-else class="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
      <svg viewBox="0 0 24 24" class="mx-auto h-10 w-10 text-white/25" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 14v3h-3M14 20h3" /></svg>
      <p class="mt-3 font-semibold">Belum ada QR tersimpan</p>
      <p class="mt-1 text-sm text-white/60">Masuk sekali dan buka QR Anda, maka QR akan tersimpan untuk dipakai tanpa masuk lagi.</p>
    </div>
  </div>
</template>
