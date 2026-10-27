<script setup lang="ts">
// The four official tabs — order, labels and SVGs copied from the official member app's
// index.html (.grit-tabbar). Everything else lives in the hidden side menu.
const tabs = [
  { to: '/', label: 'Beranda', icon: 'M4 11L12 4l8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z' },
  { to: '/packages', label: 'Paket', icon: 'M6.5 7v10M17.5 7v10M4 10v4M20 10v4M6.5 12h11' },
  { to: '/classes', label: 'Jadwal', icon: 'M3.5 9.5h17M8 3.5v3M16 3.5v3M5.5 5h13a2 2 0 012 2v12a2 2 0 01-2 2h-13a2 2 0 01-2-2V7a2 2 0 012-2z' },
  { to: '/account', label: 'Profil', icon: 'M12 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 20c0-3.9 3.1-6 7-6s7 2.1 7 6' },
]
</script>

<template>
  <nav class="safe-b fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-card">
    <ul class="grid h-16 grid-cols-4 items-center px-2">
      <li v-for="t in tabs" :key="t.to" class="flex justify-center">
        <RouterLink
          :to="t.to"
          class="flex flex-col items-center gap-1 px-2 py-1 text-[10px] font-bold text-(--tab-inactive)"
          active-class="!text-grit-500"
        >
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path :d="t.icon" />
          </svg>
          {{ t.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
