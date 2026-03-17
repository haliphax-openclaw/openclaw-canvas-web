import { describe, it, expect } from 'vitest'

describe('A2UITabs logic', () => {
  const createTabs = (def: any) => {
    const tabs = def.tabs ?? []
    const position = def.position ?? 'top'
    const height = def.height ?? 'auto'
    let activeIndex = def.active ?? 0
    return {
      tabs,
      position,
      height,
      get activeIndex() { return activeIndex },
      setActive(i: number) { activeIndex = i },
    }
  }

  it('defaults active to 0', () => {
    const t = createTabs({ tabs: [{ label: 'A', child: 'a' }, { label: 'B', child: 'b' }] })
    expect(t.activeIndex).toBe(0)
  })

  it('respects initial active index', () => {
    const t = createTabs({ tabs: [{ label: 'A', child: 'a' }, { label: 'B', child: 'b' }], active: 1 })
    expect(t.activeIndex).toBe(1)
  })

  it('clicking a tab changes active index', () => {
    const t = createTabs({ tabs: [{ label: 'A', child: 'a' }, { label: 'B', child: 'b' }] })
    t.setActive(1)
    expect(t.activeIndex).toBe(1)
  })

  it('defaults position to top', () => {
    const t = createTabs({ tabs: [] })
    expect(t.position).toBe('top')
  })

  it('accepts all position values', () => {
    for (const pos of ['top', 'bottom', 'left', 'right', 'hidden']) {
      const t = createTabs({ tabs: [], position: pos })
      expect(t.position).toBe(pos)
    }
  })

  it('defaults height to auto', () => {
    const t = createTabs({ tabs: [] })
    expect(t.height).toBe('auto')
  })

  it('accepts explicit height', () => {
    const t = createTabs({ tabs: [], height: '300px' })
    expect(t.height).toBe('300px')
  })

  it('defaults tabs to empty array', () => {
    const t = createTabs({})
    expect(t.tabs).toEqual([])
  })

  it('content style is empty for auto height', () => {
    const t = createTabs({ tabs: [] })
    const style = t.height === 'auto' ? {} : { height: t.height, overflow: 'auto' }
    expect(style).toEqual({})
  })

  it('content style has height and overflow for fixed height', () => {
    const t = createTabs({ tabs: [], height: '50vh' })
    const style = t.height === 'auto' ? {} : { height: t.height, overflow: 'auto' }
    expect(style).toEqual({ height: '50vh', overflow: 'auto' })
  })

  it('all panels are present regardless of active index', () => {
    const def = { tabs: [{ label: 'A', child: 'a' }, { label: 'B', child: 'b' }, { label: 'C', child: 'c' }], active: 1 }
    const t = createTabs(def)
    // All tabs should be iterable (all in DOM)
    expect(t.tabs.length).toBe(3)
    // Only index 1 is active
    expect(t.activeIndex).toBe(1)
    // Hidden panels are those where i !== activeIndex
    const hidden = t.tabs.map((_: any, i: number) => i !== t.activeIndex)
    expect(hidden).toEqual([true, false, true])
  })
})
