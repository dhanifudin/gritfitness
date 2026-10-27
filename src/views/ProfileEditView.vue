<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { profileUpdate } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import SafeImg from '@/components/SafeImg.vue'
import { useAction } from '@/composables/useAction'
import { useOnline } from '@/composables/useSw'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()
const { busy, error, run } = useAction()
const online = useOnline()

const u = auth.user!
const form = reactive({
  nama: u.nama,
  email: u.email ?? '',
  jenis_kelamin: u.jenis_kelamin ?? 'pria',
  tanggal_lahir: u.tanggal_lahir ?? '',
  alamat: u.alamat ?? '',
})
const foto = ref<File | null>(null)
const preview = ref('')
const initial = computed(() => (u.nama[0] ?? 'M').toUpperCase())

function pick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  foto.value = f
  preview.value = f ? URL.createObjectURL(f) : ''
}

async function submit() {
  const fd = new FormData()
  for (const [k, v] of Object.entries(form)) fd.set(k, v)
  if (foto.value) fd.set('foto', foto.value)
  const res = await run(() => profileUpdate(fd))
  if (!res) return
  if (res.user) auth.patchUser(res.user)
  router.replace('/profile')
}
</script>

<template>
  <BackHeader title="Ubah Profil" />
  <form class="space-y-4 px-4 pb-10" @submit.prevent="submit">
    <div class="flex flex-col items-center">
      <label class="relative cursor-pointer">
        <input type="file" accept="image/*" class="hidden" @change="pick" />
        <span class="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#1B2A6B,#E0155A)] text-3xl font-extrabold text-white">
          <img v-if="preview" :src="preview" alt="Pratinjau foto" class="h-full w-full object-cover" />
          <SafeImg v-else-if="u.foto" :src="u.foto" :alt="u.nama" class="h-full w-full object-cover" />
          <template v-else>{{ initial }}</template>
        </span>
        <span class="absolute -right-0.5 -bottom-0.5 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-card bg-grit-500 text-white">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
        </span>
      </label>
      <p class="mt-2 text-xs font-semibold text-mute">Ketuk ikon kamera untuk ganti foto</p>
    </div>

    <label class="block text-[13px] font-bold">Nama
      <input v-model="form.nama" class="input mt-1.5" required />
    </label>
    <label class="block text-[13px] font-bold">Email
      <input v-model="form.email" type="email" class="input mt-1.5" />
    </label>
    <div class="flex gap-2.5">
      <label class="block flex-1 text-[13px] font-bold">Jenis kelamin
        <select v-model="form.jenis_kelamin" class="input mt-1.5">
          <option value="pria">Pria</option>
          <option value="wanita">Wanita</option>
        </select>
      </label>
      <label class="block flex-1 text-[13px] font-bold">Tanggal lahir
        <input v-model="form.tanggal_lahir" type="date" class="input mt-1.5" />
      </label>
    </div>
    <label class="block text-[13px] font-bold">Alamat
      <textarea v-model="form.alamat" rows="2" class="input mt-1.5 !h-auto" />
    </label>
    <label class="block text-[13px] font-bold">Nomor WhatsApp
      <input :value="u.telepon ? '+' + u.telepon : ''" class="input mt-1.5 bg-wash text-mute" readonly />
      <span class="mt-1 block text-xs font-normal text-mute">Nomor tidak dapat diubah — hubungi front desk bila perlu.</span>
    </label>
    <p v-if="!online" class="text-sm text-warn">Perlu koneksi internet untuk menyimpan.</p>
    <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    <button class="btn-primary w-full" :disabled="busy || !online">{{ busy ? 'Menyimpan…' : 'Simpan Perubahan' }}</button>
  </form>
</template>
