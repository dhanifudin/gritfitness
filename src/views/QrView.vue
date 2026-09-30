<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { memberAktif, memberPtAktif } from '@/api/endpoints'
import type { ActiveMember } from '@/api/types'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const uid = auth.user!.id
const cacheKey = (k: string) => `grit.qr.${uid}.${k}`

const kinds = [
  { key: 'gym', label: 'Membership', fetch: memberAktif },
  { key: 'pt', label: 'Personal Trainer', fetch: memberPtAktif },
] as const

const active = ref<(typeof kinds)[number]['key']>('gym')
const items = ref<Record<string, { data: ActiveMember; at: string } | null>>({ gym: null, pt: null })
const loading = ref(true)
const stale = ref(false)

function readCache(k: string) {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(k)) ?? 'null')
  } catch {
    return null
  }
}

async function load() {
  loading.value = true
  stale.value = false
  await Promise.all(
    kinds.map(async (k) => {
      try {
        const data = await k.fetch(uid)
        if (data.error) {
          localStorage.removeItem(cacheKey(k.key))
          items.value[k.key] = { data, at: '' }
        } else {
          const entry = { data, at: new Date().toISOString() }
          localStorage.setItem(cacheKey(k.key), JSON.stringify(entry))
          items.value[k.key] = entry
        }
      } catch {
        items.value[k.key] = readCache(k.key)
        stale.value = true
      }
    }),
  )
  // default to the first tab that has a valid QR
  if (!items.value.gym?.data.qr_code && items.value.pt?.data.qr_code) active.value = 'pt'
  loading.value = false
}

onMounted(() => {
  for (const k of kinds) items.value[k.key] = readCache(k.key) // instant paint from cache
  loading.value = !items.value.gym && !items.value.pt
  load()
})

const cur = computed(() => items.value[active.value])
const valid = computed(() => cur.value && !cur.value.data.error && cur.value.data.qr_code)
const at = computed(() => (cur.value?.at ? new Date(cur.value.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''))
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

    <div class="mt-5 rounded-3xl bg-white p-6 text-center text-ink-900">
      <div v-if="loading" class="mx-auto aspect-square w-full max-w-72 animate-pulse rounded-xl bg-ink-900/10" />
      <template v-else-if="valid">
        <img :src="`data:image/svg+xml;base64,${cur!.data.qr_code}`" alt="QR Member" class="mx-auto w-full max-w-72" />
        <p class="mt-3 font-semibold">{{ cur!.data.nama_paket }}</p>
        <p class="text-sm text-ink-700/80">{{ cur!.data.tanggal_mulai }} – {{ cur!.data.tanggal_selesai }}</p>
      </template>
      <div v-else class="py-10">
        <p class="font-semibold">{{ cur?.data.error === 'Cuti' ? 'Anda sedang cuti' : 'Tidak ada paket aktif' }}</p>
        <RouterLink to="/paket" class="btn-primary mt-4">Lihat paket</RouterLink>
      </div>
    </div>

    <p class="mt-3 text-center text-xs text-white/50">
      Scan QR ini saat masuk/keluar gym.
      <template v-if="stale && at"> · Offline, tersimpan {{ at }}</template>
    </p>
    <button class="btn-ghost mt-3 w-full" @click="load">Muat ulang</button>
  </div>
</template>
