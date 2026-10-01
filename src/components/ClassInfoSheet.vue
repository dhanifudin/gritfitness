<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { assetUrl } from '@/composables/useAsync'
import type { ClassMatch } from '@/lib/classInfo'

const props = defineProps<{
  match: ClassMatch | null
  title: string
  /** the tapped session, shown under the class info */
  session?: { time: string; instructor: string | null; predicted: boolean } | null
}>()
const emit = defineEmits<{ close: [] }>()

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" :aria-label="`Tentang kelas ${title}`" @click.self="emit('close')">
      <div class="safe-b max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-white/10 bg-ink-900">
        <img v-if="props.match?.cls.photo" :src="assetUrl(props.match.cls.photo)" :alt="title" class="h-44 w-full object-cover" />
        <div class="p-5">
          <div class="flex items-start justify-between gap-3">
            <h2 class="font-display text-2xl leading-tight">{{ match?.cls.name ?? title }}</h2>
            <button class="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 active:bg-white/10" aria-label="Tutup" @click="emit('close')">
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <div v-if="match" class="mt-2 flex flex-wrap gap-2 text-xs">
            <span v-if="match.category" class="rounded-full bg-brand-400/25 px-2.5 py-1 font-semibold text-brand-300">{{ match.category.name }}</span>
            <span v-if="match.cls.minutes" class="rounded-full bg-white/8 px-2.5 py-1 text-white/70">{{ match.cls.minutes }} menit</span>
          </div>

          <p v-if="match?.cls.description" class="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/85">{{ match.cls.description }}</p>
          <p v-else class="mt-4 text-sm text-white/55">Deskripsi kelas belum tersedia.</p>

          <p v-if="match?.category?.tagline" class="mt-4 rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-white/60">
            <span class="font-semibold text-white/75">Tentang kelas {{ match.category.name }}:</span> {{ match.category.tagline }}
          </p>

          <div v-if="session" class="mt-4 border-t border-white/10 pt-3 text-sm">
            <p class="text-white/80">{{ session.time }}<template v-if="session.instructor"> · {{ session.instructor }}</template></p>
            <p v-if="session.predicted" class="mt-1 text-xs text-amber-200/80">Perkiraan — jadwal pasti biasanya dibuka sehari sebelumnya, cek lagi nanti.</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
