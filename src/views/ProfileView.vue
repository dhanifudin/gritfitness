<script setup lang="ts">
import { computed, onMounted } from 'vue'
import BackHeader from '@/components/BackHeader.vue'
import SafeImg from '@/components/SafeImg.vue'
import { titleCase } from '@/lib/format'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
onMounted(() => void auth.refreshUser())

const initial = computed(() => (auth.user?.nama?.[0] ?? 'M').toUpperCase())
const gender = (g: string | null | undefined) => (g === 'pria' ? 'Pria' : g === 'wanita' ? 'Wanita' : g || '-')
const rows = computed(() => [
  ['Nama', titleCase(auth.user?.nama)],
  ['Email', auth.user?.email || '-'],
  ['Nomor WhatsApp', auth.user?.telepon ? '+' + auth.user.telepon : '-'],
  ['Jenis Kelamin', gender(auth.user?.jenis_kelamin)],
  ['Tanggal Lahir', auth.user?.tanggal_lahir || '-'],
  ['Alamat', auth.user?.alamat || '-'],
  ['Kode Member', auth.user?.kode || '-'],
])
</script>

<template>
  <BackHeader title="Profil">
    <template #right>
      <RouterLink to="/profile/edit" class="px-2 text-[13px] font-bold text-grit-500" data-testid="edit-profile">Ubah</RouterLink>
    </template>
  </BackHeader>
  <div class="px-4 pb-6">
    <div class="card flex items-center gap-4 p-4">
      <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#1B2A6B,#E0155A)] text-2xl font-extrabold text-white">
        <SafeImg v-if="auth.user?.foto" :src="auth.user.foto" :alt="auth.user?.nama ?? ''" class="h-full w-full object-cover" />
        <template v-else>{{ initial }}</template>
      </div>
      <div class="min-w-0">
        <p class="truncate font-extrabold">{{ titleCase(auth.user?.nama) }}</p>
        <p class="text-sm font-semibold text-mute">{{ auth.user?.kode }}</p>
      </div>
    </div>

    <div class="card mt-3 p-4 text-sm">
      <div v-for="[k, v] in rows" :key="k" class="flex justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
        <span class="shrink-0 font-semibold text-mute">{{ k }}</span>
        <span class="min-w-0 text-right font-bold break-words">{{ v }}</span>
      </div>
    </div>

    <RouterLink to="/profile/edit" class="btn-primary mt-4 w-full" data-testid="edit-profile-cta">Ubah Profil</RouterLink>
  </div>
</template>
