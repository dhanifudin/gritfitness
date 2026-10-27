<script setup lang="ts">
import { computed } from 'vue'
import { cutiList } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'

const { data, loading, error, savedAt, stale, reload } = useAsync(cutiList, [], { key: CK.leave })

const pending = computed(() => data.value.filter((c) => c.status === 'pending'))
const history = computed(() => data.value.filter((c) => c.status !== 'pending'))
const pillOf = (status: string) => (status === 'pending' ? 'pill-warn' : status === 'ditolak' ? 'pill-danger' : status === 'disetujui' ? 'pill-navy' : 'pill-ok')
</script>

<template>
  <BackHeader title="Cuti Membership" />

  <div class="px-4 pb-3">
    <div class="rounded-2xl bg-navy p-4 text-white">
      <p class="font-extrabold">Butuh jeda latihan?</p>
      <p class="mt-1 text-[13px] text-[#cbd5e1]">Selama cuti, membership dibekukan dan masa aktif diperpanjang sesuai durasi cuti.</p>
      <RouterLink to="/leave/new" class="btn-primary mt-3 !min-h-10 !px-5 !py-2 text-sm">Ajukan Cuti</RouterLink>
    </div>
  </div>

  <StateBox :loading="loading" :stale="stale" :saved-at="savedAt" :error="error" :empty="!data.length" empty-text="Belum ada pengajuan cuti" @retry="reload">
    <div class="px-4 pb-6">
      <template v-if="pending.length">
        <p class="mt-2 mb-1.5 px-1 text-[15px] font-extrabold">Sedang Diajukan</p>
        <div class="space-y-2">
          <div v-for="(c, i) in pending" :key="i" class="card p-4">
            <div class="flex items-start justify-between gap-3">
              <p class="font-extrabold">{{ c.durasi }} hari</p>
              <span class="pill" :class="pillOf(c.status)"><span class="pill-dot" aria-hidden="true" />{{ c.status_label }}</span>
            </div>
            <p class="mt-1 text-sm font-semibold text-mute">{{ c.tanggal_mulai }} s.d. {{ c.tanggal_selesai }}</p>
            <p v-if="c.alasan" class="mt-1 text-sm text-soft">{{ c.alasan }}</p>
            <p class="mt-1.5 text-xs text-mute">Menunggu persetujuan admin.</p>
          </div>
        </div>
      </template>
      <template v-if="history.length">
        <p class="mt-4 mb-1.5 px-1 text-[15px] font-extrabold">Riwayat Cuti</p>
        <div class="space-y-2">
          <div v-for="(c, i) in history" :key="i" class="card p-4">
            <div class="flex items-start justify-between gap-3">
              <p class="font-extrabold">{{ c.durasi }} hari</p>
              <span class="pill" :class="pillOf(c.status)"><span class="pill-dot" aria-hidden="true" />{{ c.status_label }}</span>
            </div>
            <p class="mt-1 text-sm font-semibold text-mute">{{ c.tanggal_mulai }} s.d. {{ c.tanggal_selesai }}</p>
            <p v-if="c.alasan" class="mt-1 text-sm text-soft">{{ c.alasan }}</p>
          </div>
        </div>
      </template>
    </div>
  </StateBox>
</template>
