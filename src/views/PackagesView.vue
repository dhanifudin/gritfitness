<script setup lang="ts">
import { ref } from 'vue'
import { paketKelas, paketMemberships, paketPt } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { assetUrl, rupiah, useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'

type Tab = 'membership' | 'pt' | 'class'
const tabs: { key: Tab; label: string }[] = [
  { key: 'membership', label: 'Membership' },
  { key: 'pt', label: 'PT' },
  { key: 'class', label: 'Kelas' },
]
const tab = ref<Tab>('membership')
const sources = {
  membership: useAsync(paketMemberships, [], { key: CK.packages('membership') }),
  pt: useAsync(paketPt, [], { key: CK.packages('pt') }),
  class: useAsync(paketKelas, [], { key: CK.packages('class') }),
}
const cur = () => sources[tab.value]
const link = (id: number) => (tab.value === 'class' ? `/packages/class/${id}` : `/packages/${tab.value}/${id}`)
</script>

<template>
  <PageHeader title="Paket" subtitle="Informasi paket GritFitness" />
  <div class="mx-5 mb-4 grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">
    <button
      v-for="t in tabs"
      :key="t.key"
      class="min-h-11 rounded-lg py-2 text-sm font-semibold"
      :class="tab === t.key ? 'bg-brand-400' : 'text-white/60'"
      @click="tab = t.key"
    >
      {{ t.label }}
    </button>
  </div>
  <StateBox :loading="cur().loading.value" :error="cur().error.value" :stale="cur().stale.value" :saved-at="cur().savedAt.value" :empty="!cur().data.value.length" @retry="cur().reload()">
    <ul class="space-y-3 px-5">
      <li v-for="p in cur().data.value as any[]" :key="p.id">
        <RouterLink :to="link(p.id)" class="card flex gap-3 p-4">
          <img v-if="tab === 'class' && p.foto" :src="assetUrl('/storage/kelas/' + p.foto)" alt="" loading="lazy" class="h-16 w-16 shrink-0 rounded-xl object-cover" />
          <div class="min-w-0">
            <p class="font-semibold">{{ p.nama }}</p>
            <p v-if="tab !== 'class'" class="text-sm text-white/55">
              {{ p.durasi }} {{ p.satuan_durasi }}<template v-if="p.jumlah_pertemuan"> · {{ p.jumlah_pertemuan }} pertemuan</template>
            </p>
            <p v-else class="text-sm text-white/55">{{ p.durasi_waktu }} menit · maks {{ p.maksimal_member }} peserta</p>
            <p class="mt-1 font-display text-lg text-lime-grit">{{ rupiah(p.harga) }}</p>
          </div>
        </RouterLink>
      </li>
    </ul>
  </StateBox>
</template>
