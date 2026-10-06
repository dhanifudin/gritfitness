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
// A 401 means the gym ended this session (it allows only one per account, so a login elsewhere revokes
// it long before the 5h expiry). Don't yank the member to the login page from a background request: stay
// on the page (App.vue shows a banner with a Masuk button). Only the live QR has a useful fallback.
setUnauthorizedHandler(() => {
  auth.expire()
  if (router.currentRoute.value.name === 'qr' && hasValidQr()) router.replace({ name: 'saved-qr' })
})

app.mount('#app')
