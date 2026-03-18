import { Router } from 'express'
import http from 'node:http'

/**
 * POST /api/agent — proxies to gateway POST /tools/invoke (sessions_spawn)
 * Uses isolated sessions to avoid hooks security boundary warnings.
 * Keeps the gateway token server-side so canvas content never sees it.
 */
export function agentProxyRoute(gatewayUrl: string, hooksToken: string): Router {
  const router = Router()

  router.post('/api/agent', (req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString()
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(body)
      } catch {
        res.status(400).json({ ok: false, error: 'invalid JSON' })
        return
      }

      if (!parsed.message || typeof parsed.message !== 'string') {
        res.status(400).json({ ok: false, error: 'message is required' })
        return
      }

      const args: Record<string, unknown> = {
        task: parsed.message,
        mode: 'run',
      }
      if (parsed.agentId) args.agentId = parsed.agentId
      if (parsed.model) args.model = parsed.model
      if (parsed.thinking) args.thinking = parsed.thinking
      if (parsed.timeoutSeconds) args.runTimeoutSeconds = parsed.timeoutSeconds

      const url = new URL('/tools/invoke', gatewayUrl.replace('ws://', 'http://').replace('wss://', 'https://'))
      const payload = JSON.stringify({ tool: 'sessions_spawn', sessionKey: 'devnull', args })

      const proxyReq = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${hooksToken}`,
        },
      }, (proxyRes) => {
        const resChunks: Buffer[] = []
        proxyRes.on('data', (c: Buffer) => resChunks.push(c))
        proxyRes.on('end', () => {
          const resBody = Buffer.concat(resChunks).toString()
          res.status(proxyRes.statusCode ?? 502).type('json').send(resBody)
        })
      })

      proxyReq.on('error', (err) => {
        res.status(502).json({ ok: false, error: `gateway unreachable: ${err.message}` })
      })

      proxyReq.end(payload)
    })
  })

  return router
}
