<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BackHeader from '@/components/BackHeader.vue'
import { useSyncLabel } from '@/composables/useSyncLabel'
import { useTracker } from '@/stores/tracker'

const tracker = useTracker()
onMounted(() => tracker.init())
const syncLabel = useSyncLabel()

const enabling = ref(false)
async function enableCloudSync() {
  enabling.value = true
  tracker.consent(tracker.settings.goal_per_week)
  await tracker.sync()
  enabling.value = false
}
</script>

<template>
  <BackHeader title="Data & sinkronisasi" />
  <div class="space-y-3 px-5">
    <section class="card p-4">
      <p class="text-xs text-white/50">Status</p>
      <p class="mt-1 font-semibold" data-testid="sync-status">{{ syncLabel }}</p>
      <p v-if="tracker.pending" class="mt-1 text-xs text-white/50">{{ tracker.pending }} perubahan menunggu dikirim.</p>
    </section>

    <section v-if="tracker.localOnly" class="card p-4">
      <p class="font-semibold">Simpan di cloud</p>
      <p class="mt-1 text-sm text-white/70">Progres kamu sekarang hanya ada di perangkat ini: tidak muncul di browser lain, dan daftar otomatis kelas butuh sinkronisasi aktif.</p>
      <button class="btn-primary mt-4 w-full" :disabled="enabling" data-testid="enable-cloud-sync" @click="enableCloudSync">
        {{ enabling ? 'Mengaktifkan…' : 'Aktifkan sinkronisasi cloud' }}
      </button>
    </section>
    <section v-else-if="tracker.consented" class="card p-4">
      <p class="font-semibold">Sinkronisasi cloud aktif</p>
      <p class="mt-1 text-sm text-white/70">Progres dan target kamu tersimpan di akun, jadi ikut muncul di perangkat atau browser lain.</p>
    </section>
  </div>
</template>
