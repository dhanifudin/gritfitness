<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CelebrationSheet from '@/components/CelebrationSheet.vue'
import MiniTabBar from '@/components/MiniTabBar.vue'
import TabBar from '@/components/TabBar.vue'
import { useAuth } from '@/stores/auth'
import { useOnline, useUpdater } from '@/composables/useSw'
import { syncPushSubscription } from '@/lib/push'
import { useClassWatch } from '@/stores/classWatch'
import { useTracker } from '@/stores/tracker'

// meta.public is for the router guard's login-bypass only (see router/index.ts) — whether the tab bar
// shows is a separate concern, so it isn't driven by the same flag (that previously hid the tab bar on
// /saved-qr for logged-in members too, since that route happens to also be public for logged-out access).
const NO_CHROME = new Set(['login', 'register'])
const route = useRoute()
const auth = useAuth()
const showTabs = computed(() => auth.loggedIn && !NO_CHROME.has(String(route.name)))
// no session, but a cached QR is still being shown offline: a minimal 2-item bar (QR + Masuk), not the
// full tab bar whose other destinations need a real session to do anything.
const showMiniTabs = computed(() => !auth.loggedIn && route.name === 'saved-qr')
const online = useOnline()
const { needRefresh, update, applyIfSafe, offlineReady } = useUpdater()
// a waiting update is applied on the next navigation (never while typing)
useRouter().afterEach(() => applyIfSafe())

// one-time "works offline now" feedback after the first successful precache — otherwise a first-time
// installer gets no confirmation at all that the app cached itself for offline use.
const showOfflineToast = ref(false)
watch(offlineReady, (ready) => {
  if (!ready) return
  showOfflineToast.value = true
  setTimeout(() => (showOfflineToast.value = false), 4000)
})

// tracker: load this member's local copy and keep it in sync (online again / back in the app)
const tracker = useTracker()
const classWatch = useClassWatch()
const resync = () => {
  if (document.visibilityState !== 'visible') return
  void tracker.sync()
  void classWatch.checkAndRegister()
}
onMounted(() => {
  if (tracker.init()) void tracker.sync()
  void syncPushSubscription()
  void classWatch.checkAndRegister()
  window.addEventListener('online', resync)
  document.addEventListener('visibilitychange', resync)
})
onUnmounted(() => {
  window.removeEventListener('online', resync)
  document.removeEventListener('visibilitychange', resync)
})

// a watched class was just auto-registered (or the attempt failed) while the app was open
const watchToast = ref('')
const WATCH_MESSAGE: Record<string, (name: string) => string> = {
  registered: (n) => `Terdaftar otomatis: ${n}`,
  waiting: (n) => `Masuk waiting list otomatis: ${n}`,
  full: (n) => `${n} sudah penuh, tidak bisa didaftar otomatis`,
  failed: (n) => `Gagal mendaftar otomatis untuk ${n}, coba manual`,
}
watch(
  () => classWatch.lastResults,
  (results) => {
    if (!results.length) return
    const r = results[results.length - 1]
    const text = WATCH_MESSAGE[r.result]?.(r.entry.class_name)
    if (text) {
      watchToast.value = text
      setTimeout(() => (watchToast.value = ''), 5000)
    }
    classWatch.clearResults()
  },
)
</script>

<template>
  <div class="mx-auto flex h-full max-w-md flex-col bg-ink-950">
    <div v-if="!online" class="safe-t bg-amber-500/90 px-4 py-1.5 text-center text-xs font-semibold text-black">
      Offline — menampilkan data terakhir
    </div>
    <main class="safe-t flex-1 overflow-y-auto" :class="showTabs || showMiniTabs ? 'pb-28' : ''">
      <RouterView />
    </main>
    <button
      v-if="needRefresh"
      class="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-xl bg-lime-grit px-4 py-3 text-sm font-semibold text-black shadow-lg"
      @click="update"
    >
      Versi baru siap — ketuk untuk memperbarui sekarang
    </button>
    <p
      v-if="showOfflineToast"
      class="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-xl border border-white/10 bg-ink-900/95 px-4 py-3 text-center text-sm text-white/80 shadow-lg backdrop-blur"
    >
      Siap dipakai offline
    </p>
    <p
      v-if="watchToast"
      class="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-xl border border-white/10 bg-ink-900/95 px-4 py-3 text-center text-sm text-emerald-300 shadow-lg backdrop-blur"
    >
      {{ watchToast }}
    </p>
    <TabBar v-if="showTabs" />
    <MiniTabBar v-else-if="showMiniTabs" />
    <CelebrationSheet v-if="showTabs && !tracker.needsConsent" />
  </div>
</template>
