import type { PackageDefinition } from '@haliphax-openclaw/a2ui-sdk'
import A2UIBadge from './A2UIBadge.vue'
import A2UITable from './A2UITable.vue'

const definition: PackageDefinition = {
  components: [
    { name: 'Badge', component: A2UIBadge },
    { name: 'Table', component: A2UITable },
  ],
}

export default definition
