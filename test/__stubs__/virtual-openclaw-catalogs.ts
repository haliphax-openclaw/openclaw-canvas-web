/** Stub for virtual:openclaw-catalogs used in tests */
import A2UIBadge from '../../packages/a2ui-catalog-extended/src/A2UIBadge.vue'
import A2UITable from '../../packages/a2ui-catalog-extended/src/A2UITable.vue'

export const catalogComponents: Record<string, { component: unknown }> = {
  Badge: { component: A2UIBadge },
  Table: { component: A2UITable },
}
