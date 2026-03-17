import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import http from 'node:http'
import { scaffoldRoute } from '../src/server/routes/scaffold.js'

let server: http.Server
let port: number

beforeEach(async () => {
  const app = express()
  app.use(scaffoldRoute())
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = (server.address() as any).port
      resolve()
    })
  })
})

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()))
})

describe('scaffoldRoute', () => {
  it('returns HTML with Canvas Ready message', async () => {
    const res = await new Promise<{ status: number; body: string; contentType: string }>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/scaffold`, (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve({ status: res.statusCode!, body, contentType: res.headers['content-type']! }))
      }).on('error', reject)
    })
    expect(res.status).toBe(200)
    expect(res.contentType).toMatch(/html/)
    expect(res.body).toContain('Canvas Ready')
    expect(res.body).toContain('index.html')
  })
})
