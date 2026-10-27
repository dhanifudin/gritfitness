<script setup lang="ts">
import { computed } from 'vue'
import { progressList } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'

// Official "Progres" (pages/progress.f7.html): BODY progress from the gym's own measurements —
// latest stat grid, weight-trend sparkline, history with deltas. Activity stats live on
// /activity (Profil › Aktivitas Latihan) instead.
const { data, loading, error, savedAt, stale, reload } = useAsync(progressList, null, { key: CK.progress })

const l = computed(() => data.value?.latest ?? null)
const hist = computed(() => data.value?.history ?? [])
const fmt = (v: number | null | undefined) => (v == null ? '—' : String(v))
const bmiPill = computed(() => (l.value?.bmi_color === 'green' ? 'pill-ok' : l.value?.bmi_color === 'red' ? 'pill-danger' : 'pill-warn'))

// weight trend, chronological (history arrives newest first) — the official sparkline recipe
const spark = computed(() => {
  const vals = hist.value.map((h) => h.berat_kg).reverse()
  if (vals.length < 2) return null
  const w = 300, h = 72, pad = 8
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (vals.length - 1)
  const y = (v: number) => pad + (h - 2 * pad) * (1 - (v - min) / range)
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = vals.length - 1
  return { pts, cx: x(last).toFixed(1), cy: y(vals[last]).toFixed(1) }
})

// weight delta vs the previous (older) measurement
const delta = (i: number): { text: string; down: boolean } | null => {
  const older = hist.value[i + 1]
  if (!older) return null
  const d = +(hist.value[i].berat_kg - older.berat_kg).toFixed(1)
  if (d === 0) return null
  return { text: `${d < 0 ? '▼' : '▲'} ${Math.abs(d)} kg`, down: d < 0 }
}
const meta = (h: (typeof hist.value)[number]) =>
  `${h.berat_kg} kg · BMI ${h.bmi ?? '—'}${h.lemak_persen != null ? ` · Lemak ${h.lemak_persen}%` : ''}`
</script>

<template>
  <BackHeader title="Progres">
    <template #right>
      <RouterLink to="/progress/new" class="px-2 text-[13px] font-bold text-grit-500" data-testid="progress-add">+ Tambah</RouterLink>
    </template>
  </BackHeader>

  <StateBox :loading="loading" :error="error" :stale="stale" :saved-at="savedAt" @retry="reload">
    <div class="px-4 pb-6">
      <div v-if="!l" class="py-8 text-center">
        <svg viewBox="0 0 24 24" class="mx-auto h-12 w-12 text-line" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16M7 20v-6M12 20V6M17 20v-9" /></svg>
        <p class="mt-2.5 text-sm text-mute">Belum ada catatan progress. Yuk mulai pantau perkembanganmu!</p>
        <RouterLink to="/progress/new" class="btn-primary mt-4 inline-flex !px-6">Tambah Progress</RouterLink>
      </div>

      <template v-else>
        <div class="card p-4" data-testid="latest-measure">
          <div class="mb-3 flex items-baseline justify-between gap-3">
            <p class="font-extrabold">Pengukuran Terakhir</p>
            <span class="text-xs font-semibold text-mute">{{ l.tanggal }}</span>
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <div class="rounded-[14px] border border-line p-3.5">
              <p class="text-xs font-semibold text-mute">Berat</p>
              <p class="text-[22px] font-extrabold">{{ fmt(l.berat_kg) }}<small class="text-sm font-bold text-mute"> kg</small></p>
            </div>
            <div class="rounded-[14px] border border-line p-3.5">
              <p class="text-xs font-semibold text-mute">BMI</p>
              <p class="text-[22px] font-extrabold">{{ fmt(l.bmi) }}</p>
              <span v-if="l.bmi_kategori" class="pill mt-1 !px-2 !py-0.5 !text-[11px]" :class="bmiPill"><span class="pill-dot" aria-hidden="true" />{{ l.bmi_kategori }}</span>
            </div>
            <div class="rounded-[14px] border border-line p-3.5">
              <p class="text-xs font-semibold text-mute">Lemak Tubuh</p>
              <p class="text-[22px] font-extrabold">{{ fmt(l.lemak_persen) }}<small class="text-sm font-bold text-mute"> %</small></p>
            </div>
            <div class="rounded-[14px] border border-line p-3.5">
              <p class="text-xs font-semibold text-mute">Massa Otot</p>
              <p class="text-[22px] font-extrabold">{{ fmt(l.massa_otot_kg) }}<small class="text-sm font-bold text-mute"> kg</small></p>
            </div>
          </div>
        </div>

        <template v-if="spark">
          <p class="mt-4 mb-1.5 text-[15px] font-extrabold">Tren Berat Badan</p>
          <div class="card p-4" data-testid="weight-trend">
            <svg viewBox="0 0 300 72" preserveAspectRatio="none" class="h-[72px] w-full">
              <polyline :points="spark.pts" fill="none" stroke="#E0155A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              <circle :cx="spark.cx" :cy="spark.cy" r="4" fill="#E0155A" />
            </svg>
            <div class="mt-1 flex justify-between text-[11px] font-semibold text-mute">
              <span>{{ hist[hist.length - 1]?.tanggal }}</span>
              <span>{{ hist[0]?.tanggal }}</span>
            </div>
          </div>
        </template>

        <p class="mt-4 mb-1.5 text-[15px] font-extrabold">Riwayat</p>
        <div class="card px-4" data-testid="progress-history">
          <div v-for="(h, i) in hist" :key="h.tanggal + i" class="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
            <div class="min-w-0">
              <p class="text-sm font-bold">{{ h.tanggal }}</p>
              <p class="text-xs font-semibold text-mute">{{ meta(h) }}</p>
            </div>
            <span v-if="delta(i)" class="shrink-0 text-xs font-bold" :class="delta(i)!.down ? 'text-ok' : 'text-warn'">{{ delta(i)!.text }}</span>
          </div>
        </div>
      </template>
    </div>
  </StateBox>
</template>
