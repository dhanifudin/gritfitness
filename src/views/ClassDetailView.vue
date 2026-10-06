<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { classCancel, classDetail, classRegister, classWaiting } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import ConfirmSheet from '@/components/ConfirmSheet.vue'
import DetailRow from '@/components/DetailRow.vue'
import SafeImg from '@/components/SafeImg.vue'
import StateBox from '@/components/StateBox.vue'
import { useAction } from '@/composables/useAction'
import { assetUrl, useAsync } from '@/composables/useAsync'
import classInfo from '@/data/classInfo.json'
import { classActionFor, classNoticeFor } from '@/lib/classAction'
import { classInfoFor, type ClassInfoData } from '@/lib/classInfo'
import { CK, invalidate } from '@/lib/dataCache'
import { parseDmy } from '@/lib/timetable'
import { ymd } from '@/lib/tracker'
import { useTracker } from '@/stores/tracker'
import { useOnline } from '@/composables/useSw'

const route = useRoute()
const { data: c, loading, error, savedAt, stale, reload } = useAsync(() => classDetail(route.params.id as string), null, { key: () => CK.classDetail(route.params.id as string) })
const online = useOnline()
const tracker = useTracker()
const about = computed(() =>
  c.value ? classInfoFor(classInfo as unknown as ClassInfoData, { packageId: c.value.id_paket_kelas, kelas: c.value.nama_kelas }) : null,
)
const classMeta = computed(() => [about.value?.category?.name, about.value?.cls.minutes ? `${about.value.cls.minutes} menit` : null].filter(Boolean).join(', '))
const { busy, error: actionError, run } = useAction()

const action = computed(() => classActionFor(c.value?.daftar))
const notice = computed(() => classNoticeFor(c.value?.daftar))

const sheet = ref(false)
const reason = ref('')
const done = ref('')
const canConfirm = computed(() => action.value?.kind !== 'cancel' || reason.value.trim().length > 0)

async function confirm() {
  if (!c.value || !action.value || !canConfirm.value) return
  const id = c.value.id
  const k = action.value.kind
  const res = await run(() =>
    k === 'register' ? classRegister(id) : k === 'waiting' ? classWaiting(id) : classCancel(c.value!.id_peserta!, reason.value.trim()),
  )
  if (!res) return
  sheet.value = false
  reason.value = ''
  invalidate('classes') // list counts and status changed
  // tracker: remember classes the member signed up for, so Home can ask "Jadi ikut kelas?" on the day
  tracker.init()
  if (k === 'register') {
    tracker.trackSignup({ schedule_id: id, class_name: c.value.nama_jadwal_kelas, scheduled_on: ymd(parseDmy(c.value.tanggal)), start_time: c.value.jam_awal, status: 'planned' })
  } else if (k === 'cancel') {
    tracker.setSignupStatus(id, 'cancelled')
  }
  done.value = res.message || 'Berhasil'
  await reload()
}
</script>

<template>
  <BackHeader :title="c?.nama_jadwal_kelas ?? 'Detail kelas'" :subtitle="c?.nama_kelas" />
  <StateBox :loading="loading && !c" :stale="stale" :saved-at="savedAt" :error="error" @retry="reload">
    <div v-if="c" class="px-5">
      <div class="card px-5 py-2">
        <dl class="divide-y divide-white/8">
          <DetailRow label="Tanggal" :value="c.tanggal" />
          <DetailRow label="Jam" :value="`${c.jam_awal} – ${c.jam_akhir}`" />
          <DetailRow label="Instruktur" :value="c.instruktur" />
          <DetailRow label="Peserta" :value="`${c.peserta} / ${c.max_member}`" />
          <DetailRow label="Waiting list" :value="c.waitinglist" />
        </dl>
      </div>

      <p v-if="done" class="mt-4 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300">{{ done }}</p>
      <p v-if="notice" class="mt-4 rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-white/70">{{ notice }}</p>

      <p v-if="action && !online" class="mt-4 text-center text-xs text-amber-300">Perlu koneksi internet untuk mendaftar atau membatalkan.</p>
      <button v-if="action" :disabled="!online" :class="action.danger ? 'btn mt-4 w-full bg-red-500 text-white' : 'btn-primary mt-4 w-full'" @click="(sheet = true), (done = '')">
        {{ action.label }}
      </button>

      <div v-if="about" class="card mt-5 overflow-hidden">
        <SafeImg v-if="about.cls.photo" :src="assetUrl(about.cls.photo)" :alt="about.cls.name" class="h-36 w-full object-cover" />
        <div class="p-4">
          <p class="text-xs text-white/50">Tentang kelas</p>
          <p class="mt-1 font-display text-lg">{{ about.cls.name }}</p>
          <p v-if="classMeta" class="mt-1 text-xs text-white/55">{{ classMeta }}</p>
          <p v-if="about.cls.description" class="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/80">{{ about.cls.description }}</p>
          <p v-else-if="about.category" class="mt-3 text-sm leading-relaxed text-white/65">{{ about.category.tagline }}</p>
        </div>
      </div>
    </div>
  </StateBox>

  <ConfirmSheet
    :open="sheet"
    :title="action?.label ?? ''"
    :message="action?.kind === 'cancel' ? 'Tuliskan alasan pembatalan.' : `Konfirmasi untuk ${c?.nama_jadwal_kelas}, ${c?.tanggal} pukul ${c?.jam_awal}.`"
    :confirm-label="action?.kind === 'cancel' ? 'Batalkan' : 'Ya, daftar'"
    :danger="action?.danger"
    :busy="busy || !canConfirm"
    :error="actionError"
    @confirm="confirm"
    @close="sheet = false"
  >
    <textarea v-if="action?.kind === 'cancel'" v-model="reason" class="input" rows="3" placeholder="Alasan pembatalan" />
  </ConfirmSheet>
</template>
