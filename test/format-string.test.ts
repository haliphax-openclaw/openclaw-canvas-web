import { describe, it, expect } from 'vitest'
import { formatString } from '../src/client/utils/format-string'

describe('formatString', () => {
  it('substitutes basic fields', () => {
    expect(formatString('Hello ${name}!', { name: 'Alice' })).toBe('Hello Alice!')
  })

  it('substitutes multiple fields', () => {
    expect(formatString('${a} and ${b}', { a: 1, b: 2 })).toBe('1 and 2')
  })

  it('handles dollar-prefixed keys', () => {
    expect(formatString('${$value} / ${$count}', { $value: 42, $count: 10 })).toBe('42 / 10')
  })

  it('supports pipe transforms (percentOfMax)', () => {
    const rows = [{ points: 50 }, { points: 100 }]
    const result = formatString('${points | percentOfMax}', { points: 50 }, {
      transforms: { percentOfMax: { fn: 'percentOfMax' } },
      allRows: rows,
    })
    expect(result).toBe('50')
  })

  it('resolves JSON Pointer paths', () => {
    expect(formatString('${/data/name}', { data: { name: 'Bob' } })).toBe('Bob')
  })

  it('resolves nested JSON Pointer paths', () => {
    expect(formatString('${/a/b/c}', { a: { b: { c: 'deep' } } })).toBe('deep')
  })

  it('leaves unresolved expressions as-is', () => {
    expect(formatString('${missing}', {})).toBe('${missing}')
  })

  it('leaves unresolved JSON Pointer as-is', () => {
    expect(formatString('${/no/path}', { no: {} })).toBe('${/no/path}')
  })

  it('returns empty template unchanged', () => {
    expect(formatString('', { name: 'x' })).toBe('')
  })

  it('returns template with no expressions unchanged', () => {
    expect(formatString('plain text', { name: 'x' })).toBe('plain text')
  })

  it('converts null values to empty string', () => {
    expect(formatString('${val}', { val: null })).toBe('')
  })

  it('converts numeric values to string', () => {
    expect(formatString('${n}', { n: 0 })).toBe('0')
  })

  it('handles multiple expressions in one template', () => {
    expect(formatString('${a}-${b}-${c}', { a: 1, b: 2, c: 3 })).toBe('1-2-3')
  })

  it('handles mixed resolved and unresolved', () => {
    expect(formatString('${a} ${b}', { a: 'yes' })).toBe('yes ${b}')
  })
})
