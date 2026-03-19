export type SchemeType = 'canvas' | 'agent' | 'fileprompt' | null

export interface ParsedScheme {
  type: SchemeType
  params: Record<string, string>
  session?: string
  path?: string
}

export function parseOpenClawUrl(url: string): ParsedScheme | null {
  if (url.startsWith('openclaw-canvas://')) {
    const rest = url.slice('openclaw-canvas://'.length)
    const slashIdx = rest.indexOf('/')
    const session = slashIdx >= 0 ? rest.slice(0, slashIdx) : rest
    const path = slashIdx >= 0 ? rest.slice(slashIdx + 1) : ''
    return { type: 'canvas', params: {}, session, path }
  }

  const isAgent = url.startsWith('openclaw://')
  const isSpawn = url.startsWith('openclaw-fileprompt://')
  if (!isAgent && !isSpawn) return null

  try {
    const rest = url.slice(isAgent ? 'openclaw://'.length : 'openclaw-fileprompt://'.length)
    const qIdx = rest.indexOf('?')
    const query = qIdx >= 0 ? rest.slice(qIdx + 1) : rest
    const params: Record<string, string> = {}
    new URLSearchParams(query).forEach((v, k) => { params[k] = v })
    return { type: isAgent ? 'agent' : 'fileprompt', params }
  } catch {
    return null
  }
}
