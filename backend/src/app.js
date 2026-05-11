import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { adminStudentsRouter } from './routes/adminStudents.js'
import { studentProfileRouter } from './routes/studentProfile.js'
import { zoomRouter } from './routes/zoom.js'
import { fileUploadRouter } from './routes/fileUpload.js'
import { classesRouter } from './routes/classes.js'

export const app = express()

const allowedOriginsSet = new Set(env.allowedOrigins)

function isLocalLoopbackOrigin(origin) {
  try {
    const u = new URL(origin)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return false
    }
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

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

      // Vite often picks 5174, 5175, … if 5173 is busy — allow any localhost port in non-production.
      if (process.env.NODE_ENV !== 'production' && isLocalLoopbackOrigin(origin)) {
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

app.use('/api/admin/students', adminStudentsRouter)
app.use('/api/student/profile', studentProfileRouter)
app.use('/api/zoom', zoomRouter)
app.use('/api/upload', fileUploadRouter)
app.use('/api/classes', classesRouter)

app.use((error, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('[server:error]', error)
  res.status(500).json({ error: 'Unhandled backend error.' })
})
