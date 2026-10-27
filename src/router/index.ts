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
    // official body progress (gym measurements) + input form
    { path: '/progress', name: 'progress', component: () => import('@/views/ProgressView.vue') },
    { path: '/progress/new', name: 'progress-new', component: () => import('@/views/ProgressNewView.vue') },
    // our activity tracker (visits, badges, budget, notes)
    { path: '/activity', name: 'activity', component: () => import('@/views/ActivityStatsView.vue') },
    { path: '/classes', name: 'classes', component: () => import('@/views/ClassesView.vue') },
    // a class catalog entry's upcoming sessions (official "kelas-jadwal")
    { path: '/classes/:id/schedule', name: 'class-schedule', component: () => import('@/views/ClassScheduleView.vue') },
    // my bookings (official "Kelas Saya") and one booking's detail + per-class QR + cancel
    { path: '/my-classes', name: 'my-classes', component: () => import('@/views/MyClassesView.vue') },
    { path: '/my-classes/:id', name: 'my-class-detail', component: () => import('@/views/MyClassDetailView.vue') },
    // official "Riwayat Kehadiran" layout, fed by real /my-classes data
    { path: '/attendance', name: 'attendance', component: () => import('@/views/AttendanceView.vue') },
    // hidden-menu home of the weekly pattern + auto-booking toggles
    { path: '/auto-booking', name: 'auto-booking', component: () => import('@/views/AutoBookingView.vue') },
    { path: '/account', name: 'account', component: () => import('@/views/AccountView.vue') },
    { path: '/notifications', name: 'notifications', component: () => import('@/views/NotificationsView.vue') },
    { path: '/bills', name: 'bills', component: () => import('@/views/BillsView.vue') },
    { path: '/bills/:id', name: 'bill-detail', component: () => import('@/views/BillDetailView.vue') },
    { path: '/packages', name: 'packages', component: () => import('@/views/PackagesView.vue') },
    { path: '/packages/:type(membership|pt)/:id', name: 'package-detail', component: () => import('@/views/PackageDetailView.vue') },
    { path: '/memberships', name: 'memberships', component: () => import('@/views/MembershipsView.vue') },
    { path: '/leave', name: 'leave', component: () => import('@/views/LeaveView.vue') },
    { path: '/leave/new', name: 'leave-new', component: () => import('@/views/LeaveNewView.vue') },
    { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue') },
    { path: '/profile/edit', name: 'profile-edit', component: () => import('@/views/ProfileEditView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/settings/target', name: 'settings-target', component: () => import('@/views/SettingsTargetView.vue') },
    { path: '/settings/data', name: 'settings-data', component: () => import('@/views/SettingsDataView.vue') },
    { path: '/settings/app', name: 'settings-app', component: () => import('@/views/SettingsAppView.vue') },
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
