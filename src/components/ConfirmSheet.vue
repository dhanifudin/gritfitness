<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  message?: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  error?: string
}>()
defineEmits<{ confirm: []; close: [] }>()
</script>

<template>
  <Teleport to="body">
<Transition name="sheet" appear>    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-black/60" role="dialog" aria-modal="true" :aria-label="title" @click.self="!busy && $emit('close')">
      <div class="sheet-panel safe-b w-full max-w-md rounded-t-3xl border-t border-white/8 bg-ink-900 p-5">
        <div class="sheet-handle mt-3" aria-hidden="true" />
        <h2 class="font-display text-xl font-semibold">{{ title }}</h2>
        <p v-if="message" class="mt-1 text-sm text-white/70">{{ message }}</p>
        <div class="mt-3"><slot /></div>
        <p v-if="error" class="mt-3 text-sm text-red-300">{{ error }}</p>
        <div class="mt-5 grid grid-cols-2 gap-3">
          <button class="btn-ghost" :disabled="busy" @click="$emit('close')">Batal</button>
          <button :class="danger ? 'btn bg-red-500 text-white' : 'btn-primary'" :disabled="busy" @click="$emit('confirm')">
            {{ busy ? 'Memproses…' : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>
