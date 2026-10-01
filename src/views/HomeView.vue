<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { memberAktif, memberPtAktif, tagihan } from '@/api/endpoints'
import CheckInButton from '@/components/CheckInButton.vue'
import ConsentSheet from '@/components/ConsentSheet.vue'
import GoalRing from '@/components/GoalRing.vue'
import MissingDays from '@/components/MissingDays.vue'
import MotivationCard from '@/components/MotivationCard.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import { useInstall } from '@/composables/useSw'
import { costPerVisit, unpaidSummary } from '@/lib/budget'
import { CK } from '@/lib/dataCache'
import { prefetchAll } from '@/lib/prefetch'
import { daysLeft, parseExpiry, syncQr } from '@/lib/qrCache'
import { ymd } from '@/lib/tracker'
import { useAuth } from '@/stores/auth'
import { useTracker } from '@/stores/tracker'

const auth = useAuth()
const tracker = useTracker()
const uid = auth.user!.id
const install = useInstall()

const me = { id: uid, nama: auth.user!.nama }
const { data: gym, loading } = useAsync(
  async () => {
    const r = await memberAktif(uid)
    syncQr(me, 'gym', r) // keep the offline QR fresh whenever Home loads
    return r
  },
  null as Awaited<ReturnType<typeof memberAktif>> | null,
  { key: CK.memberGym },
)
const { data: pt } = useAsync(
  async () => {
    const r = await memberPtAktif(uid)
    syncQr(me, 'pt', r)
    return r
  },
  null as Awaited<ReturnType<typeof memberPtAktif>> | null,
  { key: CK.memberPt },
)

onMounted(() => {
  tracker.init(uid)
  void tracker.sync()
  void prefetchAll(uid)
})

const first = computed(() => (auth.user!.nama.split(' ')[0] ?? '').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()))
const dateLabel = computed(() => tracker.now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }))
const s = computed(() => tracker.stats)
const todaySignups = computed(() => tracker.signups.filter((x) => x.scheduled_on === ymd(tracker.now) && x.status === 'planned'))

// ---- information cards (reusing data already loaded elsewhere; no extra network calls) ----
const { data: bills } = useAsync(tagihan, [], { key: CK.bills })
const unpaid = computed(() => unpaidSummary(bills.value))
const nextUnpaid = computed(() => bills.value.find((b) => b.status !== 'Lunas' && b.status !== 'Dibayar') ?? null)
const membershipDaysLeft = computed(() => (gym.value && !gym.value.error ? daysLeft({ expiresAt: parseExpiry(gym.value.tanggal_selesai) }) : null))
const nextClass = computed(() => {
  const today = ymd(tracker.now)
  return tracker.signups
    .filter((x) => x.status === 'planned' && x.scheduled_on >= today)
    .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on) || (a.start_time ?? '').localeCompare(b.start_time ?? ''))[0] ?? null
})
const cpv = computed(() => costPerVisit(bills.value, tracker.visits, tracker.now, 30))
</script>

<template>
  <div class="px-5 pt-8">
    <p class="text-sm text-white/55">{{ dateLabel }}</p>
    <h1 class="font-display text-2xl font-semibold">Halo, {{ first }}!</h1>

    <section class="card mt-4 flex items-center gap-4 p-4" data-testid="goal-card">
      <GoalRing :count="s.week.count" :goal="s.week.goal" />
      <div class="min-w-0 flex-1 space-y-2.5 text-sm">
        <div>
          <p class="text-xs text-white/50">Rantai target</p>
          <p class="font-semibold" data-testid="streak"><span aria-hidden="true">🔥</span> {{ s.streak.current }} minggu<span class="font-normal text-white/50"> · terbaik {{ s.streak.best }}</span></p>
        </div>
        <div>
          <p class="text-xs text-white/50">Total latihan</p>
          <p class="font-semibold">{{ s.total }} hari<span class="font-normal text-white/50"> · rata-rata {{ s.avg4.toFixed(1) }}/minggu</span></p>
        </div>
      </div>
    </section>

    <MotivationCard :m="tracker.motivation" class="mt-3" data-testid="motivation" />

    <p v-if="tracker.reminder.show" class="mt-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" data-testid="reminder">
      <span aria-hidden="true">⏰</span> {{ tracker.reminder.text }}
    </p>

    <CheckInButton class="mt-4" />

    <MissingDays />

    <section v-if="todaySignups.length" class="card mt-3 p-4" data-testid="today-classes">
      <p class="text-xs font-semibold tracking-wide text-white/50 uppercase">Kelas hari ini</p>
      <ul class="mt-2 space-y-3">
        <li v-for="c in todaySignups" :key="c.schedule_id">
          <p class="font-semibold">{{ c.class_name }}<span v-if="c.start_time" class="font-normal text-white/55"> · {{ c.start_time.slice(0, 5) }}</span></p>
          <p class="text-xs text-white/50">Jadi ikut kelas?</p>
          <div class="mt-1.5 grid grid-cols-2 gap-2">
            <button class="btn-primary !py-2" @click="tracker.attendClass(c.schedule_id)">Saya hadir</button>
            <button class="btn-ghost !py-2" @click="tracker.setSignupStatus(c.schedule_id, 'cancelled')">Tidak jadi</button>
          </div>
        </li>
      </ul>
    </section>

    <RouterLink to="/qr" class="mt-3 block rounded-2xl bg-gradient-to-br from-brand-500 to-ink-700 p-4" data-testid="membership-card">
      <div v-if="loading && !gym" class="h-10 animate-pulse rounded-xl bg-white/10" />
      <template v-else-if="gym && !gym.error">
        <p class="text-[11px] tracking-wide text-white/70 uppercase">Membership aktif · QR check-in</p>
        <p class="mt-0.5 font-display text-base leading-tight">{{ gym.nama_paket }}</p>
        <p class="mt-1 text-xs text-white/70">
          Berlaku s.d. {{ gym.tanggal_selesai }}
          <span v-if="membershipDaysLeft != null" :class="membershipDaysLeft <= 7 ? 'font-semibold text-amber-300' : ''"> · Sisa {{ membershipDaysLeft }} hari</span>
        </p>
      </template>
      <template v-else>
        <p class="font-display text-base">{{ gym?.error === 'Cuti' ? 'Anda sedang cuti' : 'Membership belum aktif atau sudah berakhir' }}</p>
        <p class="mt-0.5 text-xs text-white/70">Hubungi front desk untuk mengaktifkan paket.</p>
      </template>
    </RouterLink>
    <div v-if="pt && !pt.error" class="card mt-3 p-4">
      <p class="text-xs tracking-wide text-white/50 uppercase">Personal Trainer</p>
      <p class="mt-1 font-semibold">{{ pt.nama_paket }}</p>
      <p class="text-sm text-white/60">s.d. {{ pt.tanggal_selesai }}</p>
    </div>

    <RouterLink v-if="nextClass" :to="`/classes/${nextClass.schedule_id}`" class="card mt-3 flex items-center justify-between p-4" data-testid="next-class-card">
      <div class="min-w-0">
        <p class="text-xs tracking-wide text-white/50 uppercase">Kelas berikutnya</p>
        <p class="mt-0.5 truncate font-semibold">{{ nextClass.class_name }}<span v-if="nextClass.start_time" class="font-normal text-white/55"> · {{ nextClass.start_time.slice(0, 5) }}</span></p>
      </div>
      <span class="text-white/40">›</span>
    </RouterLink>

    <RouterLink v-if="nextUnpaid" to="/bills" class="card mt-3 block border-amber-400/30 bg-amber-500/10 p-4" data-testid="unpaid-card">
      <p class="font-semibold text-amber-200">{{ unpaid.count }} tagihan belum dibayar</p>
      <p class="mt-0.5 text-sm text-amber-100/80">{{ rupiah(unpaid.total) }} · Inv. {{ nextUnpaid.kode }}</p>
    </RouterLink>
    <p v-else-if="bills.length" class="mt-3 px-1 text-xs text-emerald-300" data-testid="unpaid-card">Tagihan lunas ✓</p>

    <RouterLink to="/progress" class="card mt-3 flex items-center justify-between p-4" data-testid="cost-per-visit-card">
      <div class="min-w-0">
        <p class="text-xs tracking-wide text-white/50 uppercase">Biaya per latihan (30 hari)</p>
        <p class="mt-0.5 font-semibold">{{ cpv.perVisit != null ? rupiah(cpv.perVisit) : 'Belum ada data' }}</p>
      </div>
      <span class="text-white/40">›</span>
    </RouterLink>

    <button v-if="install.canInstall()" class="btn-ghost mt-5 w-full" @click="install.install()">Pasang aplikasi di layar utama</button>
    <p v-else-if="install.showIosHint()" class="mt-5 text-center text-xs text-white/50">
      Untuk memasang: ketuk tombol Bagikan lalu “Tambah ke Layar Utama”.
    </p>
  </div>

  <ConsentSheet v-if="tracker.needsConsent && tracker.memberId != null" />
</template>
