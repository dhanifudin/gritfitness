<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { progressList, progressSave } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import { useAction } from '@/composables/useAction'
import { useOnline } from '@/composables/useSw'
import { CK, invalidate, read } from '@/lib/dataCache'

// Official "Tambah Progress" (pages/progress-new.f7.html): posts the measurement to the gym's
// /progress endpoint; BMI is computed server-side from berat + tinggi.
const router = useRouter()
const { busy, error, run } = useAction()
const online = useOnline()

const berat = ref('')
const tinggi = ref('')
const lemak = ref('')
const otot = ref('')
const tanggal = ref(new Date().toISOString().slice(0, 10))
const catatan = ref('')
const formError = ref('')

onMounted(async () => {
  // prefill tinggi from the latest measurement (it rarely changes)
  const cached = read<Awaited<ReturnType<typeof progressList>>>(CK.progress)?.data ?? (await progressList().catch(() => null))
  if (cached?.latest?.tinggi_cm) tinggi.value = String(cached.latest.tinggi_cm)
})

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

async function submit() {
  formError.value = ''
  const b = num(berat.value)
  const t = num(tinggi.value)
  if (!b || !t) return void (formError.value = 'Berat dan tinggi wajib diisi.')
  const payload: Parameters<typeof progressSave>[0] = { berat_kg: b, tinggi_cm: t }
  const lm = num(lemak.value)
  if (lm != null) payload.lemak_persen = lm
  const ot = num(otot.value)
  if (ot != null) payload.massa_otot_kg = ot
  if (tanggal.value) payload.diukur_pada = tanggal.value
  if (catatan.value.trim()) payload.catatan = catatan.value.trim()
  const res = await run(() => progressSave(payload))
  if (res) {
    invalidate(CK.progress)
    router.back()
  }
}
</script>

<template>
  <BackHeader title="Tambah Progress" />
  <form class="space-y-4 px-4 pb-10" @submit.prevent="submit">
    <div class="rounded-2xl bg-navy p-4 text-[13px] leading-relaxed text-[#e2e8f0]">
      Catat pengukuran tubuhmu. BMI dihitung otomatis dari berat dan tinggi.
    </div>

    <div class="card space-y-3.5 p-4">
      <div class="flex gap-2.5">
        <label class="block flex-1 text-[13px] font-bold">Berat (kg)
          <input v-model="berat" type="text" inputmode="decimal" class="input mt-1.5" placeholder="mis. 70.5" data-testid="p-berat" />
        </label>
        <label class="block flex-1 text-[13px] font-bold">Tinggi (cm)
          <input v-model="tinggi" type="text" inputmode="decimal" class="input mt-1.5" placeholder="mis. 175" data-testid="p-tinggi" />
        </label>
      </div>
      <div class="flex gap-2.5">
        <label class="block flex-1 text-[13px] font-bold">Lemak Tubuh (%)
          <input v-model="lemak" type="text" inputmode="decimal" class="input mt-1.5" placeholder="opsional" />
        </label>
        <label class="block flex-1 text-[13px] font-bold">Massa Otot (kg)
          <input v-model="otot" type="text" inputmode="decimal" class="input mt-1.5" placeholder="opsional" />
        </label>
      </div>
      <label class="block text-[13px] font-bold">Tanggal Ukur
        <input v-model="tanggal" type="date" :max="new Date().toISOString().slice(0, 10)" class="input mt-1.5" />
      </label>
      <label class="block text-[13px] font-bold">Catatan
        <textarea v-model="catatan" rows="2" class="input mt-1.5 !h-auto" placeholder="opsional — mis. setelah program 4 minggu" />
      </label>
    </div>

    <p v-if="!online" class="text-sm text-warn">Perlu koneksi internet untuk menyimpan.</p>
    <p v-if="formError || error" class="text-sm text-danger">{{ formError || error }}</p>
    <button class="btn-primary w-full" :disabled="busy || !online" data-testid="p-save">{{ busy ? 'Menyimpan…' : 'Simpan Progress' }}</button>
  </form>
</template>
