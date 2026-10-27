<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { book, myClassDetail } from '@/api/endpoints'
import type { ScheduleRow } from '@/api/types'
import ConfirmSheet from '@/components/ConfirmSheet.vue'
import SafeImg from '@/components/SafeImg.vue'
import { assetUrl, rupiah } from '@/composables/useAsync'
import { ATURAN_KELAS, classActionFor, classNoticeFor } from '@/lib/classAction'
import type { ClassMatch } from '@/lib/classInfo'
import { syncClassQr } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'
import { useClassWatch } from '@/stores/classWatch'
import { useTracker } from '@/stores/tracker'

const props = defineProps<{
  /** the real schedule row (null for predicted slots, which can't be booked yet) */
  row: ScheduleRow | null
  /** YYYY-MM-DD the row belongs to (for the signup bookkeeping) */
  date?: string
  match: ClassMatch | null
  title: string
  /** the tapped session, shown under the class info. weekday/start_time/class_name identify a
   *  weekly slot for the auto-booking watchlist (see src/stores/classWatch.ts). */
  session?: {
    time: string
    instructor: string | null
    predicted: boolean
    ended?: boolean
    weekday?: number
    start_time?: string
    class_name?: string
    package_id?: number | null
  } | null
}>()
const emit = defineEmits<{ close: []; booked: [] }>()

const router = useRouter()
const auth = useAuth()
const tracker = useTracker()
const classWatch = useClassWatch()

// ---- auto-booking watchlist toggle (works for predicted slots and published rows alike) ----
const canWatch = computed(() => !props.session?.ended && props.session?.weekday != null && props.session.start_time && props.session.class_name && tracker.consented)
const watched = computed(() =>
  canWatch.value ? !!classWatch.activeFor(props.session!.weekday!, props.session!.start_time!, props.session!.class_name!) : false,
)
async function toggleWatch() {
  const s = props.session
  if (!s || s.weekday == null || !s.start_time || !s.class_name) return
  if (watched.value) await classWatch.unwatch(s.weekday, s.start_time, s.class_name)
  else await classWatch.watch(s.weekday, s.start_time, s.class_name, s.package_id ?? null)
}

// ---- booking ----
const action = computed(() => (props.row && !props.session?.ended ? classActionFor(props.row) : null))
const notice = computed(() => (props.row ? classNoticeFor(props.row) : ''))
const confirming = ref(false)
const busy = ref(false)
const bookError = ref('')
const success = ref('')

function act() {
  const a = action.value
  if (!a || !props.row) return
  if (a.kind === 'pay') {
    void router.push(`/bills/${props.row.tagihan_id}`)
    return
  }
  confirming.value = true
}

async function confirmBook() {
  const row = props.row
  if (!row) return
  busy.value = true
  bookError.value = ''
  try {
    const res = await book(row.id)
    confirming.value = false
    if (res.status === 'pending_payment' && res.tagihan_id) {
      void router.push(`/bills/${res.tagihan_id}`)
      return
    }
    success.value = res.message ?? (row.penuh ? 'Kamu masuk waiting list.' : 'Kelas berhasil dibooking!')
    if (!row.penuh) {
      // same bookkeeping as auto-booking: shows under "Kelas terdaftar" and counts toward the savings
      const saved = row.harga_normal - row.harga_akhir
      tracker.trackSignup({ schedule_id: row.id, class_name: row.kelas, scheduled_on: props.date ?? '', start_time: row.jam_mulai, status: 'planned', price: saved > 0 ? saved : null })
      const u = auth.user
      if (u) void myClassDetail(row.id).then((d) => syncClassQr({ id: u.id, nama: u.nama }, row.id, d)).catch(() => {})
    }
    emit('booked')
  } catch (e) {
    bookError.value = e instanceof Error ? e.message : 'Booking gagal, coba lagi.'
  } finally {
    busy.value = false
  }
}

const desc = computed(() => props.row?.deskripsi || props.match?.cls.description || '')
const syarat = computed(() => (props.row?.syarat_ketentuan ?? '').split('\n').map((s) => s.trim()).filter(Boolean))

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && emit('close')
onMounted(() => {
  document.addEventListener('keydown', onKey)
  if (tracker.consented) classWatch.load()
})
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet" appear>
      <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" :aria-label="`Kelas ${title}`" @click.self="emit('close')">
        <div class="sheet-panel safe-b max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-line bg-card">
          <div class="sheet-handle mt-3" aria-hidden="true" />
          <SafeImg v-if="props.match?.cls.photo" :src="assetUrl(props.match.cls.photo)" :alt="title" class="h-44 w-full object-cover" />
          <div class="p-5">
            <div class="flex items-start justify-between gap-3">
              <h2 class="text-xl leading-tight font-extrabold">{{ title }}</h2>
              <button class="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-soft active:bg-wash" aria-label="Tutup" @click="emit('close')">
                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div v-if="session" class="mt-3 space-y-0 text-sm">
              <div class="flex justify-between border-b border-line py-2.5"><span class="font-semibold text-mute">Waktu</span><span class="font-bold">{{ session.time }}</span></div>
              <div v-if="session.instructor" class="flex justify-between border-b border-line py-2.5"><span class="font-semibold text-mute">Instruktur</span><span class="font-bold">{{ session.instructor }}</span></div>
              <div v-if="row?.ruangan" class="flex justify-between border-b border-line py-2.5"><span class="font-semibold text-mute">Ruangan</span><span class="font-bold">{{ row.ruangan }}</span></div>
              <div v-if="row" class="flex justify-between border-b border-line py-2.5">
                <span class="font-semibold text-mute">Harga</span>
                <span>
                  <span v-if="row.harga_normal === 0" class="price-free">Gratis</span>
                  <span v-else-if="row.harga_akhir === 0" class="price-free">Termasuk Membership</span>
                  <template v-else>
                    <span v-if="row.diskon" class="price-strike mr-1">{{ rupiah(row.harga_normal) }}</span>
                    <span class="price-final">{{ rupiah(row.harga_akhir) }}</span>
                  </template>
                </span>
              </div>
              <div v-if="row" class="flex justify-between py-2.5"><span class="font-semibold text-mute">Slot</span><span class="font-bold">{{ row.slot_terisi }}/{{ row.slot_max }}</span></div>
            </div>

            <p v-if="success" class="banner banner-ok mt-3" data-testid="book-success">{{ success }}</p>
            <p v-else-if="notice" class="banner mt-3" :class="row?.booking_status === 'booked' ? 'banner-warn' : 'banner-info'" data-testid="book-notice">{{ notice }}</p>
            <p v-if="bookError && !confirming" class="banner banner-err mt-3">{{ bookError }}</p>

            <button
              v-if="action && !success"
              class="mt-4 w-full"
              :class="action.kind === 'waiting' ? 'btn-ghost' : 'btn-primary'"
              :disabled="busy"
              data-testid="book-action"
              @click="act"
            >
              {{ action.label }}
            </button>

            <button
              v-if="canWatch"
              type="button"
              class="mt-3 flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5 text-left"
              :class="watched ? 'bg-(--ok-bg)' : 'bg-wash'"
              data-testid="watch-toggle"
              @click="toggleWatch"
            >
              <span class="min-w-0">
                <span class="block text-sm font-bold" :class="watched ? 'text-ok' : 'text-soft'">{{ watched ? 'Booking otomatis aktif' : 'Booking otomatis tiap minggu' }}</span>
                <span class="block text-xs text-mute">Dibooking begitu jadwalnya terbit.</span>
              </span>
              <span class="switch" :class="watched ? 'switch-on' : ''">
                <span class="absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition" :class="watched ? 'translate-x-5' : ''" />
              </span>
            </button>
            <p v-else-if="!session?.ended" class="mt-2 text-xs text-mute">Aktifkan sinkronisasi (Pengaturan › Data & sinkronisasi) untuk booking otomatis.</p>

            <div v-if="match || row" class="mt-4 flex flex-wrap gap-2 text-xs">
              <span v-if="match?.category" class="pill pill-navy">{{ match.category.name }}</span>
              <span v-if="match?.cls.minutes" class="pill pill-mute">{{ match.cls.minutes }} menit</span>
            </div>

            <p v-if="desc" class="mt-4 text-sm leading-relaxed whitespace-pre-line text-soft">{{ desc }}</p>

            <div v-if="syarat.length" class="mt-4 rounded-xl bg-wash p-3 text-xs leading-relaxed text-mute">
              <p class="mb-1 font-bold text-soft">Syarat & Ketentuan</p>
              <ul class="list-disc space-y-1 pl-4">
                <li v-for="(s, i) in syarat" :key="i">{{ s }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <ConfirmSheet
    :open="confirming"
    title="Konfirmasi Kelas"
    :confirm-label="busy ? 'Memproses…' : 'Setuju & Ambil'"
    :busy="busy"
    :error="bookError"
    @confirm="confirmBook"
    @close="confirming = false"
  >
    <ul class="list-disc space-y-1.5 pl-4 text-sm text-soft">
      <li v-for="(t, i) in ATURAN_KELAS" :key="i">{{ t }}</li>
    </ul>
  </ConfirmSheet>
</template>
