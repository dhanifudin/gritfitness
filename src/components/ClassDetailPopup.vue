<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { book, myClassDetail } from '@/api/endpoints'
import type { ScheduleRow } from '@/api/types'
import ConfirmSheet from '@/components/ConfirmSheet.vue'
import { rupiah } from '@/composables/useAsync'
import { ATURAN_KELAS, classActionFor } from '@/lib/classAction'
import { CK, invalidate } from '@/lib/dataCache'
import { titleCase } from '@/lib/format'
import { syncClassQr } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'
import { useClassWatch } from '@/stores/classWatch'
import { useTracker } from '@/stores/tracker'

// Full-screen class detail, exactly the official kelas-detail popup: navbar + ✕, description,
// kd-rows, S&K bullets, sticky action bar. One quiet extra: the auto-booking weekly toggle.
const props = defineProps<{
  row: ScheduleRow
  /** YYYY-MM-DD the row belongs to (signup bookkeeping + the watch toggle's weekday) */
  date: string
  /** class name override when opened from a class's own schedule page */
  name?: string
}>()
const emit = defineEmits<{ close: []; booked: [] }>()

const router = useRouter()
const auth = useAuth()
const tracker = useTracker()
const classWatch = useClassWatch()

const title = computed(() => titleCase(props.name ?? props.row.kelas))
const jam = computed(() => (props.row.jam_selesai ? `${props.row.jam_mulai} – ${props.row.jam_selesai}` : props.row.jam_mulai))
const syarat = computed(() => (props.row.syarat_ketentuan ?? '').split(/\r?\n+/).map((s) => s.trim()).filter(Boolean))

// ---- auto-booking weekly toggle (our addition) ----
const weekday = computed(() => (new Date(props.date + 'T00:00').getDay() + 6) % 7)
const watched = computed(() => (tracker.consented ? !!classWatch.activeFor(weekday.value, props.row.jam_mulai, props.row.kelas) : false))
async function toggleWatch() {
  if (watched.value) await classWatch.unwatch(weekday.value, props.row.jam_mulai, props.row.kelas)
  else await classWatch.watch(weekday.value, props.row.jam_mulai, props.row.kelas, null)
}

// ---- booking ----
const action = computed(() => classActionFor(props.row))
const confirming = ref(false)
const busy = ref(false)
const bookError = ref('')
const success = ref('')

function act() {
  const a = action.value
  if (!a) return
  if (a.kind === 'pay') {
    emit('close')
    void router.push(`/bills/${props.row.tagihan_id}`)
    return
  }
  confirming.value = true
}

async function confirmBook() {
  const row = props.row
  busy.value = true
  bookError.value = ''
  try {
    const res = await book(row.id)
    confirming.value = false
    if (res.status === 'pending_payment' && res.tagihan_id) {
      emit('close')
      void router.push(`/bills/${res.tagihan_id}`)
      return
    }
    success.value = res.message ?? (row.penuh ? 'Kamu masuk waiting list.' : 'Kelas berhasil dibooking!')
    invalidate(CK.myClasses) // Kelas Saya / Riwayat Kehadiran must not show a pre-booking cache
    invalidate(CK.dashboard)
    if (!row.penuh) {
      // same bookkeeping as auto-booking: shows under Kelas Saya and counts toward the savings
      const saved = row.harga_normal - row.harga_akhir
      tracker.trackSignup({ schedule_id: row.id, class_name: row.kelas, scheduled_on: props.date, start_time: row.jam_mulai, status: 'planned', price: saved > 0 ? saved : null })
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
      <div class="fixed inset-0 z-50" role="dialog" aria-modal="true" :aria-label="`Detail kelas ${title}`">
        <div class="sheet-panel mx-auto flex h-full max-w-md flex-col bg-page">
          <header class="safe-t flex min-h-[52px] items-center justify-between gap-3 px-4">
            <h2 class="text-lg font-extrabold">Detail Kelas</h2>
            <button class="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink active:bg-wash" aria-label="Tutup" @click="emit('close')">
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-4">
            <div class="flex items-start justify-between gap-2.5">
              <h3 class="text-xl leading-tight font-extrabold">{{ title }}</h3>
              <span v-if="row.gratis && row.harga_normal > 0" class="pill pill-ok shrink-0">Membership</span>
              <span v-else-if="row.diskon" class="pill pill-warn shrink-0">Diskon</span>
            </div>
            <p v-if="row.deskripsi" class="mt-2 text-sm leading-relaxed whitespace-pre-line text-soft">{{ row.deskripsi }}</p>

            <div class="mt-3 text-sm">
              <div class="flex justify-between border-b border-line py-[11px]"><span class="font-semibold text-mute">Waktu</span><span class="font-bold">{{ jam }}</span></div>
              <div class="flex justify-between border-b border-line py-[11px]"><span class="font-semibold text-mute">Ruangan</span><span class="font-bold">{{ row.ruangan || '—' }}</span></div>
              <div class="flex justify-between border-b border-line py-[11px]"><span class="font-semibold text-mute">Instruktur</span><span class="font-bold">{{ row.instruktur || '—' }}</span></div>
              <div class="flex justify-between border-b border-line py-[11px]">
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
              <div class="flex justify-between py-[11px]"><span class="font-semibold text-mute">Slot</span><span class="font-bold">{{ row.slot_terisi }}/{{ row.slot_max }} terisi</span></div>
            </div>

            <button
              v-if="tracker.consented"
              type="button"
              class="mt-2 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line px-4 py-2 text-left"
              :class="watched ? 'bg-(--ok-bg)' : 'bg-wash'"
              data-testid="watch-toggle"
              @click="toggleWatch"
            >
              <span class="min-w-0">
                <span class="block text-sm font-bold" :class="watched ? 'text-ok' : 'text-soft'">{{ watched ? 'Booking otomatis aktif' : 'Booking otomatis tiap minggu' }}</span>
                <span class="block text-xs text-mute">Dibooking begitu jadwalnya terbit.</span>
              </span>
              <span class="switch !h-6 !w-10 shrink-0" :class="watched ? 'switch-on' : ''">
                <span class="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition" :class="watched ? 'translate-x-4' : ''" />
              </span>
            </button>

            <template v-if="syarat.length">
              <p class="mt-4 text-[15px] font-extrabold">Syarat & Ketentuan</p>
              <ul class="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-soft">
                <li v-for="(s, i) in syarat" :key="i">{{ s }}</li>
              </ul>
            </template>

            <p v-if="success" class="banner banner-ok mt-3" data-testid="book-success">{{ success }}</p>
            <p v-if="bookError && !confirming" class="banner banner-err mt-3">{{ bookError }}</p>
          </div>

          <!-- sticky action bar, exactly .kd-action-bar -->
          <div class="safe-b border-t border-line bg-card px-5 py-3">
            <div v-if="row.booking_status === 'confirmed' || success" class="rounded-xl bg-(--warn-bg) py-3.5 text-center text-sm font-bold text-navy dark:text-white" data-testid="book-status">
              Kamu sudah mengambil kelas ini
            </div>
            <button
              v-else-if="action"
              class="w-full"
              :class="action.kind === 'waiting' ? 'btn-ghost' : 'btn-primary'"
              :disabled="busy"
              data-testid="book-action"
              @click="act"
            >
              {{ action.label }}
            </button>
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
