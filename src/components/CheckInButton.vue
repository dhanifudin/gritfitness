<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ActivitySheet from '@/components/ActivitySheet.vue'
import { useTracker } from '@/stores/tracker'

defineProps<{ compact?: boolean; minimal?: boolean }>()
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
    <button
      v-if="!tracker.checkedInToday"
      class="btn w-full bg-lime-grit text-base font-bold text-black shadow-[0_6px_24px_rgba(200,245,96,.25)]"
      :class="minimal ? '!py-3' : '!py-4'"
      data-testid="checkin"
      @click="go"
    >
      <span aria-hidden="true">✅</span> {{ compact || minimal ? 'Catat latihan hari ini' : 'Sudah di gym? Catat latihan hari ini' }}
    </button>
    <template v-if="!tracker.checkedInToday">
      <button v-if="!minimal" class="btn-ghost mx-auto mt-2 !flex min-h-11 w-fit !px-4 !py-1.5 text-xs" data-testid="other-activity" @click="sheet = 'add'">Aktivitas lain atau tanggal lain</button>
    </template>
    <p v-else-if="minimal" class="rounded-xl bg-lime-grit/10 px-4 py-3 text-center text-sm font-semibold text-lime-grit" data-testid="checked-in">
      <span aria-hidden="true">✓</span> Latihan hari ini tercatat<span v-if="time"> · {{ time }}</span>
    </p>
    <div v-else class="card p-4" data-testid="checked-in">
      <div class="flex items-center justify-between gap-3">
        <p class="font-semibold text-lime-grit"><span aria-hidden="true">✓</span> Latihan hari ini tercatat<span v-if="time"> · {{ time }}</span></p>
        <button class="btn-ghost min-h-11 shrink-0 !px-3 !py-1.5 text-xs" @click="open = !open">{{ open ? 'Tutup' : 'Tambah catatan' }}</button>
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
        <div class="grid grid-cols-2 gap-2">
          <button class="btn-ghost min-h-11 !px-3 !py-1.5 text-xs" data-testid="change-type" @click="sheet = 'edit'">Ubah jenis</button>
          <button class="btn-ghost min-h-11 !px-3 !py-1.5 text-xs" @click="sheet = 'add'">Tambah aktivitas lain</button>
        </div>
      </div>
      <p v-if="tracker.pending" class="mt-2 text-[11px] text-white/40">Tersimpan di perangkat · menunggu sinkron ({{ tracker.pending }})</p>
    </div>
    <ActivitySheet v-if="sheet === 'add'" @close="sheet = null" />
    <ActivitySheet v-else-if="sheet === 'edit' && v" :visit="v" @close="sheet = null" />
  </div>
</template>
