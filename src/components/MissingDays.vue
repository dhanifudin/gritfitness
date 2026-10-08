<script setup lang="ts">
import { titleCase } from '@/lib/format'
import { computed, ref } from 'vue'
import ActivitySheet from '@/components/ActivitySheet.vue'
import { addDays, parseYmd, ymd } from '@/lib/tracker'
import { useTracker } from '@/stores/tracker'

const tracker = useTracker()
const sheetDate = ref<string | null>(null)

const yesterday = computed(() => ymd(addDays(tracker.now, -1)))
const showYesterday = computed(() => tracker.missing.includes(yesterday.value))
const dayLabel = (d: string) => parseYmd(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })
</script>

<template>
  <section v-if="showYesterday || tracker.pastSignups.length" class="mt-3 space-y-3" data-testid="missing-days">
    <div v-if="showYesterday" class="banner banner-info" data-testid="missing-yesterday">
      <p class="font-semibold">Kemarin belum tercatat</p>
      <p class="mt-0.5 text-xs text-white/50">Sudah latihan atau beraktivitas? Lengkapi datanya supaya progresmu akurat.</p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button class="btn-primary !py-2" data-testid="missing-add" @click="sheetDate = yesterday">Tambahkan</button>
        <button class="btn-ghost !py-2" data-testid="missing-skip" @click="tracker.dismissMissing(yesterday)">Tidak latihan</button>
      </div>
    </div>

    <div v-for="c in tracker.pastSignups" :key="c.schedule_id" class="banner banner-info" data-testid="past-signup">
      <p class="font-semibold">Jadi ikut {{ titleCase(c.class_name) }}?</p>
      <p class="mt-0.5 text-xs text-white/50">{{ dayLabel(c.scheduled_on) }}<span v-if="c.start_time"> · {{ c.start_time.slice(0, 5) }}</span></p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button class="btn-primary !py-2" @click="tracker.attendClass(c.schedule_id)">Saya hadir</button>
        <button class="btn-ghost !py-2" @click="tracker.setSignupStatus(c.schedule_id, 'cancelled')">Tidak jadi</button>
      </div>
    </div>
  </section>

  <ActivitySheet v-if="sheetDate" :date="sheetDate" @close="sheetDate = null" />
</template>
