<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CheckInButton from '@/components/CheckInButton.vue'
import QrCard from '@/components/QrCard.vue'
import { cachedQrOwner, daysLeft, loadQr, type QrEntry, type QrKind } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'

// Cache-only view: reads what earlier successful loads stored, never calls the API,
// so it works offline and after the login session has expired.
const auth = useAuth()

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
  <div class="px-5 pt-8 pb-10">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="font-display text-2xl font-semibold">QR Tersimpan</h1>
        <p class="truncate text-sm text-white/55">{{ owner?.nama }}</p>
      </div>
      <span v-if="!auth.loggedIn" class="mt-1 shrink-0 rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-medium text-white/60">Tanpa login</span>
    </div>

    <template v-if="cur">
      <div v-if="available.length > 1" class="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
        <button
          v-for="k in available"
          :key="k.key"
          class="rounded-lg py-2 text-sm font-semibold transition"
          :class="active === k.key ? 'bg-brand-400 text-white' : 'text-white/60'"
          @click="active = k.key"
        >
          {{ k.label }}
        </button>
      </div>

      <QrCard :entry="cur" class="mt-5">
        <p
          v-if="left !== null"
          class="mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold"
          :class="left <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'"
        >
          {{ left === 0 ? 'Berakhir hari ini' : `Sisa ${left} hari` }}
        </p>
      </QrCard>

      <p class="mt-3 text-center text-xs text-white/50">
        Scan QR ini saat masuk/keluar gym.<br />
        Disimpan {{ stamp(cur.savedAt) }}
      </p>
    </template>

    <div v-else class="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
      <p class="font-semibold">Belum ada QR tersimpan</p>
      <p class="mt-1 text-sm text-white/60">Masuk sekali dan buka QR Anda, maka QR akan tersimpan untuk dipakai tanpa masuk lagi.</p>
    </div>

    <CheckInButton class="mt-4" />

    <!-- logged in: the bottom tab bar already offers QR/Beranda navigation, nothing extra needed here -->
    <div v-if="!auth.loggedIn" class="mt-5 grid gap-3">
      <RouterLink :to="{ name: 'login', query: { redirect: '/qr' } }" :class="cur ? 'btn-ghost' : 'btn-primary'">
        {{ cur ? 'Masuk untuk memperbarui' : 'Masuk' }}
      </RouterLink>
    </div>
  </div>
</template>
