/** Prop type identifiers for schema validation */
type PropType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'string|object' | 'number|string'

interface PropSchema {
  type: PropType
  required?: boolean
}

export interface ComponentSchema {
  props: Record<string, PropSchema>
}

export type SchemaResolver = (componentName: string) => ComponentSchema | undefined

/** Reserved keys that are not user-defined props */
const RESERVED_KEYS = new Set(['id', 'component'])

function matchesType(value: unknown, type: PropType): boolean {
  if (type === 'string|object') return typeof value === 'string' || (typeof value === 'object' && value !== null && !Array.isArray(value))
  if (type === 'number|string') return typeof value === 'number' || typeof value === 'string'
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value)
  return typeof value === type
}

export interface ComponentValidationResult {
  id: string
  errors: string[]
  warnings: string[]
}

/**
 * Validate a single normalized component against its schema.
 * Returns errors for required/type mismatches, warnings for unknown props.
 * Unknown component types get a warning only.
 */
export function validateComponent(
  comp: { id: string; component: string; [key: string]: unknown },
  resolveSchema: SchemaResolver,
): ComponentValidationResult {
  const result: ComponentValidationResult = { id: comp.id, errors: [], warnings: [] }
  const schema = resolveSchema(comp.component)

  if (!schema) {
    result.warnings.push(`Unknown component type '${comp.component}'`)
    return result
  }

  for (const [prop, def] of Object.entries(schema.props)) {
    const value = comp[prop]
    if (value === undefined || value === null) {
      if (def.required) result.errors.push(`Missing required prop '${prop}'`)
      continue
    }
    if (!matchesType(value, def.type)) {
      result.errors.push(`Prop '${prop}' expected type '${def.type}', got '${Array.isArray(value) ? 'array' : typeof value}'`)
    }
  }

  for (const key of Object.keys(comp)) {
    if (RESERVED_KEYS.has(key)) continue
    if (!schema.props[key]) {
      result.warnings.push(`Unknown prop '${key}' on '${comp.component}'`)
    }
  }

  return result
}
