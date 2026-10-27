<script setup lang="ts">
import { computed } from 'vue'
import { invoices } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'

const { data, loading, error, savedAt, stale, reload } = useAsync(invoices, [], { key: CK.bills })

const unpaid = computed(() => data.value.filter((b) => !b.lunas && b.dapat_dibayar))
const history = computed(() => data.value.filter((b) => b.lunas || !b.dapat_dibayar))
const totalUnpaid = computed(() => unpaid.value.reduce((s, b) => s + b.jumlah, 0))
const pillOf = (status: string, lunas: boolean) => (lunas ? 'pill-ok' : status === 'terlambat' ? 'pill-danger' : 'pill-warn')
</script>

<template>
  <PageHeader title="Tagihan" subtitle="Pembayaran & riwayat" />
  <StateBox :loading="loading" :stale="stale" :saved-at="savedAt" :error="error" :empty="!data.length" empty-text="Belum ada tagihan" @retry="reload">
    <div class="px-4 pb-6">
      <div v-if="unpaid.length" class="rounded-2xl bg-navy p-5 text-center text-white">
        <p class="text-xs font-semibold text-[#cbd5e1]">Total belum dibayar</p>
        <p class="mt-1 text-[27px] font-extrabold tracking-[-.5px]">{{ rupiah(totalUnpaid) }}</p>
        <p class="mt-0.5 text-xs font-semibold text-[#cbd5e1]">{{ unpaid.length }} tagihan menunggu pembayaran</p>
      </div>

      <template v-if="unpaid.length">
        <p class="mt-4 mb-1.5 px-1 text-[15px] font-extrabold">Belum Dibayar</p>
        <div class="space-y-2">
          <RouterLink v-for="b in unpaid" :key="b.id" :to="`/bills/${b.id}`" class="card block p-4">
            <div class="flex items-start justify-between gap-3">
              <p class="min-w-0 truncate font-extrabold">{{ b.judul ?? b.jenis_label }}</p>
              <span class="pill shrink-0" :class="pillOf(b.status, b.lunas)"><span class="pill-dot" aria-hidden="true" />{{ b.status_label }}</span>
            </div>
            <p class="mt-0.5 text-xs font-semibold text-mute">{{ b.nomor }} · Jatuh tempo {{ b.jatuh_tempo_label }}</p>
            <div class="mt-2 flex items-center justify-between">
              <p class="text-lg font-extrabold text-grit-500">{{ rupiah(b.jumlah) }}</p>
              <svg viewBox="0 0 24 24" class="h-4 w-4 text-mute" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </div>
          </RouterLink>
        </div>
      </template>

      <template v-if="history.length">
        <p class="mt-4 mb-1.5 px-1 text-[15px] font-extrabold">Riwayat</p>
        <div class="space-y-2">
          <RouterLink v-for="b in history" :key="b.id" :to="`/bills/${b.id}`" class="card block p-4">
            <div class="flex items-start justify-between gap-3">
              <p class="min-w-0 truncate font-extrabold">{{ b.judul ?? b.jenis_label }}</p>
              <span class="pill shrink-0" :class="pillOf(b.status, b.lunas)"><span class="pill-dot" aria-hidden="true" />{{ b.status_label }}</span>
            </div>
            <p class="mt-0.5 text-xs font-semibold text-mute">{{ b.nomor }} · Jatuh tempo {{ b.jatuh_tempo_label }}</p>
            <p class="mt-2 font-extrabold text-mute">{{ rupiah(b.jumlah) }}</p>
          </RouterLink>
        </div>
      </template>
    </div>
  </StateBox>
</template>
