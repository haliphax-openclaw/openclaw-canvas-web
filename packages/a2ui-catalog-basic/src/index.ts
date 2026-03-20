import type { PackageDefinition } from '@haliphax-openclaw/a2ui-sdk'
import A2UIColumn from './A2UIColumn.vue'
import A2UIRow from './A2UIRow.vue'
import A2UIText from './A2UIText.vue'
import A2UIButton from './A2UIButton.vue'
import A2UIImage from './A2UIImage.vue'
import A2UITabs from './A2UITabs.vue'
import A2UIDivider from './A2UIDivider.vue'
import A2UISlider from './A2UISlider.vue'
import A2UICheckbox from './A2UICheckbox.vue'
import A2UIChoicePicker from './A2UIChoicePicker.vue'

const definition: PackageDefinition = {
  components: [
    { name: 'Column', component: A2UIColumn },
    { name: 'Row', component: A2UIRow },
    { name: 'Text', component: A2UIText },
    { name: 'Button', component: A2UIButton },
    { name: 'Image', component: A2UIImage },
    { name: 'Tabs', component: A2UITabs },
    { name: 'Divider', component: A2UIDivider },
    { name: 'Slider', component: A2UISlider },
    { name: 'Checkbox', component: A2UICheckbox },
    { name: 'ChoicePicker', component: A2UIChoicePicker },
  ],
}

export default definition
