import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { setUnauthorizedHandler } from './api/client'
import { useAuth } from './stores/auth'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

const auth = useAuth()
setUnauthorizedHandler(() => {
  auth.expire()
  // The QR screen keeps working from its cache; everything else needs a fresh login.
  if (router.currentRoute.value.name !== 'qr') {
    router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
  }
})

app.mount('#app')
