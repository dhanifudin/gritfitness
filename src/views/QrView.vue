<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { memberAktif, memberPtAktif } from '@/api/endpoints'
import { cachedQrOwner, loadQr, syncQr, type QrEntry, type QrKind } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()

const kinds = [
  { key: 'gym', label: 'Membership', fetch: memberAktif },
  { key: 'pt', label: 'Personal Trainer', fetch: memberPtAktif },
] as const

const owner = cachedQrOwner() // remembered even after the session expired
const name = computed(() => auth.user?.nama ?? owner?.nama ?? '')

const items = ref<Record<QrKind, QrEntry | null>>({ gym: loadQr('gym'), pt: loadQr('pt') })
const serverSaid = ref<Record<QrKind, string>>({ gym: '', pt: '' }) // {error} text when the server says no package
const active = ref<QrKind>(items.value.gym || !items.value.pt ? 'gym' : 'pt')
const loading = ref(!items.value.gym && !items.value.pt && auth.loggedIn)
const failed = ref(false)

async function load() {
  if (!auth.loggedIn || !auth.user) {
    loading.value = false
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
  if (!items.value[active.value] && items.value[active.value === 'gym' ? 'pt' : 'gym']) active.value = active.value === 'gym' ? 'pt' : 'gym'
  loading.value = false
  // session gone (401) and nothing cached to show
  if (!items.value.gym && !items.value.pt && !auth.loggedIn) router.replace({ name: 'login', query: { redirect: '/qr' } })
}

onMounted(load)

const cur = computed(() => items.value[active.value])
const visibleKinds = computed(() => (auth.loggedIn ? kinds : kinds.filter((k) => items.value[k.key])))
const stamp = (t: number) =>
  new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const noPackageText = computed(() => (serverSaid.value[active.value] === 'Cuti' ? 'Anda sedang cuti' : 'Tidak ada paket aktif'))
</script>

<template>
  <div class="px-5 pt-8">
    <h1 class="font-display text-2xl font-semibold">QR Check-in</h1>
    <p class="text-sm text-white/55">{{ name }}</p>

    <div v-if="!auth.loggedIn" class="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
      <p class="text-sm font-semibold text-amber-200">Sesi berakhir</p>
      <p class="mt-0.5 text-xs text-amber-100/70">QR tersimpan tetap bisa dipakai sampai masa berlaku paket habis.</p>
      <RouterLink :to="{ name: 'login', query: { redirect: '/qr' } }" class="btn-primary mt-3 !py-2">Masuk untuk memperbarui</RouterLink>
    </div>

    <div v-if="visibleKinds.length > 1" class="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
      <button
        v-for="k in visibleKinds"
        :key="k.key"
        class="rounded-lg py-2 text-sm font-semibold transition"
        :class="active === k.key ? 'bg-brand-400 text-white' : 'text-white/60'"
        @click="active = k.key"
      >
        {{ k.label }}
      </button>
    </div>

    <div class="mt-5 rounded-3xl bg-white p-6 text-center text-ink-900">
      <div v-if="loading" class="mx-auto aspect-square w-full max-w-72 animate-pulse rounded-xl bg-ink-900/10" />
      <template v-else-if="cur">
        <img :src="`data:image/svg+xml;base64,${cur.qr_code}`" alt="QR Member" class="mx-auto w-full max-w-72" />
        <p class="mt-3 font-semibold">{{ cur.nama_paket }}</p>
        <p class="text-sm text-ink-700/80">{{ cur.tanggal_mulai }} – {{ cur.tanggal_selesai }}</p>
      </template>
      <div v-else class="py-10">
        <p class="font-semibold">{{ noPackageText }}</p>
        <RouterLink to="/packages" class="btn-primary mt-4">Lihat paket</RouterLink>
      </div>
    </div>

    <p class="mt-3 text-center text-xs text-white/50">
      Scan QR ini saat masuk/keluar gym.
      <template v-if="cur"><br />Disimpan {{ stamp(cur.savedAt) }}<template v-if="failed || !auth.loggedIn"> · mode offline</template></template>
    </p>
    <button v-if="auth.loggedIn" class="btn-ghost mt-3 w-full" @click="load">Muat ulang</button>
  </div>
</template>
