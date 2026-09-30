<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { cutiSave } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import { useAction } from '@/composables/useAction'

const router = useRouter()
const { busy, error, run } = useAction()
const awal = ref('')
const akhir = ref('')
const keterangan = ref('')
const today = new Date().toISOString().slice(0, 10)
const valid = computed(() => awal.value && akhir.value && akhir.value >= awal.value && keterangan.value.trim())

async function submit() {
  if (!valid.value) return
  const res = await run(() => cutiSave({ awal: awal.value, akhir: akhir.value, keterangan: keterangan.value.trim() }))
  if (res) router.replace('/leave')
}
</script>

<template>
  <BackHeader title="Ajukan Cuti" />
  <form class="space-y-4 px-5" @submit.prevent="submit">
    <label class="block text-sm text-white/60">Tanggal mulai
      <input v-model="awal" type="date" :min="today" class="input mt-1" required />
    </label>
    <label class="block text-sm text-white/60">Tanggal selesai
      <input v-model="akhir" type="date" :min="awal || today" class="input mt-1" required />
    </label>
    <label class="block text-sm text-white/60">Alasan
      <textarea v-model="keterangan" rows="3" class="input mt-1" placeholder="Alasan cuti" required />
    </label>
    <p v-if="error" class="text-sm text-red-300">{{ error }}</p>
    <button class="btn-primary w-full" :disabled="busy || !valid">{{ busy ? 'Mengirim…' : 'Kirim Pengajuan' }}</button>
  </form>
</template>
