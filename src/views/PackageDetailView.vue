<script setup lang="ts">
import { useRoute } from 'vue-router'
import { packageDetail } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import DetailRow from '@/components/DetailRow.vue'
import StateBox from '@/components/StateBox.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'

const route = useRoute()
const { data: p, loading, error, savedAt, stale, reload } = useAsync(() => packageDetail(route.params.id as string), null, { key: () => CK.packageDetail(route.params.type as string, route.params.id as string) })
</script>

<template>
  <BackHeader :title="p?.nama ?? 'Detail paket'" :subtitle="route.params.type === 'pt' ? 'Personal Trainer' : 'Membership'" />
  <StateBox :loading="loading" :stale="stale" :saved-at="savedAt" :error="error" @retry="reload">
    <div v-if="p" class="px-5">
      <div class="card p-5">
        <p class="font-display text-3xl text-lime-grit">{{ rupiah(p.harga) }}</p>
        <dl class="mt-3 divide-y divide-white/8">
          <DetailRow label="Durasi" :value="`${p.durasi} ${p.satuan_durasi}`" />
          <DetailRow v-if="p.total_durasi" label="Total hari" :value="`${p.total_durasi} hari`" />
          <DetailRow v-if="p.jumlah_pertemuan" label="Pertemuan" :value="`${p.jumlah_pertemuan} sesi`" />
          <DetailRow label="Tipe" :value="p.tipe" />
          <DetailRow label="Jenis" :value="p.jenis" />
        </dl>
      </div>
      <p class="mt-4 text-center text-xs text-white/50">Untuk mengaktifkan paket, hubungi front desk GritFitness.</p>
    </div>
  </StateBox>
</template>
