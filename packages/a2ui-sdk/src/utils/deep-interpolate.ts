import { isProxy, toRaw } from 'vue'
import { formatString, type FormatStringOptions } from './format-string'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

/**
 * Recursively runs {@link formatString} on every string in a plain object / array tree.
 * Used by Repeat so template defs passed to ProgressBar/Text/etc. are fully resolved
 * (those children often have no dataSource and cannot interpolate themselves).
 */
export function deepInterpolate(
  value: unknown,
  row: Record<string, unknown>,
  options?: FormatStringOptions,
): unknown {
  if (value !== null && value !== undefined && typeof value === 'object' && isProxy(value)) {
    return deepInterpolate(toRaw(value), row, options)
  }

  const plainRow = toRaw(row) as Record<string, unknown>
  const plainOpts =
    options?.allRows != null
      ? { ...options, allRows: options.allRows.map((r) => toRaw(r) as Record<string, unknown>) }
      : options

  if (typeof value === 'string') {
    return formatString(value, plainRow, plainOpts)
  }
  if (value === null || value === undefined) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepInterpolate(item, plainRow, plainOpts))
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = deepInterpolate(v, plainRow, plainOpts)
    }
    return out
  }
  return value
}

/**
 * Second pass: any string still containing `${…}` (e.g. missed by a non-object branch) is sent through {@link formatString} again.
 */
export function sweepResidualTemplateStrings(
  value: unknown,
  row: Record<string, unknown>,
  options?: FormatStringOptions,
): unknown {
  const plainRow = toRaw(row) as Record<string, unknown>
  const plainOpts =
    options?.allRows != null
      ? { ...options, allRows: options.allRows.map((r) => toRaw(r) as Record<string, unknown>) }
      : options

  if (value !== null && value !== undefined && typeof value === 'object' && isProxy(value)) {
    return sweepResidualTemplateStrings(toRaw(value), plainRow, plainOpts)
  }

  if (typeof value === 'string' && value.includes('${')) {
    return formatString(value, plainRow, plainOpts)
  }
  if (value === null || value === undefined) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => sweepResidualTemplateStrings(item, plainRow, plainOpts))
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = sweepResidualTemplateStrings(v, plainRow, plainOpts)
    }
    return out
  }
  return value
}

/**
 * Fully resolve a Repeat template inner def for one row. Repeat should pass the result as `def` to children so they need no repeat-specific logic.
 */
export function interpolateRepeatChildDef(
  innerDef: unknown,
  row: Record<string, unknown>,
  options?: FormatStringOptions,
): Record<string, unknown> {
  let inner: unknown = innerDef
  while (inner !== null && inner !== undefined && typeof inner === 'object' && isProxy(inner)) {
    inner = toRaw(inner)
  }

  const plainRow = { ...toRaw(row) } as Record<string, unknown>
  const plainOpts =
    options?.allRows != null
      ? { ...options, allRows: options.allRows.map((r) => ({ ...toRaw(r) } as Record<string, unknown>)) }
      : options

  const once = deepInterpolate(inner, plainRow, plainOpts)
  return sweepResidualTemplateStrings(once, plainRow, plainOpts) as Record<string, unknown>
}
