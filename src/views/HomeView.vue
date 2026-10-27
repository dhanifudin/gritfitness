<script setup lang="ts">
import { titleCase } from '@/lib/format'
import { computed, onMounted, ref, watch } from 'vue'
import { invoices, membershipActive, notifications } from '@/api/endpoints'
import CheckInButton from '@/components/CheckInButton.vue'
import ConsentSheet from '@/components/ConsentSheet.vue'
import GoalRing from '@/components/GoalRing.vue'
import MissingDays from '@/components/MissingDays.vue'
import MotivationCard from '@/components/MotivationCard.vue'
import SafeImg from '@/components/SafeImg.vue'
import WeekBars from '@/components/WeekBars.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import { useInstall } from '@/composables/useSw'
import { costPerVisit, invoiceBill, unpaidSummary } from '@/lib/budget'
import { nextOccurrence, showOnHome, watchStatus, watchWhen } from '@/lib/classWatch'
import { CK } from '@/lib/dataCache'
import { dailyInsight, favouriteClassToday, noTrackingNudge, weekTrend } from '@/lib/insight'
import { prefetchAll } from '@/lib/prefetch'
import { parseExpiry, syncQr } from '@/lib/qrCache'
import { parseYmd, signupDue, weekCounts, ymd } from '@/lib/tracker'
import timetable from '@/data/timetable.json'
import type { Slot } from '@/lib/timetable'
import { useAuth } from '@/stores/auth'
import { useClassWatch } from '@/stores/classWatch'
import { useTracker } from '@/stores/tracker'

const auth = useAuth()
const tracker = useTracker()
const uid = auth.user!.id
const install = useInstall()
const classWatch = useClassWatch()

onMounted(() => {
  tracker.init(uid)
  void tracker.sync()
  void prefetchAll({ id: uid, nama: auth.user!.nama })
})

// ---- membership hero (same data that feeds the QR tab; keeps the offline cache fresh too) ----
const { data: member } = useAsync(
  async () => {
    const r = await membershipActive()
    syncQr({ id: uid, nama: auth.user!.nama }, r)
    return r
  },
  null,
  { key: CK.memberGym },
)
const heroPct = computed(() => {
  const m = member.value?.membership
  return m && m.total_hari > 0 ? Math.max(0, Math.min(100, (m.sisa_hari / m.total_hari) * 100)) : 0
})

// ---- notifications bell: unread = latest newer than the last time the list was opened ----
const { data: notifs } = useAsync(notifications, [], { key: CK.notifications })
const hasUnread = computed(() => {
  const latest = notifs.value[0]?.created_at
  if (!latest) return false
  const seen = localStorage.getItem('grit.notifSeen')
  return !seen || new Date(latest) > new Date(seen)
})

// ---- auto-register list: classes marked "Booking otomatis" (cloud-synced) ----
watch(() => tracker.consented, (on) => on && void classWatch.load(), { immediate: true })
const WATCH_MAX = 4
const watched = computed(() =>
  classWatch.entries
    .filter((e) => showOnHome(e, tracker.now))
    .sort((a, b) => nextOccurrence(a, tracker.now) - nextOccurrence(b, tracker.now) || a.start_time.localeCompare(b.start_time)),
)
const watchedShown = computed(() => watched.value.slice(0, WATCH_MAX))
const removing = ref<string | null>(null)
async function removeWatch(e: (typeof watched.value)[number]) {
  removing.value = e.id
  try {
    await classWatch.unwatch(e.weekday, e.start_time, e.class_name)
  } catch {
    /* offline: the row stays, tap again later */
  } finally {
    removing.value = null
  }
}
const TONE = { good: 'text-ok', warn: 'text-warn', bad: 'text-danger', info: 'text-mute' } as const

const first = computed(() => (auth.user!.nama.split(' ')[0] ?? '').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))
const initial = computed(() => (auth.user!.nama[0] ?? 'M').toUpperCase())
const dateLabel = computed(() => tracker.now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }))
const s = computed(() => tracker.stats)
// the attendance question waits for the class to start; until then today's class sits in the upcoming list
const dueSignups = computed(() => tracker.signups.filter((x) => signupDue(x, tracker.now)))
const upcomingSignups = computed(() =>
  tracker.signups
    .filter((x) => x.status === 'planned' && (x.scheduled_on > ymd(tracker.now) || (x.scheduled_on === ymd(tracker.now) && !signupDue(x, tracker.now))))
    .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on) || (a.start_time ?? '').localeCompare(b.start_time ?? '')),
)
const upcomingDay = (on: string) => (on === ymd(tracker.now) ? 'Hari ini' : parseYmd(on).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }))

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

// ---- notice: unpaid invoices only (no "lunas" noise) ----
const { data: rawBills } = useAsync(invoices, [], { key: CK.bills })
const bills = computed(() => rawBills.value.map((i) => invoiceBill(i, parseExpiry)))
const unpaid = computed(() => unpaidSummary(bills.value))
const nextUnpaid = computed(() => rawBills.value.find((b) => !b.lunas && b.dapat_dibayar) ?? null)

// ---- one rotating, data-backed insight sentence ----
const cpv = computed(() => costPerVisit(bills.value, tracker.visits, tracker.now, 30))
const insight = computed(() => dailyInsight({ visits: tracker.visits, now: tracker.now, total: s.value.total, streak: s.value.streak, cpv: cpv.value }, rupiah))
</script>

<template>
  <div class="px-4 pt-5">
    <div class="flex items-center gap-3">
      <div class="flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#1B2A6B,#E0155A)] text-lg font-extrabold text-white">
        <SafeImg v-if="auth.user?.foto" :src="auth.user.foto" :alt="auth.user.nama" class="h-full w-full object-cover" />
        <template v-else>{{ initial }}</template>
      </div>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-xl font-extrabold">Halo, {{ first }}!</h1>
        <p class="text-[13px] font-semibold text-mute">{{ dateLabel }}</p>
      </div>
      <RouterLink to="/notifications" class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wash text-ink" aria-label="Notifikasi" data-testid="open-notifications">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></svg>
        <span v-if="hasUnread" class="absolute top-2 right-2 h-2 w-2 rounded-full bg-grit-500" aria-hidden="true" />
      </RouterLink>
    </div>

    <RouterLink v-if="member?.aktif && member.membership" to="/qr" class="hero mt-3 block" data-testid="membership-hero">
      <p class="text-[11px] font-bold tracking-[.05em] text-[#ffd0e0] uppercase">Paket Kamu</p>
      <p class="mt-1 text-lg leading-tight font-extrabold">{{ titleCase(member.membership.tier) }}</p>
      <p class="mt-1 text-xs font-semibold text-[#f0d9e2]">Aktif s.d {{ member.membership.aktif_sampai }} · QR Absensi →</p>
      <div class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/25">
        <span class="block h-full rounded-full bg-white" :style="{ width: heroPct + '%' }" />
      </div>
      <p class="mt-1.5 text-xs font-semibold text-[#f0d9e2]">{{ member.membership.sisa_hari }}/{{ member.membership.total_hari }} hari tersisa</p>
    </RouterLink>
    <RouterLink v-else-if="member && !member.aktif" to="/packages" class="card mt-3 block p-4 text-center" data-testid="no-membership">
      <p class="font-bold">Belum ada membership aktif</p>
      <p class="mt-1 text-sm text-mute">Pilih paket untuk mulai latihan.</p>
      <span class="btn-primary mt-3 !min-h-10 !px-5 !py-2 text-sm">Lihat Paket</span>
    </RouterLink>

    <section class="card mt-3 p-4" data-testid="goal-card">
      <div class="flex items-center gap-4">
        <GoalRing :count="s.week.count" :goal="s.week.goal" />
        <div class="min-w-0 flex-1 space-y-2.5 text-sm">
          <div>
            <p class="text-xs text-mute">Rantai target</p>
            <p
              class="font-bold"
              :class="s.streak.best >= 2 && s.streak.current === s.streak.best ? 'text-lg text-grit-500' : ''"
              data-testid="streak"
            >{{ s.streak.current }} minggu<span class="font-normal text-mute"> · terbaik {{ s.streak.best }}</span></p>
          </div>
          <div>
            <p class="text-xs text-mute">Total latihan</p>
            <p class="font-bold">{{ s.total }} hari<span class="font-normal text-mute"> · rata-rata {{ s.avg4.toFixed(1) }}/minggu</span></p>
          </div>
        </div>
      </div>
      <template v-if="trendText">
        <p class="mt-4 text-sm text-soft">{{ trendText }}</p>
        <WeekBars class="mt-2" :weeks="weeks8" :goal="s.week.goal" />
      </template>
    </section>

    <CheckInButton class="mt-3" />

    <MotivationCard :m="tracker.motivation" class="mt-3" data-testid="motivation" />

    <section v-if="tracker.consented && watched.length" class="mt-4" data-testid="watchlist">
      <p class="px-1 text-[15px] font-extrabold">Booking otomatis</p>
      <div class="mt-1.5 card divide-y divide-line">
        <div v-for="e in watchedShown" :key="e.id" class="flex items-center gap-3 px-4 py-2.5 text-sm" data-testid="watch-row">
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-3">
              <span class="min-w-0 truncate font-bold">{{ titleCase(e.class_name) }}</span>
              <span class="shrink-0 text-mute">{{ watchWhen(e, tracker.now) }}</span>
            </div>
            <p class="mt-0.5 text-xs" :class="TONE[watchStatus(e, tracker.now).tone]">{{ watchStatus(e, tracker.now).text }}</p>
          </div>
          <button
            class="btn-sm shrink-0"
            :disabled="removing === e.id"
            :aria-label="`Hapus ${e.class_name} dari booking otomatis`"
            data-testid="watch-remove"
            @click="removeWatch(e)"
          >
            {{ removing === e.id ? '…' : 'Hapus' }}
          </button>
        </div>
        <p v-if="watched.length > WATCH_MAX" class="px-4 py-2 text-xs text-mute">+{{ watched.length - WATCH_MAX }} kelas lainnya</p>
      </div>
    </section>

    <div v-if="tracker.reminder.show" class="banner banner-warn mt-3 flex gap-2.5" data-testid="reminder">
      <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0 text-warn" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
      <p>{{ tracker.reminder.text }}</p>
    </div>

    <div v-if="trackingNudge" class="banner banner-warn mt-3 flex gap-2.5" data-testid="tracking-nudge">
      <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0 text-warn" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 16l6-6 4 4 8-9M21 5v6h-6" /></svg>
      <p>{{ trackingNudge }}</p>
    </div>

    <div v-if="favClass" class="banner banner-info mt-3 flex gap-2.5" data-testid="favclass-nudge">
      <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0 text-grit-500" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></svg>
      <div class="min-w-0">
        <p class="font-bold">{{ titleCase(favClass.className) }}<span class="font-normal text-mute"> · {{ favClass.start.slice(0, 5) }}</span></p>
        <p class="mt-0.5 text-xs text-mute">Kelas favoritmu ada hari ini — belum booking.</p>
        <RouterLink to="/classes" class="btn-sm mt-2">Lihat jadwal</RouterLink>
      </div>
    </div>

    <section v-if="dueSignups.length" class="mt-3 space-y-3" data-testid="today-classes">
      <div v-for="c in dueSignups" :key="c.schedule_id" class="banner banner-info flex gap-2.5">
        <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0 text-grit-500" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></svg>
        <div class="min-w-0 flex-1">
          <p class="font-bold">{{ titleCase(c.class_name) }}<span v-if="c.start_time" class="font-normal text-mute"> · {{ c.start_time.slice(0, 5) }}</span></p>
          <p class="mt-0.5 text-xs text-mute">Jadi ikut kelas?</p>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <button class="btn-primary !min-h-10 !py-2" @click="tracker.attendClass(c.schedule_id)">Saya hadir</button>
            <button class="btn-ghost !min-h-10 !py-2" @click="tracker.setSignupStatus(c.schedule_id, 'cancelled')">Tidak jadi</button>
          </div>
        </div>
      </div>
    </section>

    <MissingDays />

    <section v-if="upcomingSignups.length" class="mt-4" data-testid="upcoming-classes">
      <p class="px-1 text-[15px] font-extrabold">Kelas terbooking</p>
      <div class="mt-1.5 card divide-y divide-line">
        <RouterLink v-for="c in upcomingSignups" :key="c.schedule_id" :to="`/my-classes/${c.schedule_id}`" class="flex items-center justify-between px-4 py-2.5 text-sm">
          <span class="font-bold">{{ titleCase(c.class_name) }}</span>
          <span class="text-mute">{{ upcomingDay(c.scheduled_on) }}<span v-if="c.start_time"> · {{ c.start_time.slice(0, 5) }}</span></span>
        </RouterLink>
      </div>
    </section>

    <RouterLink v-if="nextUnpaid" to="/bills" class="banner banner-warn mt-3 flex items-center gap-2.5" data-testid="unpaid-card">
      <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-warn" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>
      <span class="min-w-0 flex-1">{{ unpaid.count }} tagihan belum dibayar, total {{ rupiah(unpaid.total) }} (termasuk {{ nextUnpaid.nomor }}).</span>
      <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-mute" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
    </RouterLink>

    <p v-if="insight" class="mt-3 px-1 text-sm text-mute" data-testid="insight">{{ insight.text }}</p>

    <button v-if="install.canInstall()" class="btn-ghost mt-4 w-full" @click="install.install()">Pasang aplikasi di layar utama</button>
    <p v-else-if="install.showIosHint()" class="mt-4 text-center text-xs text-mute">
      Untuk memasang: ketuk tombol Bagikan lalu “Tambah ke Layar Utama”.
    </p>
  </div>

  <ConsentSheet v-if="tracker.needsConsent && tracker.memberId != null" />
</template>
