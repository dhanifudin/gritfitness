<script setup lang="ts">
import { titleCase } from '@/lib/format'
import { computed, onMounted, ref } from 'vue'
import { invoices } from '@/api/endpoints'
import ActivitySheet from '@/components/ActivitySheet.vue'
import BadgeGrid from '@/components/BadgeGrid.vue'
import DaySheet from '@/components/DaySheet.vue'
import ConsentSheet from '@/components/ConsentSheet.vue'
import MissingDays from '@/components/MissingDays.vue'
import MonthHeatmap from '@/components/MonthHeatmap.vue'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import WeekBars from '@/components/WeekBars.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import ActivityIcon from '@/components/ActivityIcon.vue'
import { activityLabel } from '@/lib/activities'
import { costPerVisit, invoiceBill, monthlySpend, otherActivitySpend, totalSpent, unpaidSummary } from '@/lib/budget'
import { useSyncLabel } from '@/composables/useSyncLabel'
import { classEfficiency, classSavings } from '@/lib/classValue'
import { CK } from '@/lib/dataCache'
import { dailyInsight, favouriteLabel, favouriteWeekdays } from '@/lib/insight'
import { activityBreakdown, addDays, counts, parseYmd, weekCounts, weekdayHistogram, ymd, type Visit } from '@/lib/tracker'
import { parseExpiry } from '@/lib/qrCache'
import { useTracker } from '@/stores/tracker'

const tracker = useTracker()
onMounted(() => {
  tracker.init()
  void tracker.sync()
})

type Tab = 'ringkasan' | 'badge' | 'anggaran' | 'catatan'
const tabs: { key: Tab; label: string }[] = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'badge', label: 'Badge' },
  { key: 'anggaran', label: 'Anggaran' },
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
const { data: rawBills, loading: billsLoading, error: billsError, savedAt: billsSavedAt, stale: billsStale, reload: reloadBills } = useAsync(invoices, [], { key: CK.bills })
const bills = computed(() => rawBills.value.map((i) => invoiceBill(i, parseExpiry)))
const spendMonths = computed(() => monthlySpend(bills.value, tracker.now, 6))
const spendMax = computed(() => Math.max(1, ...spendMonths.value.map((m) => m.total)))
const spentThisYear = computed(() => totalSpent(bills.value, { from: `${tracker.now.getFullYear()}-01-01`, to: today.value }))
const cpv = computed(() => costPerVisit(bills.value, tracker.visits, tracker.now, 30))
const unpaid = computed(() => unpaidSummary(bills.value))
// one rotating, data-backed insight sentence (moved here from the old Beranda)
const insight = computed(() => dailyInsight({ visits: tracker.visits, now: tracker.now, total: s.value.total, streak: s.value.streak, cpv: cpv.value }, rupiah))
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
// ---- catatan ----
const ENERGY = ['', '😴', '😐', '🙂', '💪', '🔥']
const dayLabel = (d: string) => parseYmd(d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
const timeLabel = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '')
const visitMeta = (v: Visit) => [activityLabel(v), v.duration_min ? `${v.duration_min} mnt` : null, !counts(v) ? 'tidak dihitung' : null].filter(Boolean).join(' · ')
</script>

<template>
  <PageHeader title="Aktivitas Latihan" :subtitle="`Target ${goal}x seminggu · ${syncLabel}`" />


  <div class="seg mx-5 mb-4 grid-cols-5" role="tablist">
    <button
      v-for="t in tabs" :key="t.key" role="tab" :aria-selected="tab === t.key"
      class="seg-tab !text-xs leading-tight" :class="tab === t.key ? 'seg-tab-on' : ''"
      @click="tab = t.key"
    >{{ t.label }}</button>
  </div>

  <!-- RINGKASAN -->
  <div v-if="tab === 'ringkasan'" class="space-y-3 px-5" data-testid="tab-ringkasan">
    <section class="card p-4">
      <div class="grid grid-cols-2 gap-4">
        <div><p class="text-xs text-mute">Minggu ini</p><p class="text-2xl font-extrabold">{{ s.week.count }}<span class="text-base text-mute">/{{ s.week.goal }}</span></p></div>
        <div><p class="text-xs text-mute">Rata-rata 4 minggu</p><p class="text-2xl font-extrabold" data-testid="avg4">{{ s.avg4.toFixed(1) }}<span class="text-base text-mute">/minggu</span></p></div>
        <div><p class="text-xs text-mute">Rantai terbaik</p><p class="text-2xl font-extrabold text-grit-500">{{ s.streak.best }}<span class="text-base text-mute"> minggu</span></p></div>
        <div><p class="text-xs text-mute">Total latihan</p><p class="text-2xl font-extrabold" data-testid="total">{{ s.total }}<span class="text-base text-mute"> hari</span></p></div>
      </div>
    </section>

    <MissingDays />
    <p v-if="insight" class="px-1 text-sm text-mute" data-testid="insight">{{ insight.text }}</p>

    <section class="card p-4"><h2 class="mb-3 text-sm font-semibold">8 minggu terakhir</h2><WeekBars :weeks="weeks" :goal="goal" /></section>
    <section class="card p-4"><MonthHeatmap :visits="tracker.visits" :now="tracker.now" :planned="planned" @select="daySheet = $event" /></section>

    <section class="card p-4">
      <h2 class="text-sm font-semibold">Hari favoritmu</h2>
      <p class="text-xs text-mute">{{ favourite ? `Paling sering: ${favourite}` : 'Belum ada data' }}</p>
      <div class="mt-3 flex h-20 items-end gap-2">
        <div v-for="(n, i) in hist" :key="i" class="flex flex-1 flex-col items-center justify-end">
          <div class="w-full rounded-t-md" :class="n === Math.max(...hist) && n > 0 ? 'bg-grit-500' : 'bg-line'" :style="{ height: (n / histMax) * 3.5 + 'rem', minHeight: n ? '0.2rem' : '0.1rem' }" />
          <span class="mt-1 text-xs text-mute">{{ DAY_SHORT[i] }}</span>
        </div>
      </div>
    </section>

    <section class="card p-4" data-testid="activity-card">
      <h2 class="text-sm font-semibold">Aktivitas 30 hari terakhir</h2>
      <p v-if="!breakdown.total" class="mt-1 text-xs text-mute">Belum ada aktivitas tercatat.</p>
      <ul v-else class="mt-2 space-y-1.5">
        <li v-for="i in breakdown.items" :key="i.key" class="flex items-center justify-between text-sm">
          <span class="flex items-center gap-1.5"><ActivityIcon :kind="i.key" class="text-soft" /> {{ i.label }}</span><span class="font-semibold">{{ i.count }}x</span>
        </li>
      </ul>
      <p v-if="breakdown.topClass" class="mt-2 text-xs text-mute">Kelas favorit: {{ titleCase(breakdown.topClass.name) }} ({{ breakdown.topClass.count }}x)</p>
      <button class="btn-ghost mt-3 w-full !py-2" data-testid="add-activity" @click="openAdd()">Tambah aktivitas</button>
    </section>

  </div>

  <!-- BADGE -->
  <div v-else-if="tab === 'badge'" class="px-5" data-testid="tab-badge">
    <p class="mb-3 text-sm text-mute">{{ tracker.badgeList.filter((b) => b.unlocked).length }} dari {{ tracker.badgeList.length }} pencapaian terbuka</p>
    <BadgeGrid :badges="tracker.badgeList" />
  </div>

  <!-- ANGGARAN -->
  <div v-else-if="tab === 'anggaran'" data-testid="tab-anggaran">
    <StateBox :loading="billsLoading" :stale="billsStale" :saved-at="billsSavedAt" :error="billsError" @retry="reloadBills">
      <div class="space-y-3 px-5">
        <section class="card p-4">
          <div class="grid grid-cols-2 gap-4">
            <div><p class="text-xs text-mute">Tahun ini</p><p class="text-2xl font-extrabold" data-testid="spent-year">{{ rupiah(spentThisYear) }}</p></div>
            <div>
              <p class="text-xs text-mute">Rp / latihan (30 hari)</p>
              <p class="text-2xl font-extrabold" data-testid="cost-per-visit">{{ cpv.perVisit != null ? rupiah(cpv.perVisit) : '-' }}</p>
            </div>
          </div>
        </section>

        <section v-if="savings.count" class="card p-4" data-testid="class-savings">
          <h2 class="text-sm font-semibold">Hemat dari kelas (30 hari)</h2>
          <p class="mt-2 text-2xl font-extrabold">{{ rupiah(savings.saved) }}</p>
          <p class="text-xs text-mute">dari {{ savings.count }} kelas yang gratis untuk member (tarif non-member).</p>
          <p v-if="efficiency.paybackPct != null" class="mt-3 text-sm text-soft">
            {{ efficiency.exceedsCost ? 'Lebih besar dari biaya membership 30 hari.' : `Setara ${Math.round(efficiency.paybackPct)}% dari biaya membership 30 hari.` }}
          </p>
          <p v-if="efficiency.effectivePerVisit != null" class="mt-1 text-sm text-soft">
            Biaya efektif per latihan: <span class="font-semibold">{{ rupiah(efficiency.effectivePerVisit) }}</span>
          </p>
        </section>

        <RouterLink v-if="unpaid.count" to="/bills" class="banner banner-warn flex items-center justify-between gap-3" data-testid="unpaid-card">
          <span class="text-soft">{{ unpaid.count }} tagihan belum dibayar, total {{ rupiah(unpaid.total) }}.</span>
          <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-mute" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </RouterLink>
        <p v-else class="flex items-center gap-1.5 px-1 text-sm text-ok" data-testid="unpaid-card"><svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg> Semua tagihan lunas</p>

        <section class="card p-4">
          <h2 class="mb-3 text-sm font-semibold">Pengeluaran 6 bulan terakhir</h2>
          <div class="flex h-28 items-end gap-2">
            <div v-for="m in spendMonths" :key="m.month" class="flex flex-1 flex-col items-center justify-end">
              <span class="mb-1 text-xs text-mute">{{ m.total ? rupiah(m.total) : '' }}</span>
              <div class="w-full rounded-t-md bg-chart-2" :style="{ height: (m.total / spendMax) * 5 + 'rem', minHeight: m.total ? '0.2rem' : '0.1rem' }" :class="!m.total ? '!bg-line' : ''" />
              <span class="mt-1 text-xs text-mute">{{ monthLabel(m.month) }}</span>
            </div>
          </div>
        </section>

        <p class="px-1 text-xs leading-relaxed text-mute">
          Dihitung dari tagihan yang sudah lunas dan hari latihan GritFitness (Gym, Kelas, Personal Trainer, Pemulihan). Tidak termasuk aktivitas di luar GritFitness, misalnya Hyrox.
        </p>

        <p v-if="otherSpend.count" class="px-1 text-sm text-soft" data-testid="other-spend">
          Di luar GritFitness, 30 hari ({{ otherSpend.count }} aktivitas): <span class="font-semibold text-ink">{{ rupiah(otherSpend.total) }}</span>
        </p>
      </div>
    </StateBox>
  </div>


  <!-- CATATAN -->
  <div v-else class="space-y-3 px-5" data-testid="tab-catatan">
    <button class="btn-primary w-full" data-testid="notes-add" @click="openAdd()">Tambah aktivitas (tanggal mana pun)</button>

    <ul v-if="tracker.visits.length" class="space-y-2" data-testid="visit-list">
      <li v-for="v in tracker.visits.slice(0, 60)" :key="v.client_id" class="card px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium">{{ dayLabel(v.visited_on) }}<span v-if="v.visited_at" class="font-normal text-mute"> · {{ timeLabel(v.visited_at) }}</span></p>
            <p class="flex items-center gap-1.5 text-xs text-mute"><ActivityIcon :kind="v.activity ?? 'gym'" class="!h-3.5 !w-3.5" /> {{ visitMeta(v) }} <span v-if="v.energy" aria-hidden="true">{{ ENERGY[v.energy] }}</span></p>
          </div>
          <div class="flex shrink-0 gap-2">
            <button class="btn-sm" :aria-label="`Ubah aktivitas ${v.visited_on}`" @click="openEdit(v)">Ubah</button>
            <button class="btn-sm btn-danger" :aria-label="`Hapus latihan ${v.visited_on}`" @click="tracker.removeVisit(v.client_id)">Hapus</button>
          </div>
        </div>
        <p v-if="v.note" class="mt-1.5 text-sm text-soft">{{ v.note }}</p>
      </li>
    </ul>
    <p v-else class="py-6 text-center text-sm text-mute">Belum ada latihan tercatat. Mulai dari tombol “Catat latihan” di Beranda.</p>
  </div>

  <DaySheet v-if="daySheet" :date="daySheet" @close="daySheet = null" @add="openAdd($event)" @edit="openEdit($event)" />
  <ActivitySheet v-if="editSheet" :visit="editSheet.visit" :date="editSheet.date" @close="editSheet = null" />

  <ConsentSheet v-if="tracker.needsConsent && tracker.memberId != null" />
</template>
