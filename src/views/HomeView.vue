<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { tagihan } from '@/api/endpoints'
import CheckInButton from '@/components/CheckInButton.vue'
import ConsentSheet from '@/components/ConsentSheet.vue'
import GoalRing from '@/components/GoalRing.vue'
import MissingDays from '@/components/MissingDays.vue'
import MotivationCard from '@/components/MotivationCard.vue'
import WeekBars from '@/components/WeekBars.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import { useInstall } from '@/composables/useSw'
import { costPerVisit, unpaidSummary } from '@/lib/budget'
import { CK } from '@/lib/dataCache'
import { dailyInsight, favouriteClassToday, noTrackingNudge, weekTrend } from '@/lib/insight'
import { prefetchAll } from '@/lib/prefetch'
import { parseYmd, weekCounts, ymd } from '@/lib/tracker'
import timetable from '@/data/timetable.json'
import type { Slot } from '@/lib/timetable'
import { useAuth } from '@/stores/auth'
import { useTracker } from '@/stores/tracker'

const auth = useAuth()
const tracker = useTracker()
const uid = auth.user!.id
const install = useInstall()

onMounted(() => {
  tracker.init(uid)
  void tracker.sync()
  void prefetchAll({ id: uid, nama: auth.user!.nama })
})

const first = computed(() => (auth.user!.nama.split(' ')[0] ?? '').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))
const dateLabel = computed(() => tracker.now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }))
const s = computed(() => tracker.stats)
const todaySignups = computed(() => tracker.signups.filter((x) => x.scheduled_on === ymd(tracker.now) && x.status === 'planned'))
const upcomingSignups = computed(() =>
  tracker.signups
    .filter((x) => x.status === 'planned' && x.scheduled_on > ymd(tracker.now))
    .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on) || (a.start_time ?? '').localeCompare(b.start_time ?? '')),
)

// ---- act zone: favourite-class-predicted-today and no-tracking nudges (same logic the push checks reuse) ----
const slots = timetable.slots as Slot[]
const favClass = computed(() => favouriteClassToday({ visits: tracker.visits, now: tracker.now, slots, signups: tracker.signups }))
const trackingNudge = computed(() => noTrackingNudge(s.value.sinceLast))

// ---- hero: trend vs 4 weeks ago, only when there's enough history to compare honestly ----
const weeks8 = computed(() => weekCounts(tracker.visits, tracker.now, 8))
const trendText = computed(() => {
  const { recent, prior } = weekTrend(tracker.visits, tracker.now, 4)
  if (prior == null) return null
  if (recent > prior) return 'Lebih aktif dibanding 4 minggu sebelumnya.'
  if (recent < prior) return 'Lebih jarang dibanding 4 minggu sebelumnya.'
  return 'Konsisten seperti 4 minggu sebelumnya.'
})

// ---- notice: unpaid bills only (no "lunas" noise) ----
const { data: bills } = useAsync(tagihan, [], { key: CK.bills })
const unpaid = computed(() => unpaidSummary(bills.value))
const nextUnpaid = computed(() => bills.value.find((b) => b.status !== 'Lunas' && b.status !== 'Dibayar') ?? null)

// ---- one rotating, data-backed insight sentence ----
const cpv = computed(() => costPerVisit(bills.value, tracker.visits, tracker.now, 30))
const insight = computed(() => dailyInsight({ visits: tracker.visits, now: tracker.now, total: s.value.total, streak: s.value.streak, cpv: cpv.value }, rupiah))
</script>

<template>
  <div class="px-5 pt-8">
    <p class="text-sm text-white/55">{{ dateLabel }}</p>
    <h1 class="font-display text-2xl font-semibold">Halo, {{ first }}!</h1>

    <section class="card mt-4 p-4" data-testid="goal-card">
      <div class="flex items-center gap-4">
        <GoalRing :count="s.week.count" :goal="s.week.goal" />
        <div class="min-w-0 flex-1 space-y-2.5 text-sm">
          <div>
            <p class="text-xs text-white/50">Rantai target</p>
            <p
              class="font-semibold"
              :class="s.streak.best >= 2 && s.streak.current === s.streak.best ? 'font-display text-lg text-lime-grit' : ''"
              data-testid="streak"
            >{{ s.streak.current }} minggu<span class="font-normal text-white/50"> · terbaik {{ s.streak.best }}</span></p>
          </div>
          <div>
            <p class="text-xs text-white/50">Total latihan</p>
            <p class="font-semibold">{{ s.total }} hari<span class="font-normal text-white/50"> · rata-rata {{ s.avg4.toFixed(1) }}/minggu</span></p>
          </div>
        </div>
      </div>
      <template v-if="trendText">
        <p class="mt-4 text-sm text-white/70">{{ trendText }}</p>
        <WeekBars class="mt-2" :weeks="weeks8" :goal="s.week.goal" />
      </template>
    </section>

    <CheckInButton class="mt-4" />

    <MotivationCard :m="tracker.motivation" class="mt-3" data-testid="motivation" />

    <div v-if="tracker.reminder.show" class="mt-3 flex gap-2.5 border-l-2 border-amber-400 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" data-testid="reminder">
      <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
      <p>{{ tracker.reminder.text }}</p>
    </div>

    <div v-if="trackingNudge" class="mt-3 flex gap-2.5 border-l-2 border-amber-400 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" data-testid="tracking-nudge">
      <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 16l6-6 4 4 8-9M21 5v6h-6" /></svg>
      <p>{{ trackingNudge }}</p>
    </div>

    <div v-if="favClass" class="mt-3 flex gap-2.5 border-l-2 border-brand-400 bg-white/5 px-4 py-3" data-testid="favclass-nudge">
      <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0 text-brand-300" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></svg>
      <div class="min-w-0">
        <p class="font-semibold">{{ favClass.className }}<span class="font-normal text-white/55"> · {{ favClass.start.slice(0, 5) }}</span></p>
        <p class="mt-0.5 text-xs text-white/55">Kelas favoritmu ada hari ini — belum daftar.</p>
        <RouterLink to="/classes" class="btn-ghost mt-2 min-h-11 !px-3 !py-1.5 text-xs">Lihat jadwal</RouterLink>
      </div>
    </div>

    <section v-if="todaySignups.length" class="mt-3 space-y-3" data-testid="today-classes">
      <div v-for="c in todaySignups" :key="c.schedule_id" class="flex gap-2.5 border-l-2 border-brand-400 bg-white/5 px-4 py-3">
        <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0 text-brand-300" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></svg>
        <div class="min-w-0 flex-1">
          <p class="font-semibold">{{ c.class_name }}<span v-if="c.start_time" class="font-normal text-white/55"> · {{ c.start_time.slice(0, 5) }}</span></p>
          <p class="mt-0.5 text-xs text-white/55">Jadi ikut kelas?</p>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <button class="btn-primary !py-2" @click="tracker.attendClass(c.schedule_id)">Saya hadir</button>
            <button class="btn-ghost !py-2" @click="tracker.setSignupStatus(c.schedule_id, 'cancelled')">Tidak jadi</button>
          </div>
        </div>
      </div>
    </section>

    <MissingDays />

    <section v-if="upcomingSignups.length" class="mt-3" data-testid="upcoming-classes">
      <p class="px-1 text-xs text-white/50">Kelas terdaftar</p>
      <div class="mt-1.5 divide-y divide-white/8 rounded-2xl border border-white/8 bg-ink-900/60">
        <div v-for="c in upcomingSignups" :key="c.schedule_id" class="flex items-center justify-between px-4 py-2.5 text-sm">
          <span class="font-medium">{{ c.class_name }}</span>
          <span class="text-white/50">{{ parseYmd(c.scheduled_on).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) }}<span v-if="c.start_time"> · {{ c.start_time.slice(0, 5) }}</span></span>
        </div>
      </div>
    </section>

    <RouterLink v-if="nextUnpaid" to="/bills" class="mt-3 flex items-center gap-2.5 border-l-2 border-amber-400 bg-amber-500/10 px-4 py-3 text-sm" data-testid="unpaid-card">
      <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-amber-300" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
      <span class="min-w-0 flex-1 text-amber-100">{{ unpaid.count }} tagihan belum dibayar, total {{ rupiah(unpaid.total) }} (termasuk Inv. {{ nextUnpaid.kode }}).</span>
      <span class="shrink-0 text-amber-200/70">›</span>
    </RouterLink>

    <p v-if="insight" class="mt-4 px-1 text-sm text-white/60" data-testid="insight">{{ insight.text }}</p>

    <button v-if="install.canInstall()" class="btn-ghost mt-5 w-full" @click="install.install()">Pasang aplikasi di layar utama</button>
    <p v-else-if="install.showIosHint()" class="mt-5 text-center text-xs text-white/50">
      Untuk memasang: ketuk tombol Bagikan lalu “Tambah ke Layar Utama”.
    </p>
  </div>

  <ConsentSheet v-if="tracker.needsConsent && tracker.memberId != null" />
</template>
