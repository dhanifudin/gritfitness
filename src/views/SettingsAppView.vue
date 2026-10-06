<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BackHeader from '@/components/BackHeader.vue'
import ConfirmSheet from '@/components/ConfirmSheet.vue'
import { checkForUpdate } from '@/composables/useSw'
import { useAuth } from '@/stores/auth'
import { useTracker } from '@/stores/tracker'

const auth = useAuth()
const tracker = useTracker()
const router = useRouter()
onMounted(() => tracker.init())

const version = __APP_VERSION__
const checking = ref(false)
const updateMsg = ref('')
async function checkUpdate() {
  checking.value = true
  updateMsg.value = ''
  const r = await checkForUpdate()
  updateMsg.value = r === 'available' ? 'Versi baru ditemukan — akan dipasang saat Anda berpindah halaman.' : r === 'latest' ? 'Sudah versi terbaru.' : 'Pembaruan otomatis tidak aktif di mode ini.'
  checking.value = false
}

const confirmOut = ref(false)
const outBusy = ref(false)
const outMessage = computed(
  () => 'QR offline di perangkat ini akan dihapus.' + (tracker.localOnly || !tracker.consented ? ' Progres yang hanya tersimpan di perangkat ini akan hilang permanen.' : ''),
)
async function out() {
  outBusy.value = true
  try {
    await auth.logout()
    router.replace({ name: 'login' })
  } finally {
    outBusy.value = false
    confirmOut.value = false
  }
}
</script>

<template>
  <BackHeader title="Aplikasi & akun" />
  <div class="space-y-3 px-5">
    <section class="card p-4">
      <p class="text-xs text-white/50">Versi aplikasi</p>
      <p class="mt-1 font-semibold">{{ version.sha }} · {{ version.date }}</p>
      <button class="btn-ghost mt-3 w-full disabled:opacity-50" :disabled="checking" data-testid="check-update" @click="checkUpdate">
        {{ checking ? 'Memeriksa…' : 'Periksa pembaruan' }}
      </button>
      <p v-if="updateMsg" class="mt-2 text-center text-xs text-white/55">{{ updateMsg }}</p>
    </section>

    <section class="card p-4">
      <p class="font-semibold">Akun</p>
      <p class="mt-1 text-sm text-white/65">{{ auth.user?.nama }} · {{ auth.user?.no_hp }}</p>
      <button class="btn-ghost mt-3 w-full !text-red-300" data-testid="logout" @click="confirmOut = true">Keluar</button>
    </section>
  </div>

  <ConfirmSheet
    :open="confirmOut"
    title="Keluar dari akun?"
    :message="outMessage"
    confirm-label="Ya, keluar"
    danger
    :busy="outBusy"
    @confirm="out"
    @close="confirmOut = false"
  />
</template>
