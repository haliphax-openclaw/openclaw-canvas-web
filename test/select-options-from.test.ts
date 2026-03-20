// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { a2uiModule } from '../src/client/store/a2ui'

vi.mock('../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))

vi.mock('../src/client/services/deep-link', () => ({
  parseOpenclawUrl: vi.fn(),
  executeDeepLink: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import { wsClient } from '../src/client/services/ws-client'
import A2UISelect from '../packages/a2ui-catalog-basic/src/A2UIChoicePicker.vue'

function makeStore(surfaces: Record<string, any> = {}) {
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces }) } },
  })
}

function mountSelect(def: any, surfaces: Record<string, any> = {}) {
  const store = makeStore(surfaces)
  return { wrapper: mount(A2UISelect, { props: { def, surfaceId: 's1', componentId: 'c1' }, global: { plugins: [store] } }), store }
}

const teamSurface = (rows: any[]) => ({
  s1: {
    components: {},
    root: null,
    dataModel: {},
    sources: { team_members: { fields: ['name', 'department'], rows } },
    filters: {},
  },
})

beforeEach(() => { vi.mocked(wsClient.send).mockClear() })

describe('A2UISelect optionsFrom', () => {
  describe('static options (backward compat)', () => {
    it('renders static options when no optionsFrom', () => {
      const { wrapper } = mountSelect({ options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] })
      const opts = wrapper.findAll('option')
      expect(opts).toHaveLength(2)
      expect(opts[0].text()).toBe('A')
    })
  })

  describe('optionsFrom.list', () => {
    it('derives options from a static list', () => {
      const { wrapper } = mountSelect({ optionsFrom: { list: ['Active', 'On Leave', 'Trainee'] } })
      const opts = wrapper.findAll('option')
      expect(opts).toHaveLength(3)
      expect(opts[0].attributes('value')).toBe('Active')
      expect(opts[1].text()).toBe('On Leave')
    })

    it('takes precedence over static options', () => {
      const { wrapper } = mountSelect({
        options: [{ label: 'X', value: 'x' }],
        optionsFrom: { list: ['Y', 'Z'] },
      })
      expect(wrapper.findAll('option')).toHaveLength(2)
      expect(wrapper.findAll('option')[0].text()).toBe('Y')
    })
  })

  describe('optionsFrom.source', () => {
    it('derives unique sorted options from data source field', () => {
      const rows = [
        { name: 'Alice', department: 'Engineering' },
        { name: 'Bob', department: 'Sales' },
        { name: 'Carol', department: 'Engineering' },
        { name: 'Dave', department: 'Marketing' },
      ]
      const { wrapper } = mountSelect(
        { optionsFrom: { source: 'team_members', field: 'department' } },
        teamSurface(rows),
      )
      const opts = wrapper.findAll('option')
      expect(opts).toHaveLength(3)
      expect(opts[0].text()).toBe('Engineering')
      expect(opts[1].text()).toBe('Marketing')
      expect(opts[2].text()).toBe('Sales')
    })

    it('prepends All option when includeAll is true', () => {
      const rows = [
        { name: 'Alice', department: 'Engineering' },
        { name: 'Bob', department: 'Sales' },
      ]
      const { wrapper } = mountSelect(
        { optionsFrom: { source: 'team_members', field: 'department', includeAll: true, allLabel: 'All Divisions' } },
        teamSurface(rows),
      )
      const opts = wrapper.findAll('option')
      expect(opts).toHaveLength(3)
      expect(opts[0].text()).toBe('All Divisions')
      expect(opts[0].attributes('value')).toBe('')
    })

    it('uses default "All" label when allLabel not specified', () => {
      const rows = [{ name: 'Alice', department: 'Engineering' }]
      const { wrapper } = mountSelect(
        { optionsFrom: { source: 'team_members', field: 'department', includeAll: true } },
        teamSurface(rows),
      )
      expect(wrapper.findAll('option')[0].text()).toBe('All')
    })

    it('returns empty options when source does not exist', () => {
      const { wrapper } = mountSelect(
        { optionsFrom: { source: 'nonexistent', field: 'department' } },
        teamSurface([]),
      )
      expect(wrapper.findAll('option')).toHaveLength(0)
    })

    it('filters out null/undefined values', () => {
      const rows = [
        { name: 'Alice', department: 'Engineering' },
        { name: 'Bob', department: null },
        { name: 'Carol', department: undefined },
      ]
      const { wrapper } = mountSelect(
        { optionsFrom: { source: 'team_members', field: 'department' } },
        teamSurface(rows),
      )
      expect(wrapper.findAll('option')).toHaveLength(1)
      expect(wrapper.findAll('option')[0].text()).toBe('Engineering')
    })

    it('reactively updates when data source changes', async () => {
      const rows = [{ name: 'Alice', department: 'Engineering' }]
      const { wrapper, store } = mountSelect(
        { optionsFrom: { source: 'team_members', field: 'department' } },
        teamSurface(rows),
      )
      expect(wrapper.findAll('option')).toHaveLength(1)

      store.commit('a2ui/updateDataModel', {
        surfaceId: 's1',
        data: { $sources: { team_members: { fields: ['name', 'department'], rows: [
          { name: 'Alice', department: 'Engineering' },
          { name: 'Bob', department: 'Sales' },
        ] } } },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.findAll('option')).toHaveLength(2)
    })
  })

  describe('MultiSelect with optionsFrom', () => {
    it('renders multi-select with optionsFrom.list', () => {
      const { wrapper } = mountSelect({
        multi: true,
        optionsFrom: { list: ['Active', 'On Leave'] },
        selected: ['Active'],
      })
      const select = wrapper.find('select')
      expect(select.attributes('multiple')).toBeDefined()
      expect(wrapper.findAll('option')).toHaveLength(2)
    })

    it('renders multi-select with optionsFrom.source', () => {
      const rows = [
        { name: 'Alice', department: 'Engineering' },
        { name: 'Bob', department: 'Sales' },
      ]
      const { wrapper } = mountSelect(
        { multi: true, optionsFrom: { source: 'team_members', field: 'department' } },
        teamSurface(rows),
      )
      const select = wrapper.find('select')
      expect(select.attributes('multiple')).toBeDefined()
      expect(wrapper.findAll('option')).toHaveLength(2)
    })
  })
})
