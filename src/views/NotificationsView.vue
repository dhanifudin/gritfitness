<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { notifications } from '@/api/endpoints'
import BackHeader from '@/components/BackHeader.vue'
import StateBox from '@/components/StateBox.vue'
import { useAsync } from '@/composables/useAsync'
import { CK } from '@/lib/dataCache'

// Read state is client-side, same as the official app: everything older than the last time
// this screen was opened counts as read.
const SEEN_KEY = 'grit.notifSeen'
const seenBefore = localStorage.getItem(SEEN_KEY) ?? ''

const { data: list, loading, error, reload } = useAsync(notifications, [], { key: CK.notifications })

const unreadCount = computed(() => list.value.filter((n) => !seenBefore || new Date(n.created_at) > new Date(seenBefore)).length)
const isUnread = (iso: string) => !seenBefore || new Date(iso) > new Date(seenBefore)

onMounted(() => {
  // mark everything seen for next time (this visit still shows which were new)
  const latest = list.value[0]?.created_at
  if (latest) localStorage.setItem(SEEN_KEY, latest)
})

const ICONS: Record<string, { path: string; color: string }> = {
  payment: { path: 'M3 7h18v10H3zM3 11h18M7 15h4', color: 'text-grit-500' },
  calendar: { path: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z', color: 'text-chart-2' },
  gift: { path: 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7c2 0 4-1 4-3a2 2 0 00-4 0M12 7c-2 0-4-1-4-3a2 2 0 014 0', color: 'text-warn' },
  promo: { path: 'M20 13l-8 8-9-9V4h8l9 9zM7.5 7.5h.01', color: 'text-[#FF9A3C]' },
  bell: { path: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0', color: 'text-navy dark:text-white' },
}
const iconOf = (k: string) => ICONS[k] ?? ICONS.bell
</script>

<template>
  <BackHeader title="Notifikasi" />

  <p class="px-5 pb-2 text-[13px] font-semibold text-mute">
    {{ unreadCount ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca' }}
  </p>

  <StateBox :loading="loading" :error="error" :empty="!list.length" empty-text="Belum ada notifikasi" @retry="reload">
    <div class="space-y-2 px-4 pb-6">
      <div
        v-for="(n, i) in list"
        :key="i"
        class="flex gap-3.5 rounded-[14px] border p-4"
        :class="isUnread(n.created_at) ? 'border-[rgba(224,21,90,.18)] bg-[rgba(224,21,90,.05)] dark:border-[rgba(224,21,90,.28)] dark:bg-[rgba(224,21,90,.10)]' : 'border-line bg-card'"
      >
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[rgba(107,114,128,.12)]" :class="isUnread(n.created_at) ? iconOf(n.icon).color : 'text-mute'">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="iconOf(n.icon).path" /></svg>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm" :class="isUnread(n.created_at) ? 'font-extrabold' : 'font-semibold'">{{ n.title }}</p>
            <span v-if="isUnread(n.created_at)" class="mt-1 h-2 w-2 shrink-0 rounded-full bg-grit-500" aria-hidden="true" />
          </div>
          <p class="mt-0.5 text-xs text-soft">{{ n.body }}</p>
          <p class="mt-1 text-[11px] font-semibold text-mute">{{ n.time_label }}</p>
        </div>
      </div>
    </div>
  </StateBox>
</template>
