<script setup lang="ts">
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { ref } from 'vue'
import { checkForUpdate } from '@/composables/useSw'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()
const rows = () => [
  ['No. HP', auth.user?.no_hp],
  ['Email', auth.user?.email || '-'],
  ['Jenis kelamin', auth.user?.jenis_kelamin],
  ['Alamat', auth.user?.alamat || '-'],
  ['Tipe', auth.user?.tipe],
]

const links = [
  { to: '/profile/edit', label: 'Ubah Profil' },
  { to: '/memberships', label: 'Riwayat Membership' },
  { to: '/leave', label: 'Cuti Membership' },
  { to: '/packages', label: 'Paket' },
  { to: '/saved-qr', label: 'QR Tersimpan (offline)' },
]

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
    <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="card mt-3 flex justify-between px-4 py-4 text-sm font-medium">
      {{ l.label }} <span class="text-white/40">›</span>
    </RouterLink>
    <button class="btn-ghost mt-5 w-full !text-red-300" @click="out">Keluar</button>
    <p class="mt-6 text-center text-xs text-white/40">Versi {{ version.sha }} · {{ version.date }}</p>
    <button class="mx-auto mt-1 block text-xs text-brand-300 underline disabled:opacity-50" :disabled="checking" @click="checkUpdate">
      {{ checking ? 'Memeriksa…' : 'Periksa pembaruan' }}
    </button>
    <p v-if="updateMsg" class="mt-1 text-center text-xs text-white/50">{{ updateMsg }}</p>
  </div>
</template>
