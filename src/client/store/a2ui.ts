import type { Module } from 'vuex'
import type { RootState } from './index'

export interface A2UISurfaceState {
  components: Record<string, Record<string, unknown>>
  root: string | null
  dataModel: Record<string, unknown>
}

export interface A2UIState {
  surfaces: Record<string, A2UISurfaceState>
}

export const a2uiModule: Module<A2UIState, RootState> = {
  namespaced: true,
  state: (): A2UIState => ({ surfaces: {} }),
  mutations: {
    upsertSurface(state, payload: { surfaceId: string; components: Array<{ id: string; component: Record<string, unknown> }> }) {
      if (!state.surfaces[payload.surfaceId]) {
        state.surfaces[payload.surfaceId] = { components: {}, root: null, dataModel: {} }
      }
      const s = state.surfaces[payload.surfaceId]
      for (const c of payload.components) {
        s.components[c.id] = c.component
      }
    },
    setRoot(state, payload: { surfaceId: string; root: string }) {
      if (state.surfaces[payload.surfaceId]) {
        state.surfaces[payload.surfaceId].root = payload.root
      }
    },
    updateDataModel(state, payload: { surfaceId: string; data: Record<string, unknown> }) {
      if (state.surfaces[payload.surfaceId]) {
        Object.assign(state.surfaces[payload.surfaceId].dataModel, payload.data)
      }
    },
    deleteSurface(state, payload: { surfaceId: string }) {
      delete state.surfaces[payload.surfaceId]
    },
    clearAll(state) {
      state.surfaces = {}
    },
  },
}
