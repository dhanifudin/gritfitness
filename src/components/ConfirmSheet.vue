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
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-black/60" @click.self="!busy && $emit('close')">
      <div class="safe-b w-full max-w-md rounded-t-3xl border-t border-white/10 bg-ink-900 p-5">
        <h2 class="font-display text-xl">{{ title }}</h2>
        <p v-if="message" class="mt-1 text-sm text-white/65">{{ message }}</p>
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
  </Teleport>
</template>
