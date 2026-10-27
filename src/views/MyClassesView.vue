<script setup lang="ts">
import { myClasses } from '@/api/endpoints'
import type { MyClass } from '@/api/types'
import BackHeader from '@/components/BackHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'
import { titleCase } from '@/lib/format'

// Official "Kelas Saya" (pages/my-classes.f7.html): Mendatang + Riwayat sections.
const { data, loading, error, savedAt, stale, reload } = useAsync(myClasses, null, { key: CK.myClasses })

// riwayat shows attendance when known, otherwise the booking status (official badge rule)
function pill(k: MyClass, riwayat: boolean): { cls: string; label: string } {
  if (riwayat && k.kehadiran_label) {
    return { cls: k.kehadiran === 'hadir' ? 'pill-ok' : k.kehadiran === 'izin' ? 'pill-warn' : 'pill-mute', label: k.kehadiran_label }
  }
  return { cls: k.status_booking === 'cancelled' ? 'pill-mute' : k.status_booking === 'no_show' ? 'pill-warn' : 'pill-navy', label: k.status_booking_label }
}
const sub2 = (k: MyClass) => [k.instruktur ? `Instruktur ${k.instruktur}` : '', k.ruangan ?? ''].filter(Boolean).join(' · ')
</script>

<template>
  <BackHeader title="Kelas Saya" />
  <StateBox
    :loading="loading" :error="error" :stale="stale" :saved-at="savedAt"
    :empty="!!data && !data.mendatang.length && !data.riwayat.length"
    empty-text="Belum ada kelas. Yuk booking kelas dari tab Jadwal!"
    @retry="reload"
  >
    <div v-if="data" class="px-4 pb-6">
      <template v-for="section in [{ title: 'Mendatang', items: data.mendatang, riwayat: false }, { title: 'Riwayat', items: data.riwayat, riwayat: true }]" :key="section.title">
        <template v-if="section.items.length">
          <p class="mt-4 mb-1.5 text-[15px] font-extrabold">{{ section.title }}</p>
          <div class="space-y-3" :data-testid="`mc-${section.title.toLowerCase()}`">
            <RouterLink v-for="k in section.items" :key="k.id" :to="`/my-classes/${k.schedule_id}`" class="card block p-4">
              <div class="flex items-start justify-between gap-3">
                <p class="min-w-0 truncate font-extrabold">{{ titleCase(k.nama) }}</p>
                <span class="pill shrink-0" :class="pill(k, section.riwayat).cls">{{ pill(k, section.riwayat).label }}</span>
              </div>
              <p class="mt-0.5 text-sm font-semibold text-soft">{{ k.tanggal }} · {{ k.jam_mulai }}–{{ k.jam_selesai }}</p>
              <p v-if="sub2(k)" class="mt-0.5 text-xs font-semibold text-mute">{{ sub2(k) }}</p>
            </RouterLink>
          </div>
        </template>
      </template>
    </div>
  </StateBox>
</template>
