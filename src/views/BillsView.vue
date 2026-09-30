<script setup lang="ts">
import { tagihan } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { rupiah, useAsync } from '@/composables/useAsync'

const { data, loading, error, reload } = useAsync(tagihan, [])
</script>

<template>
  <PageHeader title="Tagihan" subtitle="Riwayat tagihan" />
  <StateBox :loading="loading" :error="error" :empty="!data.length" empty-text="Belum ada tagihan" @retry="reload">
    <ul class="space-y-3 px-5">
      <li v-for="b in data" :key="b.id">
      <RouterLink :to="`/bills/${b.id}`" class="card block p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate font-semibold">{{ b.paket ?? b.jenis_paket }}</p>
            <p class="text-xs text-white/50">Inv. {{ b.kode }} · {{ b.tanggal_invoice }}</p>
          </div>
          <StatusBadge :status="b.status" />
        </div>
        <div class="mt-3 flex items-center justify-between">
          <p class="font-display text-lg">{{ b.total_rp ?? rupiah(b.total_tagihan) }}</p>
        </div>
      </RouterLink>
      </li>
    </ul>
  </StateBox>
</template>
