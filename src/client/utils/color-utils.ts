function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = h.length === 3
    ? [h[0]+h[0], h[1]+h[1], h[2]+h[2]]
    : [h.slice(0,2), h.slice(2,4), h.slice(4,6)]
  return [parseInt(n[0],16), parseInt(n[1],16), parseInt(n[2],16)]
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r,g,b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2,'0')).join('')
}

export function lighten(hex: string, pct: number): string {
  const [r,g,b] = parseHex(hex)
  const f = pct / 100
  return toHex(r + (255-r)*f, g + (255-g)*f, b + (255-b)*f)
}

export function darken(hex: string, pct: number): string {
  const [r,g,b] = parseHex(hex)
  const f = 1 - pct / 100
  return toHex(r*f, g*f, b*f)
}
