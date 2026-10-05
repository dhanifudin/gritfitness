<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { assetUrl } from '@/composables/useAsync'
import type { ClassMatch } from '@/lib/classInfo'
import { useClassWatch } from '@/stores/classWatch'
import { useTracker } from '@/stores/tracker'

const props = defineProps<{
  match: ClassMatch | null
  title: string
  /** the tapped session, shown under the class info. weekday/start_time/class_name identify a
   *  predicted slot for the auto-register watchlist (see src/stores/classWatch.ts). */
  session?: {
    time: string
    instructor: string | null
    predicted: boolean
    ended?: boolean
    weekday?: number
    start_time?: string
    class_name?: string
    package_id?: number | null
  } | null
}>()
const emit = defineEmits<{ close: [] }>()

const tracker = useTracker()
const classWatch = useClassWatch()
// Not just predicted slots: a class already real for today (confirmed) can still have its own
// registration window not open yet (e.g. an afternoon class that opens the same morning) — the
// watchlist check always decides off the row's real window anyway, so gate this on "not already
// over", not on the predicted/confirmed display badge.
const canWatch = computed(() => !props.session?.ended && props.session?.weekday != null && props.session.start_time && props.session.class_name && tracker.consented)
const watched = computed(() =>
  canWatch.value ? !!classWatch.activeFor(props.session!.weekday!, props.session!.start_time!, props.session!.class_name!) : false,
)
async function toggleWatch() {
  const s = props.session
  if (!s || s.weekday == null || !s.start_time || !s.class_name) return
  if (watched.value) await classWatch.unwatch(s.weekday, s.start_time, s.class_name)
  else await classWatch.watch(s.weekday, s.start_time, s.class_name, s.package_id ?? null)
}

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && emit('close')
onMounted(() => {
  document.addEventListener('keydown', onKey)
  if (tracker.consented) classWatch.load()
})
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" :aria-label="`Tentang kelas ${title}`" @click.self="emit('close')">
      <div class="safe-b max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-white/10 bg-ink-900">
        <img v-if="props.match?.cls.photo" :src="assetUrl(props.match.cls.photo)" :alt="title" class="h-44 w-full object-cover" />
        <div class="p-5">
          <div class="flex items-start justify-between gap-3">
            <h2 class="font-display text-2xl leading-tight">{{ match?.cls.name ?? title }}</h2>
            <button class="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 active:bg-white/10" aria-label="Tutup" @click="emit('close')">
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <div v-if="match" class="mt-2 flex flex-wrap gap-2 text-xs">
            <span v-if="match.category" class="rounded-full bg-brand-400/25 px-2.5 py-1 font-semibold text-brand-300">{{ match.category.name }}</span>
            <span v-if="match.cls.minutes" class="rounded-full bg-white/8 px-2.5 py-1 text-white/70">{{ match.cls.minutes }} menit</span>
          </div>

          <p v-if="match?.cls.description" class="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/85">{{ match.cls.description }}</p>
          <p v-else class="mt-4 text-sm text-white/55">Deskripsi kelas belum tersedia.</p>

          <p v-if="match?.category?.tagline" class="mt-4 rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-white/60">
            <span class="font-semibold text-white/75">Tentang kelas {{ match.category.name }}:</span> {{ match.category.tagline }}
          </p>

          <div v-if="session" class="mt-4 border-t border-white/10 pt-3 text-sm">
            <p class="text-white/80">{{ session.time }}<template v-if="session.instructor"> · {{ session.instructor }}</template></p>
            <p v-if="session.predicted" class="mt-1 text-xs text-amber-200/80">Perkiraan — jadwal pasti biasanya dibuka sehari sebelumnya.</p>
            <button
              v-if="canWatch"
              type="button"
              class="mt-3 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold"
              :class="watched ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/70'"
              @click="toggleWatch"
            >
              <span>{{ watched ? 'Daftar otomatis aktif' : 'Daftar otomatis saat dibuka' }}</span>
              <span class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition" :class="watched ? 'bg-emerald-400' : 'bg-white/20'">
                <span class="inline-block h-4 w-4 translate-x-0.5 rounded-full bg-white transition" :class="watched ? 'translate-x-4' : ''" />
              </span>
            </button>
            <p v-else-if="!session.ended" class="mt-1 text-xs text-white/40">Aktifkan sinkronisasi di Progres untuk daftar otomatis.</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
