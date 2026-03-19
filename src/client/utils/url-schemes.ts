export type SchemeType = 'canvas' | 'agent' | 'fileprompt' | null

export interface ParsedScheme {
  type: SchemeType
  params: Record<string, string>
  path: string
}

const SCHEMES: [string, SchemeType][] = [
  ['openclaw-canvas://', 'canvas'],
  ['openclaw-fileprompt://', 'fileprompt'],
  ['openclaw://', 'agent'],
]

/**
 * Parse an openclaw custom scheme URL.
 * Everything after :// is the payload — no query string delimiter needed.
 *   openclaw-canvas://session/subpath
 *   openclaw://message=hello&agentId=dev
 *   openclaw-fileprompt://file=prompts/deploy.md&agentId=dev
 */
export function parseOpenClawUrl(url: string): ParsedScheme | null {
  for (const [prefix, type] of SCHEMES) {
    if (!url.startsWith(prefix)) continue
    const rest = url.slice(prefix.length)
    const params: Record<string, string> = {}
    if (rest) new URLSearchParams(rest).forEach((v, k) => { params[k] = v })
    return { type, path: rest, params }
  }
  return null
}
