<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { requestOtp } from '@/api/endpoints'
import { clearLastPhone, getLastPhone } from '@/lib/lastPhone'
import { useAuth } from '@/stores/auth'

// One WhatsApp-OTP flow for login AND signup, like the official app: verify-otp answers
// 'registered' (straight in) or 'new' (continue to the registration form).
const auth = useAuth()
const router = useRouter()
const route = useRoute()

const remembered = ref(getLastPhone())
const phone = ref(remembered.value ?? '')
const otp = ref('')
const step = ref<'phone' | 'otp'>('phone')
const busy = ref(false)
const error = ref('')
const info = ref('')
const otpInput = ref<HTMLInputElement | null>(null)

// resend cooldown, mirroring the server's 60s OtpService cooldown
const cooldown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
function startCooldown(s: number) {
  cooldown.value = s
  clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) clearInterval(timer)
  }, 1000)
}
onUnmounted(() => clearInterval(timer))

function forgetPhone() {
  clearLastPhone()
  remembered.value = null
  phone.value = ''
}

async function send() {
  busy.value = true
  error.value = ''
  try {
    const res = await requestOtp(phone.value.trim())
    info.value = res.message ?? ''
    startCooldown(res.cooldown_seconds ?? 60)
    step.value = 'otp'
    await nextTick()
    otpInput.value?.focus()
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
    const status = await auth.login(phone.value.trim(), otp.value.trim())
    if (status === 'new') {
      void router.replace({ name: 'register', query: { no_hp: phone.value.trim() } })
      return
    }
    router.replace((route.query.redirect as string) || '/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'OTP salah'
  } finally {
    busy.value = false
  }
}
const canResend = computed(() => cooldown.value <= 0 && !busy.value)
</script>

<template>
  <div class="safe-t px-6 pt-10 pb-10">
    <img src="/logo.png" alt="GritFitness" class="mx-auto h-24 rounded-2xl" />
    <h1 class="mt-8 text-center text-2xl font-extrabold">Daftar/Masuk dengan WhatsApp</h1>
    <p class="mt-1.5 mb-6 text-center text-sm font-semibold text-mute">
      {{ step === 'phone' ? 'Masukkan nomor WhatsApp kamu. Kode OTP dikirim via WhatsApp.' : `Kode dikirim via WhatsApp ke ${phone}.` }}
    </p>

    <form v-if="step === 'phone'" class="space-y-4" @submit.prevent="send">
      <label class="block">
        <span class="sr-only">Nomor WhatsApp</span>
        <input v-model="phone" class="input !h-[52px]" type="tel" inputmode="numeric" autocomplete="tel" placeholder="08xxxxxxxxxx" required />
      </label>
      <button class="btn-primary w-full" :disabled="busy || phone.length < 9">{{ busy ? 'Mengirim…' : 'Kirim Kode OTP' }}</button>
      <button v-if="remembered" type="button" class="btn-ghost w-full" @click="forgetPhone">Bukan Anda? Ganti nomor</button>
      <p class="text-center text-xs text-mute">Nomor baru akan diarahkan untuk melengkapi data member.</p>
    </form>

    <form v-else class="space-y-4" @submit.prevent="verify">
      <label class="block">
        <span class="sr-only">Kode OTP</span>
        <input
          ref="otpInput"
          v-model="otp"
          class="input !h-[64px] text-center text-[26px] font-extrabold tracking-[.5em]"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="••••"
          required
        />
      </label>
      <button class="btn-primary w-full" :disabled="busy || otp.length < 4">{{ busy ? 'Memeriksa…' : 'Masuk' }}</button>
      <button type="button" class="btn-ghost w-full" :disabled="!canResend" :class="!canResend ? 'opacity-45' : ''" @click="send">
        {{ cooldown > 0 ? `Kirim ulang (${cooldown}s)` : 'Belum menerima kode? Kirim ulang' }}
      </button>
      <button type="button" class="w-full py-2 text-center text-sm font-bold text-mute" @click="step = 'phone'">Ganti nomor</button>
    </form>

    <p v-if="info && step === 'otp'" class="mt-4 text-center text-xs text-mute">{{ info }}</p>
    <p v-if="route.query.registered" class="mt-4 text-center text-sm text-ok">Pendaftaran berhasil. Silakan masuk.</p>
    <p v-if="error" class="mt-4 text-center text-sm text-danger">{{ error }}</p>
  </div>
</template>
