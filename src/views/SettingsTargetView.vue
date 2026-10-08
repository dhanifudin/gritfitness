<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BackHeader from '@/components/BackHeader.vue'
import { disablePush, enablePush, isStandalone, permissionState, pushSupported, wasEnabled } from '@/lib/push'
import { useTracker } from '@/stores/tracker'

const tracker = useTracker()
onMounted(() => tracker.init())

const goal = computed(() => tracker.settings.goal_per_week)
const hour = computed(() => tracker.settings.reminder_hour ?? 17)

const goalWeight = ref(tracker.settings.goal_weight_kg != null ? String(tracker.settings.goal_weight_kg) : '')
function saveGoalWeight() {
  const t = goalWeight.value.trim()
  const v = t === '' ? null : Number(t.replace(',', '.'))
  tracker.setSettings({ goal_weight_kg: v != null && v >= 20 && v <= 400 ? v : null })
}

// ---- push notifications: cloud sync required (subscriptions live alongside the rest of the tracker data) ----
const pushOn = ref(wasEnabled())
const pushBusy = ref(false)
const pushError = ref('')
const pushBlocked = computed(() => {
  if (!tracker.consented) return 'Aktifkan sinkronisasi cloud dulu (Pengaturan › Data & sinkronisasi) untuk menerima notifikasi.'
  if (!pushSupported()) return 'Browser ini tidak mendukung notifikasi push.'
  if (!isStandalone()) return 'Pasang aplikasi ke layar utama dulu, lalu buka dari sana untuk mengaktifkan.'
  if (permissionState() === 'denied') return 'Izin notifikasi diblokir — aktifkan lewat pengaturan browser/perangkat.'
  return null
})
async function togglePush() {
  pushError.value = ''
  pushBusy.value = true
  if (pushOn.value) {
    await disablePush()
    pushOn.value = false
  } else {
    const r = await enablePush()
    if (r.ok) pushOn.value = true
    else pushError.value = r.reason
  }
  pushBusy.value = false
}
</script>

<template>
  <BackHeader title="Target & pengingat" />
  <div class="space-y-3 px-5">
    <section class="card space-y-4 p-4">
      <div class="flex items-center justify-between">
        <span class="text-sm">Target per minggu</span>
        <div class="flex items-center gap-3">
          <button class="btn-sm !text-sm" aria-label="Kurangi target" :disabled="goal <= 1" @click="tracker.setSettings({ goal_per_week: goal - 1 })"><svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14" /></svg></button>
          <span class="w-6 text-center font-display text-lg" data-testid="goal-value">{{ goal }}</span>
          <button class="btn-sm !text-sm" aria-label="Tambah target" :disabled="goal >= 7" @click="tracker.setSettings({ goal_per_week: goal + 1 })"><svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
        </div>
      </div>
      <label class="flex items-center justify-between text-sm">Pengingat setelah jam
        <select class="input !w-auto !py-2" data-testid="reminder-hour" :value="hour" @change="tracker.setSettings({ reminder_hour: Number(($event.target as HTMLSelectElement).value) })">
          <option v-for="h in 18" :key="h" :value="h + 4">{{ String(h + 4).padStart(2, '0') }}.00</option>
        </select>
      </label>
      <label class="flex items-center justify-between text-sm">Target berat (kg)
        <input v-model="goalWeight" inputmode="decimal" class="input !w-24 !py-2 text-right" placeholder="-" data-testid="goal-weight" @change="saveGoalWeight" />
      </label>
    </section>

    <section class="card p-4" data-testid="push-settings">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="font-semibold">Notifikasi latihan</p>
          <p class="mt-0.5 text-xs text-white/50">Kelas favorit yang terlewat, dan pengingat kalau belum tercatat beberapa hari.</p>
        </div>
        <button
          type="button" role="switch" :aria-checked="pushOn" data-testid="push-toggle"
          class="switch"
          :class="pushOn ? 'switch-on' : ''"
          :disabled="pushBusy"
          @click="togglePush"
        >
          <span v-if="pushBusy" class="absolute inset-0 flex items-center justify-center">
            <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          </span>
          <span v-else class="absolute top-1 h-5 w-5 rounded-full bg-white transition" :class="pushOn ? 'left-6' : 'left-1'" />
        </button>
      </div>
      <p v-if="!pushOn && pushBlocked" class="mt-2 text-xs text-amber-200/80">{{ pushBlocked }}</p>
      <p v-if="pushError" class="mt-2 text-xs text-red-300">{{ pushError }}</p>
    </section>
  </div>
</template>
