<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { classSchedule } from '@/api/endpoints'
import type { ScheduleRow } from '@/api/types'
import BackHeader from '@/components/BackHeader.vue'
import ClassDetailPopup from '@/components/ClassDetailPopup.vue'
import StateBox from '@/components/StateBox.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'
import { titleCase } from '@/lib/format'

// One class from the catalog: description + every upcoming published session, grouped by day
// (official "kelas-jadwal" screen).
const route = useRoute()
const id = String(route.params.id)

const { data, loading, error, reload } = useAsync(() => classSchedule(id), null, { key: CK.classSchedule(id) })

const groups = computed(() => {
  const by = new Map<string, { label: string; rows: ScheduleRow[] }>()
  for (const r of data.value?.data ?? []) {
    const key = r.tanggal ?? ''
    if (!by.has(key)) by.set(key, { label: r.tanggal_label ?? key, rows: [] })
    by.get(key)!.rows.push(r)
  }
  return [...by.entries()].map(([key, g]) => ({ key, ...g }))
})

const opened = ref<{ row: ScheduleRow; date: string } | null>(null)
function booked() {
  void reload()
}
</script>

<template>
  <BackHeader :title="titleCase(data?.kelas.nama) || 'Jadwal Kelas'" />

  <StateBox :loading="loading" :error="error" :empty="!!data && !groups.length" empty-text="Belum ada jadwal untuk kelas ini" @retry="reload">
    <div class="px-4 pb-6">
      <div v-if="data" class="card p-4">
        <p class="font-extrabold">{{ titleCase(data.kelas.nama) }}</p>
        <p class="mt-0.5 text-[13px] font-semibold text-mute">
          <template v-if="data.kelas.kategori">{{ data.kelas.kategori }} · </template>{{ data.kelas.durasi_menit }} menit
        </p>
        <p v-if="data.kelas.deskripsi" class="mt-2 text-sm leading-relaxed text-soft">{{ data.kelas.deskripsi }}</p>
      </div>

      <template v-for="g in groups" :key="g.key">
        <p class="mt-4 mb-1.5 px-1 text-[11px] font-extrabold tracking-[.04em] text-mute uppercase">{{ g.label }}</p>
        <div class="space-y-2">
          <button v-for="r in g.rows" :key="r.id" type="button" class="card flex w-full items-center gap-3 p-4 text-left" @click="opened = { row: r, date: g.key }">
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <p class="font-extrabold">{{ r.jam_mulai }}–{{ r.jam_selesai }}</p>
                <span v-if="r.booking_status === 'confirmed'" class="pill pill-navy shrink-0">Terbooking</span>
                <span v-else-if="r.booking_status === 'booked'" class="pill pill-warn shrink-0">Belum Bayar</span>
                <span v-else-if="r.penuh" class="pill pill-danger shrink-0">Penuh</span>
                <span v-else class="shrink-0 text-[13px] font-bold text-grit-500">Detail ›</span>
              </div>
              <p class="mt-0.5 truncate text-[13px] font-semibold text-mute">
                <template v-if="r.instruktur">{{ r.instruktur }}</template><template v-if="r.ruangan"> · {{ r.ruangan }}</template>
              </p>
              <p class="mt-1 text-[13px]">
                <span v-if="r.harga_normal === 0" class="price-free">Gratis</span>
                <span v-else-if="r.harga_akhir === 0" class="price-free">Termasuk Membership</span>
                <template v-else>
                  <span v-if="r.diskon" class="price-strike mr-1">{{ rupiah(r.harga_normal) }}</span>
                  <span class="price-final">{{ rupiah(r.harga_akhir) }}</span>
                </template>
                <span class="text-mute"> · {{ r.slot_terisi }}/{{ r.slot_max }} slot</span>
              </p>
            </div>
          </button>
        </div>
      </template>
    </div>
  </StateBox>

  <ClassDetailPopup v-if="opened && data" :row="opened.row" :date="opened.date" :name="data.kelas.nama" @close="opened = null" @booked="booked" />
</template>
