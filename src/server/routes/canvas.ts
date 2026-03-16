import { Router } from 'express'
import mime from 'mime-types'
import fs from 'node:fs/promises'
import { FileResolver } from '../services/file-resolver.js'

export function canvasRoute(fileResolver: FileResolver): Router {
  const router = Router()

  // Wildcard path: /canvas/:session/some/deep/path.html
  router.get('/canvas/:session/{*subpath}', async (req, res) => {
    const session = req.params.session as string
    const subpath = (req.params as any).subpath || 'index.html'

    const resolved = await fileResolver.resolve(session, subpath)
    if (!resolved) {
      const exists = await fileResolver.sessionExists(session)
      if (exists && (!subpath || subpath === 'index.html')) {
        if (!(await fileResolver.hasIndex(session))) {
          res.redirect(`/scaffold?session=${encodeURIComponent(session)}`)
          return
        }
      }
      res.status(404).send('Not found')
      return
    }

    const contentType = mime.lookup(resolved) || 'application/octet-stream'
    const content = await fs.readFile(resolved)
    res.type(contentType).send(content)
  })

  // Bare session path (no subpath)
  router.get('/canvas/:session', async (req, res) => {
    const { session } = req.params
    const resolved = await fileResolver.resolve(session, 'index.html')
    if (!resolved) {
      if (await fileResolver.sessionExists(session)) {
        res.redirect(`/scaffold?session=${encodeURIComponent(session)}`)
        return
      }
      res.status(404).send('Not found')
      return
    }
    const content = await fs.readFile(resolved)
    res.type('text/html').send(content)
  })

  return router
}
