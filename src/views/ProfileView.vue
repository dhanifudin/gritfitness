<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { memberAktif, memberPtAktif } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import { useAsync } from '@/composables/useAsync'
import { checkForUpdate } from '@/composables/useSw'
import { CK } from '@/lib/dataCache'
import { disablePush, enablePush, isStandalone, permissionState, pushSupported, wasEnabled } from '@/lib/push'
import { daysLeft, parseExpiry } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'
import { useTracker } from '@/stores/tracker'

const auth = useAuth()
const tracker = useTracker()
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

// ---- push notifications: cloud sync required (subscriptions live alongside the rest of the tracker data) ----
const pushOn = ref(wasEnabled())
const pushBusy = ref(false)
const pushError = ref('')
const pushBlocked = computed(() => {
  if (!tracker.consented) return 'Aktifkan sinkronisasi cloud dulu untuk menerima notifikasi.'
  if (!pushSupported()) return 'Browser ini tidak mendukung notifikasi push.'
  if (!isStandalone()) return 'Pasang aplikasi ke layar utama dulu, lalu buka dari sana untuk mengaktifkan.'
  if (permissionState() === 'denied') return 'Izin notifikasi diblokir — aktifkan lewat pengaturan browser/perangkat.'
  return null
})
async function togglePush() {
  pushError.value = ''
  pushBusy.value = true
  if (pushOn.value) {
    await disablePush()
    pushOn.value = false
  } else {
    const r = await enablePush()
    if (r.ok) pushOn.value = true
    else pushError.value = r.reason
  }
  pushBusy.value = false
}

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

    <div class="card mt-3 p-5" data-testid="push-settings">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="font-semibold">Notifikasi latihan</p>
          <p class="mt-0.5 text-xs text-white/55">Kelas favorit yang terlewat, dan pengingat kalau belum tercatat beberapa hari.</p>
        </div>
        <button
          type="button" role="switch" :aria-checked="pushOn" data-testid="push-toggle"
          class="relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60"
          :class="pushOn ? 'bg-lime-grit' : 'bg-white/15'"
          :disabled="pushBusy"
          @click="togglePush"
        >
          <span v-if="pushBusy" class="absolute inset-0 flex items-center justify-center">
            <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </span>
          <span v-else class="absolute top-1 h-5 w-5 rounded-full bg-white transition" :class="pushOn ? 'left-6' : 'left-1'" />
        </button>
      </div>
      <p v-if="!pushOn && pushBlocked" class="mt-2 text-xs text-amber-200/80">{{ pushBlocked }}</p>
      <p v-if="pushError" class="mt-2 text-xs text-red-300">{{ pushError }}</p>
    </div>

    <button class="btn-ghost mt-5 w-full !text-red-300" @click="out">Keluar</button>
    <p class="mt-6 text-center text-xs text-white/40">Versi {{ version.sha }} · {{ version.date }}</p>
    <button class="btn-ghost mx-auto mt-2 !flex min-h-11 w-fit !px-4 !py-1.5 text-xs" :disabled="checking" @click="checkUpdate">
      {{ checking ? 'Memeriksa…' : 'Periksa pembaruan' }}
    </button>
    <p v-if="updateMsg" class="mt-1 text-center text-xs text-white/50">{{ updateMsg }}</p>
  </div>
</template>
