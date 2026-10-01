<script setup lang="ts">
const tabs = [
  { to: '/', label: 'Beranda', icon: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { to: '/classes', label: 'Kelas', icon: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z' },
  { to: '/qr', label: 'QR', center: true },
  { to: '/progress', label: 'Progres', icon: 'M4 20h16M7 20v-6M12 20V6M17 20v-9' },
  { to: '/profile', label: 'Profil', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0' },
]
</script>

<template>
  <nav class="safe-b fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-white/8 bg-ink-900/95 backdrop-blur">
    <ul class="grid grid-cols-5 items-end px-2 pt-2 pb-2">
      <li v-for="t in tabs" :key="t.to" class="flex justify-center">
        <RouterLink
          v-if="t.center"
          :to="t.to"
          aria-label="QR Member"
          class="-mt-8 flex h-16 w-16 items-center justify-center rounded-full border-4 border-ink-950 bg-lime-grit text-black shadow-[0_6px_24px_rgba(200,245,96,.35)] transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3z" />
          </svg>
        </RouterLink>
        <RouterLink
          v-else
          :to="t.to"
          class="flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium text-white/50"
          active-class="!text-brand-300"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path :d="t.icon" />
          </svg>
          {{ t.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
