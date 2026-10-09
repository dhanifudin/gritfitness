<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { memberAktif, memberPtAktif } from '@/api/endpoints'
import CheckInButton from '@/components/CheckInButton.vue'
import QrCard from '@/components/QrCard.vue'
import ProfileButton from '@/components/ProfileButton.vue'
import SettingsButton from '@/components/SettingsButton.vue'
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

const onVisible = () => document.visibilityState === 'visible' && load()
onMounted(() => {
  void load()
  document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => document.removeEventListener('visibilitychange', onVisible))

const cur = computed(() => items.value[active.value])
const both = computed(() => !!items.value.gym && !!items.value.pt)
const stamp = (t: number) => new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const noPackageText = computed(() => (serverSaid.value[active.value] === 'Cuti' ? 'Anda sedang cuti' : 'Tidak ada paket aktif'))
</script>

<template>
  <div class="flex h-full flex-col px-5 pt-5">
    <div class="flex items-center justify-between gap-3">
      <p class="min-w-0 truncate font-display text-lg font-semibold">{{ auth.user?.nama }}</p>
      <div class="flex shrink-0 gap-2"><ProfileButton /><SettingsButton /></div>
    </div>

    <div v-if="both" class="seg mt-2 grid-cols-2">
      <button
        v-for="k in kinds"
        :key="k.key"
        class="seg-tab"
        :class="active === k.key ? 'seg-tab-on' : ''"
        @click="active = k.key"
      >
        {{ k.label }}
      </button>
    </div>

    <div v-if="loading" class="mt-3 rounded-3xl bg-white p-4">
      <div class="mx-auto aspect-square w-[min(100%,18rem,34dvh)] animate-pulse rounded-xl bg-ink-900/10" />
    </div>
    <QrCard v-else-if="cur" :entry="cur" compact :tight="both" class="mt-3" />
    <div v-else class="mt-3 rounded-3xl bg-white p-6 py-8 text-center text-ink-900">
      <svg viewBox="0 0 24 24" class="mx-auto h-10 w-10 text-ink-700/40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 14v3h-3M14 20h3" /></svg>
      <p class="mt-3 font-semibold">{{ noPackageText }}</p>
      <RouterLink to="/packages" class="btn-primary mt-4">Lihat paket</RouterLink>
    </div>

    <div v-if="cur" class="mt-2 flex items-center justify-center gap-2 text-xs text-white/50">
      <span>Disimpan {{ stamp(cur.savedAt) }}<template v-if="failed"> · mode offline</template></span>
      <button v-if="failed" class="btn-sm" @click="load">Coba lagi</button>
    </div>
    <CheckInButton minimal class="mt-2" />
  </div>
</template>
