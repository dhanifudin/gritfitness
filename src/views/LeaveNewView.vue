<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { cutiSave } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import { useAction } from '@/composables/useAction'
import { useOnline } from '@/composables/useSw'
import { invalidate } from '@/lib/dataCache'

const router = useRouter()
const { busy, error, run } = useAction()
const online = useOnline()
const awal = ref('')
const akhir = ref('')
const alasan = ref('')
const today = new Date().toISOString().slice(0, 10)
const durasi = computed(() => {
  if (!awal.value || !akhir.value) return null
  const d = Math.round((Date.parse(akhir.value) - Date.parse(awal.value)) / 86_400_000) + 1
  return d >= 1 ? d : null
})
const valid = computed(() => !!durasi.value && !!alasan.value.trim())

async function submit() {
  if (!valid.value) return
  const res = await run(() => cutiSave({ tanggal_mulai: awal.value, tanggal_selesai: akhir.value, alasan: alasan.value.trim() }))
  if (res) {
    invalidate('leave')
    router.replace('/leave')
  }
}
</script>

<template>
  <BackHeader title="Ajukan Cuti" />
  <form class="space-y-4 px-4" @submit.prevent="submit">
    <div class="rounded-2xl bg-navy p-4 text-[13px] leading-relaxed text-[#cbd5e1]">
      Membership dibekukan selama cuti dan masa aktif diperpanjang otomatis sesuai durasi yang disetujui.
    </div>
    <label class="block text-[13px] font-bold">Tanggal mulai
      <input v-model="awal" type="date" :min="today" class="input mt-1.5" required />
    </label>
    <label class="block text-[13px] font-bold">Tanggal selesai
      <input v-model="akhir" type="date" :min="awal || today" class="input mt-1.5" required />
    </label>
    <p v-if="awal && akhir" class="text-sm font-semibold" :class="durasi ? 'text-soft' : 'text-danger'">
      {{ durasi ? `Durasi cuti: ${durasi} hari` : 'Tanggal selesai harus setelah tanggal mulai.' }}
    </p>
    <label class="block text-[13px] font-bold">Alasan
      <textarea v-model="alasan" rows="3" class="input mt-1.5 !h-auto" placeholder="Alasan cuti" required />
    </label>
    <p v-if="!online" class="text-sm text-warn">Perlu koneksi internet untuk mengirim pengajuan.</p>
    <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    <button class="btn-primary w-full" :disabled="busy || !valid || !online">{{ busy ? 'Mengirim…' : 'Kirim Pengajuan' }}</button>
  </form>
</template>
