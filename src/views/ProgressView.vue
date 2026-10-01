<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BadgeGrid from '@/components/BadgeGrid.vue'
import ConsentSheet from '@/components/ConsentSheet.vue'
import MetricChart from '@/components/MetricChart.vue'
import MonthHeatmap from '@/components/MonthHeatmap.vue'
import PageHeader from '@/components/PageHeader.vue'
import WeekBars from '@/components/WeekBars.vue'
import { parseYmd, weekCounts, weekdayHistogram, ymd } from '@/lib/tracker'
import { weightChange } from '@/lib/trackerData'
import { useTracker } from '@/stores/tracker'

const tracker = useTracker()
onMounted(() => {
  tracker.init()
  void tracker.sync()
})

type Tab = 'ringkasan' | 'badge' | 'tubuh' | 'catatan'
const tabs: { key: Tab; label: string }[] = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'badge', label: 'Badge' },
  { key: 'tubuh', label: 'Tubuh' },
  { key: 'catatan', label: 'Catatan' },
]
const tab = ref<Tab>('ringkasan')
const today = computed(() => ymd(tracker.now))

// ---- ringkasan ----
const s = computed(() => tracker.stats)
const weeks = computed(() => weekCounts(tracker.visits, tracker.now, 8))
const hist = computed(() => weekdayHistogram(tracker.visits, tracker.now, 8))
const DAY_FULL = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const DAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const favourite = computed(() => (Math.max(...hist.value) > 0 ? DAY_FULL[hist.value.indexOf(Math.max(...hist.value))] : null))
const histMax = computed(() => Math.max(1, ...hist.value))
const planned = computed(() => tracker.signups.filter((x) => x.status === 'planned').map((x) => x.scheduled_on))
const goal = computed(() => tracker.settings.goal_per_week)
const hour = computed(() => tracker.settings.reminder_hour ?? 17)
const syncLabel = computed(() =>
  tracker.localOnly ? 'Hanya di perangkat ini'
  : !tracker.consented ? 'Belum disinkronkan'
  : tracker.pending ? `Menunggu sinkron (${tracker.pending})`
  : tracker.lastSyncAt ? `Tersinkron ${new Date(tracker.lastSyncAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
  : 'Menunggu sinkron',
)

// ---- tubuh ----
const form = ref({ date: today.value, weight: '', waist: '', fat: '' })
const formError = ref('')
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
function saveMetric() {
  const weight = num(form.value.weight)
  const waist = num(form.value.waist)
  const fat = num(form.value.fat)
  formError.value = ''
  if (weight == null && waist == null && fat == null) return void (formError.value = 'Isi minimal satu ukuran.')
  if (weight != null && !(weight >= 20 && weight <= 400)) return void (formError.value = 'Berat badan harus 20–400 kg.')
  if (waist != null && !(waist >= 30 && waist <= 300)) return void (formError.value = 'Lingkar pinggang harus 30–300 cm.')
  if (fat != null && !(fat >= 2 && fat <= 70)) return void (formError.value = 'Lemak tubuh harus 2–70%.')
  tracker.saveMetric({ measured_on: form.value.date, weight_kg: weight, waist_cm: waist, body_fat_pct: fat })
  form.value = { date: today.value, weight: '', waist: '', fat: '' }
}
const weightPoints = computed(() => tracker.metrics.filter((m) => m.weight_kg != null).map((m) => ({ date: m.measured_on, value: m.weight_kg! })))
const waistPoints = computed(() => tracker.metrics.filter((m) => m.waist_cm != null).map((m) => ({ date: m.measured_on, value: m.waist_cm! })))
const change30 = computed(() => weightChange(tracker.metrics, 30, tracker.now))
const goalWeight = ref(tracker.settings.goal_weight_kg != null ? String(tracker.settings.goal_weight_kg) : '')
function saveGoalWeight() {
  const v = num(goalWeight.value)
  tracker.setSettings({ goal_weight_kg: v != null && v >= 20 && v <= 400 ? v : null })
}

// ---- catatan ----
const manual = ref({ date: today.value, note: '' })
function addManual() {
  tracker.addManualVisit(manual.value.date, { note: manual.value.note.trim() || null })
  manual.value = { date: today.value, note: '' }
}
const ENERGY = ['', '😴', '😐', '🙂', '💪', '🔥']
const dayLabel = (d: string) => parseYmd(d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
const timeLabel = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '')
const SOURCE = { checkin: 'Check-in', class: 'Kelas', manual: 'Manual' } as const
</script>

<template>
  <PageHeader title="Progres" :subtitle="`Target ${goal}x seminggu · ${syncLabel}`" />

  <div class="mx-5 mb-4 grid grid-cols-4 gap-1 rounded-xl bg-white/5 p-1" role="tablist">
    <button
      v-for="t in tabs" :key="t.key" role="tab" :aria-selected="tab === t.key"
      class="rounded-lg py-2 text-xs font-semibold transition" :class="tab === t.key ? 'bg-brand-400 text-white' : 'text-white/60'"
      @click="tab = t.key"
    >{{ t.label }}</button>
  </div>

  <!-- RINGKASAN -->
  <div v-if="tab === 'ringkasan'" class="space-y-3 px-5" data-testid="tab-ringkasan">
    <div class="grid grid-cols-2 gap-3">
      <div class="card p-3"><p class="text-xs text-white/50">Minggu ini</p><p class="font-display text-2xl">{{ s.week.count }}<span class="text-base text-white/40">/{{ s.week.goal }}</span></p></div>
      <div class="card p-3"><p class="text-xs text-white/50">Rata-rata 4 minggu</p><p class="font-display text-2xl" data-testid="avg4">{{ s.avg4.toFixed(1) }}<span class="text-base text-white/40">/minggu</span></p></div>
      <div class="card p-3"><p class="text-xs text-white/50">Rantai terbaik</p><p class="font-display text-2xl">{{ s.streak.best }}<span class="text-base text-white/40"> minggu</span></p></div>
      <div class="card p-3"><p class="text-xs text-white/50">Total latihan</p><p class="font-display text-2xl" data-testid="total">{{ s.total }}<span class="text-base text-white/40"> hari</span></p></div>
    </div>

    <section class="card p-4"><h2 class="mb-3 text-sm font-semibold">8 minggu terakhir</h2><WeekBars :weeks="weeks" :goal="goal" /></section>
    <section class="card p-4"><MonthHeatmap :visits="tracker.visits" :now="tracker.now" :planned="planned" /></section>

    <section class="card p-4">
      <h2 class="text-sm font-semibold">Hari favoritmu</h2>
      <p class="text-xs text-white/50">{{ favourite ? `Paling sering: ${favourite}` : 'Belum ada data' }}</p>
      <div class="mt-3 flex h-20 items-end gap-2">
        <div v-for="(n, i) in hist" :key="i" class="flex flex-1 flex-col items-center justify-end">
          <div class="w-full rounded-t-md" :class="n === Math.max(...hist) && n > 0 ? 'bg-lime-grit' : 'bg-white/25'" :style="{ height: (n / histMax) * 3.5 + 'rem', minHeight: n ? '0.2rem' : '0.1rem' }" />
          <span class="mt-1 text-[10px] text-white/45">{{ DAY_SHORT[i] }}</span>
        </div>
      </div>
    </section>

    <section class="card space-y-4 p-4">
      <h2 class="text-sm font-semibold">Pengaturan</h2>
      <div class="flex items-center justify-between">
        <span class="text-sm">Target per minggu</span>
        <div class="flex items-center gap-3">
          <button class="btn-ghost !px-3 !py-1.5" aria-label="Kurangi target" :disabled="goal <= 1" @click="tracker.setSettings({ goal_per_week: goal - 1 })">−</button>
          <span class="w-6 text-center font-display text-lg" data-testid="goal-value">{{ goal }}</span>
          <button class="btn-ghost !px-3 !py-1.5" aria-label="Tambah target" :disabled="goal >= 7" @click="tracker.setSettings({ goal_per_week: goal + 1 })">+</button>
        </div>
      </div>
      <label class="flex items-center justify-between text-sm">Pengingat setelah jam
        <select class="input !w-auto !py-2" :value="hour" @change="tracker.setSettings({ reminder_hour: Number(($event.target as HTMLSelectElement).value) })">
          <option v-for="h in 18" :key="h" :value="h + 4">{{ String(h + 4).padStart(2, '0') }}.00</option>
        </select>
      </label>
    </section>
  </div>

  <!-- BADGE -->
  <div v-else-if="tab === 'badge'" class="px-5" data-testid="tab-badge">
    <p class="mb-3 text-sm text-white/55">{{ tracker.badgeList.filter((b) => b.unlocked).length }} dari {{ tracker.badgeList.length }} pencapaian terbuka</p>
    <BadgeGrid :badges="tracker.badgeList" />
  </div>

  <!-- TUBUH -->
  <div v-else-if="tab === 'tubuh'" class="space-y-3 px-5" data-testid="tab-tubuh">
    <form class="card space-y-3 p-4" @submit.prevent="saveMetric">
      <h2 class="text-sm font-semibold">Catat ukuran tubuh</h2>
      <label class="block text-xs text-white/55">Tanggal<input v-model="form.date" type="date" :max="today" class="input mt-1" required /></label>
      <div class="grid grid-cols-3 gap-2">
        <label class="block text-xs text-white/55">Berat (kg)<input v-model="form.weight" inputmode="decimal" class="input mt-1" placeholder="70.5" data-testid="m-weight" /></label>
        <label class="block text-xs text-white/55">Pinggang (cm)<input v-model="form.waist" inputmode="decimal" class="input mt-1" placeholder="85" data-testid="m-waist" /></label>
        <label class="block text-xs text-white/55">Lemak (%)<input v-model="form.fat" inputmode="decimal" class="input mt-1" placeholder="20" /></label>
      </div>
      <p v-if="formError" class="text-sm text-red-300">{{ formError }}</p>
      <button class="btn-primary w-full" data-testid="m-save">Simpan</button>
    </form>

    <section v-if="weightPoints.length" class="card p-4">
      <div class="mb-2 flex items-baseline justify-between">
        <h2 class="text-sm font-semibold">Berat badan</h2>
        <span v-if="change30 !== null" class="text-xs" :class="change30 <= 0 ? 'text-lime-grit' : 'text-amber-300'" data-testid="change30">{{ change30 > 0 ? '+' : '' }}{{ change30 }} kg / 30 hari</span>
      </div>
      <MetricChart :points="weightPoints" unit="kg" :target="tracker.settings.goal_weight_kg ?? null" />
      <label class="mt-3 flex items-center justify-between text-xs text-white/55">Target berat (kg)
        <input v-model="goalWeight" inputmode="decimal" class="input !w-24 !py-1.5 text-right" placeholder="-" @change="saveGoalWeight" />
      </label>
    </section>
    <section v-if="waistPoints.length > 0" class="card p-4"><h2 class="mb-2 text-sm font-semibold">Lingkar pinggang</h2><MetricChart :points="waistPoints" unit="cm" /></section>

    <ul v-if="tracker.metrics.length" class="space-y-2">
      <li v-for="m in tracker.metrics.slice(0, 30)" :key="m.measured_on" class="card flex items-center justify-between px-4 py-3 text-sm">
        <div>
          <p class="font-medium">{{ dayLabel(m.measured_on) }}</p>
          <p class="text-xs text-white/55">
            <template v-if="m.weight_kg != null">{{ m.weight_kg }} kg </template>
            <template v-if="m.waist_cm != null">· pinggang {{ m.waist_cm }} cm </template>
            <template v-if="m.body_fat_pct != null">· lemak {{ m.body_fat_pct }}%</template>
          </p>
        </div>
        <button class="text-xs text-red-300" :aria-label="`Hapus ${m.measured_on}`" @click="tracker.removeMetric(m.measured_on)">Hapus</button>
      </li>
    </ul>
    <p v-else class="py-6 text-center text-sm text-white/50">Belum ada catatan ukuran tubuh.</p>
  </div>

  <!-- CATATAN -->
  <div v-else class="space-y-3 px-5" data-testid="tab-catatan">
    <form class="card space-y-3 p-4" @submit.prevent="addManual">
      <h2 class="text-sm font-semibold">Tambah latihan manual</h2>
      <div class="grid grid-cols-[auto_1fr] gap-2">
        <input v-model="manual.date" type="date" :max="today" class="input" required />
        <input v-model="manual.note" maxlength="500" class="input" placeholder="Catatan (opsional)" />
      </div>
      <button class="btn-ghost w-full" data-testid="manual-add">Tambahkan</button>
    </form>

    <ul v-if="tracker.visits.length" class="space-y-2" data-testid="visit-list">
      <li v-for="v in tracker.visits.slice(0, 60)" :key="v.client_id" class="card px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium">{{ dayLabel(v.visited_on) }}<span v-if="v.visited_at" class="font-normal text-white/50"> · {{ timeLabel(v.visited_at) }}</span></p>
            <p class="text-xs text-white/55">{{ SOURCE[v.source] }}<template v-if="v.class_name"> · {{ v.class_name }}</template> <span v-if="v.energy" aria-hidden="true">{{ ENERGY[v.energy] }}</span></p>
          </div>
          <button class="shrink-0 text-xs text-red-300" :aria-label="`Hapus latihan ${v.visited_on}`" @click="tracker.removeVisit(v.client_id)">Hapus</button>
        </div>
        <p v-if="v.note" class="mt-1.5 text-sm text-white/75">{{ v.note }}</p>
      </li>
    </ul>
    <p v-else class="py-6 text-center text-sm text-white/50">Belum ada latihan tercatat. Mulai dari tombol “Catat latihan” di Beranda.</p>
  </div>

  <ConsentSheet v-if="tracker.needsConsent && tracker.memberId != null" />
</template>
