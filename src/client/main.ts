import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { store } from './store'
import { wsClient } from './services/ws-client'
import A2UINode from './components/A2UINode.vue'

wsClient.connect()

// Save panel state on server shutdown
wsClient.on('server.shutdown', () => {
  // Visibility is already persisted on each mutation; nothing extra needed
  wsClient.destroy()
})

const app = createApp(App)
app.component('A2UINode', A2UINode)
app.use(router).use(store).mount('#app')
