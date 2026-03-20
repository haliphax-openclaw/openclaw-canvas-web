import type { PackageDefinition } from '@haliphax-openclaw/a2ui-sdk'
import A2UIBadge from './A2UIBadge.vue'

const definition: PackageDefinition = {
  components: [
    { name: 'Badge', component: A2UIBadge },
  ],
}

export default definition
