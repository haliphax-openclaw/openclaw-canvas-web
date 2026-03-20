import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { a2uiModule } from '../../src/client/store/a2ui'

export function makeStore(surfaces: Record<string, any> = {}) {
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces }) } },
  })
}

export function mountWith(component: any, props: Record<string, any>, surfaces: Record<string, any> = {}) {
  const store = makeStore(surfaces)
  return mount(component, { props, global: { plugins: [store] } })
}
