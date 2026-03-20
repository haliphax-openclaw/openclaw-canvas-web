/** Row + format options supplied by each Repeat iteration (provide/inject). */
export interface RepeatFmtContext {
  row: Record<string, unknown>
  transforms: Record<string, { fn: string; field?: string }>
  allRows: Record<string, unknown>[]
}

/** String key so provide/inject works across Vite chunks (avoid Symbol identity issues). */
export const A2UI_REPEAT_FMT_KEY = 'a2uiRepeatFmtCtx'
