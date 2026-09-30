<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { requestOtp } from '@/api/endpoints'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()
const route = useRoute()

const phone = ref('')
const otp = ref('')
const step = ref<'phone' | 'otp'>('phone')
const busy = ref(false)
const error = ref('')

async function send() {
  busy.value = true
  error.value = ''
  try {
    await requestOtp(phone.value.trim())
    step.value = 'otp'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Gagal mengirim OTP'
  } finally {
    busy.value = false
  }
}

async function verify() {
  busy.value = true
  error.value = ''
  try {
    await auth.login(phone.value.trim(), otp.value.trim())
    router.replace((route.query.redirect as string) || '/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'OTP salah'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="safe-t flex min-h-full flex-col justify-center bg-gradient-to-b from-ink-800 to-ink-950 px-6 py-10">
    <div class="mx-auto mb-8 rounded-2xl bg-white px-5 py-3"><img src="/logo.png" alt="GritFitness" class="h-14" /></div>
    <h1 class="font-display text-3xl font-semibold">Masuk member</h1>
    <p class="mt-1 mb-6 text-sm text-white/60">
      {{ step === 'phone' ? 'Masukkan nomor WhatsApp yang terdaftar.' : `Kode OTP dikirim ke ${phone}.` }}
    </p>

    <form v-if="step === 'phone'" class="space-y-4" @submit.prevent="send">
      <input v-model="phone" class="input" type="tel" inputmode="numeric" autocomplete="tel" placeholder="08xxxxxxxxxx" required />
      <button class="btn-primary w-full" :disabled="busy || phone.length < 9">{{ busy ? 'Mengirim…' : 'Kirim OTP' }}</button>
    </form>

    <form v-else class="space-y-4" @submit.prevent="verify">
      <input
        v-model="otp"
        class="input text-center font-display text-2xl tracking-[.5em]"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        placeholder="••••"
        required
      />
      <button class="btn-primary w-full" :disabled="busy || otp.length < 4">{{ busy ? 'Memeriksa…' : 'Masuk' }}</button>
      <button type="button" class="btn-ghost w-full" @click="step = 'phone'">Ganti nomor</button>
    </form>

    <p v-if="error" class="mt-4 text-center text-sm text-red-300">{{ error }}</p>
  </div>
</template>
