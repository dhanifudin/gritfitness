<script setup lang="ts">
import { computed } from 'vue'
import { titleCase } from '@/lib/format'
import { signupDue } from '@/lib/tracker'
import { useTracker } from '@/stores/tracker'

// "Jadi ikut kelas?" — the attendance question for a booked class whose start time has passed.
// Lives globally (App.vue) since the pure-official Beranda no longer hosts it; it's time-critical
// and must surface wherever the member happens to be. Dismissal = answering (hadir / tidak jadi).
const tracker = useTracker()
const due = computed(() => tracker.signups.filter((x) => signupDue(x, tracker.now)))
const cur = computed(() => due.value[0] ?? null)
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="cur" class="fixed inset-0 z-40 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Konfirmasi kehadiran kelas" data-testid="today-classes">
        <div class="sheet-panel safe-b w-full max-w-md rounded-t-3xl border-t border-line bg-card p-5">
          <div class="sheet-handle mt-3" aria-hidden="true" />
          <p class="text-lg font-extrabold">{{ titleCase(cur.class_name) }}<span v-if="cur.start_time" class="font-semibold text-mute"> · {{ cur.start_time.slice(0, 5) }}</span></p>
          <p class="mt-1 text-sm text-soft">Jadi ikut kelas ini?</p>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <button class="btn-ghost" @click="tracker.setSignupStatus(cur.schedule_id, 'cancelled')">Tidak jadi</button>
            <button class="btn-primary" data-testid="attend-yes" @click="tracker.attendClass(cur.schedule_id)">Saya hadir</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
