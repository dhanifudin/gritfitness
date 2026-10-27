<script setup lang="ts">
import { titleCase } from '@/lib/format'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { myClasses, schedule } from '@/api/endpoints'
import type { ScheduleRow } from '@/api/types'
import PageHeader from '@/components/PageHeader.vue'
import ClassInfoSheet from '@/components/ClassInfoSheet.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import timetable from '@/data/timetable.json'
import classInfo from '@/data/classInfo.json'
import { classInfoFor, type ClassInfoData } from '@/lib/classInfo'
import { CK, read, write } from '@/lib/dataCache'
import { addDays, mergeDay, startOfDay, weekdayOf, type DayItem, type Slot } from '@/lib/timetable'
import { ymd } from '@/lib/tracker'
import { useTracker } from '@/stores/tracker'

// Official-style day picker: 14 days starting today, each tap (re)fetches that day's schedule.
const DAYS_AHEAD = 14
const DAY_NAMES_SUN = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const slots = timetable.slots as Slot[]
const info = classInfo as unknown as ClassInfoData

const now = ref(new Date())
let timer: ReturnType<typeof setInterval>
onMounted(() => (timer = setInterval(() => (now.value = new Date()), 60_000))) // flips "Perkiraan" → "Selesai" on time
onUnmounted(() => clearInterval(timer))

const days = computed(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(startOfDay(now.value), i)))
const sel = ref(0)
const selDate = computed(() => days.value[sel.value])
const selYmd = computed(() => ymd(selDate.value))

// per-date rows, stale-while-revalidate against the shared cache
const byDate = ref<Record<string, ScheduleRow[]>>({})
const loading = ref(false)
const error = ref('')
const savedAt = ref(0)
const stale = ref(false)
async function loadDay(date: string, force = false) {
  const hit = read<ScheduleRow[]>(CK.schedule(date))
  if (hit) {
    byDate.value = { ...byDate.value, [date]: hit.data }
    savedAt.value = hit.savedAt
    if (!force && Date.now() - hit.savedAt < 30_000) return
  } else {
    savedAt.value = 0
  }
  loading.value = !hit
  error.value = ''
  stale.value = false
  try {
    const rows = await schedule(date)
    byDate.value = { ...byDate.value, [date]: rows }
    savedAt.value = write(CK.schedule(date), rows)
  } catch (e) {
    if (hit) stale.value = true
    else error.value = e instanceof Error ? e.message : 'Terjadi kesalahan'
  } finally {
    loading.value = false
  }
}
watch(selYmd, (d) => void loadDay(d), { immediate: true })
const reload = () => loadDay(selYmd.value, true)

const actual = computed(() => byDate.value[selYmd.value])
// Real rows merged with the recurring weekly pattern (predictions) for days the gym hasn't published yet.
const items = computed(() => mergeDay(selDate.value, actual.value ?? [], slots, now.value))
const rowOf = (it: DayItem) => (actual.value ?? []).find((r) => r.id === it.classId) ?? null
const generated = new Date(timetable.generatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

// ---- "Terdaftar" view: the member's bookings (API) plus tracker-known signups ----
const tracker = useTracker()
onMounted(() => tracker.init())
const { data: mine, reload: reloadMine } = useAsync(myClasses, null, { key: CK.myClasses })
type View = 'mine' | 'all'
// null until the member chooses: the default follows whether anything is booked
const view = ref<View | null>(null)
const effectiveView = computed<View>(() => (view.value ?? (mine.value?.mendatang.length ? 'mine' : 'all')))

const opened = ref<{ item: DayItem; row: ScheduleRow | null } | null>(null)
const openedMatch = computed(() => (opened.value ? classInfoFor(info, { packageId: opened.value.item.packageId, kelas: opened.value.item.kelas }) : null))
function openItem(it: DayItem) {
  opened.value = { item: it, row: rowOf(it) }
}
function booked() {
  // keep the sheet open so the success message is readable; refresh the lists behind it
  void loadDay(selYmd.value, true)
  void reloadMine()
}

const badge = { confirmed: 'pill-ok', predicted: 'pill-warn', ended: 'pill-mute' } as const
const badgeText = { confirmed: 'Terjadwal', predicted: 'Perkiraan', ended: 'Selesai' } as const
const dayLabel = (d: Date, i: number) => (i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }))
</script>

<template>
  <PageHeader title="Jadwal Kelas" :subtitle="effectiveView === 'all' ? dayLabel(selDate, sel) : 'Kelas yang kamu ikuti'" />

  <div class="seg mx-4 mb-3 grid-cols-2" role="tablist">
    <button role="tab" :aria-selected="effectiveView === 'mine'" class="seg-tab" :class="effectiveView === 'mine' ? 'seg-tab-on' : ''" data-testid="view-mine" @click="view = 'mine'">Terdaftar</button>
    <button role="tab" :aria-selected="effectiveView === 'all'" class="seg-tab" :class="effectiveView === 'all' ? 'seg-tab-on' : ''" data-testid="view-all" @click="view = 'all'">Jadwal</button>
  </div>

  <template v-if="effectiveView === 'mine'">
    <div class="space-y-3 px-4" data-testid="mine-list">
      <RouterLink
        v-for="c in mine?.mendatang ?? []"
        :key="c.id"
        :to="`/my-classes/${c.schedule_id}`"
        class="card flex items-center justify-between gap-3 p-4"
      >
        <div class="min-w-0">
          <p class="truncate font-extrabold">{{ titleCase(c.nama) }}</p>
          <p class="mt-0.5 text-sm text-mute">{{ c.tanggal }} · {{ c.jam_mulai }}–{{ c.jam_selesai }}<template v-if="c.instruktur"> · {{ c.instruktur }}</template></p>
        </div>
        <span class="pill shrink-0" :class="c.status_booking === 'confirmed' ? 'pill-ok' : 'pill-warn'">
          <span class="pill-dot" aria-hidden="true" />{{ c.status_booking_label }}
        </span>
      </RouterLink>

      <div v-if="!mine?.mendatang.length" class="card p-6 text-center" data-testid="mine-empty">
        <p class="font-bold">Belum ada kelas terbooking</p>
        <p class="mt-1 text-sm text-mute">Booking dari jadwal, atau nyalakan booking otomatis di kelas yang kamu mau.</p>
        <button class="btn-primary mt-4 w-full" @click="view = 'all'">Lihat jadwal</button>
      </div>
    </div>
  </template>

  <template v-else>
    <div class="scrollbar-none mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
      <button
        v-for="(d, i) in days"
        :key="i"
        role="tab"
        :aria-selected="sel === i"
        class="flex w-[52px] shrink-0 flex-col items-center rounded-xl border py-2 text-xs transition"
        :class="sel === i ? 'border-grit-500 bg-grit-500 text-white' : 'border-line bg-card text-mute'"
        @click="sel = i"
      >
        <span class="text-[11px] font-semibold">{{ DAY_NAMES_SUN[d.getDay()] }}</span>
        <span class="mt-0.5 text-base leading-none font-extrabold" :class="sel === i ? '' : 'text-ink'">{{ d.getDate() }}</span>
      </button>
    </div>

    <p v-if="error" class="banner banner-err mx-4 mb-3 flex items-center justify-between gap-3 !py-2 !text-xs">
      Jadwal terbaru tidak bisa dimuat.
      <button class="btn-sm btn-danger shrink-0" @click="reload">Coba lagi</button>
    </p>
    <div v-if="loading" class="space-y-3 px-4">
      <div v-for="i in 3" :key="i" class="skeleton h-[84px]" />
    </div>
    <template v-else>
      <p v-if="stale && savedAt" class="banner banner-warn mx-4 mb-3 !px-3 !py-2 !text-xs">Tidak bisa memperbarui · menampilkan data tersimpan</p>
      <div v-if="!items.length" class="px-4 py-12 text-center">
        <svg viewBox="0 0 24 24" class="mx-auto h-12 w-12 text-line" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M3 11h18M8 3v4M16 3v4" /></svg>
        <p class="mt-2.5 text-sm text-mute">Tidak ada jadwal kelas di hari ini</p>
      </div>
      <ul v-else class="space-y-3 px-4">
        <li v-for="it in items" :key="it.key" :class="it.status === 'ended' ? 'opacity-50' : ''">
          <button type="button" class="card flex w-full items-center gap-3 p-4 text-left" @click="openItem(it)">
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <p class="truncate font-extrabold">{{ titleCase(it.name) }}</p>
                <span v-if="it.mine" class="pill shrink-0" :class="it.mine === 'peserta' ? 'pill-navy' : 'pill-warn'">
                  {{ it.mine === 'peserta' ? 'Terbooking' : 'Belum Bayar' }}
                </span>
                <span v-else-if="it.status !== 'confirmed'" class="pill shrink-0" :class="badge[it.status]">{{ badgeText[it.status] }}</span>
                <span v-else-if="it.penuh" class="pill pill-danger shrink-0">Penuh</span>
                <span v-else class="shrink-0 text-[13px] font-bold text-grit-500">Detail ›</span>
              </div>
              <p class="mt-0.5 truncate text-[13px] font-semibold text-mute">
                {{ it.start }}–{{ it.end }}<template v-if="it.instructor"> · {{ it.instructor }}</template>
              </p>
              <p v-if="it.status === 'confirmed' && rowOf(it)" class="mt-1 text-[13px]">
                <span v-if="rowOf(it)!.gratis && rowOf(it)!.harga_normal > 0" class="pill pill-ok mr-1.5 !px-2 !py-0.5 !text-[11px]">Membership</span>
                <span v-if="rowOf(it)!.diskon" class="pill pill-warn mr-1.5 !px-2 !py-0.5 !text-[11px]">Diskon</span>
                <span v-if="rowOf(it)!.harga_normal === 0" class="price-free">Gratis</span>
                <span v-else-if="rowOf(it)!.harga_akhir === 0" class="price-free">Termasuk Membership</span>
                <template v-else>
                  <span v-if="rowOf(it)!.diskon" class="price-strike mr-1">{{ rupiah(rowOf(it)!.harga_normal) }}</span>
                  <span class="price-final">{{ rupiah(rowOf(it)!.harga_akhir) }}</span>
                </template>
                <span class="text-mute"> · {{ rowOf(it)!.slot_terisi }}/{{ rowOf(it)!.slot_max }} slot</span>
              </p>
            </div>
          </button>
        </li>
      </ul>
    </template>

    <p class="mx-4 mt-4 text-center text-xs leading-relaxed text-mute">
      Kelas berlabel “Perkiraan” mengikuti pola {{ timetable.weeksUsed }} minggu terakhir (diperbarui {{ generated }}) dan bisa berubah.
    </p>
  </template>

  <ClassInfoSheet
    v-if="opened"
    :row="opened.row"
    :date="selYmd"
    :match="openedMatch"
    :title="titleCase(opened.item.name)"
    :session="{
      time: `${opened.item.start}–${opened.item.end}`,
      instructor: opened.item.instructor,
      predicted: opened.item.status === 'predicted',
      ended: opened.item.status === 'ended',
      weekday: weekdayOf(selDate),
      start_time: opened.item.start,
      class_name: opened.item.name,
      package_id: opened.item.packageId,
    }"
    @close="opened = null"
    @booked="booked"
  />
</template>

<style scoped>
.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
