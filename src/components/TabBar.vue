<script setup lang="ts">
// Five direct tabs, official-style flat bar (64px, card surface, pink active). The official app
// has four (no QR); QR keeps its own center tab here because it's the daily gym-door screen.
// Progres lives in the Akun menu, matching the official IA.
const tabs = [
  { to: '/', label: 'Beranda', icon: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { to: '/classes', label: 'Jadwal', icon: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z' },
  { to: '/qr', label: 'QR', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v1M14 20h1M18 18h3v3h-3z' },
  { to: '/packages', label: 'Paket', icon: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8' },
  { to: '/account', label: 'Akun', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-5 8-5s8 1.7 8 5' },
]
</script>

<template>
  <nav class="safe-b fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-card">
    <ul class="grid h-16 grid-cols-5 items-center px-2">
      <li v-for="t in tabs" :key="t.to" class="flex justify-center">
        <RouterLink
          :to="t.to"
          class="flex flex-col items-center gap-1 px-2 py-1 text-[10px] font-bold text-(--tab-inactive)"
          active-class="!text-grit-500"
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
