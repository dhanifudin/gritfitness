<script setup lang="ts">
import { useRoute } from 'vue-router'
import { membershipDetail } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import DetailRow from '@/components/DetailRow.vue'
import StateBox from '@/components/StateBox.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'

const route = useRoute()
const { data: m, loading, error, savedAt, stale, reload } = useAsync(() => membershipDetail(route.params.id as string), null, { key: () => CK.membershipDetail(route.params.id as string) })
</script>

<template>
  <BackHeader title="Detail membership" :subtitle="m?.kode_registrasi" />
  <StateBox :loading="loading" :stale="stale" :saved-at="savedAt" :error="error" @retry="reload">
    <div v-if="m" class="px-5">
      <div class="card p-5">
        <div class="flex items-start justify-between gap-3">
          <p class="font-semibold">{{ m.nama_paket }}</p>
          <StatusBadge :status="m.status" />
        </div>
        <dl class="mt-3 divide-y divide-white/8">
          <DetailRow label="Nama" :value="m.nama_member" />
          <DetailRow label="Mulai" :value="m.tanggal_mulai" />
          <DetailRow label="Berakhir" :value="m.tanggal_selesai" />
          <DetailRow label="Durasi" :value="m.total_durasi ? `${m.total_durasi} hari` : '-'" />
          <DetailRow label="Harga" :value="m.harga" />
        </dl>
      </div>
      <RouterLink v-if="m.invoice" :to="`/bills/${m.invoice.id}`" class="card mt-3 flex items-center justify-between px-4 py-4 text-sm font-medium">
        Lihat tagihan {{ m.invoice.kode }} <span class="text-white/40">›</span>
      </RouterLink>
    </div>
  </StateBox>
</template>
