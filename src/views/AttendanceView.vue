<script setup lang="ts">
import { computed } from 'vue'
import { myClasses } from '@/api/endpoints'
import type { MyClass } from '@/api/types'
import BackHeader from '@/components/BackHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'
import { titleCase } from '@/lib/format'

// Official "Riwayat Kehadiran" layout (pages/attendance.f7.html) — the official app still renders
// mock data here; ours is fed by the real /my-classes riwayat (kehadiran per past booking).
const { data, loading, error, savedAt, stale, reload } = useAsync(myClasses, null, { key: CK.myClasses })

// cancelled bookings aren't attendance events; everything else counts (null/no_show/tidak_hadir = Alfa)
const rows = computed(() => (data.value?.riwayat ?? []).filter((k) => k.status_booking !== 'cancelled'))
const statusOf = (k: MyClass): 'hadir' | 'izin' | 'alfa' => (k.kehadiran === 'hadir' ? 'hadir' : k.kehadiran === 'izin' ? 'izin' : 'alfa')
const summary = computed(() => {
  const s = { hadir: 0, izin: 0, alfa: 0 }
  for (const k of rows.value) s[statusOf(k)]++
  return s
})
const LABEL = { hadir: 'Hadir', izin: 'Izin', alfa: 'Alfa' } as const
const PILL = { hadir: 'pill-ok', izin: 'pill-warn', alfa: 'pill-danger' } as const
// "Sabtu, 10 Okt 2026" -> day block {d:'10', m:'Okt'}
const dateBlock = (tanggal: string) => {
  const m = tanggal.match(/(\d{1,2})\s+([A-Za-z]{3})/)
  return { d: m?.[1] ?? '–', m: m?.[2] ?? '' }
}
</script>

<template>
  <BackHeader title="Riwayat Kehadiran" />
  <StateBox :loading="loading" :error="error" :stale="stale" :saved-at="savedAt" :empty="!!data && !rows.length" empty-text="Belum ada riwayat kehadiran." @retry="reload">
    <div class="px-4 pb-6">
      <div class="card flex p-4 text-center" data-testid="att-summary">
        <div v-for="k in (['hadir', 'izin', 'alfa'] as const)" :key="k" class="flex-1 border-r border-line last:border-r-0">
          <p class="text-[26px] font-extrabold tracking-[-.5px]" :class="k === 'hadir' ? 'text-ok' : k === 'izin' ? 'text-warn' : 'text-danger'">{{ summary[k] }}</p>
          <p class="text-xs font-semibold text-mute">{{ LABEL[k] }}</p>
        </div>
      </div>

      <p class="mt-4 mb-1.5 text-[15px] font-extrabold">Riwayat</p>
      <div class="card px-4" data-testid="att-list">
        <div v-for="k in rows" :key="k.id" class="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
          <div class="w-10 shrink-0 text-center">
            <p class="text-[17px] leading-tight font-extrabold">{{ dateBlock(k.tanggal).d }}</p>
            <p class="text-[11px] font-semibold text-mute">{{ dateBlock(k.tanggal).m }}</p>
          </div>
          <p class="min-w-0 flex-1 truncate text-sm font-bold">{{ titleCase(k.nama) }}</p>
          <span class="pill shrink-0" :class="PILL[statusOf(k)]"><span class="pill-dot" aria-hidden="true" />{{ LABEL[statusOf(k)] }}</span>
        </div>
      </div>
    </div>
  </StateBox>
</template>
