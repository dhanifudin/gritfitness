<script setup lang="ts">
import { titleCase } from '@/lib/format'
import { ref } from 'vue'
import SafeImg from '@/components/SafeImg.vue'
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
  <div class="seg mx-5 mb-4 grid-cols-3">
    <button
      v-for="t in tabs"
      :key="t.key"
      class="seg-tab"
      :class="tab === t.key ? 'seg-tab-on' : ''"
      @click="tab = t.key"
    >
      {{ t.label }}
    </button>
  </div>
  <StateBox :loading="cur().loading.value" :error="cur().error.value" :stale="cur().stale.value" :saved-at="cur().savedAt.value" :empty="!cur().data.value.length" @retry="cur().reload()">
    <ul class="space-y-3 px-5">
      <li v-for="p in cur().data.value as any[]" :key="p.id">
        <RouterLink :to="link(p.id)" class="card flex gap-3 p-4">
          <SafeImg v-if="tab === 'class'" :src="p.foto ? assetUrl('/storage/kelas/' + p.foto) : ''" :alt="titleCase(p.nama)" class="h-16 w-16 shrink-0 rounded-xl object-cover" />
          <div class="min-w-0">
            <p class="font-semibold">{{ tab === 'class' ? titleCase(p.nama) : p.nama }}</p>
            <p v-if="tab !== 'class'" class="text-sm text-white/50">
              {{ p.durasi }} {{ p.satuan_durasi }}<template v-if="p.jumlah_pertemuan"> · {{ p.jumlah_pertemuan }} pertemuan</template>
            </p>
            <p v-else class="text-sm text-white/50">{{ p.durasi_waktu }} menit · maks {{ p.maksimal_member }} peserta</p>
            <p class="mt-1 font-display text-lg">{{ rupiah(p.harga) }}</p>
          </div>
        </RouterLink>
      </li>
    </ul>
  </StateBox>
</template>
