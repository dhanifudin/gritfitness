<script setup lang="ts">
import { nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { regionSearch, register, registerOtp } from '@/api/endpoints'
import type { Region } from '@/api/types'
import BackHeader from '@/components/BackHeader.vue'
import { useAction } from '@/composables/useAction'

const router = useRouter()
const otpAction = useAction()
const submitAction = useAction()

const form = reactive({
  nama: '', email: '', noHp: '', alamat: '', kota: '', jenisKelamin: 'Laki-Laki',
  daftar_pelajar: 'Tidak', otp: '', tanggal_lahir: '',
})
const foto = ref<File | null>(null)
const fotoPelajar = ref<File | null>(null)
const otpSent = ref(false)
const otpInput = ref<HTMLInputElement | null>(null)

const cityQuery = ref('')
const cities = ref<Region[]>([])
let timer: ReturnType<typeof setTimeout>
watch(cityQuery, (q) => {
  clearTimeout(timer)
  if (q.trim().length < 3) return void (cities.value = [])
  timer = setTimeout(async () => (cities.value = await regionSearch(q.trim()).catch(() => [])), 300)
})

const pickFoto = (e: Event) => (foto.value = (e.target as HTMLInputElement).files?.[0] ?? null)
const pickPelajar = (e: Event) => (fotoPelajar.value = (e.target as HTMLInputElement).files?.[0] ?? null)

async function sendOtp() {
  otpSent.value = !!(await otpAction.run(() => registerOtp(form.noHp.trim())))
  if (otpSent.value) {
    await nextTick()
    otpInput.value?.focus()
  }
}

async function submit() {
  const fd = new FormData()
  for (const [k, v] of Object.entries(form)) fd.append(k, v)
  if (foto.value) fd.append('foto', foto.value)
  if (form.daftar_pelajar === 'Ya' && fotoPelajar.value) fd.append('foto_pelajar', fotoPelajar.value)
  const res = await submitAction.run(() => register(fd))
  if (res) router.replace({ name: 'login', query: { registered: '1' } })
}
</script>

<template>
  <BackHeader title="Daftar Member" subtitle="Buat akun GritFitness" />
  <form class="space-y-4 px-5 pb-10" @submit.prevent="submit">
    <label class="block text-sm text-white/50">Nama lengkap<input v-model="form.nama" class="input mt-1" required /></label>
    <label class="block text-sm text-white/50">Email<input v-model="form.email" type="email" class="input mt-1" required /></label>
    <label class="block text-sm text-white/50">Tanggal lahir<input v-model="form.tanggal_lahir" type="date" class="input mt-1" required /></label>
    <label class="block text-sm text-white/50">Jenis kelamin
      <select v-model="form.jenisKelamin" class="input mt-1"><option>Laki-Laki</option><option>Perempuan</option></select>
    </label>
    <label class="block text-sm text-white/50">Alamat<textarea v-model="form.alamat" rows="2" class="input mt-1" required /></label>

    <div>
      <label class="block text-sm text-white/50">Kota
        <input v-model="cityQuery" class="input mt-1" placeholder="Cari nama kota…" />
      </label>
      <select v-model="form.kota" class="input mt-2" :disabled="!cities.length" required>
        <option value="" disabled>{{ cities.length ? 'Pilih kota' : 'Ketik minimal 3 huruf' }}</option>
        <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.text }}</option>
      </select>
    </div>

    <label class="block text-sm text-white/50">Foto (opsional)<input type="file" accept="image/*" class="input mt-1" @change="pickFoto" /></label>
    <label class="block text-sm text-white/50">Pendaftar pelajar?
      <select v-model="form.daftar_pelajar" class="input mt-1"><option>Tidak</option><option>Ya</option></select>
    </label>
    <label v-if="form.daftar_pelajar === 'Ya'" class="block text-sm text-white/50">Kartu pelajar
      <input type="file" accept="image/*" class="input mt-1" required @change="pickPelajar" />
    </label>

    <label class="block text-sm text-white/50">No. WhatsApp<input v-model="form.noHp" type="tel" inputmode="numeric" class="input mt-1" required /></label>
    <button type="button" class="btn-ghost w-full" :disabled="otpAction.busy.value || form.noHp.length < 9" @click="sendOtp">
      {{ otpAction.busy.value ? 'Mengirim…' : otpSent ? 'Kirim ulang OTP' : 'Kirim OTP' }}
    </button>
    <p v-if="otpAction.error.value" class="text-sm text-red-300">{{ otpAction.error.value }}</p>
    <input v-if="otpSent" ref="otpInput" v-model="form.otp" class="input text-center font-display text-2xl tracking-[.4em]" inputmode="numeric" maxlength="6" placeholder="OTP" required />

    <p v-if="submitAction.error.value" class="text-sm text-red-300">{{ submitAction.error.value }}</p>
    <button class="btn-primary w-full" :disabled="submitAction.busy.value || !otpSent || !form.otp">
      {{ submitAction.busy.value ? 'Mendaftar…' : 'Daftar' }}
    </button>
  </form>
</template>
