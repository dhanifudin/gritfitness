<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cancelClass, myClassDetail } from '@/api/endpoints'
import type { MyClassDetail } from '@/api/types'
import BackHeader from '@/components/BackHeader.vue'
import ConfirmSheet from '@/components/ConfirmSheet.vue'
import QrCard from '@/components/QrCard.vue'
import StateBox from '@/components/StateBox.vue'
import { titleCase } from '@/lib/format'
import { syncClassQr } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'
import { useTracker } from '@/stores/tracker'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const tracker = useTracker()
const scheduleId = Number(route.params.id)

const d = ref<MyClassDetail | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    d.value = await myClassDetail(scheduleId)
    const u = auth.user
    if (u) syncClassQr({ id: u.id, nama: u.nama }, scheduleId, d.value) // keep the offline QR cache fresh
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Terjadi kesalahan'
  } finally {
    loading.value = false
  }
}
onMounted(() => void load())

const statusPill = computed(() => {
  switch (d.value?.status_booking) {
    case 'confirmed': return 'pill-ok'
    case 'booked': return 'pill-warn'
    case 'cancelled': return 'pill-mute'
    default: return 'pill-danger'
  }
})
const kehadiranPill = computed(() => (d.value?.kehadiran === 'hadir' ? 'pill-ok' : d.value?.kehadiran === 'izin' ? 'pill-warn' : 'pill-mute'))

const cancelling = ref(false)
const busy = ref(false)
const cancelError = ref('')
async function confirmCancel() {
  busy.value = true
  cancelError.value = ''
  try {
    await cancelClass(scheduleId)
    cancelling.value = false
    tracker.setSignupStatus(scheduleId, 'cancelled') // keep the home/jadwal lists honest right away
    await load()
    setTimeout(() => router.back(), 150)
  } catch (e) {
    cancelError.value = e instanceof Error ? e.message : 'Pembatalan gagal, coba lagi.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BackHeader title="Rincian Kelas" />

  <StateBox :loading="loading" :error="error" @retry="load">
    <div v-if="d" class="px-4 pb-6">
      <div class="hero">
        <div class="flex items-start justify-between gap-3">
          <p class="text-lg leading-tight font-extrabold">{{ titleCase(d.kelas.nama) }}</p>
          <span class="pill shrink-0 !bg-white/20 !text-white">{{ d.status_booking_label }}</span>
        </div>
        <p class="mt-1 text-sm font-semibold text-[#f0d9e2]">{{ d.kelas.tanggal_label || d.kelas.tanggal }} · {{ d.kelas.jam_mulai }}–{{ d.kelas.jam_selesai }}</p>
      </div>

      <div class="card mt-3 p-4 text-sm">
        <div class="flex justify-between border-b border-line py-2.5"><span class="font-semibold text-mute">Peserta</span><span class="font-bold">{{ d.kelas.nama_member }}</span></div>
        <div v-if="d.kelas.kategori" class="flex justify-between border-b border-line py-2.5"><span class="font-semibold text-mute">Kategori</span><span class="font-bold">{{ d.kelas.kategori }}</span></div>
        <div v-if="d.kelas.instruktur" class="flex justify-between border-b border-line py-2.5"><span class="font-semibold text-mute">Instruktur</span><span class="font-bold">{{ d.kelas.instruktur }}</span></div>
        <div v-if="d.kelas.ruangan" class="flex justify-between border-b border-line py-2.5"><span class="font-semibold text-mute">Ruangan</span><span class="font-bold">{{ d.kelas.ruangan }}</span></div>
        <div class="flex justify-between py-2.5">
          <span class="font-semibold text-mute">Status</span>
          <span class="pill" :class="statusPill"><span class="pill-dot" aria-hidden="true" />{{ d.status_booking_label }}</span>
        </div>
      </div>

      <template v-if="d.upcoming && d.qr_absensi">
        <QrCard :payload="d.qr_absensi" title="QR Absensi Kelas" :sub="`${titleCase(d.kelas.nama)} · ${d.kelas.jam_mulai}`" compact class="mt-3" data-testid="class-qr" />
        <p class="banner banner-warn mt-2 !py-2 !text-xs">Scan QR ini saat mengikuti kelas. Tanpa scan dianggap tidak hadir dan pinalti berlaku.</p>
      </template>

      <div v-if="!d.upcoming && d.kehadiran_label" class="mt-3 text-center">
        <span class="pill" :class="kehadiranPill"><span class="pill-dot" aria-hidden="true" />{{ d.kehadiran_label }}</span>
      </div>

      <template v-if="d.upcoming && d.status_booking !== 'cancelled'">
        <button v-if="d.bisa_cancel" class="btn-ghost btn-danger mt-4 w-full" data-testid="cancel-class" @click="cancelling = true">Batalkan Kelas</button>
        <p v-else class="mt-4 text-center text-xs text-mute">
          Cancel kelas tidak dapat dilakukan {{ d.batas_cancel_jam || 1 }} jam sebelum kelas dimulai.
        </p>
      </template>
    </div>
  </StateBox>

  <ConfirmSheet
    :open="cancelling"
    title="Batalkan Kelas"
    message="Slot akan diberikan ke member lain. Lanjutkan?"
    confirm-label="Ya, Batalkan"
    danger
    :busy="busy"
    :error="cancelError"
    @confirm="confirmCancel"
    @close="cancelling = false"
  />
</template>
