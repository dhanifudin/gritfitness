<script setup lang="ts">
import { computed } from 'vue'
import SafeImg from '@/components/SafeImg.vue'
import { useSideMenu } from '@/composables/useSideMenu'
import { useAuth } from '@/stores/auth'

// The member's avatar (photo or gradient initial) as the hidden-menu toggle.
// `size` 46 = the official dashboard header avatar; 36 = compact navbar version.
const props = withDefaults(defineProps<{ size?: number }>(), { size: 36 })
const auth = useAuth()
const menu = useSideMenu()
const initial = computed(() => (auth.user?.nama?.[0] ?? 'M').toUpperCase())
const px = computed(() => props.size + 'px')
</script>

<template>
  <button
    type="button"
    class="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#1B2A6B,#E0155A)] font-extrabold text-white"
    :style="{ width: px, height: px, fontSize: size >= 46 ? '18px' : '14px' }"
    aria-label="Menu lainnya"
    :aria-expanded="menu.open.value"
    data-testid="side-menu-toggle"
    @click="menu.toggle()"
  >
    <SafeImg v-if="auth.user?.foto" :src="auth.user.foto" :alt="auth.user?.nama ?? ''" class="h-full w-full object-cover" />
    <template v-else>{{ initial }}</template>
  </button>
</template>
