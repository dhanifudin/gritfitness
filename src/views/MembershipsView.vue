<script setup lang="ts">
import { memberships } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAsync } from '@/composables/useAsync'
import { useAuth } from '@/stores/auth'

const uid = useAuth().user!.id
const { data, loading, error, reload } = useAsync(() => memberships(uid), [])
</script>

<template>
  <PageHeader title="Riwayat Membership" />
  <StateBox :loading="loading" :error="error" :empty="!data.length" empty-text="Belum ada riwayat membership" @retry="reload">
    <ul class="space-y-3 px-5">
      <li v-for="m in data" :key="m.id">
        <RouterLink :to="`/memberships/${m.id}`" class="card block p-4">
          <div class="flex items-start justify-between gap-3">
            <p class="font-semibold">{{ m.nama_paket }}</p>
            <StatusBadge :status="m.status" />
          </div>
          <p class="mt-1 text-sm text-white/55">{{ m.tanggal_mulai }} – {{ m.tanggal_selesai }}</p>
        </RouterLink>
      </li>
    </ul>
  </StateBox>
</template>
