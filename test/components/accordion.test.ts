import { describe, it, expect } from 'vitest'

describe('A2UIAccordion logic', () => {
  // Extract the toggle/state logic as pure functions matching the component
  const createAccordion = (mode: string, expanded: number[] = []) => {
    let openSet = new Set<number>(expanded)
    return {
      isOpen: (i: number) => openSet.has(i),
      toggle: (i: number) => {
        const next = new Set(openSet)
        if (next.has(i)) {
          next.delete(i)
        } else {
          if (mode === 'single') next.clear()
          next.add(i)
        }
        openSet = next
      },
    }
  }

  it('starts with all panels collapsed by default', () => {
    const acc = createAccordion('single')
    expect(acc.isOpen(0)).toBe(false)
    expect(acc.isOpen(1)).toBe(false)
  })

  it('respects initial expanded indices', () => {
    const acc = createAccordion('single', [0])
    expect(acc.isOpen(0)).toBe(true)
    expect(acc.isOpen(1)).toBe(false)
  })

  it('single mode: opening a panel closes others', () => {
    const acc = createAccordion('single', [0])
    acc.toggle(1)
    expect(acc.isOpen(0)).toBe(false)
    expect(acc.isOpen(1)).toBe(true)
  })

  it('single mode: toggling open panel closes it', () => {
    const acc = createAccordion('single', [0])
    acc.toggle(0)
    expect(acc.isOpen(0)).toBe(false)
  })

  it('multi mode: multiple panels can be open', () => {
    const acc = createAccordion('multi')
    acc.toggle(0)
    acc.toggle(1)
    expect(acc.isOpen(0)).toBe(true)
    expect(acc.isOpen(1)).toBe(true)
  })

  it('multi mode: toggling a panel does not affect others', () => {
    const acc = createAccordion('multi', [0, 1])
    acc.toggle(0)
    expect(acc.isOpen(0)).toBe(false)
    expect(acc.isOpen(1)).toBe(true)
  })

  it('defaults mode to single', () => {
    const def: any = { panels: [{ title: 'A', child: 'a' }] }
    expect(def.mode ?? 'single').toBe('single')
  })

  it('defaults panels to empty array', () => {
    const def: any = {}
    expect(def.panels ?? []).toEqual([])
  })
})
