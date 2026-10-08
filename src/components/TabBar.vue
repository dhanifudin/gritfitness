<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const tabs = [
  { to: '/', label: 'Beranda', icon: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { to: '/classes', label: 'Kelas', icon: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z' },
  { to: '/qr', label: 'QR', center: true },
  { to: '/progress', label: 'Progres', icon: 'M4 20h16M7 20v-6M12 20V6M17 20v-9' },
]

// Profil is first here since it no longer has its own bottom tab, followed by the rarely-used destinations.
// Editing the profile is a button inside the Profil page itself, not a second menu row.
const moreLinks = [
  { to: '/profile', label: 'Profil' },
  { to: '/settings', label: 'Pengaturan' },
  { to: '/memberships', label: 'Riwayat Membership' },
  { to: '/leave', label: 'Cuti Membership' },
  { to: '/packages', label: 'Paket' },
  { to: '/saved-qr', label: 'QR Tersimpan (offline)' },
]

const open = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => (open.value = false)) // close whenever a link (or anything else) navigates

function onKeydown(e: KeyboardEvent) {
  if (open.value && e.key === 'Escape') open.value = false
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <nav class="safe-b fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-white/8 bg-ink-900/95 backdrop-blur">
    <ul class="grid grid-cols-5 items-end px-2 pt-2 pb-2">
      <li v-for="t in tabs" :key="t.to" class="relative flex justify-center">
        <RouterLink
          v-if="t.center"
          :to="t.to"
          aria-label="QR Member"
          class="-mt-8 flex h-16 w-16 items-center justify-center rounded-full border-4 border-ink-950 bg-grit-500 text-white shadow-[0_6px_24px_rgba(236,47,143,.3)] transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3z" />
          </svg>
        </RouterLink>
        <RouterLink
          v-else
          :to="t.to"
          class="flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium text-white/50"
          active-class="!text-grit-300"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path :d="t.icon" />
          </svg>
          {{ t.label }}
        </RouterLink>
      </li>
      <li class="relative flex justify-center">
        <button
          type="button"
          aria-haspopup="menu"
          :aria-expanded="open"
          class="flex flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium text-white/50"
          :class="open ? '!text-grit-300' : ''"
          @click="open = !open"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          Lainnya
        </button>
      </li>
    </ul>

    <Teleport to="body">
      <Transition name="sheet" appear><div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="menu" aria-label="Menu lainnya" data-testid="more-menu" @click.self="open = false">
        <div class="sheet-panel safe-b w-full max-w-md rounded-t-3xl border-t border-white/8 bg-ink-900 p-3 pt-3"><div class="sheet-handle" />
          <p class="px-2 pt-1 pb-2 text-xs text-white/50">Menu lainnya</p>
          <RouterLink
            v-for="l in moreLinks" :key="l.to" :to="l.to" role="menuitem"
            class="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium active:bg-white/5"
          >
            {{ l.label }} <svg viewBox="0 0 24 24" class="h-4 w-4 text-white/35" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </RouterLink>
        </div>
      </div></Transition>
    </Teleport>
  </nav>
</template>
