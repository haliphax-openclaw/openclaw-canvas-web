import { createRouter, createWebHistory } from 'vue-router'
import CanvasView from './views/CanvasView.vue'
import ScaffoldView from './views/ScaffoldView.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/session/main/' },
    { path: '/session/:sessionId/:path(.*)', name: 'canvas', component: CanvasView },
    { path: '/scaffold', name: 'scaffold', component: ScaffoldView },
  ],
})
