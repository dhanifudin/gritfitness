<script setup lang="ts">
import { jadwalKelas } from '@/api/endpoints'
import PageHeader from '@/components/PageHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { assetUrl, useAsync } from '@/composables/useAsync'

const { data, loading, error, reload } = useAsync(jadwalKelas, [])
</script>

<template>
  <PageHeader title="Jadwal Kelas" subtitle="Kelas yang tersedia" />
  <StateBox :loading="loading" :error="error" :empty="!data.length" empty-text="Belum ada jadwal kelas" @retry="reload">
    <ul class="space-y-3 px-5">
      <li v-for="j in data" :key="j.id" class="card flex gap-3 p-3">
        <img :src="assetUrl(j.foto_url)" :alt="j.nama_kelas" loading="lazy" class="h-24 w-24 shrink-0 rounded-xl object-cover" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-display text-lg leading-tight">{{ j.nama_jadwal_kelas }}</p>
          <p class="text-sm text-white/55">{{ j.nama_kelas }}<template v-if="j.instruktur"> · {{ j.instruktur }}</template></p>
          <p class="mt-1 text-sm">{{ j.tanggal }} · {{ j.jam_awal }}–{{ j.jam_akhir }}</p>
          <p class="mt-1 text-xs text-brand-300">{{ j.peserta }}/{{ j.maksimal_member }} peserta</p>
        </div>
      </li>
    </ul>
  </StateBox>
</template>
