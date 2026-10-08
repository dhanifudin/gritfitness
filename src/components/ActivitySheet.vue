<script setup lang="ts">
import ActivityIcon from '@/components/ActivityIcon.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ACTIVITIES, activityMeta, classGroups, defaultCounts, searchClasses, type Activity } from '@/lib/activities'
import type { ClassInfoData } from '@/lib/classInfo'
import classInfo from '@/data/classInfo.json'
import { addDays, parseYmd, ymd, type Visit } from '@/lib/tracker'
import { useTracker } from '@/stores/tracker'

const props = defineProps<{ visit?: Visit | null; date?: string }>()
const emit = defineEmits<{ close: []; saved: [Visit | null] }>()

const tracker = useTracker()
const today = ymd(tracker.now)
const minDate = ymd(addDays(tracker.now, -400))
const groups = classGroups(classInfo as unknown as ClassInfoData)

const editing = !!props.visit
const v0 = props.visit
const date = ref(v0?.visited_on ?? props.date ?? today)
const activity = ref<Activity>((v0?.activity as Activity) ?? 'gym')
const classId = ref<number | null>(v0?.class_id ?? null)
const className = ref<string | null>(v0?.class_name ?? null)
const customName = ref(v0?.activity_name ?? '')
const counted = ref(v0 ? v0.counts_toward_goal !== false : defaultCounts('gym'))
const time = ref(v0?.visited_at ? new Date(v0.visited_at).toTimeString().slice(0, 5) : '')
const duration = ref(v0?.duration_min != null ? String(v0.duration_min) : '')
const energy = ref<number | null>(v0?.energy ?? null)
const note = ref(v0?.note ?? '')
const cost = ref(v0?.cost != null ? String(v0.cost) : '')
const query = ref('')
const error = ref('')

const ENERGY = [
  { v: 1, e: '😴', t: 'Lelah' }, { v: 2, e: '😐', t: 'Biasa' }, { v: 3, e: '🙂', t: 'Baik' }, { v: 4, e: '💪', t: 'Kuat' }, { v: 5, e: '🔥', t: 'Luar biasa' },
]
const quick = computed(() => [
  { label: 'Hari ini', d: today },
  { label: 'Kemarin', d: ymd(addDays(tracker.now, -1)) },
  { label: '2 hari lalu', d: ymd(addDays(tracker.now, -2)) },
])
const shown = computed(() => searchClasses(groups, query.value))
const dateLabel = computed(() => parseYmd(date.value).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))

function pickActivity(a: Activity) {
  activity.value = a
  counted.value = defaultCounts(a)
  error.value = ''
}
function pickClass(c: { id: number; name: string; minutes: number | null }) {
  classId.value = c.id
  className.value = c.name
  if (!duration.value && c.minutes) duration.value = String(c.minutes)
}

function save() {
  error.value = ''
  if (!date.value || date.value > today) return void (error.value = 'Tanggal tidak boleh di masa depan.')
  if (date.value < minDate) return void (error.value = 'Tanggal terlalu lama (maksimal 400 hari ke belakang).')
  if (activity.value === 'class' && !className.value) return void (error.value = 'Pilih kelasnya dulu.')
  if (activity.value === 'other' && !customName.value.trim()) return void (error.value = 'Tulis nama aktivitasnya, misalnya Hyrox.')
  const dur = duration.value.trim() === '' ? null : Number(duration.value)
  if (dur != null && !(Number.isInteger(dur) && dur >= 1 && dur <= 600)) return void (error.value = 'Durasi harus 1–600 menit.')
  const costVal = cost.value.trim() === '' ? null : Number(cost.value)
  if (costVal != null && !(costVal >= 0)) return void (error.value = 'Biaya tidak boleh negatif.')
  const patch = {
    visited_on: date.value,
    visited_at: time.value ? new Date(`${date.value}T${time.value}:00`).toISOString() : null,
    activity: activity.value,
    activity_name: activity.value === 'other' ? customName.value.trim() : null,
    class_id: activity.value === 'class' ? classId.value : null,
    class_name: activity.value === 'class' ? className.value : null,
    counts_toward_goal: counted.value,
    duration_min: dur,
    energy: energy.value,
    note: note.value.trim() || null,
    cost: activity.value === 'other' ? costVal : null,
  }
  if (editing && v0) {
    tracker.updateVisit(v0.client_id, patch)
    emit('saved', null)
  } else {
    emit('saved', tracker.addActivity({ date: date.value, activity: activity.value, activity_name: patch.activity_name, class_id: patch.class_id, class_name: patch.class_name, counts: counted.value, duration_min: dur, time: time.value || null, energy: energy.value, note: patch.note, cost: patch.cost }))
  }
  emit('close')
}

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
<Transition name="sheet" appear>    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" :aria-label="editing ? 'Ubah aktivitas' : 'Tambah aktivitas'" data-testid="activity-sheet" @click.self="emit('close')">
      <div class="sheet-panel safe-b max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-white/8 bg-ink-900 p-5">
        <div class="sheet-handle mt-3" aria-hidden="true" />
        <div class="flex items-start justify-between gap-3">
          <h2 class="font-display text-xl font-semibold">{{ editing ? 'Ubah aktivitas' : 'Tambah aktivitas' }}</h2>
          <button class="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:bg-white/10" aria-label="Tutup" @click="emit('close')">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <!-- date -->
        <p class="mt-3 text-xs font-semibold text-white/50">Tanggal</p>
        <div class="mt-1.5 grid grid-cols-3 gap-1.5">
          <button v-for="q in quick" :key="q.label" type="button" class="rounded-xl py-2 text-xs font-semibold transition" :class="date === q.d ? 'bg-grit-500 text-white' : 'bg-white/5 text-white/50'" @click="date = q.d">{{ q.label }}</button>
        </div>
        <input v-model="date" type="date" :min="minDate" :max="today" class="input mt-2" data-testid="act-date" />
        <p class="mt-1 text-xs text-white/50">{{ dateLabel }}</p>

        <!-- type -->
        <p class="mt-3 text-xs font-semibold text-white/50">Jenis aktivitas</p>
        <div class="mt-1.5 grid grid-cols-2 gap-1.5">
          <button
            v-for="a in ACTIVITIES" :key="a.key" type="button" :aria-pressed="activity === a.key" :data-testid="'act-' + a.key"
            class="rounded-xl px-3 py-2.5 text-left transition" :class="activity === a.key ? 'bg-grit-500 text-white' : 'bg-white/5 text-white/70'"
            @click="pickActivity(a.key)"
          >
            <span class="flex items-center gap-1.5 text-sm font-semibold"><ActivityIcon :kind="a.key" /> {{ a.label }}</span>
            <span class="block text-xs opacity-70">{{ a.hint }}</span>
          </button>
        </div>

        <!-- class picker -->
        <div v-if="activity === 'class'" class="mt-3" data-testid="class-picker">
          <input v-model="query" class="input" placeholder="Cari kelas (mis. yoga)" data-testid="class-search" />
          <p v-if="className" class="mt-2 flex items-center gap-1.5 text-sm font-semibold text-grit-300"><svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg> {{ className }}</p>
          <div class="mt-2 max-h-48 overflow-y-auto rounded-xl bg-white/5 p-2">
            <p v-if="!shown.length" class="px-2 py-3 text-sm text-white/50">Tidak ada kelas yang cocok.</p>
            <div v-for="g in shown" :key="g.category" class="mb-2">
              <p class="px-2 text-xs text-white/50">{{ g.category }}</p>
              <button v-for="c in g.classes" :key="c.id" type="button" class="block w-full rounded-lg px-2 py-2 text-left text-sm" :class="classId === c.id ? 'bg-grit-500/30' : 'active:bg-white/10'" @click="pickClass(c)">
                {{ c.name }}<span v-if="c.minutes" class="text-white/50"> · {{ c.minutes }} mnt</span>
              </button>
            </div>
          </div>
        </div>

        <!-- custom -->
        <div v-if="activity === 'other'" class="mt-3 space-y-2">
          <input v-model="customName" maxlength="60" class="input" placeholder="Nama aktivitas (mis. Hyrox)" data-testid="act-name" />
          <input v-model="cost" inputmode="numeric" class="input" placeholder="Biaya, Rp (opsional)" data-testid="act-cost" />
        </div>
        <label v-if="activity === 'other'" class="mt-2 flex items-center gap-2 text-sm text-white/70">
          <input v-model="counted" type="checkbox" class="h-4 w-4 accent-grit-500" data-testid="act-counts" /> Hitung sebagai latihan (untuk target mingguan)
        </label>
        <p class="mt-2 rounded-lg px-3 py-2 text-xs" :class="counted ? 'bg-emerald-500/10 text-emerald-200' : 'bg-white/5 text-white/50'">
          {{ counted ? 'Dihitung untuk target mingguan dan rantai.' : `${activityMeta(activity).label} hanya dicatat, tidak dihitung untuk target.` }}
        </p>

        <!-- optional details -->
        <div class="mt-3 grid grid-cols-2 gap-2">
          <label class="block text-xs text-white/50">Jam (opsional)<input v-model="time" type="time" class="input mt-1" /></label>
          <label class="block text-xs text-white/50">Durasi, menit<input v-model="duration" inputmode="numeric" class="input mt-1" placeholder="60" /></label>
        </div>
        <p class="mt-3 text-xs font-semibold text-white/50">Energi</p>
        <div class="mt-1.5 grid grid-cols-5 gap-1.5">
          <button v-for="x in ENERGY" :key="x.v" type="button" :aria-label="x.t" :aria-pressed="energy === x.v" class="rounded-xl py-2 text-xl transition" :class="energy === x.v ? 'bg-grit-500' : 'bg-white/5'" @click="energy = energy === x.v ? null : x.v">{{ x.e }}</button>
        </div>
        <textarea v-model="note" rows="2" maxlength="500" class="input mt-3" placeholder="Catatan (opsional)" />

        <p v-if="error" class="mt-3 text-sm text-red-300" data-testid="act-error">{{ error }}</p>
        <button class="btn-primary mt-4 w-full" data-testid="act-save" @click="save">{{ editing ? 'Simpan perubahan' : 'Simpan' }}</button>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>
