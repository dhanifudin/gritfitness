<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackHeader from '@/components/BackHeader.vue'
import { useAction } from '@/composables/useAction'
import { useAuth } from '@/stores/auth'

// "Lengkapi Data": reached after verify-otp answered 'new' (auth.registerToken is set).
// A direct visit without that token can only start from the login screen's OTP flow.
const router = useRouter()
const route = useRoute()
const auth = useAuth()
const submitAction = useAction()

const noHp = String(route.query.no_hp ?? '')
const hasToken = computed(() => !!auth.registerToken)

const form = reactive({
  nama: '',
  email: '',
  jenis_kelamin: 'pria',
  tanggal_lahir: '',
  alamat: '',
  pelajar: '0',
})
const foto = ref<File | null>(null)
const fotoPreview = ref('')
const kartu = ref<File | null>(null)
function pickFoto(e: Event) {
  foto.value = (e.target as HTMLInputElement).files?.[0] ?? null
  fotoPreview.value = foto.value ? URL.createObjectURL(foto.value) : ''
}
const pickKartu = (e: Event) => (kartu.value = (e.target as HTMLInputElement).files?.[0] ?? null)

async function submit() {
  const fd = new FormData()
  for (const [k, v] of Object.entries(form)) fd.set(k, v)
  if (foto.value) fd.set('foto', foto.value)
  if (form.pelajar === '1' && kartu.value) fd.set('foto_kartu_pelajar', kartu.value)
  const res = await submitAction.run(async () => {
    await auth.registerAccount(fd, noHp)
    return true
  })
  if (res) router.replace('/')
}
</script>

<template>
  <BackHeader title="Lengkapi Data" subtitle="Buat akun member GritFitness" />

  <div v-if="!hasToken" class="px-4">
    <div class="card p-6 text-center">
      <p class="font-bold">Mulai dari verifikasi WhatsApp</p>
      <p class="mt-1 text-sm text-mute">Masukkan nomor WhatsApp di halaman masuk — akun baru dibuat setelah kode OTP terverifikasi.</p>
      <RouterLink :to="{ name: 'login' }" class="btn-primary mt-4 w-full">Ke Halaman Masuk</RouterLink>
    </div>
  </div>

  <form v-else class="space-y-4 px-4 pb-10" @submit.prevent="submit">
    <label class="block text-[13px] font-bold">Nomor WhatsApp
      <input :value="noHp" class="input mt-1.5 bg-wash text-mute" type="tel" readonly />
    </label>
    <label class="block text-[13px] font-bold">Nama lengkap<input v-model="form.nama" class="input mt-1.5" required /></label>
    <label class="block text-[13px] font-bold">Email<input v-model="form.email" type="email" class="input mt-1.5" required /></label>
    <div class="flex gap-2.5">
      <label class="block flex-1 text-[13px] font-bold">Jenis kelamin
        <select v-model="form.jenis_kelamin" class="input mt-1.5"><option value="pria">Pria</option><option value="wanita">Wanita</option></select>
      </label>
      <label class="block flex-1 text-[13px] font-bold">Tanggal lahir
        <input v-model="form.tanggal_lahir" type="date" class="input mt-1.5" required />
      </label>
    </div>
    <label class="block text-[13px] font-bold">Alamat<textarea v-model="form.alamat" rows="2" class="input mt-1.5 !h-auto" required /></label>

    <label class="block text-[13px] font-bold">Status keanggotaan
      <select v-model="form.pelajar" class="input mt-1.5"><option value="0">Umum</option><option value="1">Pelajar</option></select>
    </label>
    <label v-if="form.pelajar === '1'" class="block cursor-pointer rounded-xl border-2 border-dashed border-(--input-border) p-5 text-center text-mute">
      <input type="file" accept="image/*" class="hidden" required @change="pickKartu" />
      <span class="text-[13px] font-semibold">{{ kartu ? kartu.name : 'Unggah foto kartu pelajar' }}</span>
    </label>

    <label class="block cursor-pointer rounded-xl border-2 border-dashed border-(--input-border) p-5 text-center text-mute">
      <input type="file" accept="image/*" class="hidden" @change="pickFoto" />
      <img v-if="fotoPreview" :src="fotoPreview" alt="Pratinjau foto" class="mx-auto h-24 w-24 rounded-full object-cover" />
      <span v-else class="text-[13px] font-semibold">Foto profil (opsional)</span>
    </label>

    <p v-if="submitAction.error.value" class="text-sm text-danger">{{ submitAction.error.value }}</p>
    <button class="btn-primary w-full" :disabled="submitAction.busy.value">
      {{ submitAction.busy.value ? 'Mendaftar…' : 'Daftar' }}
    </button>
  </form>
</template>
