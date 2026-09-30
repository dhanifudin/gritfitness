<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { jadwalKelas, paketKelas } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { assetUrl, useAsync } from '@/composables/useAsync'
import timetable from '@/data/timetable.json'
import { CK } from '@/lib/dataCache'
import { DAY_NAMES, mergeDay, sameDay, weekDates, weekLabel, type Slot } from '@/lib/timetable'

const MAX_OFFSET = 3 // current week + 3 weeks ahead
const slots = timetable.slots as Slot[]

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
  hint.value = ''
}

const week = computed(() => dates.value.map((d) => mergeDay(d, actual.value, slots, now.value)))
const items = computed(() => week.value[selected.value])
const hint = ref('')
const generated = new Date(timetable.generatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const badge = {
  confirmed: 'bg-emerald-500/20 text-emerald-300',
  predicted: 'bg-amber-500/15 text-amber-300',
  ended: 'bg-white/8 text-white/40',
} as const
const badgeText = { confirmed: 'Terjadwal', predicted: 'Perkiraan', ended: 'Selesai' } as const
</script>

<template>
  <PageHeader title="Kelas" :subtitle="weekLabel(dates)" />

  <div class="mb-3 flex items-center justify-between px-5">
    <button class="btn-ghost !px-3 !py-1.5 disabled:opacity-30" :disabled="offset === 0" aria-label="Minggu sebelumnya" @click="go(-1)">‹</button>
    <span class="text-xs text-white/50">{{ offset === 0 ? 'Minggu ini' : offset === 1 ? 'Minggu depan' : `${offset} minggu lagi` }}</span>
    <button class="btn-ghost !px-3 !py-1.5 disabled:opacity-30" :disabled="offset === MAX_OFFSET" aria-label="Minggu berikutnya" @click="go(1)">›</button>
  </div>

  <div class="mb-4 grid grid-cols-7 gap-1.5 px-5" role="tablist">
    <button
      v-for="(d, i) in dates"
      :key="i"
      role="tab"
      :aria-selected="selected === i"
      class="flex flex-col items-center rounded-xl py-2 text-xs transition"
      :class="[
        selected === i ? 'bg-brand-400 text-white' : 'bg-white/5 text-white/60',
        i === todayIdx && selected !== i ? 'ring-1 ring-lime-grit/70' : '',
        !week[i].length && selected !== i ? 'opacity-40' : '',
      ]"
      @click="(picked = i), (hint = '')"
    >
      <span>{{ DAY_NAMES[i] }}</span>
      <span class="mt-0.5 font-display text-lg leading-none">{{ d.getDate() }}</span>
      <span class="mt-1 h-1 w-1 rounded-full" :class="week[i].some((x) => x.status === 'confirmed') ? 'bg-emerald-400' : week[i].length ? 'bg-white/30' : 'bg-transparent'" />
    </button>
  </div>

  <p v-if="error" class="mx-5 mb-3 flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
    Jadwal terbaru tidak bisa dimuat.
    <button class="underline" @click="reload">Coba lagi</button>
  </p>
  <StateBox :stale="stale" :saved-at="savedAt" :empty="!items.length" empty-text="Tidak ada jadwal kelas di hari ini">
    <ul class="space-y-3 px-5">
      <li v-for="it in items" :key="it.key">
        <component
          :is="it.status === 'confirmed' ? 'RouterLink' : 'button'"
          v-bind="it.status === 'confirmed' ? { to: `/classes/${it.classId}` } : { type: 'button' }"
          class="card flex w-full gap-3 p-3 text-left"
          :class="it.status === 'ended' ? 'opacity-50' : ''"
          @click="it.status === 'predicted' && (hint = hint === it.key ? '' : it.key)"
        >
          <img
            v-if="it.fotoUrl || photoOf(it.packageId)"
            :src="it.fotoUrl ? assetUrl(it.fotoUrl) : photoOf(it.packageId)"
            :alt="it.kelas"
            loading="lazy"
            class="h-20 w-20 shrink-0 rounded-xl object-cover"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="truncate font-display text-lg leading-tight">{{ it.name }}</p>
              <span class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="badge[it.status]">{{ badgeText[it.status] }}</span>
            </div>
            <p class="truncate text-sm text-white/55">{{ it.kelas }}<template v-if="it.instructor"> · {{ it.instructor }}</template></p>
            <p class="mt-1 text-sm">{{ it.start }}–{{ it.end }}</p>
            <p v-if="it.status === 'confirmed'" class="mt-0.5 text-xs text-brand-300">{{ it.peserta }}/{{ it.max }} peserta</p>
            <p v-if="hint === it.key" class="mt-1 text-xs text-amber-200/80">Jadwal pasti biasanya dibuka sehari sebelumnya — cek lagi nanti.</p>
          </div>
        </component>
      </li>
    </ul>
  </StateBox>

  <p class="mx-5 mt-4 text-center text-[11px] leading-relaxed text-white/40">
    Kelas berlabel “Perkiraan” mengikuti pola {{ timetable.weeksUsed }} minggu terakhir (diperbarui {{ generated }}) dan bisa berubah.
  </p>
</template>
