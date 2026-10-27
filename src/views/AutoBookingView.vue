<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BackHeader from '@/components/BackHeader.vue'
import timetable from '@/data/timetable.json'
import { nextOccurrence, watchStatus, watchWhen } from '@/lib/classWatch'
import { titleCase } from '@/lib/format'
import type { Slot } from '@/lib/timetable'
import { useClassWatch } from '@/stores/classWatch'
import { useTracker } from '@/stores/tracker'

// Booking Otomatis: the home of the recurring weekly pattern (the old "Perkiraan" predictions)
// and the watch toggles. Watched slots get booked the moment the gym publishes their row —
// the actual attempt runs on app open/resume (src/stores/classWatch.ts checkAndRegister).
const tracker = useTracker()
const classWatch = useClassWatch()
const now = ref(new Date())
let timer: ReturnType<typeof setInterval>
onMounted(() => {
  tracker.init()
  if (tracker.consented) void classWatch.load()
  timer = setInterval(() => (now.value = new Date()), 60_000)
})
onUnmounted(() => clearInterval(timer))

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const slots = timetable.slots as Slot[]
const generated = new Date(timetable.generatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const byDay = computed(() =>
  DAYS.map((label, wd) => ({ label, wd, slots: slots.filter((s) => s.wd === wd).sort((a, b) => a.start.localeCompare(b.start)) })).filter((d) => d.slots.length),
)

const active = computed(() =>
  classWatch.entries
    .filter((e) => e.active)
    .sort((a, b) => nextOccurrence(a, now.value) - nextOccurrence(b, now.value) || a.start_time.localeCompare(b.start_time)),
)
const TONE = { good: 'text-ok', warn: 'text-warn', bad: 'text-danger', info: 'text-mute' } as const

const isWatched = (wd: number, start: string, name: string) => !!classWatch.activeFor(wd, start, name)
const busyKey = ref('')
async function toggle(wd: number, start: string, name: string, packageId: number | null) {
  busyKey.value = `${wd}-${start}-${name}`
  try {
    if (isWatched(wd, start, name)) await classWatch.unwatch(wd, start, name)
    else await classWatch.watch(wd, start, name, packageId)
  } catch {
    /* offline: toggle again later */
  } finally {
    busyKey.value = ''
  }
}
</script>

<template>
  <BackHeader title="Booking Otomatis" />

  <div class="px-4 pb-6">
    <div class="rounded-2xl bg-navy p-4 text-[13px] leading-relaxed text-[#cbd5e1]">
      Pilih kelas rutin yang mau dibooking otomatis. Begitu gym menerbitkan jadwalnya (biasanya sehari sebelumnya), aplikasi membookingkannya saat kamu membuka app.
    </div>

    <div v-if="!tracker.consented" class="card mt-3 p-4 text-sm text-soft">
      Booking otomatis butuh sinkronisasi cloud.
      <RouterLink to="/settings/data" class="font-bold text-grit-500">Aktifkan di Data & Sinkronisasi →</RouterLink>
    </div>

    <template v-else>
      <template v-if="active.length">
        <p class="mt-4 mb-1.5 text-[15px] font-extrabold">Aktif</p>
        <div class="card divide-y divide-line" data-testid="watch-active">
          <div v-for="e in active" :key="e.id" class="flex items-center gap-3 px-4 py-2.5 text-sm" data-testid="watch-row">
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-3">
                <span class="min-w-0 truncate font-bold">{{ titleCase(e.class_name) }}</span>
                <span class="shrink-0 text-mute">{{ watchWhen(e, now) }}</span>
              </div>
              <p class="mt-0.5 text-xs" :class="TONE[watchStatus(e, now).tone]">{{ watchStatus(e, now).text }}</p>
            </div>
            <button class="btn-sm shrink-0" data-testid="watch-remove" :aria-label="`Hapus ${e.class_name}`" @click="toggle(e.weekday, e.start_time, e.class_name, e.package_id)">Hapus</button>
          </div>
        </div>
      </template>

      <p class="mt-4 mb-1.5 text-[15px] font-extrabold">Pola jadwal mingguan</p>
      <template v-for="d in byDay" :key="d.wd">
        <p class="mt-3 mb-1.5 px-1 text-[11px] font-extrabold tracking-[.04em] text-mute uppercase">{{ d.label }}</p>
        <div class="card divide-y divide-line">
          <button
            v-for="s in d.slots"
            :key="s.start + s.name"
            type="button"
            class="flex w-full items-center gap-3 px-4 py-2.5 text-left"
            :disabled="busyKey === `${d.wd}-${s.start}-${s.name}`"
            :data-testid="`slot-${d.wd}-${s.start}`"
            @click="toggle(d.wd, s.start, s.name, s.packageId)"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold">{{ titleCase(s.name) }}</p>
              <p class="mt-0.5 text-xs font-semibold text-mute">{{ s.start }}–{{ s.end }}<template v-if="s.instructor"> · {{ s.instructor }}</template></p>
            </div>
            <span class="switch !h-6 !w-10 shrink-0" :class="isWatched(d.wd, s.start, s.name) ? 'switch-on' : ''">
              <span class="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition" :class="isWatched(d.wd, s.start, s.name) ? 'translate-x-4' : ''" />
            </span>
          </button>
        </div>
      </template>

      <p class="mt-4 text-center text-xs leading-relaxed text-mute">
        Pola mengikuti jadwal {{ timetable.weeksUsed }} minggu terakhir (diperbarui {{ generated }}) dan bisa berubah.
      </p>
    </template>
  </div>
</template>
