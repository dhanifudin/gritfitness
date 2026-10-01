<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AccountMenu from '@/components/AccountMenu.vue'
import CelebrationSheet from '@/components/CelebrationSheet.vue'
import TabBar from '@/components/TabBar.vue'
import { useAuth } from '@/stores/auth'
import { useOnline, useUpdater } from '@/composables/useSw'
import { useTracker } from '@/stores/tracker'

const route = useRoute()
const auth = useAuth()
const showTabs = computed(() => !route.meta.public && auth.loggedIn)
const online = useOnline()
const { needRefresh, update, applyIfSafe } = useUpdater()
// a waiting update is applied on the next navigation (never while typing)
useRouter().afterEach(() => applyIfSafe())

// tracker: load this member's local copy and keep it in sync (online again / back in the app)
const tracker = useTracker()
const resync = () => {
  if (document.visibilityState === 'visible') void tracker.sync()
}
onMounted(() => {
  if (tracker.init()) void tracker.sync()
  window.addEventListener('online', resync)
  document.addEventListener('visibilitychange', resync)
})
onUnmounted(() => {
  window.removeEventListener('online', resync)
  document.removeEventListener('visibilitychange', resync)
})
</script>

<template>
  <div class="relative mx-auto flex h-full max-w-md flex-col bg-ink-950">
    <div v-if="!online" class="safe-t bg-amber-500/90 px-4 py-1.5 text-center text-xs font-semibold text-black">
      Offline — menampilkan data terakhir
    </div>
    <main class="flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]" :class="showTabs ? 'pb-28' : ''">
      <RouterView />
    </main>
    <AccountMenu v-if="showTabs" />
    <button
      v-if="needRefresh"
      class="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-xl bg-lime-grit px-4 py-3 text-sm font-semibold text-black shadow-lg"
      @click="update"
    >
      Versi baru siap — ketuk untuk memperbarui sekarang
    </button>
    <TabBar v-if="showTabs" />
    <CelebrationSheet v-if="showTabs && !tracker.needsConsent" />
  </div>
</template>
