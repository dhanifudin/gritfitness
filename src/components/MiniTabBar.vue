<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { hasValidQr } from '@/lib/qrCache'

// Shown instead of the full TabBar when there's no active session (expired/offline, viewing a cached
// QR, or the login/register screens) — honest about what's actually usable without one.
const route = useRoute()
const name = computed(() => String(route.name))
const onAuthPage = computed(() => name.value === 'login' || name.value === 'register')
// On the auth pages the QR item only makes sense if there's actually something cached to show.
const showQr = computed(() => name.value === 'saved-qr' || (onAuthPage.value && hasValidQr()))
// The other item always leads somewhere new: Daftar from login, Masuk from register / the offline QR.
const other = computed(() =>
  name.value === 'login'
    ? { label: 'Daftar', to: { name: 'register' }, icon: 'register' as const }
    : { label: 'Masuk', to: name.value === 'register' ? { name: 'login' } : { name: 'login', query: { redirect: '/qr' } }, icon: 'login' as const },
)
</script>

<template>
  <nav class="safe-b fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-white/8 bg-ink-900/95 backdrop-blur">
    <ul class="grid items-center px-2 py-2" :class="showQr ? 'grid-cols-2' : 'grid-cols-1'">
      <li v-if="showQr" class="flex justify-center">
        <RouterLink
          to="/qr"
          class="flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium"
          :class="name === 'saved-qr' || name === 'qr' ? 'text-lime-grit' : 'text-white/50'"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3z" />
          </svg>
          QR
        </RouterLink>
      </li>
      <li class="flex justify-center">
        <RouterLink :to="other.to" class="flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium text-white/50">
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="other.icon === 'register'">
              <circle cx="9" cy="8" r="3.3" />
              <path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M18 8v5M15.5 10.5h5" />
            </template>
            <path v-else d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
          </svg>
          {{ other.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
