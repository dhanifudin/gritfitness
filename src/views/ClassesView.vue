<script setup lang="ts">
import { titleCase } from '@/lib/format'
import { computed, ref, watch } from 'vue'
import { schedule } from '@/api/endpoints'
import type { ScheduleRow } from '@/api/types'
import ClassDetailPopup from '@/components/ClassDetailPopup.vue'
import PageHeader from '@/components/PageHeader.vue'
import { rupiah } from '@/composables/useAsync'
import { CK, read, write } from '@/lib/dataCache'
import { ymd } from '@/lib/tracker'

// Exact official schedule tab (pages/schedule.f7.html): 14-day picker + published rows only.
// Recurring-pattern predictions live on the Booking Otomatis screen (hidden menu) instead.
const DAY_NAMES_SUN = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

const days = computed(() => {
  const out: Date[] = []
  const now = new Date()
  for (let i = 0; i < 14; i++) out.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i))
  return out
})
const sel = ref(0)
const selYmd = computed(() => ymd(days.value[sel.value]))

// Per-date rows, stale-while-revalidate against the shared cache. `byDate` is only ever written
// under the fetch's own `date` argument, so one day's answer can never render under another day;
// an entry stays undefined (= skeleton, never the empty state) until that very day has an answer.
const byDate = ref<Record<string, ScheduleRow[]>>({})
const error = ref('')
const stale = ref(false)
async function loadDay(date: string, force = false) {
  const hit = read<ScheduleRow[]>(CK.schedule(date))
  if (hit) {
    byDate.value = { ...byDate.value, [date]: hit.data }
    if (!force && Date.now() - hit.savedAt < 30_000) return
  }
  error.value = ''
  stale.value = false
  try {
    const rows = await schedule(date)
    byDate.value = { ...byDate.value, [date]: rows }
    write(CK.schedule(date), rows)
  } catch (e) {
    if (hit) stale.value = true
    else error.value = e instanceof Error ? e.message : 'Terjadi kesalahan'
  }
}
watch(selYmd, (d) => void loadDay(d), { immediate: true })
const reload = () => loadDay(selYmd.value, true)

const rows = computed(() => byDate.value[selYmd.value])
const loading = computed(() => rows.value === undefined && !error.value)
const caption = computed(() => days.value[sel.value].toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
const opened = ref<ScheduleRow | null>(null)
function booked() {
  void loadDay(selYmd.value, true)
}
</script>

<template>
  <PageHeader title="Jadwal Kelas">
    <template #right>
      <RouterLink to="/auto-booking" class="flex h-10 w-10 items-center justify-center rounded-xl bg-wash text-ink" aria-label="Booking otomatis" data-testid="open-auto-booking">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v4l2.5 2.5M21 12a9 9 0 11-9-9c2.5 0 4.8 1 6.4 2.6L21 8M21 3v5h-5" /></svg>
      </RouterLink>
    </template>
  </PageHeader>

  <div class="scrollbar-none mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
    <button
      v-for="(d, i) in days"
      :key="i"
      role="tab"
      :aria-selected="sel === i"
      class="flex w-[52px] shrink-0 flex-col items-center rounded-xl border py-2 transition"
      :class="sel === i ? 'border-grit-500 bg-grit-500 text-white' : 'border-line bg-card'"
      @click="sel = i"
    >
      <span class="text-[11px] font-semibold" :class="sel === i ? '' : 'text-mute'">{{ DAY_NAMES_SUN[d.getDay()] }}</span>
      <span class="mt-0.5 text-base leading-none font-extrabold" :class="sel === i ? '' : 'text-ink'">{{ d.getDate() }}</span>
    </button>
  </div>

  <p class="mb-2 px-4 text-[13px] font-bold text-soft" data-testid="day-caption">{{ caption }}</p>

  <p v-if="error" class="banner banner-err mx-4 mb-3 flex items-center justify-between gap-3 !py-2 !text-xs">
    Jadwal tidak bisa dimuat.
    <button class="btn-sm btn-danger shrink-0" @click="reload">Coba lagi</button>
  </p>
  <div v-if="loading" class="space-y-3 px-4">
    <div v-for="i in 2" :key="i" class="skeleton h-[84px]" />
  </div>
  <template v-else-if="rows">
    <p v-if="stale" class="banner banner-warn mx-4 mb-3 !px-3 !py-2 !text-xs">Tidak bisa memperbarui · menampilkan data tersimpan</p>
    <div v-if="!rows.length" class="px-4 py-12 text-center">
      <svg viewBox="0 0 24 24" class="mx-auto h-12 w-12 text-line" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M3 11h18M8 3v4M16 3v4" /></svg>
      <p class="mt-2.5 text-sm text-mute">Tidak ada kelas pada tanggal ini.</p>
    </div>
    <ul v-else class="space-y-3 px-4 pb-6">
      <li v-for="k in rows" :key="k.id">
        <button type="button" class="card block w-full p-4 text-left" :data-testid="`class-row-${k.id}`" @click="opened = k">
          <div class="flex items-start justify-between gap-2.5">
            <div class="min-w-0">
              <p class="truncate font-extrabold">{{ titleCase(k.kelas) }}</p>
              <p class="mt-0.5 text-[13px] font-semibold text-mute">{{ k.jam_mulai }} · {{ k.ruangan || '—' }}<template v-if="k.instruktur"> · {{ k.instruktur }}</template></p>
            </div>
            <span v-if="k.gratis && k.harga_normal > 0" class="pill pill-ok shrink-0">Membership</span>
            <span v-else-if="k.diskon" class="pill pill-warn shrink-0">Diskon</span>
          </div>
          <div class="mt-3 flex items-center justify-between gap-3">
            <p class="min-w-0 text-[13px]">
              <span v-if="k.harga_normal === 0" class="price-free">Gratis</span>
              <span v-else-if="k.harga_akhir === 0" class="price-free">Termasuk Membership</span>
              <template v-else>
                <span v-if="k.diskon" class="price-strike mr-1">{{ rupiah(k.harga_normal) }}</span>
                <span class="price-final">{{ rupiah(k.harga_akhir) }}</span>
              </template>
              <span class="text-mute"> · {{ k.slot_terisi }}/{{ k.slot_max }} slot</span>
            </p>
            <span v-if="k.booking_status === 'confirmed'" class="pill pill-navy shrink-0">Terbooking</span>
            <span v-else-if="k.booking_status === 'booked'" class="pill pill-warn shrink-0">Belum Bayar</span>
            <span v-else-if="k.penuh" class="pill pill-danger shrink-0">Penuh</span>
            <span v-else class="flex shrink-0 items-center gap-0.5 text-[13px] font-bold text-grit-500">
              Detail
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </span>
          </div>
        </button>
      </li>
    </ul>
  </template>

  <ClassDetailPopup v-if="opened" :row="opened" :date="selYmd" @close="opened = null" @booked="booked" />
</template>

<style scoped>
.scrollbar-none {
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
