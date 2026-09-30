<script setup lang="ts">
import { memberAktif, memberPtAktif, tagihan } from '@/api/endpoints'
import { onMounted } from 'vue'
import { useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'
import { prefetchAll } from '@/lib/prefetch'
import { syncQr } from '@/lib/qrCache'
import { useInstall } from '@/composables/useSw'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const uid = auth.user!.id
const install = useInstall()
const me = { id: uid, nama: auth.user!.nama }
const { data: gym, loading } = useAsync(
  async () => {
    const r = await memberAktif(uid)
    syncQr(me, 'gym', r) // keep the offline QR fresh whenever Home loads
    return r
  },
  null as Awaited<ReturnType<typeof memberAktif>> | null,
  { key: CK.memberGym },
)
const { data: pt } = useAsync(
  async () => {
    const r = await memberPtAktif(uid)
    syncQr(me, 'pt', r)
    return r
  },
  null as Awaited<ReturnType<typeof memberPtAktif>> | null,
  { key: CK.memberPt },
)
const { data: bills } = useAsync(tagihan, [], { key: CK.bills })
onMounted(() => prefetchAll(uid))

const unpaid = () => bills.value.filter((b) => b.status === 'Belum Dibayar' || b.status === 'Belum Lunas').length
const actions = [
  { to: '/classes', label: 'Booking Kelas' },
  { to: '/packages', label: 'Lihat Paket' },
  { to: '/memberships', label: 'Riwayat Membership' },
  { to: '/leave', label: 'Cuti Membership' },
]
</script>

<template>
  <div class="px-5 pt-8">
    <p class="text-sm text-white/55">Halo,</p>
    <h1 class="font-display text-2xl font-semibold">{{ auth.user?.nama }}</h1>

    <RouterLink to="/qr" class="mt-5 block rounded-3xl bg-gradient-to-br from-brand-500 to-ink-700 p-5">
      <div v-if="loading" class="h-16 animate-pulse rounded-xl bg-white/10" />
      <template v-else-if="gym && !gym.error">
        <p class="text-xs tracking-wide text-white/70 uppercase">Membership aktif</p>
        <p class="mt-1 font-display text-lg leading-tight">{{ gym.nama_paket }}</p>
        <p class="mt-2 text-sm text-white/75">Berlaku s.d. {{ gym.tanggal_selesai }}</p>
        <p class="mt-4 text-sm font-semibold text-lime-grit">Ketuk untuk tampilkan QR →</p>
      </template>
      <template v-else>
        <p class="font-display text-lg">
          {{ gym?.error === 'Cuti' ? 'Anda sedang cuti' : 'Membership belum aktif atau sudah berakhir' }}
        </p>
        <p class="mt-1 text-sm text-white/70">Hubungi front desk untuk mengaktifkan paket.</p>
      </template>
    </RouterLink>

    <div v-if="pt && !pt.error" class="card mt-3 p-4">
      <p class="text-xs tracking-wide text-white/50 uppercase">Personal Trainer</p>
      <p class="mt-1 font-semibold">{{ pt.nama_paket }}</p>
      <p class="text-sm text-white/60">s.d. {{ pt.tanggal_selesai }}</p>
    </div>

    <div v-if="unpaid()" class="mt-3 rounded-2xl border border-pink-grit/40 bg-pink-grit/10 p-4 text-sm">
      Ada <b>{{ unpaid() }}</b> tagihan belum lunas.
      <RouterLink to="/bills" class="ml-1 font-semibold text-pink-grit underline">Lihat</RouterLink>
    </div>

    <div class="mt-5 grid gap-2">
      <RouterLink v-for="a in actions" :key="a.to" :to="a.to" class="card flex items-center justify-between px-4 py-4 text-sm font-medium">
        {{ a.label }} <span class="text-white/40">›</span>
      </RouterLink>
    </div>

    <button v-if="install.canInstall()" class="btn-ghost mt-5 w-full" @click="install.install()">Pasang aplikasi di layar utama</button>
    <p v-else-if="install.showIosHint()" class="mt-5 text-center text-xs text-white/50">
      Untuk memasang: ketuk tombol Bagikan lalu “Tambah ke Layar Utama”.
    </p>
  </div>
</template>
