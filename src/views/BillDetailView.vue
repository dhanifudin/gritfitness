<script setup lang="ts">
import { useRoute } from 'vue-router'
import { billDetail } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import DetailRow from '@/components/DetailRow.vue'
import StateBox from '@/components/StateBox.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAsync } from '@/composables/useAsync'

const route = useRoute()
const { data: b, loading, error, reload } = useAsync(() => billDetail(route.params.id as string), null)
</script>

<template>
  <BackHeader title="Detail tagihan" :subtitle="b?.kode" />
  <StateBox :loading="loading" :error="error" @retry="reload">
    <div v-if="b" class="px-5">
      <div class="card p-5">
        <div class="flex items-start justify-between gap-3">
          <p class="font-semibold">{{ b.paket }}</p>
          <StatusBadge :status="b.status" />
        </div>
        <dl class="mt-3 divide-y divide-white/8">
          <DetailRow label="Tanggal" :value="b.tanggal" />
          <DetailRow label="Total" :value="b.total_rp" />
          <DetailRow label="Sudah dibayar" :value="b.dibayar_rp" />
          <DetailRow label="Sisa" :value="b.belum_rp" />
        </dl>
      </div>
      <p v-if="b.status !== 'Lunas'" class="mt-4 text-center text-xs text-white/50">Pembayaran dilakukan di front desk GritFitness.</p>
    </div>
  </StateBox>
</template>
