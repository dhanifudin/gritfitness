<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

// Profil itself is first here since there's no longer a bottom tab for it, followed by the
// rarely-used destinations that used to live in TabBar's own dropdown.
const links = [
  { to: '/profile', label: 'Profil' },
  { to: '/profile/edit', label: 'Ubah Profil' },
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
  <button
    type="button"
    aria-haspopup="menu"
    :aria-expanded="open"
    aria-label="Akun"
    class="absolute right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-ink-900/90 text-white/70 backdrop-blur active:bg-white/10"
    style="top: calc(env(safe-area-inset-top) + 1rem)"
    @click.stop="open = !open"
  >
    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" />
    </svg>
  </button>

  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="menu" aria-label="Menu akun" data-testid="more-menu" @click.self="open = false">
      <div class="safe-b w-full max-w-md rounded-t-3xl border-t border-white/10 bg-ink-900 p-3">
        <p class="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-white/40 uppercase">Akun</p>
        <RouterLink
          v-for="l in links" :key="l.to" :to="l.to" role="menuitem"
          class="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium active:bg-white/5"
        >
          {{ l.label }} <span class="text-white/40">›</span>
        </RouterLink>
      </div>
    </div>
  </Teleport>
</template>
