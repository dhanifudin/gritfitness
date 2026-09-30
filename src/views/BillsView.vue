<script setup lang="ts">
import { tagihan } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { rupiah, useAsync } from '@/composables/useAsync'

const { data, loading, error, reload } = useAsync(tagihan, [])
const tone = (s: string) =>
  s === 'Lunas' || s === 'Dibayar' ? 'bg-emerald-500/20 text-emerald-300'
  : s === 'Belum Lunas' ? 'bg-amber-500/20 text-amber-300'
  : 'bg-red-500/20 text-red-300'
</script>

<template>
  <PageHeader title="Tagihan" subtitle="Riwayat dan pembayaran" />
  <StateBox :loading="loading" :error="error" :empty="!data.length" empty-text="Belum ada tagihan" @retry="reload">
    <ul class="space-y-3 px-5">
      <li v-for="b in data" :key="b.id" class="card p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate font-semibold">{{ b.paket ?? b.jenis_paket }}</p>
            <p class="text-xs text-white/50">Inv. {{ b.kode }} · {{ b.tanggal_invoice }}</p>
          </div>
          <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" :class="tone(b.status)">{{ b.status }}</span>
        </div>
        <div class="mt-3 flex items-center justify-between">
          <p class="font-display text-lg">{{ b.total_rp ?? rupiah(b.total_tagihan) }}</p>
          <a v-if="b.invoice_url && b.status !== 'Lunas' && b.status !== 'Expired'" :href="b.invoice_url" class="btn-primary !py-2">Bayar</a>
        </div>
      </li>
    </ul>
  </StateBox>
</template>
