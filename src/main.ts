import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { setUnauthorizedHandler } from './api/client'
import { hasValidQr } from './lib/qrCache'
import { useAuth } from './stores/auth'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

const auth = useAuth()
setUnauthorizedHandler(() => {
  auth.expire()
  const r = router.currentRoute.value
  if (r.name === 'saved-qr') return
  // The cached QR stays usable; everything else needs a fresh login.
  if (r.name === 'qr' && hasValidQr()) router.replace({ name: 'saved-qr' })
  else router.replace({ name: 'login', query: { redirect: r.fullPath } })
})

app.mount('#app')
