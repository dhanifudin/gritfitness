<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { jadwalKelas, paketKelas } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { assetUrl, useAsync } from '@/composables/useAsync'
import timetable from '@/data/timetable.json'
import { CK } from '@/lib/dataCache'
import ClassInfoSheet from '@/components/ClassInfoSheet.vue'
import SafeImg from '@/components/SafeImg.vue'
import classInfo from '@/data/classInfo.json'
import { classInfoFor, type ClassInfoData } from '@/lib/classInfo'
import { DAY_NAMES, mergeDay, sameDay, weekDates, weekdayOf, weekLabel, type DayItem, type Slot } from '@/lib/timetable'

const MAX_OFFSET = 3 // current week + 3 weeks ahead
const slots = timetable.slots as Slot[]
const info = classInfo as unknown as ClassInfoData

// What the class is (description, category), joined on the class package id.
const matchOf = (it: DayItem) => classInfoFor(info, { packageId: it.packageId, kelas: it.kelas })
// One small icon per class category (Cardio/Flexibility/Strength — the full set, confirmed via classInfo.json)
// instead of a plain colored dot: a pulse line, a stretch figure, a dumbbell.
const CAT_ICON: Record<string, { path: string; color: string }> = {
  '2': { path: 'M3 12h4l2-5 4 10 2-5h6', color: 'text-white/50' }, // Cardio: pulse line
  '4': { path: 'M12 5v5M7 8l5 2.5L17 8M9 20l3-7 3 7', color: 'text-white/50' }, // Flexibility: stretch figure
  '5': { path: 'M4 9v6M20 9v6M7 12h10', color: 'text-white/50' }, // Strength: barbell
}
const opened = ref<DayItem | null>(null)
const openedMatch = computed(() => (opened.value ? matchOf(opened.value) : null))

// Real rows: the API only lists today's still-open classes.
const { data: actual, error, savedAt, stale, reload } = useAsync(jadwalKelas, [], { key: CK.classes })
// Class photos for predicted rows, by package id (prefetched and cached by the other tabs).
const { data: packages } = useAsync(paketKelas, [], { key: CK.packages('class') })
const photoOf = (packageId: number | null) => {
  const f = packages.value.find((p) => p.id === packageId)?.foto
  return f ? assetUrl('/storage/kelas/' + f) : ''
}

const now = ref(new Date())
let timer: ReturnType<typeof setInterval>
onMounted(() => (timer = setInterval(() => (now.value = new Date()), 60_000))) // flips "Perkiraan" → "Selesai" on time
onUnmounted(() => clearInterval(timer))

const offset = ref(0)
const dates = computed(() => weekDates(offset.value, now.value))
const todayIdx = computed(() => dates.value.findIndex((d) => sameDay(d, now.value)))
const picked = ref<number | null>(null) // null = default (today, or Monday on other weeks)
const selected = computed(() => picked.value ?? (todayIdx.value >= 0 ? todayIdx.value : 0))

function go(delta: number) {
  offset.value = Math.min(MAX_OFFSET, Math.max(0, offset.value + delta))
  picked.value = null
}

const week = computed(() => dates.value.map((d) => mergeDay(d, actual.value, slots, now.value)))
const items = computed(() => week.value[selected.value])
const generated = new Date(timetable.generatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const badge = {
  confirmed: 'bg-emerald-500/20 text-emerald-300',
  predicted: 'bg-amber-500/15 text-amber-300',
  ended: 'bg-white/10 text-white/35',
} as const
const badgeText = { confirmed: 'Terjadwal', predicted: 'Perkiraan', ended: 'Selesai' } as const
// so status doesn't rely on color (or reading the Indonesian word) alone: check mark / clock / muted check
const badgeIcon = { confirmed: 'check', predicted: 'clock', ended: 'check' } as const
</script>

<template>
  <PageHeader title="Kelas" :subtitle="weekLabel(dates)" gear />

  <div class="mb-3 flex items-center justify-between px-5">
    <button class="btn-sm !text-sm" :disabled="offset === 0" aria-label="Minggu sebelumnya" @click="go(-1)"><svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
    <span class="text-xs text-white/50">{{ offset === 0 ? 'Minggu ini' : offset === 1 ? 'Minggu depan' : `${offset} minggu lagi` }}</span>
    <button class="btn-sm !text-sm" :disabled="offset === MAX_OFFSET" aria-label="Minggu berikutnya" @click="go(1)"><svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
  </div>

  <div class="mb-4 grid grid-cols-7 gap-1.5 px-5" role="tablist">
    <button
      v-for="(d, i) in dates"
      :key="i"
      role="tab"
      :aria-selected="selected === i"
      class="flex flex-col items-center rounded-xl py-2 text-xs transition"
      :class="[
        selected === i ? 'bg-grit-500 text-white' : 'bg-white/5 text-white/50',
        i === todayIdx && selected !== i ? 'ring-1 ring-white/70' : '',
        !week[i].length && selected !== i ? 'opacity-40' : '',
      ]"
      @click="picked = i"
    >
      <span>{{ DAY_NAMES[i] }}</span>
      <span class="mt-0.5 font-display text-lg leading-none">{{ d.getDate() }}</span>
      <span class="mt-1 h-1 w-1 rounded-full" :class="week[i].some((x) => x.status === 'confirmed') ? 'bg-emerald-400' : week[i].length ? 'bg-white/15' : 'bg-transparent'" />
    </button>
  </div>

  <p v-if="error" class="banner banner-err mx-5 mb-3 flex items-center justify-between gap-3 !py-2 !text-xs">
    Jadwal terbaru tidak bisa dimuat.
    <button class="btn-sm btn-danger shrink-0" @click="reload">Coba lagi</button>
  </p>
  <StateBox :stale="stale" :saved-at="savedAt" :empty="!items.length" empty-text="Tidak ada jadwal kelas di hari ini">
    <ul class="space-y-3 px-5">
      <li v-for="it in items" :key="it.key" class="card overflow-hidden" :class="it.status === 'ended' ? 'opacity-50' : ''">
        <component
          :is="it.status === 'confirmed' ? 'RouterLink' : 'div'"
          v-bind="it.status === 'confirmed' ? { to: `/classes/${it.classId}` } : {}"
          class="flex w-full gap-3 p-3"
        >
          <SafeImg :src="it.fotoUrl ? assetUrl(it.fotoUrl) : photoOf(it.packageId)" :alt="it.kelas" class="h-20 w-20 shrink-0 rounded-xl object-cover" />
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="truncate font-display text-lg leading-tight">{{ it.name }}</p>
              <span class="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" :class="badge[it.status]">
                <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle v-if="badgeIcon[it.status] === 'clock'" cx="12" cy="12" r="9" />
                  <path :d="badgeIcon[it.status] === 'clock' ? 'M12 7v5l3 3' : 'M20 6L9 17l-5-5'" />
                </svg>
                {{ badgeText[it.status] }}
              </span>
            </div>
            <p class="truncate text-sm text-white/50">{{ it.kelas }}<template v-if="it.instructor"> · {{ it.instructor }}</template></p>
            <p class="mt-1 flex items-center gap-1.5 text-sm">
              {{ it.start }}–{{ it.end }}
              <template v-if="matchOf(it)?.category">
                <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" :class="CAT_ICON[String(matchOf(it)!.cls.categoryId)]?.color ?? 'text-white/35'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path :d="CAT_ICON[String(matchOf(it)!.cls.categoryId)]?.path ?? 'M12 12h.01'" />
                </svg>
                <span class="text-xs text-white/50">{{ matchOf(it)!.category!.name }}</span>
              </template>
            </p>
            <p v-if="it.status === 'confirmed'" class="mt-0.5 text-xs text-white/70">{{ it.peserta }}/{{ it.max }} peserta</p>
          </div>
        </component>
        <button
          v-if="matchOf(it)"
          type="button"
          class="flex w-full items-center justify-between border-t border-white/8 px-4 py-2.5 text-xs font-semibold text-grit-300 active:bg-white/5"
          @click="opened = it"
        >
          Tentang kelas <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-white/35" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </li>
    </ul>
  </StateBox>

  <p class="mx-5 mt-4 text-center text-xs leading-relaxed text-white/35">
    Kelas berlabel “Perkiraan” mengikuti pola {{ timetable.weeksUsed }} minggu terakhir (diperbarui {{ generated }}) dan bisa berubah.
  </p>

  <ClassInfoSheet
    v-if="opened"
    :match="openedMatch"
    :title="opened.name"
    :session="{
      time: `${opened.start}–${opened.end}`,
      instructor: opened.instructor,
      predicted: opened.status === 'predicted',
      ended: opened.status === 'ended',
      weekday: weekdayOf(dates[selected]),
      start_time: opened.start,
      class_name: opened.name,
      package_id: opened.packageId,
    }"
    @close="opened = null"
  />
</template>
