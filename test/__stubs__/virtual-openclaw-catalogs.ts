/** Stub for virtual:openclaw-catalogs used in tests */
import A2UIColumn from '../../packages/a2ui-catalog-basic/src/A2UIColumn.vue'
import A2UIRow from '../../packages/a2ui-catalog-basic/src/A2UIRow.vue'
import A2UIText from '../../packages/a2ui-catalog-basic/src/A2UIText.vue'
import A2UIButton from '../../packages/a2ui-catalog-basic/src/A2UIButton.vue'
import A2UIImage from '../../packages/a2ui-catalog-basic/src/A2UIImage.vue'
import A2UITabs from '../../packages/a2ui-catalog-basic/src/A2UITabs.vue'
import A2UIDivider from '../../packages/a2ui-catalog-basic/src/A2UIDivider.vue'
import A2UISlider from '../../packages/a2ui-catalog-basic/src/A2UISlider.vue'
import A2UICheckbox from '../../packages/a2ui-catalog-basic/src/A2UICheckbox.vue'
import A2UIChoicePicker from '../../packages/a2ui-catalog-basic/src/A2UIChoicePicker.vue'
import A2UIBadge from '../../packages/a2ui-catalog-extended/src/A2UIBadge.vue'
import A2UITable from '../../packages/a2ui-catalog-extended/src/A2UITable.vue'
import A2UIStack from '../../packages/a2ui-catalog-extended/src/A2UIStack.vue'
import A2UISpacer from '../../packages/a2ui-catalog-extended/src/A2UISpacer.vue'
import A2UIProgressBar from '../../packages/a2ui-catalog-extended/src/A2UIProgressBar.vue'
import A2UIRepeat from '../../packages/a2ui-catalog-extended/src/A2UIRepeat.vue'
import A2UIAccordion from '../../packages/a2ui-catalog-extended/src/A2UIAccordion.vue'

export const catalogComponents: Record<string, { component: unknown }> = {
  Column: { component: A2UIColumn },
  Row: { component: A2UIRow },
  Text: { component: A2UIText },
  Button: { component: A2UIButton },
  Image: { component: A2UIImage },
  Tabs: { component: A2UITabs },
  Divider: { component: A2UIDivider },
  Slider: { component: A2UISlider },
  Checkbox: { component: A2UICheckbox },
  ChoicePicker: { component: A2UIChoicePicker },
  Badge: { component: A2UIBadge },
  Table: { component: A2UITable },
  Stack: { component: A2UIStack },
  Spacer: { component: A2UISpacer },
  ProgressBar: { component: A2UIProgressBar },
  Repeat: { component: A2UIRepeat },
  Accordion: { component: A2UIAccordion },
}
