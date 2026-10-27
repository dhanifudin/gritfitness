<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { paketDetail, ptPaketBuy, ptPaketDetail, subscribe } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import ConfirmSheet from '@/components/ConfirmSheet.vue'
import StateBox from '@/components/StateBox.vue'
import { rupiah, useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'
import { titleCase } from '@/lib/format'

const route = useRoute()
const router = useRouter()
const isPt = route.params.type === 'pt'
const id = String(route.params.id)

const membership = useAsync(() => paketDetail(id), null, { key: isPt ? undefined : CK.packageDetail('membership', id) })
const pt = useAsync(() => ptPaketDetail(id), null, { key: isPt ? CK.packageDetail('pt', id) : undefined })
const src = isPt ? pt : membership
const p = computed(() => membership.data.value)
const q = computed(() => pt.data.value)

const months = computed(() => (p.value ? Math.round(p.value.durasi_hari / 30) : 0))

// Subscribe/buy → the new invoice's payment screen
const confirming = ref(false)
const busy = ref(false)
const buyError = ref('')
const cta = computed(() => (isPt ? 'Beli Paket Ini' : p.value?.is_tier_aktif ? 'Perpanjang Paket Ini' : 'Langganan Paket Ini'))
async function confirmBuy() {
  busy.value = true
  buyError.value = ''
  try {
    const res = isPt ? await ptPaketBuy(Number(id)) : await subscribe(Number(id))
    confirming.value = false
    void router.push(`/bills/${res.invoice.id}`)
  } catch (e) {
    buyError.value = e instanceof Error ? e.message : 'Gagal membuat tagihan, coba lagi.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BackHeader :title="titleCase(isPt ? q?.nama : p?.nama) || 'Detail Paket'" :subtitle="isPt ? 'Personal Trainer' : 'Membership'" />
  <StateBox :loading="src.loading.value" :stale="src.stale.value" :saved-at="src.savedAt.value" :error="src.error.value" @retry="src.reload()">
    <div class="px-4 pb-6">
      <template v-if="isPt && q">
        <div class="card p-4">
          <p class="font-extrabold">{{ titleCase(q.nama) }}</p>
          <p class="mt-2 text-2xl font-extrabold text-grit-500">{{ rupiah(q.harga) }}</p>
        </div>
        <div class="card mt-3 p-4 text-sm">
          <div class="flex justify-between border-b border-line py-2.5"><span class="font-semibold text-mute">Jumlah Sesi</span><span class="font-bold">{{ q.jumlah_sesi }} sesi</span></div>
          <div class="flex justify-between border-b border-line py-2.5"><span class="font-semibold text-mute">Harga per Sesi</span><span class="font-bold">{{ rupiah(q.harga_per_sesi) }}</span></div>
          <div class="flex justify-between border-b border-line py-2.5"><span class="font-semibold text-mute">Masa Berlaku</span><span class="font-bold">{{ q.masa_berlaku_hari }} hari</span></div>
          <div class="flex justify-between py-2.5"><span class="font-semibold text-mute">Total</span><span class="font-extrabold text-grit-500">{{ rupiah(q.harga) }}</span></div>
        </div>
      </template>

      <template v-else-if="p">
        <div class="card p-4">
          <p class="font-extrabold">{{ titleCase(p.nama) }}</p>
          <p v-if="p.deskripsi" class="mt-1 text-sm text-soft">{{ p.deskripsi }}</p>
          <p class="mt-2 text-2xl font-extrabold text-grit-500">{{ rupiah(p.harga) }}</p>
          <p class="text-xs font-semibold text-mute">Masa aktif {{ months }} bulan ({{ p.durasi_hari }} hari)</p>
        </div>
        <div v-if="p.benefit?.length" class="card mt-3 p-4">
          <p class="text-[15px] font-extrabold">Benefit</p>
          <ul class="mt-2 space-y-1.5 text-[13px] font-semibold text-soft">
            <li v-for="(b, i) in p.benefit" :key="i" class="flex gap-2">
              <svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0 text-ok" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
              <span>{{ b }}</span>
            </li>
          </ul>
        </div>
        <div v-if="p.syarat_ketentuan?.length" class="card mt-3 p-4">
          <p class="text-[15px] font-extrabold">Syarat & Ketentuan</p>
          <ol class="mt-2 list-decimal space-y-1.5 pl-4 text-[13px] leading-relaxed text-soft">
            <li v-for="(s, i) in p.syarat_ketentuan" :key="i">{{ s }}</li>
          </ol>
        </div>
      </template>

      <p v-if="buyError && !confirming" class="banner banner-err mt-3">{{ buyError }}</p>
      <button v-if="q || p" class="btn-primary mt-4 w-full" data-testid="subscribe" @click="confirming = true">{{ cta }}</button>
    </div>
  </StateBox>

  <ConfirmSheet
    :open="confirming"
    title="Konfirmasi"
    :message="`${cta} — tagihan akan dibuat dan dibayar via transfer bank. Lanjutkan?`"
    confirm-label="Ya, Lanjutkan"
    :busy="busy"
    :error="buyError"
    @confirm="confirmBuy"
    @close="confirming = false"
  />
</template>
