<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ActivitySheet from '@/components/ActivitySheet.vue'
import { useTracker } from '@/stores/tracker'

defineProps<{ minimal?: boolean }>()
const tracker = useTracker()
onMounted(() => tracker.init())

const energies = [
  { v: 1, e: '😴', t: 'Lelah' },
  { v: 2, e: '😐', t: 'Biasa' },
  { v: 3, e: '🙂', t: 'Baik' },
  { v: 4, e: '💪', t: 'Kuat' },
  { v: 5, e: '🔥', t: 'Luar biasa' },
]
const v = computed(() => tracker.todayVisit)
const note = ref('')
watch(v, (x) => (note.value = x?.note ?? ''), { immediate: true })
const time = computed(() => (v.value?.visited_at ? new Date(v.value.visited_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''))

const open = ref(false) // details (energy + note) after tapping
const sheet = ref<'add' | 'edit' | null>(null)
function go() {
  tracker.checkIn()
  open.value = true
}
const saveNote = () => v.value && note.value.trim() !== (v.value.note ?? '') && tracker.updateVisit(v.value.client_id, { note: note.value.trim() || null })
</script>

<template>
  <div>
    <div v-if="!tracker.checkedInToday" class="flex items-stretch gap-2">
      <button
        class="btn flex-1 bg-grit-500 text-base font-bold text-white shadow-[0_6px_24px_rgba(236,47,143,.3)]"
        :class="minimal ? '!py-3' : '!py-4'"
        data-testid="checkin"
        @click="go"
      >
        Catat latihan hari ini
      </button>
      <button
        v-if="!minimal"
        class="btn-ghost w-14 shrink-0 !p-0"
        aria-label="Aktivitas lain atau tanggal lain"
        data-testid="other-activity"
        @click="sheet = 'add'"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
    <p v-else-if="minimal" class="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300" data-testid="checked-in">
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
      Latihan hari ini tercatat<span v-if="time"> · {{ time }}</span>
    </p>
    <div v-else class="card p-4" data-testid="checked-in">
      <div class="flex items-center justify-between gap-3">
        <p class="flex items-start gap-1.5 font-semibold text-emerald-300"><svg viewBox="0 0 24 24" class="mt-1 h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg><span>Latihan hari ini tercatat<span v-if="time"> · {{ time }}</span></span></p>
        <button class="btn-sm shrink-0" @click="open = !open">{{ open ? 'Tutup' : 'Tambah catatan' }}</button>
      </div>
      <div v-if="open" class="mt-3 space-y-3">
        <div>
          <p class="mb-1.5 text-xs text-white/50">Bagaimana energimu?</p>
          <div class="grid grid-cols-5 gap-1.5">
            <button
              v-for="x in energies" :key="x.v" type="button" :aria-label="x.t" :aria-pressed="v?.energy === x.v"
              class="rounded-xl py-2 text-xl transition" :class="v?.energy === x.v ? 'bg-grit-500' : 'bg-white/5'"
              @click="v && tracker.updateVisit(v.client_id, { energy: v.energy === x.v ? null : x.v })"
            >{{ x.e }}</button>
          </div>
        </div>
        <textarea v-model="note" rows="2" maxlength="500" class="input" placeholder="Catatan latihan (opsional)" @blur="saveNote" />
        <div class="grid grid-cols-2 gap-2">
          <button class="btn-sm" data-testid="change-type" @click="sheet = 'edit'">Ubah jenis</button>
          <button class="btn-sm" @click="sheet = 'add'">Tambah aktivitas lain</button>
        </div>
      </div>
      <p v-if="tracker.pending" class="mt-2 text-xs text-white/35">Tersimpan di perangkat · menunggu sinkron ({{ tracker.pending }})</p>
    </div>
    <ActivitySheet v-if="sheet === 'add'" @close="sheet = null" />
    <ActivitySheet v-else-if="sheet === 'edit' && v" :visit="v" @close="sheet = null" />
  </div>
</template>
