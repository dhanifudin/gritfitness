<script setup lang="ts">
import { ref } from 'vue'
import { trackerConfigured } from '@/lib/supabase'
import { useTracker } from '@/stores/tracker'

const tracker = useTracker()
const goal = ref(tracker.settings.goal_per_week)
const days = ['1x', '2x', '3x', '4x', '5x', '6x', '7x']
</script>

<template>
  <Teleport to="body">
<Transition name="sheet" appear>    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Mulai pantau progres">
      <div class="sheet-panel safe-b max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-white/8 bg-ink-900 p-5">
        <div class="sheet-handle mt-3" aria-hidden="true" />
        <h2 class="font-display text-xl font-semibold">Pantau progres latihanmu</h2>
        <p class="mt-1 text-sm text-white/70">Catat kehadiran, lihat konsistensimu, dan dapatkan semangat untuk hidup lebih sehat.</p>

        <p class="mt-4 text-sm font-semibold">Target latihan per minggu</p>
        <div class="mt-2 grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Target per minggu">
          <button
            v-for="(d, i) in days" :key="d" type="button" role="radio" :aria-checked="goal === i + 1"
            class="rounded-xl py-2.5 text-sm font-semibold transition" :class="goal === i + 1 ? 'bg-grit-500 text-white' : 'bg-white/5 text-white/50'"
            @click="goal = i + 1"
          >{{ d }}</button>
        </div>
        <p class="mt-2 text-xs text-white/50">3x seminggu adalah awal yang realistis. Bisa diubah kapan saja.</p>

        <div v-if="trackerConfigured" class="mt-4 rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-white/70">
          Jika kamu setuju, datamu (kehadiran, catatan, ukuran tubuh) disimpan di server GritFitness agar tidak hilang saat ganti HP.
          Hanya kamu yang bisa melihatnya. Kamu bisa memilih menyimpannya di perangkat ini saja.
        </div>
        <div class="mt-4 grid gap-2.5">
          <button v-if="trackerConfigured" class="btn-primary" data-testid="consent-cloud" @click="tracker.consent(goal)">Simpan di cloud (disarankan)</button>
          <button :class="trackerConfigured ? 'btn-ghost' : 'btn-primary'" data-testid="consent-local" @click="tracker.stayLocal(goal)">Hanya di perangkat ini</button>
        </div>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>
