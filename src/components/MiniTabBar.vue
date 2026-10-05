<script setup lang="ts">
import { useRoute } from 'vue-router'

// Shown instead of the full TabBar when there's no active session (expired/offline, viewing a cached
// QR) — honest about what's actually usable without one: the QR itself, and a way to log back in.
const route = useRoute()
</script>

<template>
  <nav class="safe-b fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-white/8 bg-ink-900/95 backdrop-blur">
    <ul class="grid grid-cols-2 items-center px-2 py-2">
      <li class="flex justify-center">
        <RouterLink
          to="/qr"
          class="flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium"
          :class="route.name === 'saved-qr' || route.name === 'qr' ? 'text-lime-grit' : 'text-white/50'"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3z" />
          </svg>
          QR
        </RouterLink>
      </li>
      <li class="flex justify-center">
        <RouterLink
          :to="{ name: 'login', query: { redirect: '/qr' } }"
          class="flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium"
          :class="route.name === 'login' ? 'text-lime-grit' : 'text-white/50'"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
          </svg>
          Masuk
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
