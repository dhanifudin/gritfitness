<script setup lang="ts">
import DOMPurify from 'dompurify'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { paketKelasDetail } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import DetailRow from '@/components/DetailRow.vue'
import SafeImg from '@/components/SafeImg.vue'
import StateBox from '@/components/StateBox.vue'
import { assetUrl, rupiah, useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'

const route = useRoute()
const { data: p, loading, error, savedAt, stale, reload } = useAsync(() => paketKelasDetail(route.params.id as string), null, { key: () => CK.packageDetail('class', route.params.id as string) })
const html = computed(() => DOMPurify.sanitize(p.value?.deskripsi ?? ''))
</script>

<template>
  <BackHeader :title="p?.nama ?? 'Detail kelas'" :subtitle="p?.kategori" />
  <StateBox :loading="loading" :stale="stale" :saved-at="savedAt" :error="error" @retry="reload">
    <div v-if="p" class="px-5">
      <SafeImg v-if="p.foto" :src="assetUrl('/storage/kelas/' + p.foto)" :alt="p.nama" class="mb-4 h-48 w-full rounded-2xl object-cover" />
      <div class="card p-4">
        <p class="font-display text-3xl">{{ rupiah(p.harga) }}</p>
        <dl class="mt-3 divide-y divide-white/8">
          <DetailRow label="Durasi" :value="`${p.durasi_waktu} menit`" />
          <DetailRow label="Kapasitas" :value="`${p.maksimal_member} peserta`" />
          <DetailRow label="Instruktur" :value="p.instruktur" />
        </dl>
      </div>
      <div v-if="html" class="card mt-3 p-4 text-sm leading-relaxed text-white/70 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2" v-html="html" />
      <template v-if="p.jadwal?.length">
        <h2 class="mt-3 mb-2 font-display text-lg">Jadwal</h2>
        <ul class="space-y-2">
          <li v-for="j in p.jadwal" :key="j.id">
            <RouterLink :to="`/classes/${j.id}`" class="card flex justify-between px-4 py-3 text-sm">
              <span>{{ j.tanggal }}</span><span class="text-white/50">{{ j.jam_awal }}–{{ j.jam_akhir }}</span>
            </RouterLink>
          </li>
        </ul>
      </template>
    </div>
  </StateBox>
</template>
