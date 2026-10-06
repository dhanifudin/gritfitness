<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { tagihan } from '@/api/endpoints'
import ActivitySheet from '@/components/ActivitySheet.vue'
import BadgeGrid from '@/components/BadgeGrid.vue'
import DaySheet from '@/components/DaySheet.vue'
import ConsentSheet from '@/components/ConsentSheet.vue'
import MetricChart from '@/components/MetricChart.vue'
import MonthHeatmap from '@/components/MonthHeatmap.vue'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import WeekBars from '@/components/WeekBars.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import { activityLabel, activityMeta } from '@/lib/activities'
import { costPerVisit, monthlySpend, otherActivitySpend, totalSpent, unpaidSummary } from '@/lib/budget'
import { useSyncLabel } from '@/composables/useSyncLabel'
import { classEfficiency, classSavings } from '@/lib/classValue'
import { CK } from '@/lib/dataCache'
import { favouriteLabel, favouriteWeekdays } from '@/lib/insight'
import { activityBreakdown, addDays, counts, parseYmd, weekCounts, weekdayHistogram, ymd, type Visit } from '@/lib/tracker'
import { weightChange } from '@/lib/trackerData'
import { useTracker } from '@/stores/tracker'

const tracker = useTracker()
onMounted(() => {
  tracker.init()
  void tracker.sync()
})

type Tab = 'ringkasan' | 'badge' | 'anggaran' | 'tubuh' | 'catatan'
const tabs: { key: Tab; label: string }[] = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'badge', label: 'Badge' },
  { key: 'anggaran', label: 'Anggaran' },
  { key: 'tubuh', label: 'Tubuh' },
  { key: 'catatan', label: 'Catatan' },
]
const tab = ref<Tab>('ringkasan')
const today = computed(() => ymd(tracker.now))

// ---- activity entry (add / edit / day sheet) ----
const daySheet = ref<string | null>(null)
const editSheet = ref<{ visit?: Visit; date?: string } | null>(null)
const openAdd = (date?: string) => {
  daySheet.value = null
  editSheet.value = { date }
}
const openEdit = (visit: Visit) => {
  daySheet.value = null
  editSheet.value = { visit }
}
const breakdown = computed(() => activityBreakdown(tracker.visits, tracker.now, 30))

// ---- anggaran (bills vs GritFitness-tracked activities only; custom entries like Hyrox are excluded) ----
const { data: bills, loading: billsLoading, error: billsError, savedAt: billsSavedAt, stale: billsStale, reload: reloadBills } = useAsync(tagihan, [], { key: CK.bills })
const spendMonths = computed(() => monthlySpend(bills.value, tracker.now, 6))
const spendMax = computed(() => Math.max(1, ...spendMonths.value.map((m) => m.total)))
const spentThisYear = computed(() => totalSpent(bills.value, { from: `${tracker.now.getFullYear()}-01-01`, to: today.value }))
const cpv = computed(() => costPerVisit(bills.value, tracker.visits, tracker.now, 30))
const unpaid = computed(() => unpaidSummary(bills.value))
// classes are free for members: the non-member price of each registered class is what the membership saved
const savings = computed(() => classSavings(tracker.signups, ymd(addDays(tracker.now, -29)), ymd(tracker.now)))
const efficiency = computed(() => classEfficiency({ saved: savings.value.saved, spent: cpv.value.spent, visits: cpv.value.visits }))
const otherSpend = computed(() => otherActivitySpend(tracker.visits, tracker.now, 30))
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const monthLabel = (m: string) => MONTH_SHORT[Number(m.slice(5, 7)) - 1]

// ---- ringkasan ----
const s = computed(() => tracker.stats)
const weeks = computed(() => weekCounts(tracker.visits, tracker.now, 8))
const hist = computed(() => weekdayHistogram(tracker.visits, tracker.now, 8))
const DAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const favourite = computed(() => favouriteLabel(favouriteWeekdays(tracker.visits, tracker.now, 8)))
const histMax = computed(() => Math.max(1, ...hist.value))
const planned = computed(() => tracker.signups.filter((x) => x.status === 'planned').map((x) => x.scheduled_on))
const goal = computed(() => tracker.settings.goal_per_week)
const syncLabel = useSyncLabel()
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
const metricLine = (m: (typeof tracker.metrics)[number]) =>
  [m.weight_kg != null ? `${m.weight_kg} kg` : null, m.waist_cm != null ? `pinggang ${m.waist_cm} cm` : null, m.body_fat_pct != null ? `lemak ${m.body_fat_pct}%` : null]
    .filter(Boolean)
    .join(', ')

// ---- catatan ----
const ENERGY = ['', '😴', '😐', '🙂', '💪', '🔥']
const dayLabel = (d: string) => parseYmd(d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
const timeLabel = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '')
const visitMeta = (v: Visit) => [activityLabel(v), v.duration_min ? `${v.duration_min} mnt` : null, !counts(v) ? 'tidak dihitung' : null].filter(Boolean).join(', ')
</script>

<template>
  <PageHeader title="Progres" :subtitle="`Target ${goal}x seminggu · ${syncLabel}`" gear />


  <div class="mx-5 mb-4 grid grid-cols-5 gap-1 rounded-xl bg-white/5 p-1" role="tablist">
    <button
      v-for="t in tabs" :key="t.key" role="tab" :aria-selected="tab === t.key"
      class="min-h-11 rounded-lg px-0.5 py-2 text-[11px] leading-tight font-semibold transition" :class="tab === t.key ? 'bg-brand-400 text-white' : 'text-white/60'"
      @click="tab = t.key"
    >{{ t.label }}</button>
  </div>

  <!-- RINGKASAN -->
  <div v-if="tab === 'ringkasan'" class="space-y-3 px-5" data-testid="tab-ringkasan">
    <section class="card p-4">
      <div class="grid grid-cols-2 gap-4">
        <div><p class="text-xs text-white/50">Minggu ini</p><p class="font-display text-2xl">{{ s.week.count }}<span class="text-base text-white/40">/{{ s.week.goal }}</span></p></div>
        <div><p class="text-xs text-white/50">Rata-rata 4 minggu</p><p class="font-display text-2xl" data-testid="avg4">{{ s.avg4.toFixed(1) }}<span class="text-base text-white/40">/minggu</span></p></div>
        <div><p class="text-xs text-white/50">Rantai terbaik</p><p class="font-display text-3xl text-lime-grit">{{ s.streak.best }}<span class="text-base text-white/40"> minggu</span></p></div>
        <div><p class="text-xs text-white/50">Total latihan</p><p class="font-display text-2xl" data-testid="total">{{ s.total }}<span class="text-base text-white/40"> hari</span></p></div>
      </div>
    </section>

    <section class="card p-4"><h2 class="mb-3 text-sm font-semibold">8 minggu terakhir</h2><WeekBars :weeks="weeks" :goal="goal" /></section>
    <section class="card p-4"><MonthHeatmap :visits="tracker.visits" :now="tracker.now" :planned="planned" @select="daySheet = $event" /></section>

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

    <section class="card p-4" data-testid="activity-card">
      <h2 class="text-sm font-semibold">Aktivitas 30 hari terakhir</h2>
      <p v-if="!breakdown.total" class="mt-1 text-xs text-white/50">Belum ada aktivitas tercatat.</p>
      <ul v-else class="mt-2 space-y-1.5">
        <li v-for="i in breakdown.items" :key="i.key" class="flex items-center justify-between text-sm">
          <span><span aria-hidden="true">{{ i.emoji }}</span> {{ i.label }}</span><span class="font-semibold">{{ i.count }}x</span>
        </li>
      </ul>
      <p v-if="breakdown.topClass" class="mt-2 text-xs text-white/50">Kelas favorit: {{ breakdown.topClass.name }} ({{ breakdown.topClass.count }}x)</p>
      <button class="btn-ghost mt-3 w-full !py-2" data-testid="add-activity" @click="openAdd()">Tambah aktivitas</button>
    </section>

  </div>

  <!-- BADGE -->
  <div v-else-if="tab === 'badge'" class="px-5" data-testid="tab-badge">
    <p class="mb-3 text-sm text-white/55">{{ tracker.badgeList.filter((b) => b.unlocked).length }} dari {{ tracker.badgeList.length }} pencapaian terbuka</p>
    <BadgeGrid :badges="tracker.badgeList" />
  </div>

  <!-- ANGGARAN -->
  <div v-else-if="tab === 'anggaran'" data-testid="tab-anggaran">
    <StateBox :loading="billsLoading" :stale="billsStale" :saved-at="billsSavedAt" :error="billsError" @retry="reloadBills">
      <div class="space-y-3 px-5">
        <section class="card p-4">
          <div class="grid grid-cols-2 gap-4">
            <div><p class="text-xs text-white/50">Tahun ini</p><p class="font-display text-xl" data-testid="spent-year">{{ rupiah(spentThisYear) }}</p></div>
            <div>
              <p class="text-xs text-white/50">Rp / latihan (30 hari)</p>
              <p class="font-display text-xl" data-testid="cost-per-visit">{{ cpv.perVisit != null ? rupiah(cpv.perVisit) : '-' }}</p>
            </div>
          </div>
        </section>

        <section v-if="savings.count" class="card p-4" data-testid="class-savings">
          <h2 class="text-sm font-semibold">Hemat dari kelas (30 hari)</h2>
          <p class="mt-2 font-display text-2xl text-lime-grit">{{ rupiah(savings.saved) }}</p>
          <p class="text-xs text-white/55">dari {{ savings.count }} kelas yang gratis untuk member (tarif non-member).</p>
          <p v-if="efficiency.paybackPct != null" class="mt-3 text-sm text-white/80">
            {{ efficiency.exceedsCost ? 'Lebih besar dari biaya membership 30 hari.' : `Setara ${Math.round(efficiency.paybackPct)}% dari biaya membership 30 hari.` }}
          </p>
          <p v-if="efficiency.effectivePerVisit != null" class="mt-1 text-sm text-white/80">
            Biaya efektif per latihan: <span class="font-semibold">{{ rupiah(efficiency.effectivePerVisit) }}</span>
          </p>
        </section>

        <RouterLink v-if="unpaid.count" to="/bills" class="flex items-center justify-between gap-3 border-l-2 border-amber-400 bg-amber-500/10 px-4 py-3 text-sm" data-testid="unpaid-card">
          <span class="text-amber-100">{{ unpaid.count }} tagihan belum dibayar, total {{ rupiah(unpaid.total) }}.</span>
          <span class="text-amber-200/70">›</span>
        </RouterLink>
        <p v-else class="px-1 text-sm text-emerald-300" data-testid="unpaid-card">Semua tagihan lunas ✓</p>

        <section class="card p-4">
          <h2 class="mb-3 text-sm font-semibold">Pengeluaran 6 bulan terakhir</h2>
          <div class="flex h-28 items-end gap-2">
            <div v-for="m in spendMonths" :key="m.month" class="flex flex-1 flex-col items-center justify-end">
              <span class="mb-1 text-[10px] text-white/55">{{ m.total ? rupiah(m.total) : '' }}</span>
              <div class="w-full rounded-t-md bg-brand-400" :style="{ height: (m.total / spendMax) * 5 + 'rem', minHeight: m.total ? '0.2rem' : '0.1rem' }" :class="!m.total ? '!bg-white/15' : ''" />
              <span class="mt-1 text-[10px] text-white/45">{{ monthLabel(m.month) }}</span>
            </div>
          </div>
        </section>

        <p class="px-1 text-xs leading-relaxed text-white/45">
          Dihitung dari tagihan yang sudah lunas dan hari latihan GritFitness (Gym, Kelas, Personal Trainer, Pemulihan). Tidak termasuk aktivitas di luar GritFitness, misalnya Hyrox.
        </p>

        <p v-if="otherSpend.count" class="px-1 text-sm text-white/70" data-testid="other-spend">
          Di luar GritFitness, 30 hari ({{ otherSpend.count }} aktivitas): <span class="font-semibold text-white">{{ rupiah(otherSpend.total) }}</span>
        </p>
      </div>
    </StateBox>
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
    </section>
    <section v-if="waistPoints.length > 0" class="card p-4"><h2 class="mb-2 text-sm font-semibold">Lingkar pinggang</h2><MetricChart :points="waistPoints" unit="cm" /></section>

    <ul v-if="tracker.metrics.length" class="space-y-2">
      <li v-for="m in tracker.metrics.slice(0, 30)" :key="m.measured_on" class="card flex items-center justify-between px-4 py-3 text-sm">
        <div>
          <p class="font-medium">{{ dayLabel(m.measured_on) }}</p>
          <p class="text-xs text-white/55">{{ metricLine(m) }}</p>
        </div>
        <button class="btn-ghost min-h-11 shrink-0 !px-3 !py-1.5 text-xs !text-red-300" :aria-label="`Hapus ${m.measured_on}`" @click="tracker.removeMetric(m.measured_on)">Hapus</button>
      </li>
    </ul>
    <p v-else class="py-6 text-center text-sm text-white/50">Belum ada catatan ukuran tubuh.</p>
  </div>

  <!-- CATATAN -->
  <div v-else class="space-y-3 px-5" data-testid="tab-catatan">
    <button class="btn-primary w-full" data-testid="notes-add" @click="openAdd()">Tambah aktivitas (tanggal mana pun)</button>

    <ul v-if="tracker.visits.length" class="space-y-2" data-testid="visit-list">
      <li v-for="v in tracker.visits.slice(0, 60)" :key="v.client_id" class="card px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium">{{ dayLabel(v.visited_on) }}<span v-if="v.visited_at" class="font-normal text-white/50"> · {{ timeLabel(v.visited_at) }}</span></p>
            <p class="text-xs text-white/55"><span aria-hidden="true">{{ activityMeta(v.activity).emoji }}</span> {{ visitMeta(v) }} <span v-if="v.energy" aria-hidden="true">{{ ENERGY[v.energy] }}</span></p>
          </div>
          <div class="flex shrink-0 gap-2">
            <button class="btn-ghost min-h-11 !px-3 !py-1.5 text-xs" :aria-label="`Ubah aktivitas ${v.visited_on}`" @click="openEdit(v)">Ubah</button>
            <button class="btn-ghost min-h-11 !px-3 !py-1.5 text-xs !text-red-300" :aria-label="`Hapus latihan ${v.visited_on}`" @click="tracker.removeVisit(v.client_id)">Hapus</button>
          </div>
        </div>
        <p v-if="v.note" class="mt-1.5 text-sm text-white/75">{{ v.note }}</p>
      </li>
    </ul>
    <p v-else class="py-6 text-center text-sm text-white/50">Belum ada latihan tercatat. Mulai dari tombol “Catat latihan” di Beranda.</p>
  </div>

  <DaySheet v-if="daySheet" :date="daySheet" @close="daySheet = null" @add="openAdd($event)" @edit="openEdit($event)" />
  <ActivitySheet v-if="editSheet" :visit="editSheet.visit" :date="editSheet.date" @close="editSheet = null" />

  <ConsentSheet v-if="tracker.needsConsent && tracker.memberId != null" />
</template>
