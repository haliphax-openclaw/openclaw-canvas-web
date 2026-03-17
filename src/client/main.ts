import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { store } from './store'
import { wsClient } from './services/ws-client'
import A2UINode from './components/A2UINode.vue'

// Extract session from URL path so initial WS connect uses the correct session
const sessionMatch = window.location.pathname.match(/\/session\/([^/]+)/)
wsClient.connect(sessionMatch?.[1] ?? undefined)

// Save panel state on server shutdown
wsClient.on('server.shutdown', () => {
  // Visibility is already persisted on each mutation; nothing extra needed
  wsClient.destroy()
})

const app = createApp(App)
app.component('A2UINode', A2UINode)
app.use(router).use(store).mount('#app')
