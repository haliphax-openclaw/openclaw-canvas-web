import { Router } from 'express'
import http from 'node:http'

export function cronTriggerRoute(gatewayUrl: string, hooksToken: string): Router {
  const router = Router()

  router.post('/api/cron-trigger', (req, res) => {
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

      if (!parsed.jobId || typeof parsed.jobId !== 'string') {
        res.status(400).json({ ok: false, error: 'jobId is required' })
        return
      }

      const httpUrl = gatewayUrl.replace('ws://', 'http://').replace('wss://', 'https://')
      const url = new URL('/hooks/cron/run', httpUrl)
      const payload = JSON.stringify({ jobId: parsed.jobId, runMode: parsed.runMode ?? 'force' })

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
