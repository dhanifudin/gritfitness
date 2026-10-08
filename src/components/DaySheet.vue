<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import ActivityIcon from '@/components/ActivityIcon.vue'
import { activityLabel } from '@/lib/activities'
import { counts, parseYmd, ymd, type Visit } from '@/lib/tracker'
import { useTracker } from '@/stores/tracker'

const props = defineProps<{ date: string }>()
const emit = defineEmits<{ close: []; add: [date: string]; edit: [visit: Visit] }>()
const tracker = useTracker()

const entries = computed(() => tracker.visits.filter((v) => v.visited_on === props.date))
const label = computed(() => parseYmd(props.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
const future = computed(() => props.date > ymd(tracker.now))
const time = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '')
const ENERGY = ['', '😴', '😐', '🙂', '💪', '🔥']

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
<Transition name="sheet" appear>    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" :aria-label="`Aktivitas ${label}`" data-testid="day-sheet" @click.self="emit('close')">
      <div class="sheet-panel safe-b max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-white/8 bg-ink-900 p-5">
        <div class="sheet-handle mt-3" aria-hidden="true" />
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-display text-xl font-semibold">{{ label }}</h2>
            <p class="text-xs text-white/50">{{ entries.length ? `${entries.length} aktivitas tercatat` : 'Belum ada aktivitas tercatat' }}</p>
          </div>
          <button class="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:bg-white/10" aria-label="Tutup" @click="emit('close')">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <ul v-if="entries.length" class="mt-3 space-y-2">
          <li v-for="v in entries" :key="v.client_id" class="card px-4 py-3" data-testid="day-entry">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="flex items-center gap-1.5 text-sm font-semibold"><ActivityIcon :kind="v.activity ?? 'gym'" class="text-white/70" /> {{ activityLabel(v) }}</p>
                <p class="text-xs text-white/50">
                  <template v-if="v.visited_at">{{ time(v.visited_at) }} · </template><template v-if="v.duration_min">{{ v.duration_min }} menit · </template>{{ counts(v) ? 'dihitung' : 'tidak dihitung' }}
                  <span v-if="v.energy" aria-hidden="true"> {{ ENERGY[v.energy] }}</span>
                </p>
              </div>
              <div class="flex shrink-0 gap-2">
                <button class="btn-sm" data-testid="day-edit" @click="emit('edit', v)">Ubah</button>
                <button class="btn-sm btn-danger" data-testid="day-delete" @click="tracker.removeVisit(v.client_id)">Hapus</button>
              </div>
            </div>
            <p v-if="v.note" class="mt-1.5 text-sm text-white/70">{{ v.note }}</p>
          </li>
        </ul>

        <button v-if="!future" class="btn-primary mt-4 w-full" data-testid="day-add" @click="emit('add', date)">Tambah aktivitas di tanggal ini</button>
        <p v-else class="mt-4 text-center text-xs text-white/50">Hari yang belum terjadi belum bisa dicatat.</p>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>
