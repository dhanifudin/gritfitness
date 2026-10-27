<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { invoiceDetail, uploadBukti } from '@/api/endpoints'
import type { InvoiceDetail } from '@/api/types'
import BackHeader from '@/components/BackHeader.vue'
import SafeImg from '@/components/SafeImg.vue'
import StateBox from '@/components/StateBox.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'

const route = useRoute()
const id = String(route.params.id)
const { data, loading, error, savedAt, stale, reload } = useAsync(() => invoiceDetail(id), null, { key: CK.billDetail(id) })
const inv = computed(() => data.value?.invoice ?? null)
const banks = computed(() => data.value?.bank_accounts ?? [])

const pillOf = computed(() => (inv.value?.status === 'lunas' ? 'pill-ok' : inv.value?.status === 'terlambat' ? 'pill-danger' : 'pill-warn'))

const copied = ref('')
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = text
    setTimeout(() => (copied.value = ''), 1500)
  } catch {
    /* clipboard blocked; the number is visible to copy by hand */
  }
}

// ---- transfer confirmation upload ----
const pengirim = ref('')
const bankId = ref<number | null>(null)
const file = ref<File | null>(null)
const preview = ref('')
const sending = ref(false)
const sendError = ref('')
const sent = ref(false)
function pick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  file.value = f
  preview.value = f ? URL.createObjectURL(f) : ''
}
async function submit() {
  if (!pengirim.value.trim() || !file.value) {
    sendError.value = 'Isi nama pengirim dan pilih foto bukti transfer.'
    return
  }
  sending.value = true
  sendError.value = ''
  try {
    const form = new FormData()
    form.set('pengirim', pengirim.value.trim())
    if (bankId.value != null) form.set('bank_account_id', String(bankId.value))
    form.set('bukti', file.value)
    const res = await uploadBukti(id, form)
    if ((res as InvoiceDetail).invoice) data.value = res as InvoiceDetail
    else await reload()
    sent.value = true
    pengirim.value = ''
    file.value = null
    preview.value = ''
  } catch (e) {
    sendError.value = e instanceof Error ? e.message : 'Gagal mengirim bukti, coba lagi.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <BackHeader title="Instruksi Pembayaran" :subtitle="inv?.nomor" />
  <StateBox :loading="loading" :stale="stale" :saved-at="savedAt" :error="error" @retry="reload">
    <div v-if="inv" class="px-4 pb-6">
      <div class="card p-4 text-center">
        <div class="flex items-center justify-between gap-3 text-left">
          <p class="text-xs font-semibold text-mute">{{ inv.nomor }}</p>
          <span class="pill" :class="pillOf"><span class="pill-dot" aria-hidden="true" />{{ inv.status_label }}</span>
        </div>
        <p v-if="inv.keterangan || inv.jenis_label" class="mt-3 text-sm font-semibold text-soft">{{ inv.keterangan ?? inv.jenis_label }}</p>
        <p class="mt-2 text-xs font-semibold text-mute">Total pembayaran</p>
        <p class="text-[26px] font-extrabold text-grit-500">{{ rupiah(inv.jumlah) }}</p>
        <p class="text-xs font-semibold text-mute">Bayar sebelum {{ inv.jatuh_tempo_label }}</p>
      </div>

      <div v-if="inv.pembayaran" class="card mt-3 p-4" data-testid="payment-status">
        <div class="flex items-center justify-between gap-3">
          <p class="font-extrabold">Konfirmasi Transfer</p>
          <span class="pill" :class="inv.pembayaran.status === 'berhasil' ? 'pill-ok' : inv.pembayaran.status === 'gagal' ? 'pill-danger' : 'pill-warn'">
            <span class="pill-dot" aria-hidden="true" />{{ inv.pembayaran.status_label }}
          </span>
        </div>
        <p class="mt-2 text-[13px] text-soft">
          <template v-if="inv.pembayaran.status === 'pending'">Bukti transfer sedang diverifikasi admin.</template>
          <template v-else-if="inv.pembayaran.status === 'berhasil'">Pembayaran sudah diverifikasi. Terima kasih!</template>
          <template v-else>Bukti ditolak<template v-if="inv.pembayaran.catatan">. Alasan: {{ inv.pembayaran.catatan }}</template> — kirim ulang di bawah.</template>
        </p>
        <SafeImg v-if="inv.pembayaran.bukti_transfer" :src="inv.pembayaran.bukti_transfer" alt="Bukti transfer" class="mt-3 h-28 w-28 rounded-xl border border-line object-cover" />
      </div>

      <template v-if="inv.dapat_dibayar">
        <p class="mt-4 mb-1.5 px-1 text-[15px] font-extrabold">Transfer ke salah satu rekening</p>
        <div class="space-y-2">
          <div v-for="b in banks" :key="b.id" class="card flex items-center gap-3 p-4">
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-mute">{{ b.bank_name }}<template v-if="b.branch"> · {{ b.branch }}</template></p>
              <p class="text-lg font-extrabold tracking-[.5px]">{{ b.account_number }}</p>
              <p class="text-xs font-semibold text-soft">a.n. {{ b.account_holder }}</p>
            </div>
            <button type="button" class="flex shrink-0 items-center gap-1 text-[13px] font-bold text-grit-500" @click="copy(b.account_number)">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>
              {{ copied === b.account_number ? 'Tersalin' : 'Salin' }}
            </button>
          </div>
        </div>

        <div class="card mt-3 p-4">
          <p class="font-extrabold">Cara pembayaran</p>
          <ol class="mt-2 list-decimal space-y-1.5 pl-4 text-[13px] leading-relaxed text-soft">
            <li>Transfer sejumlah {{ rupiah(inv.jumlah) }} ke salah satu rekening di atas.</li>
            <li>Simpan bukti transfer (screenshot/struk).</li>
            <li>Kirim konfirmasi lewat formulir di bawah ini.</li>
            <li>Admin memverifikasi dalam 1×24 jam hari kerja.</li>
          </ol>
        </div>

        <div class="card mt-3 p-4" data-testid="bukti-form">
          <p class="font-extrabold">{{ inv.pembayaran && inv.pembayaran.status !== 'gagal' ? 'Perbarui Bukti Transfer' : 'Konfirmasi Transfer' }}</p>
          <label class="mt-3 block text-[13px] font-bold">Nama pengirim
            <input v-model="pengirim" type="text" class="input mt-1.5" placeholder="Nama di rekening pengirim" />
          </label>
          <label v-if="banks.length" class="mt-3 block text-[13px] font-bold">Bank tujuan
            <select v-model="bankId" class="input mt-1.5">
              <option :value="null" disabled>Pilih bank tujuan</option>
              <option v-for="b in banks" :key="b.id" :value="b.id">{{ b.bank_name }} · {{ b.account_number }}</option>
            </select>
          </label>
          <label class="mt-3 block cursor-pointer rounded-xl border-2 border-dashed border-line p-6 text-center text-mute">
            <input type="file" accept="image/*" class="hidden" @change="pick" />
            <img v-if="preview" :src="preview" alt="Pratinjau bukti" class="mx-auto max-h-40 rounded-lg" />
            <template v-else>
              <svg viewBox="0 0 24 24" class="mx-auto h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
              <span class="mt-2 block text-[13px] font-semibold">Ketuk untuk pilih foto bukti transfer</span>
            </template>
          </label>
          <p v-if="sendError" class="banner banner-err mt-3 !py-2 !text-xs">{{ sendError }}</p>
          <p v-if="sent" class="banner banner-ok mt-3 !py-2 !text-xs">Bukti terkirim — menunggu verifikasi admin.</p>
          <button class="btn-primary mt-4 w-full" :disabled="sending" data-testid="send-bukti" @click="submit">
            {{ sending ? 'Mengirim…' : 'Kirim Konfirmasi' }}
          </button>
        </div>
      </template>

      <RouterLink to="/" class="btn-ghost mt-4 w-full">Selesai</RouterLink>
    </div>
  </StateBox>
</template>
