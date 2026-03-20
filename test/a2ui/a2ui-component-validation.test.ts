import { describe, it, expect, vi } from 'vitest'
import { validateComponent, type ComponentSchema, type SchemaResolver } from '../../src/server/services/a2ui-component-schemas.js'
import { processPipelineCommand, processBatch } from '../../src/server/services/a2ui-pipeline.js'

const TEST_SCHEMAS: Record<string, ComponentSchema> = {
  Text:          { props: { text: { type: 'string' }, variant: { type: 'string' }, strokeWidth: { type: 'string' }, dataSource: { type: 'object' } } },
  Button:        { props: { label: { type: 'string' }, text: { type: 'string' }, variant: { type: 'string' }, href: { type: 'string' } } },
  Image:         { props: { src: { type: 'string', required: true }, alt: { type: 'string' } } },
  Tabs:          { props: { tabs: { type: 'array', required: true }, active: { type: 'number' }, position: { type: 'string' }, height: { type: 'string' } } },
  Divider:       { props: {} },
  Spacer:        { props: {} },
  Slider:        { props: { label: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' }, value: { type: 'number' }, bind: { type: 'object' } } },
  Checkbox:      { props: { label: { type: 'string' }, checked: { type: 'boolean' }, bind: { type: 'object' } } },
  ChoicePicker:  { props: { options: { type: 'array' }, optionsFrom: { type: 'object' }, selected: { type: 'string' }, multi: { type: 'boolean' }, bind: { type: 'object' } } },
  List:          { props: { rows: { type: 'array' }, wrap: { type: 'number' }, grow: { type: 'number' } } },
  Card:          { props: { child: { type: 'string' }, title: { type: 'string' }, image: { type: 'string' }, imageAlt: { type: 'string' }, actions: { type: 'array' }, variant: { type: 'string' }, side: { type: 'boolean' }, size: { type: 'string' }, shadow: { type: 'string' } } },
  Modal:         { props: { trigger: { type: 'string' }, content: { type: 'string' } } },
  TextField:     { props: { label: { type: 'string|object', required: true }, value: { type: 'string|object' }, variant: { type: 'string' }, validationRegexp: { type: 'string' }, checks: { type: 'array' }, accessibility: { type: 'object' }, placeholder: { type: 'string' } } },
  DateTimeInput: { props: { label: { type: 'string' }, value: { type: 'string' }, enableDate: { type: 'boolean' }, enableTime: { type: 'boolean' }, min: { type: 'string' }, max: { type: 'string' } } },
  Icon:          { props: { icon: { type: 'string|object', required: true }, size: { type: 'number' }, color: { type: 'string' } } },
  AudioPlayer:   { props: { url: { type: 'string', required: true }, description: { type: 'string' }, autoplay: { type: 'boolean' }, loop: { type: 'boolean' }, muted: { type: 'boolean' } } },
  Video:         { props: { src: { type: 'string' }, url: { type: 'string' }, poster: { type: 'string' }, autoplay: { type: 'boolean' }, loop: { type: 'boolean' }, muted: { type: 'boolean' }, controls: { type: 'boolean' } } },
  Badge:         { props: { text: { type: 'string' }, variant: { type: 'string' }, dataSource: { type: 'object' } } },
  Table:         { props: { headers: { type: 'array' }, rows: { type: 'array' }, dataSource: { type: 'object' }, sortable: { type: 'boolean' }, formatters: { type: 'object' } } },
  Stack:         { props: { children: { type: 'array' } } },
  Repeat:        { props: { dataSource: { type: 'object', required: true }, template: { type: 'object', required: true }, transforms: { type: 'object' }, emptyText: { type: 'string' }, sortable: { type: 'boolean' }, sortField: { type: 'string' } } },
  ProgressBar:   { props: { value: { type: 'number|string', required: true }, label: { type: 'string' }, dataSource: { type: 'object' } } },
  Accordion:     { props: { panels: { type: 'array', required: true }, mode: { type: 'string' }, expanded: { type: 'array' } } },
}

const resolve: SchemaResolver = (name) => TEST_SCHEMAS[name]

function makeMocks() {
  const a2uiManager = {
    upsertSurface: vi.fn(),
    setRoot: vi.fn(),
    updateDataModel: vi.fn(),
    deleteSurface: vi.fn(),
  }
  const broadcasts: any[] = []
  const gateway = {
    broadcastSpaSession: vi.fn((_s: string, msg: any) => broadcasts.push(msg)),
  }
  return { a2uiManager, gateway, broadcasts }
}

describe('validateComponent', () => {
  it('passes a valid Text component', () => {
    const r = validateComponent({ id: 'c1', component: 'Text', text: 'hello' }, resolve)
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it('errors on missing required prop', () => {
    const r = validateComponent({ id: 'c1', component: 'Image' }, resolve)
    expect(r.errors).toContain("Missing required prop 'src'")
  })

  it('errors on wrong prop type', () => {
    const r = validateComponent({ id: 'c1', component: 'Text', text: 123 }, resolve)
    expect(r.errors.some(e => e.includes("Prop 'text'") && e.includes("expected type 'string'"))).toBe(true)
  })

  it('warns on unknown prop', () => {
    const r = validateComponent({ id: 'c1', component: 'Text', text: 'hi', bogus: true }, resolve)
    expect(r.warnings).toContain("Unknown prop 'bogus' on 'Text'")
    expect(r.errors).toEqual([])
  })

  it('warns on unknown component type', () => {
    const r = validateComponent({ id: 'c1', component: 'CustomWidget', foo: 'bar' }, resolve)
    expect(r.warnings).toContain("Unknown component type 'CustomWidget'")
    expect(r.errors).toEqual([])
  })

  it('passes Tabs with correct child prop', () => {
    const r = validateComponent({ id: 'c1', component: 'Tabs', tabs: [{ label: 'A', child: 'x' }] }, resolve)
    expect(r.errors).toEqual([])
  })

  it('errors on Tabs with children instead of tabs (wrong type)', () => {
    const r = validateComponent({ id: 'c1', component: 'Tabs', tabs: 'not-array' }, resolve)
    expect(r.errors.some(e => e.includes("'tabs'") && e.includes("'array'"))).toBe(true)
  })

  it('errors on Tabs missing required tabs prop', () => {
    const r = validateComponent({ id: 'c1', component: 'Tabs' }, resolve)
    expect(r.errors).toContain("Missing required prop 'tabs'")
  })

  it('warns when Tabs receives children instead of tabs', () => {
    const r = validateComponent({ id: 'c1', component: 'Tabs', tabs: [{ label: 'A', child: 'x' }], children: ['a'] }, resolve)
    expect(r.warnings).toContain("Unknown prop 'children' on 'Tabs'")
  })

  it('passes Accordion with panels', () => {
    const r = validateComponent({ id: 'c1', component: 'Accordion', panels: [{ title: 'A', child: 'x' }] }, resolve)
    expect(r.errors).toEqual([])
  })

  it('errors on Accordion missing panels', () => {
    const r = validateComponent({ id: 'c1', component: 'Accordion' }, resolve)
    expect(r.errors).toContain("Missing required prop 'panels'")
  })

  it('passes Image with src', () => {
    const r = validateComponent({ id: 'c1', component: 'Image', src: 'http://example.com/img.png' }, resolve)
    expect(r.errors).toEqual([])
  })

  it('errors on Image missing src', () => {
    const r = validateComponent({ id: 'c1', component: 'Image' }, resolve)
    expect(r.errors).toContain("Missing required prop 'src'")
  })

  it('passes Repeat with required props', () => {
    const r = validateComponent({ id: 'c1', component: 'Repeat', dataSource: { name: 'ds' }, template: { Text: { text: '${name}' } } }, resolve)
    expect(r.errors).toEqual([])
  })

  it('errors on Repeat missing dataSource', () => {
    const r = validateComponent({ id: 'c1', component: 'Repeat', template: { Text: {} } }, resolve)
    expect(r.errors).toContain("Missing required prop 'dataSource'")
  })

  it('passes ProgressBar with number value', () => {
    const r = validateComponent({ id: 'c1', component: 'ProgressBar', value: 50 }, resolve)
    expect(r.errors).toEqual([])
  })

  it('passes ProgressBar with string template value', () => {
    const r = validateComponent({ id: 'c1', component: 'ProgressBar', value: '${$value}' }, resolve)
    expect(r.errors).toEqual([])
  })

  it('errors on ProgressBar with boolean value', () => {
    const r = validateComponent({ id: 'c1', component: 'ProgressBar', value: true }, resolve)
    expect(r.errors.some(e => e.includes("'value'"))).toBe(true)
  })

  it('passes Icon with string', () => {
    const r = validateComponent({ id: 'c1', component: 'Icon', icon: 'check' }, resolve)
    expect(r.errors).toEqual([])
  })

  it('passes Icon with object', () => {
    const r = validateComponent({ id: 'c1', component: 'Icon', icon: { path: 'M0 0' } }, resolve)
    expect(r.errors).toEqual([])
  })

  it('errors on Icon with array', () => {
    const r = validateComponent({ id: 'c1', component: 'Icon', icon: ['bad'] }, resolve)
    expect(r.errors.some(e => e.includes("'icon'") && e.includes("'string|object'"))).toBe(true)
  })

  it('passes Divider with no props', () => {
    const r = validateComponent({ id: 'c1', component: 'Divider' }, resolve)
    expect(r.errors).toEqual([])
  })

  it('passes AudioPlayer with url', () => {
    const r = validateComponent({ id: 'c1', component: 'AudioPlayer', url: 'http://example.com/audio.mp3' }, resolve)
    expect(r.errors).toEqual([])
  })

  it('errors on AudioPlayer missing url', () => {
    const r = validateComponent({ id: 'c1', component: 'AudioPlayer' }, resolve)
    expect(r.errors).toContain("Missing required prop 'url'")
  })

  it('passes TextField with string label', () => {
    const r = validateComponent({ id: 'c1', component: 'TextField', label: 'Name' }, resolve)
    expect(r.errors).toEqual([])
  })

  it('passes TextField with path-bound label', () => {
    const r = validateComponent({ id: 'c1', component: 'TextField', label: { path: '/labels/name' } }, resolve)
    expect(r.errors).toEqual([])
  })

  it('errors on TextField missing label', () => {
    const r = validateComponent({ id: 'c1', component: 'TextField', value: 'x' }, resolve)
    expect(r.errors).toContain("Missing required prop 'label'")
  })
})

describe('pipeline component validation integration', () => {
  it('returns ok:true with no errors for valid components', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text', text: 'hello' }] },
    }, 0, a2uiManager as any, gateway as any, resolve)
    expect(result.ok).toBe(true)
    expect(result.componentErrors).toBeUndefined()
    expect(a2uiManager.upsertSurface).toHaveBeenCalled()
  })

  it('returns ok:false with ValidationFailed for invalid component', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Image' }] },
    }, 0, a2uiManager as any, gateway as any, resolve)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/ValidationFailed/)
    expect(result.error).toMatch(/c1/)
    expect(result.componentErrors).toHaveLength(1)
    expect(result.componentErrors![0].id).toBe('c1')
    expect(a2uiManager.upsertSurface).not.toHaveBeenCalled()
  })

  it('processes valid components and reports errors for invalid ones in same batch', () => {
    const { a2uiManager, gateway, broadcasts } = makeMocks()
    const result = processPipelineCommand('dev', {
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'good', component: 'Text', text: 'hi' },
          { id: 'bad', component: 'Image' },
        ],
      },
    }, 0, a2uiManager as any, gateway as any, resolve)
    expect(result.ok).toBe(false)
    expect(result.componentErrors).toHaveLength(1)
    expect(result.componentErrors![0].id).toBe('bad')
    expect(a2uiManager.upsertSurface).toHaveBeenCalledWith('dev', 's1', expect.any(Array))
    const upsertedComponents = a2uiManager.upsertSurface.mock.calls[0][2]
    expect(upsertedComponents).toHaveLength(1)
    expect(upsertedComponents[0].id).toBe('good')
  })

  it('includes warnings for unknown props on valid components', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text', text: 'hi', typo: true }] },
    }, 0, a2uiManager as any, gateway as any, resolve)
    expect(result.ok).toBe(true)
    expect(result.componentWarnings).toHaveLength(1)
    expect(result.componentWarnings![0].warnings).toContain("Unknown prop 'typo' on 'Text'")
    expect(a2uiManager.upsertSurface).toHaveBeenCalled()
  })

  it('warns but passes unknown component types', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'ThirdPartyWidget', foo: 'bar' }] },
    }, 0, a2uiManager as any, gateway as any, resolve)
    expect(result.ok).toBe(true)
    expect(result.componentWarnings).toHaveLength(1)
    expect(result.componentWarnings![0].warnings[0]).toMatch(/Unknown component type/)
    expect(a2uiManager.upsertSurface).toHaveBeenCalled()
  })

  it('catches Tabs with children array instead of child string in tab defs', () => {
    const { a2uiManager, gateway } = makeMocks()
    const result = processPipelineCommand('dev', {
      updateComponents: {
        surfaceId: 's1',
        components: [{ id: 'c1', component: 'Tabs', tabs: [{ label: 'A', child: 'x' }], children: ['a'] }],
      },
    }, 0, a2uiManager as any, gateway as any, resolve)
    expect(result.ok).toBe(true)
    expect(result.componentWarnings).toHaveLength(1)
    expect(result.componentWarnings![0].warnings).toContain("Unknown prop 'children' on 'Tabs'")
  })

  it('batch with mixed valid/invalid returns per-command results', () => {
    const { a2uiManager, gateway } = makeMocks()
    const jsonl = [
      JSON.stringify({ updateComponents: { surfaceId: 's1', components: [{ id: 'c1', component: 'Text', text: 'ok' }] } }),
      JSON.stringify({ updateComponents: { surfaceId: 's1', components: [{ id: 'c2', component: 'Image' }] } }),
    ].join('\n')
    const results = processBatch('main', jsonl, a2uiManager as any, gateway as any, resolve)
    expect(results[0].ok).toBe(true)
    expect(results[1].ok).toBe(false)
    expect(results[1].error).toMatch(/ValidationFailed/)
  })
})
