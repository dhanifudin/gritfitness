<script setup lang="ts">
import { memberships } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'
import { titleCase } from '@/lib/format'

const { data, loading, error, savedAt, stale, reload } = useAsync(memberships, [], { key: CK.memberships })
const pillOf = (m: { aktif: boolean; status: string }) => (m.aktif ? 'pill-ok' : m.status === 'expired' ? 'pill-warn' : 'pill-mute')
const pct = (m: { sisa_hari: number; total_hari: number }) => (m.total_hari > 0 ? Math.max(0, Math.min(100, (m.sisa_hari / m.total_hari) * 100)) : 0)
</script>

<template>
  <BackHeader title="Memberships Saya" />
  <StateBox :loading="loading" :stale="stale" :saved-at="savedAt" :error="error" :empty="!data.length" empty-text="Belum ada riwayat membership" @retry="reload">
    <ul class="space-y-3 px-4 pb-6">
      <li v-for="m in data" :key="m.id">
        <component :is="m.aktif ? 'RouterLink' : 'div'" v-bind="m.aktif ? { to: '/qr' } : {}" class="card block p-4">
          <div class="flex items-start justify-between gap-3">
            <p class="min-w-0 font-extrabold">{{ titleCase(m.tier) }}</p>
            <span class="pill shrink-0" :class="pillOf(m)"><span class="pill-dot" aria-hidden="true" />{{ m.status_label }}</span>
          </div>
          <p class="mt-1 text-sm font-semibold text-mute">{{ m.tanggal_mulai }} – {{ m.aktif_sampai }}</p>
          <template v-if="m.aktif">
            <div class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
              <span class="block h-full rounded-full bg-grit-500" :style="{ width: pct(m) + '%' }" />
            </div>
            <p class="mt-1 text-xs font-semibold text-mute">{{ m.sisa_hari }}/{{ m.total_hari }} hari tersisa</p>
          </template>
        </component>
      </li>
    </ul>
  </StateBox>
</template>
