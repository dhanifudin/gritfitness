<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTracker } from '@/stores/tracker'

defineProps<{ compact?: boolean }>()
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
function go() {
  tracker.checkIn()
  open.value = true
}
const saveNote = () => v.value && note.value.trim() !== (v.value.note ?? '') && tracker.updateVisit(v.value.client_id, { note: note.value.trim() || null })
</script>

<template>
  <div>
    <button
      v-if="!tracker.checkedInToday"
      class="btn w-full !py-4 bg-lime-grit text-base font-bold text-black shadow-[0_6px_24px_rgba(200,245,96,.25)]"
      data-testid="checkin"
      @click="go"
    >
      <span aria-hidden="true">✅</span> {{ compact ? 'Catat latihan hari ini' : 'Sudah di gym? Catat latihan hari ini' }}
    </button>
    <div v-else class="card p-4" data-testid="checked-in">
      <div class="flex items-center justify-between gap-3">
        <p class="font-semibold text-lime-grit"><span aria-hidden="true">✓</span> Latihan hari ini tercatat<span v-if="time"> · {{ time }}</span></p>
        <button class="text-xs text-white/50 underline" @click="open = !open">{{ open ? 'Tutup' : 'Tambah catatan' }}</button>
      </div>
      <div v-if="open" class="mt-3 space-y-3">
        <div>
          <p class="mb-1.5 text-xs text-white/55">Bagaimana energimu?</p>
          <div class="grid grid-cols-5 gap-1.5">
            <button
              v-for="x in energies" :key="x.v" type="button" :aria-label="x.t" :aria-pressed="v?.energy === x.v"
              class="rounded-xl py-2 text-xl transition" :class="v?.energy === x.v ? 'bg-brand-400' : 'bg-white/5'"
              @click="v && tracker.updateVisit(v.client_id, { energy: v.energy === x.v ? null : x.v })"
            >{{ x.e }}</button>
          </div>
        </div>
        <textarea v-model="note" rows="2" maxlength="500" class="input" placeholder="Catatan latihan (opsional)" @blur="saveNote" />
      </div>
      <p v-if="tracker.pending" class="mt-2 text-[11px] text-white/40">Tersimpan di perangkat · menunggu sinkron ({{ tracker.pending }})</p>
    </div>
  </div>
</template>
