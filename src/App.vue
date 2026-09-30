<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from '@/components/TabBar.vue'
import { useAuth } from '@/stores/auth'
import { useOnline, useUpdater } from '@/composables/useSw'

const route = useRoute()
const auth = useAuth()
const showTabs = computed(() => !route.meta.public && auth.loggedIn)
const online = useOnline()
const { needRefresh, update } = useUpdater()
</script>

<template>
  <div class="mx-auto flex h-full max-w-md flex-col bg-ink-950">
    <div v-if="!online" class="safe-t bg-amber-500/90 px-4 py-1.5 text-center text-xs font-semibold text-black">
      Offline — menampilkan data terakhir
    </div>
    <main class="flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]" :class="showTabs ? 'pb-28' : ''">
      <RouterView />
    </main>
    <button
      v-if="needRefresh"
      class="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-xl bg-lime-grit px-4 py-3 text-sm font-semibold text-black shadow-lg"
      @click="update"
    >
      Versi baru tersedia — ketuk untuk memperbarui
    </button>
    <TabBar v-if="showTabs" />
  </div>
</template>
