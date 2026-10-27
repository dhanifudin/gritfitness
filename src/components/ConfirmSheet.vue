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
      <div class="sheet-panel safe-b w-full max-w-md rounded-t-3xl border-t border-line bg-card p-5">
        <div class="sheet-handle mt-3" aria-hidden="true" />
        <h2 class="text-lg font-extrabold">{{ title }}</h2>
        <p v-if="message" class="mt-1 text-sm text-soft">{{ message }}</p>
        <div class="mt-3"><slot /></div>
        <p v-if="error" class="mt-3 text-sm text-danger">{{ error }}</p>
        <div class="mt-5 grid grid-cols-2 gap-3">
          <button class="btn-ghost" :disabled="busy" @click="$emit('close')">Batal</button>
          <button :class="danger ? 'btn bg-danger text-white' : 'btn-primary'" :disabled="busy" @click="$emit('confirm')">
            {{ busy ? 'Memproses…' : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>
