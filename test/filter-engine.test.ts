import { describe, it, expect } from 'vitest'
import { matchFilter, applyFilters, formatCompact, computeAggregate, type FieldFilter } from '@haliphax-openclaw/a2ui-sdk'

const base: Omit<FieldFilter, 'op' | 'value' | 'field'> = { nullValue: '', isNull: false, componentId: 'c1' }

describe('matchFilter', () => {
  it('eq matches exact value', () => {
    expect(matchFilter({ x: 5 }, { ...base, field: 'x', op: 'eq', value: 5 })).toBe(true)
    expect(matchFilter({ x: 5 }, { ...base, field: 'x', op: 'eq', value: 6 })).toBe(false)
  })

  it('contains matches case-insensitive substring', () => {
    expect(matchFilter({ name: 'Hello World' }, { ...base, field: 'name', op: 'contains', value: 'hello' })).toBe(true)
    expect(matchFilter({ name: 'Hello' }, { ...base, field: 'name', op: 'contains', value: 'xyz' })).toBe(false)
  })

  it('gte/lte compare numbers', () => {
    expect(matchFilter({ v: 10 }, { ...base, field: 'v', op: 'gte', value: 10 })).toBe(true)
    expect(matchFilter({ v: 9 }, { ...base, field: 'v', op: 'gte', value: 10 })).toBe(false)
    expect(matchFilter({ v: 10 }, { ...base, field: 'v', op: 'lte', value: 10 })).toBe(true)
    expect(matchFilter({ v: 11 }, { ...base, field: 'v', op: 'lte', value: 10 })).toBe(false)
  })

  it('range checks inclusive bounds', () => {
    expect(matchFilter({ v: 5 }, { ...base, field: 'v', op: 'range', value: [1, 10] })).toBe(true)
    expect(matchFilter({ v: 0 }, { ...base, field: 'v', op: 'range', value: [1, 10] })).toBe(false)
  })

  it('in checks array membership', () => {
    expect(matchFilter({ s: 'a' }, { ...base, field: 's', op: 'in', value: ['a', 'b'] })).toBe(true)
    expect(matchFilter({ s: 'c' }, { ...base, field: 's', op: 'in', value: ['a', 'b'] })).toBe(false)
  })
})

describe('applyFilters', () => {
  const rows = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]

  it('returns all rows when no active filters', () => {
    const nullFilter: FieldFilter = { ...base, field: 'name', op: 'eq', value: '', isNull: true }
    expect(applyFilters(rows, [nullFilter])).toEqual(rows)
  })

  it('filters rows by active filters', () => {
    const f: FieldFilter = { ...base, field: 'name', op: 'eq', value: 'Alice' }
    expect(applyFilters(rows, [f])).toEqual([{ name: 'Alice', age: 30 }])
  })

  it('returns all rows when filters array is empty', () => {
    expect(applyFilters(rows, [])).toEqual(rows)
  })
})

describe('formatCompact', () => {
  it('formats millions', () => expect(formatCompact(1_500_000)).toBe('1.5M'))
  it('formats thousands', () => expect(formatCompact(2_500)).toBe('2.5K'))
  it('returns plain number below 1000', () => expect(formatCompact(42)).toBe('42'))
})

describe('computeAggregate', () => {
  const rows = [{ v: 10 }, { v: 20 }, { v: 30 }]

  it('count returns row count', () => expect(computeAggregate({ fn: 'count' }, rows)).toBe(3))
  it('sum adds values', () => expect(computeAggregate({ fn: 'sum', field: 'v' }, rows)).toBe(60))
  it('avg computes mean', () => expect(computeAggregate({ fn: 'avg', field: 'v' }, rows)).toBe(20))
  it('min finds minimum', () => expect(computeAggregate({ fn: 'min', field: 'v' }, rows)).toBe(10))
  it('max finds maximum', () => expect(computeAggregate({ fn: 'max', field: 'v' }, rows)).toBe(30))
  it('returns 0 for empty rows', () => expect(computeAggregate({ fn: 'sum', field: 'v' }, [])).toBe(0))
  it('ignores NaN values', () => expect(computeAggregate({ fn: 'sum', field: 'v' }, [{ v: 'abc' }, { v: 5 }])).toBe(5))
})
