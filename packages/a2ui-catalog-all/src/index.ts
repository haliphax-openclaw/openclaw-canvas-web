import type { PackageDefinition } from '@haliphax-openclaw/a2ui-sdk'
import basicCatalog from '@haliphax-openclaw/a2ui-catalog-basic'
import extendedCatalog from '@haliphax-openclaw/a2ui-catalog-extended'

const definition: PackageDefinition = {
  components: [
    ...basicCatalog.components,
    ...extendedCatalog.components,
  ],
}

export default definition
