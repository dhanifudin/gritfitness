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
import { dailyInsight, weekTrend } from '@/lib/insight'
import { prefetchAll } from '@/lib/prefetch'
import { weekCounts, ymd } from '@/lib/tracker'
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
            <p class="font-semibold" data-testid="streak">{{ s.streak.current }} minggu<span class="font-normal text-white/50"> · terbaik {{ s.streak.best }}</span></p>
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

    <p v-if="tracker.reminder.show" class="mt-3 border-l-2 border-amber-400 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" data-testid="reminder">
      {{ tracker.reminder.text }}
    </p>

    <section v-if="todaySignups.length" class="mt-3 space-y-3" data-testid="today-classes">
      <div v-for="c in todaySignups" :key="c.schedule_id" class="border-l-2 border-brand-400 bg-white/5 px-4 py-3">
        <p class="font-semibold">{{ c.class_name }}<span v-if="c.start_time" class="font-normal text-white/55"> · {{ c.start_time.slice(0, 5) }}</span></p>
        <p class="mt-0.5 text-xs text-white/55">Jadi ikut kelas?</p>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <button class="btn-primary !py-2" @click="tracker.attendClass(c.schedule_id)">Saya hadir</button>
          <button class="btn-ghost !py-2" @click="tracker.setSignupStatus(c.schedule_id, 'cancelled')">Tidak jadi</button>
        </div>
      </div>
    </section>

    <MissingDays />

    <RouterLink v-if="nextUnpaid" to="/bills" class="mt-3 flex items-center justify-between gap-3 border-l-2 border-amber-400 bg-amber-500/10 px-4 py-3 text-sm" data-testid="unpaid-card">
      <span class="text-amber-100">{{ unpaid.count }} tagihan belum dibayar, total {{ rupiah(unpaid.total) }} (termasuk Inv. {{ nextUnpaid.kode }}).</span>
      <span class="text-amber-200/70">›</span>
    </RouterLink>

    <p v-if="insight" class="mt-4 px-1 text-sm text-white/60" data-testid="insight">{{ insight.text }}</p>

    <button v-if="install.canInstall()" class="btn-ghost mt-5 w-full" @click="install.install()">Pasang aplikasi di layar utama</button>
    <p v-else-if="install.showIosHint()" class="mt-5 text-center text-xs text-white/50">
      Untuk memasang: ketuk tombol Bagikan lalu “Tambah ke Layar Utama”.
    </p>
  </div>

  <ConsentSheet v-if="tracker.needsConsent && tracker.memberId != null" />
</template>
