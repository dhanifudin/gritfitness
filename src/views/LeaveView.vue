<script setup lang="ts">
import { cutiList } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import StateBox from '@/components/StateBox.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'
import { useAuth } from '@/stores/auth'

const uid = useAuth().user!.id
const { data, loading, error, savedAt, stale, reload } = useAsync(() => cutiList(uid), { data_cuti: [], cek_member: '' }, { key: CK.leave })
</script>

<template>
  <BackHeader title="Cuti Membership" :subtitle="data.cek_member ? `Status membership: ${data.cek_member}` : undefined" />
  <StateBox :loading="loading" :stale="stale" :saved-at="savedAt" :error="error" :empty="!data.data_cuti.length" empty-text="Belum ada pengajuan cuti" @retry="reload">
    <ul class="space-y-3 px-5">
      <li v-for="c in data.data_cuti" :key="c.id" class="card p-4">
        <div class="flex items-start justify-between gap-3">
          <p class="font-semibold">{{ c.status_cuti }}</p>
          <StatusBadge :status="c.status_paket" />
        </div>
        <p v-if="c.tgl_awal" class="mt-1 text-sm text-white/60">{{ c.tgl_awal }} s.d. {{ c.tgl_akhir || '-' }}</p>
        <p class="mt-1 text-sm text-white/50">Alasan: {{ c.nama_kegiatan }}</p>
      </li>
    </ul>
  </StateBox>
  <div class="px-5 pt-4">
    <RouterLink to="/leave/new" class="btn-primary w-full">Ajukan Cuti</RouterLink>
  </div>
</template>
