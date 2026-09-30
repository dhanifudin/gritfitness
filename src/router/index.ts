import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/stores/auth'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/masuk', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/qr', name: 'qr', component: () => import('@/views/QrView.vue') },
    { path: '/jadwal', name: 'jadwal', component: () => import('@/views/ScheduleView.vue') },
    { path: '/tagihan', name: 'tagihan', component: () => import('@/views/BillsView.vue') },
    { path: '/paket', name: 'paket', component: () => import('@/views/PackagesView.vue') },
    { path: '/profil', name: 'profil', component: () => import('@/views/ProfileView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const auth = useAuth()
  if (!to.meta.public && !auth.loggedIn) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.name === 'login' && auth.loggedIn) return { name: 'home' }
})
