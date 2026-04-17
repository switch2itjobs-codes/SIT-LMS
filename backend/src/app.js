import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { zoomRouter } from './routes/zoom.js'

export const app = express()

const allowedOriginsSet = new Set(env.allowedOrigins)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests with no browser origin.
      if (!origin) {
        callback(null, true)
        return
      }

      if (allowedOriginsSet.has(origin)) {
        callback(null, true)
        return
      }

      callback(new Error(`CORS blocked for origin: ${origin}`))
    },
    credentials: true,
  }),
)

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/zoom', zoomRouter)

app.use((error, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('[server:error]', error)
  res.status(500).json({ error: 'Unhandled backend error.' })
})
