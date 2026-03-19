import { Router } from 'express'
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * POST /api/file-spawn — reads a prompt file from the canvas workspace
 * and spawns a subagent via gateway /tools/invoke (sessions_spawn).
 */
export function fileSpawnRoute(gatewayUrl: string, gatewayToken: string, canvasRoot: string, agentWorkspaceMap?: Map<string, string>): Router {
  const router = Router()

  router.post('/api/file-spawn', async (req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', async () => {
      const body = Buffer.concat(chunks).toString()
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(body)
      } catch {
        res.status(400).json({ ok: false, error: 'invalid JSON' })
        return
      }

      const filePath = parsed.file as string | undefined
      if (!filePath || typeof filePath !== 'string') {
        res.status(400).json({ ok: false, error: 'file is required' })
        return
      }

      // Resolve root based on agentId
      const agentId = parsed.agentId as string | undefined
      const root = (agentId && agentWorkspaceMap?.get(agentId)) ?? canvasRoot

      // Block traversal
      const resolved = path.resolve(root, filePath)
      if (!resolved.startsWith(root + path.sep) && resolved !== root) {
        res.status(403).json({ ok: false, error: 'path traversal not allowed' })
        return
      }

      let prompt: string
      try {
        prompt = await fs.readFile(resolved, 'utf-8')
      } catch {
        res.status(404).json({ ok: false, error: 'file not found' })
        return
      }

      const args: Record<string, unknown> = { task: prompt, mode: 'run' }
      if (parsed.agentId) args.agentId = parsed.agentId
      if (parsed.model) args.model = parsed.model
      if (parsed.sessionKey) args.sessionKey = parsed.sessionKey

      const sessionKey = (parsed.sessionKey as string) || 'devnull'
      const url = new URL('/tools/invoke', gatewayUrl.replace('ws://', 'http://').replace('wss://', 'https://'))
      const payload = JSON.stringify({ tool: 'sessions_spawn', sessionKey, args })

      const proxyReq = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${gatewayToken}`,
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
