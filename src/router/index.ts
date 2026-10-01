import { createRouter, createWebHistory } from 'vue-router'
import { hasValidQr } from '@/lib/qrCache'
import { useAuth } from '@/stores/auth'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { public: true } },
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/qr', name: 'qr', component: () => import('@/views/QrView.vue') },
    // cache-only: no API calls, reachable in every session state (public => no tab bar)
    { path: '/saved-qr', name: 'saved-qr', component: () => import('@/views/SavedQrView.vue'), meta: { public: true } },
    { path: '/progress', name: 'progress', component: () => import('@/views/ProgressView.vue') },
    { path: '/classes', name: 'classes', component: () => import('@/views/ClassesView.vue') },
    { path: '/classes/:id', name: 'class-detail', component: () => import('@/views/ClassDetailView.vue') },
    { path: '/bills', name: 'bills', component: () => import('@/views/BillsView.vue') },
    { path: '/bills/:id', name: 'bill-detail', component: () => import('@/views/BillDetailView.vue') },
    { path: '/packages', name: 'packages', component: () => import('@/views/PackagesView.vue') },
    { path: '/packages/class/:id', name: 'class-package-detail', component: () => import('@/views/ClassPackageDetailView.vue') },
    { path: '/packages/:type(membership|pt)/:id', name: 'package-detail', component: () => import('@/views/PackageDetailView.vue') },
    { path: '/memberships', name: 'memberships', component: () => import('@/views/MembershipsView.vue') },
    { path: '/memberships/:id', name: 'membership-detail', component: () => import('@/views/MembershipDetailView.vue') },
    { path: '/leave', name: 'leave', component: () => import('@/views/LeaveView.vue') },
    { path: '/leave/new', name: 'leave-new', component: () => import('@/views/LeaveNewView.vue') },
    { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue') },
    { path: '/profile/edit', name: 'profile-edit', component: () => import('@/views/ProfileEditView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const auth = useAuth()
  if (to.name === 'saved-qr') return
  // Session expired but a valid QR is cached: opening the app lands on the saved QR.
  if (!auth.loggedIn && (to.name === 'home' || to.name === 'qr') && hasValidQr()) return { name: 'saved-qr' }
  if (!to.meta.public && !auth.loggedIn) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.public && auth.loggedIn) return { name: 'home' }
})
