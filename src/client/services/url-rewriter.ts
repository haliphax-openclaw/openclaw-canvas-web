/**
 * Rewrites openclaw-canvas://<session>/<path> URLs to
 * http(s)://<host>:<port>/canvas/<session>/<path>
 */
export function rewriteCanvasUrl(url: string): string {
  const prefix = 'openclaw-canvas://'
  if (!url.startsWith(prefix)) return url
  const rest = url.slice(prefix.length)
  return `${location.origin}/canvas/${rest}`
}
