<script setup lang="ts">
import { ref } from 'vue'
import { paketMemberships, paketPt } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { rupiah, useAsync } from '@/composables/useAsync'

const tab = ref<'gym' | 'pt'>('gym')
const gym = useAsync(paketMemberships, [])
const pt = useAsync(paketPt, [])
const cur = () => (tab.value === 'gym' ? gym : pt)
</script>

<template>
  <PageHeader title="Paket" subtitle="Pilih paket membership" />
  <div class="mx-5 mb-4 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
    <button class="rounded-lg py-2 text-sm font-semibold" :class="tab === 'gym' ? 'bg-brand-400' : 'text-white/60'" @click="tab = 'gym'">Membership</button>
    <button class="rounded-lg py-2 text-sm font-semibold" :class="tab === 'pt' ? 'bg-brand-400' : 'text-white/60'" @click="tab = 'pt'">Personal Trainer</button>
  </div>
  <StateBox :loading="cur().loading.value" :error="cur().error.value" :empty="!cur().data.value.length" @retry="cur().reload()">
    <ul class="space-y-3 px-5">
      <li v-for="p in cur().data.value" :key="p.id" class="card p-4">
        <p class="font-semibold">{{ p.nama }}</p>
        <p class="text-sm text-white/55">
          {{ p.durasi }} {{ p.satuan_durasi }}<template v-if="p.jumlah_pertemuan"> · {{ p.jumlah_pertemuan }} pertemuan</template>
        </p>
        <p class="mt-2 font-display text-xl text-lime-grit">{{ rupiah(p.harga) }}</p>
      </li>
    </ul>
  </StateBox>
</template>
