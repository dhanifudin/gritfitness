<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { profileUpdate } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import { useAction } from '@/composables/useAction'
import { useOnline } from '@/composables/useSw'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()
const { busy, error, run } = useAction()
const online = useOnline()

// API stores dates as DD/MM/YYYY; <input type=date> wants YYYY-MM-DD
const toInput = (d: string | null) => {
  if (!d) return ''
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d.slice(0, 10)
}

const u = auth.user!
const form = reactive({
  nama: u.nama,
  email: u.email ?? '',
  alamat: u.alamat ?? '',
  no_hp: u.no_hp,
  tanggal_lahir: toInput(u.tanggal_lahir),
  jenis_kelamin: u.jenis_kelamin ?? '',
})
const foto = ref<File | null>(null)
const preview = ref('')

function pick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  foto.value = f
  preview.value = f ? URL.createObjectURL(f) : ''
}

async function submit() {
  const fd = new FormData()
  for (const [k, v] of Object.entries(form)) fd.append(k, v)
  if (foto.value) fd.append('foto', foto.value)
  const res = await run(() => profileUpdate(fd))
  if (!res) return
  // server echoes the saved profile either at the top level or under `data`
  const saved = ((res as Record<string, unknown>).data ?? res) as Partial<typeof u>
  auth.patchUser({ ...form, ...(saved.foto ? { foto: saved.foto } : {}) })
  router.replace('/profile')
}
</script>

<template>
  <BackHeader title="Ubah Profil" />
  <form class="space-y-4 px-5" @submit.prevent="submit">
    <label class="block text-sm text-white/50">Nama
      <input v-model="form.nama" class="input mt-1" required />
    </label>
    <label class="block text-sm text-white/50">No. HP
      <input v-model="form.no_hp" type="tel" inputmode="numeric" class="input mt-1" required />
    </label>
    <label class="block text-sm text-white/50">Email
      <input v-model="form.email" type="email" class="input mt-1" />
    </label>
    <label class="block text-sm text-white/50">Tanggal lahir
      <input v-model="form.tanggal_lahir" type="date" class="input mt-1" />
    </label>
    <label class="block text-sm text-white/50">Jenis kelamin
      <select v-model="form.jenis_kelamin" class="input mt-1">
        <option value="">Pilih</option>
        <option>Laki-Laki</option>
        <option>Perempuan</option>
      </select>
    </label>
    <label class="block text-sm text-white/50">Alamat
      <textarea v-model="form.alamat" rows="2" class="input mt-1" />
    </label>
    <label class="block text-sm text-white/50">Foto
      <input type="file" accept="image/*" class="input mt-1" @change="pick" />
    </label>
    <img v-if="preview" :src="preview" alt="Pratinjau" class="h-24 w-24 rounded-xl object-cover" />
    <p v-if="!online" class="text-sm text-amber-300">Perlu koneksi internet untuk menyimpan.</p>
    <p v-if="error" class="text-sm text-red-300">{{ error }}</p>
    <button class="btn-primary w-full" :disabled="busy || !online">{{ busy ? 'Menyimpan…' : 'Simpan' }}</button>
  </form>
</template>
