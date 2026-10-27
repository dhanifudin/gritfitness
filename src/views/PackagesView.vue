<script setup lang="ts">
import { titleCase } from '@/lib/format'
import { ref } from 'vue'
import { classCatalog, paketList, ptPaketList } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'

type Tab = 'membership' | 'pt' | 'class'
const tabs: { key: Tab; label: string }[] = [
  { key: 'membership', label: 'Membership' },
  { key: 'pt', label: 'PT' },
  { key: 'class', label: 'Kelas' },
]
const tab = ref<Tab>('membership')
const membership = useAsync(paketList, null, { key: CK.packages('membership') })
const pt = useAsync(ptPaketList, [], { key: CK.packages('pt') })
const kelas = useAsync(classCatalog, [], { key: CK.packages('class') })
const cur = () => (tab.value === 'membership' ? membership : tab.value === 'pt' ? pt : kelas)

/** "/bln", "/3bln", "/1thn", "/N hari" — same period rule as the official app. */
function period(hari: number): string {
  if (hari % 365 === 0) return `/${hari / 365 > 1 ? hari / 365 : ''}thn`
  if (hari === 30 || hari === 31) return '/bln'
  if (hari % 30 === 0) return `/${hari / 30}bln`
  return `/${hari} hari`
}
const empty = () => (tab.value === 'membership' ? !membership.data.value?.data.length : tab.value === 'pt' ? !pt.data.value.length : !kelas.data.value.length)
</script>

<template>
  <PageHeader title="Pilih Paketmu" subtitle="Membership, PT, dan kelas GritFitness" />
  <div class="seg mx-4 mb-4 grid-cols-3">
    <button
      v-for="t in tabs"
      :key="t.key"
      class="seg-tab"
      :class="tab === t.key ? 'seg-tab-on' : ''"
      :data-testid="`tab-${t.key}`"
      @click="tab = t.key"
    >
      {{ t.label }}
    </button>
  </div>
  <StateBox :loading="cur().loading.value" :error="cur().error.value" :stale="cur().stale.value" :saved-at="cur().savedAt.value" :empty="empty()" @retry="cur().reload()">
    <!-- Membership tiers -->
    <ul v-if="tab === 'membership'" class="space-y-4 px-4 pb-6">
      <li v-for="p in membership.data.value?.data ?? []" :key="p.id" class="relative">
        <RouterLink
          :to="`/packages/membership/${p.id}`"
          class="block rounded-2xl border-[1.5px] p-[18px]"
          :class="p.id === membership.data.value?.tier_aktif_id ? 'border-grit-500 border-2 bg-(--tier-active-bg)' : 'border-line bg-card'"
        >
          <span v-if="p.id === membership.data.value?.tier_aktif_id" class="absolute -top-2.5 left-4 rounded-md bg-grit-500 px-2.5 py-0.5 text-[10px] font-bold text-white">Paket Kamu</span>
          <p class="text-[15px] font-extrabold">
            {{ titleCase(p.nama) }}
            <span v-if="p.tipe === 'pelajar'" class="ml-1.5 rounded-md bg-navy px-2 py-0.5 align-middle text-[10px] font-bold text-white">Pelajar</span>
          </p>
          <p class="mt-2.5 text-2xl font-extrabold text-grit-500">{{ rupiah(p.harga) }}<span class="text-xs font-semibold text-mute">{{ period(p.durasi_hari) }}</span></p>
          <ul v-if="p.benefit?.length" class="mt-3 space-y-1.5 text-[13px] font-semibold text-soft">
            <li v-for="(b, i) in p.benefit" :key="i" class="flex gap-2">
              <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0 text-ok" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
              <span>{{ b }}</span>
            </li>
          </ul>
          <span class="mt-4 block w-full rounded-xl py-3 text-center text-sm font-bold" :class="p.id === membership.data.value?.tier_aktif_id ? 'bg-grit-500 text-white' : 'border-[1.5px] border-navy text-navy dark:border-white dark:text-white'">
            {{ p.id === membership.data.value?.tier_aktif_id ? 'Perpanjang' : 'Pilih Paket' }}
          </span>
        </RouterLink>
      </li>
    </ul>

    <!-- PT packages -->
    <ul v-else-if="tab === 'pt'" class="space-y-3 px-4 pb-6">
      <li v-for="p in pt.data.value" :key="p.id">
        <RouterLink :to="`/packages/pt/${p.id}`" class="card block p-4">
          <p class="font-extrabold">{{ titleCase(p.nama) }}</p>
          <p class="mt-0.5 text-[13px] font-semibold text-mute">{{ p.jumlah_sesi }} sesi · Berlaku {{ p.masa_berlaku_hari }} hari</p>
          <p class="mt-1.5"><span class="price-final text-lg">{{ rupiah(p.harga) }}</span><span class="text-xs font-semibold text-mute"> total · {{ rupiah(p.harga_per_sesi) }}/sesi</span></p>
        </RouterLink>
      </li>
    </ul>

    <!-- Class catalog -->
    <ul v-else class="space-y-3 px-4 pb-6">
      <li v-for="k in kelas.data.value" :key="k.id" class="card p-4">
        <p class="font-extrabold">{{ titleCase(k.nama) }}</p>
        <p class="mt-0.5 text-[13px] font-semibold text-mute"><template v-if="k.kategori">{{ k.kategori }} · </template>{{ k.durasi_menit }} menit</p>
        <p v-if="k.deskripsi" class="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-soft">{{ k.deskripsi }}</p>
        <div class="mt-2.5 flex items-center justify-between gap-3">
          <span class="text-[13px]">
            <span v-if="!k.ada_jadwal" class="font-semibold text-mute">Belum ada jadwal</span>
            <span v-else-if="k.termasuk_paket" class="price-free">Termasuk membership</span>
            <span v-else-if="k.gratis" class="price-free">Gratis</span>
            <span v-else-if="k.harga_mulai" class="price-final">mulai {{ rupiah(k.harga_mulai) }}</span>
          </span>
          <RouterLink v-if="k.ada_jadwal" :to="`/classes/${k.id}/schedule`" class="btn-sm shrink-0 !text-grit-500">Lihat Jadwal</RouterLink>
        </div>
      </li>
    </ul>
  </StateBox>
</template>
