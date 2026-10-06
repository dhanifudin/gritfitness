<script setup lang="ts">
import { computed } from 'vue'
import { memberAktif, memberPtAktif } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import { useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'
import { daysLeft, parseExpiry } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
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
</script>

<template>
  <PageHeader title="Profil" />
  <div class="px-5">
    <div class="card p-5">
      <div class="flex items-start justify-between gap-3">
        <p class="font-display text-xl">{{ auth.user?.nama }}</p>
        <RouterLink to="/profile/edit" class="btn-ghost min-h-11 shrink-0 !px-3 !py-1.5 text-xs" data-testid="edit-profile">Ubah Profil</RouterLink>
      </div>
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
  </div>
</template>
