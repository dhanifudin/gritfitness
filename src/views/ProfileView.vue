<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { memberAktif, memberPtAktif } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import { useAsync } from '@/composables/useAsync'
import { checkForUpdate } from '@/composables/useSw'
import { CK } from '@/lib/dataCache'
import { daysLeft, parseExpiry } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()
const uid = auth.user!.id
const rows = () => [
  ['No. HP', auth.user?.no_hp],
  ['Email', auth.user?.email || '-'],
  ['Jenis kelamin', auth.user?.jenis_kelamin],
  ['Alamat', auth.user?.alamat || '-'],
  ['Tipe', auth.user?.tipe],
]

// cache hit in the common case: Beranda already warmed these via prefetchAll
const { data: gym } = useAsync(() => memberAktif(uid), null as Awaited<ReturnType<typeof memberAktif>> | null, { key: CK.memberGym })
const { data: pt } = useAsync(() => memberPtAktif(uid), null as Awaited<ReturnType<typeof memberPtAktif>> | null, { key: CK.memberPt })
const membershipDaysLeft = computed(() => (gym.value && !gym.value.error ? daysLeft({ expiresAt: parseExpiry(gym.value.tanggal_selesai) }) : null))

const version = __APP_VERSION__
const checking = ref(false)
const updateMsg = ref('')
async function checkUpdate() {
  checking.value = true
  updateMsg.value = ''
  const r = await checkForUpdate()
  updateMsg.value = r === 'available' ? 'Versi baru ditemukan — akan dipasang saat Anda berpindah halaman.' : r === 'latest' ? 'Sudah versi terbaru.' : 'Pembaruan otomatis tidak aktif di mode ini.'
  checking.value = false
}

async function out() {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <PageHeader title="Profil" />
  <div class="px-5">
    <div class="card p-5">
      <p class="font-display text-xl">{{ auth.user?.nama }}</p>
      <dl class="mt-4 space-y-3 text-sm">
        <div v-for="[k, v] in rows()" :key="k" class="flex justify-between gap-4">
          <dt class="text-white/50">{{ k }}</dt>
          <dd class="text-right">{{ v }}</dd>
        </div>
      </dl>
    </div>

    <div class="card mt-3 p-5" data-testid="membership-card">
      <p class="text-sm text-white/50">Membership</p>
      <template v-if="gym && !gym.error">
        <p class="mt-1 font-display text-lg leading-tight">{{ gym.nama_paket }}</p>
        <p class="mt-1 text-sm text-white/60">
          Berlaku s.d. {{ gym.tanggal_selesai }}
          <span v-if="membershipDaysLeft != null" :class="membershipDaysLeft <= 7 ? 'font-semibold text-amber-300' : ''"> · sisa {{ membershipDaysLeft }} hari</span>
        </p>
      </template>
      <template v-else-if="gym">
        <p class="mt-1 font-display text-lg">{{ gym.error === 'Cuti' ? 'Sedang cuti' : 'Belum aktif atau sudah berakhir' }}</p>
        <p class="mt-1 text-sm text-white/60">Hubungi front desk untuk mengaktifkan paket.</p>
      </template>
      <div v-if="pt && !pt.error" class="mt-4 border-t border-white/10 pt-4">
        <p class="text-xs text-white/50">Personal Trainer</p>
        <p class="mt-1 font-semibold">{{ pt.nama_paket }}</p>
        <p class="text-sm text-white/60">s.d. {{ pt.tanggal_selesai }}</p>
      </div>
    </div>

    <button class="btn-ghost mt-5 w-full !text-red-300" @click="out">Keluar</button>
    <p class="mt-6 text-center text-xs text-white/40">Versi {{ version.sha }} · {{ version.date }}</p>
    <button class="mx-auto mt-1 block text-xs text-brand-300 underline disabled:opacity-50" :disabled="checking" @click="checkUpdate">
      {{ checking ? 'Memeriksa…' : 'Periksa pembaruan' }}
    </button>
    <p v-if="updateMsg" class="mt-1 text-center text-xs text-white/50">{{ updateMsg }}</p>
  </div>
</template>
