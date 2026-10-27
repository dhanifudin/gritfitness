import { ref } from 'vue'

// Shared open/close state for the hidden side menu (one drawer instance lives in App.vue;
// every tab header's avatar button toggles it).
const open = ref(false)

export function useSideMenu() {
  return {
    open,
    toggle: () => (open.value = !open.value),
    close: () => (open.value = false),
  }
}
