<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { memberAktif, memberPtAktif } from '@/api/endpoints'
import CheckInButton from '@/components/CheckInButton.vue'
import QrCard from '@/components/QrCard.vue'
import { hasValidQr, loadQr, syncQr, type QrEntry, type QrKind } from '@/lib/qrCache'
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
const serverSaid = ref<Record<QrKind, string>>({ gym: '', pt: '' }) // {error} text when the server says no package
const active = ref<QrKind>(items.value.gym || !items.value.pt ? 'gym' : 'pt')
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
  await Promise.all(
    kinds.map(async (k) => {
      try {
        const res = await k.fetch(user.id)
        syncQr(user, k.key, res)
        items.value[k.key] = loadQr(k.key)
        serverSaid.value[k.key] = res.error ?? ''
      } catch {
        failed.value = true // offline / server down: keep whatever the cache holds
      }
    }),
  )
  const other = active.value === 'gym' ? 'pt' : 'gym'
  if (!items.value[active.value] && items.value[other]) active.value = other
  loading.value = false
}

onMounted(load)

const cur = computed(() => items.value[active.value])
const stamp = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const noPackageText = computed(() => (serverSaid.value[active.value] === 'Cuti' ? 'Anda sedang cuti' : 'Tidak ada paket aktif'))
</script>

<template>
  <div class="px-5 pt-8">
    <h1 class="font-display text-2xl font-semibold">QR Check-in</h1>
    <p class="text-sm text-white/55">{{ auth.user?.nama }}</p>

    <div class="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
      <button
        v-for="k in kinds"
        :key="k.key"
        class="rounded-lg py-2 text-sm font-semibold transition"
        :class="active === k.key ? 'bg-brand-400 text-white' : 'text-white/60'"
        @click="active = k.key"
      >
        {{ k.label }}
      </button>
    </div>

    <div v-if="loading" class="mt-5 rounded-3xl bg-white p-6">
      <div class="mx-auto aspect-square w-full max-w-72 animate-pulse rounded-xl bg-ink-900/10" />
    </div>
    <QrCard v-else-if="cur" :entry="cur" class="mt-5" />
    <div v-else class="mt-5 rounded-3xl bg-white p-6 py-10 text-center text-ink-900">
      <svg viewBox="0 0 24 24" class="mx-auto h-10 w-10 text-ink-700/40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 14v3h-3M14 20h3" /></svg>
      <p class="mt-3 font-semibold">{{ noPackageText }}</p>
      <RouterLink to="/packages" class="btn-primary mt-4">Lihat paket</RouterLink>
    </div>

    <p class="mt-3 text-center text-xs text-white/50">
      Scan QR ini saat masuk/keluar gym.
      <template v-if="cur"><br />Disimpan {{ stamp(cur.savedAt) }}<template v-if="failed"> · mode offline</template></template>
    </p>
    <CheckInButton class="mt-4" />

    <button class="btn-ghost mt-3 w-full" @click="load">Muat ulang</button>
    <RouterLink v-if="hasValidQr()" to="/saved-qr" class="btn-ghost mt-3 w-full">Lihat QR tersimpan</RouterLink>
  </div>
</template>
