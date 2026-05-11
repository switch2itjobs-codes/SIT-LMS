import express from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import { uploadToR2 } from '../lib/r2.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
})

export const fileUploadRouter = express.Router()

/**
 * Generic file upload to R2.
 * POST /api/upload
 * Body: multipart form with `file` field + `folder` field (e.g. 'assignments', 'chat')
 * Optional: `path` field for custom key prefix
 * Returns: { url: string }
 */
fileUploadRouter.post(
  '/',
  requireAuth,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message ?? 'Upload failed.' })
      next()
    })
  },
  async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Missing file.' })
      }

      const folder = req.body.folder || 'uploads'
      const pathPrefix = req.body.path || ''
      const cleanName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      const key = pathPrefix
        ? `${pathPrefix}/${cleanName}`
        : `${Date.now()}-${cleanName}`

      const url = await uploadToR2(folder, key, req.file.buffer, req.file.mimetype || 'application/octet-stream')

      return res.json({ url })
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Upload failed.' })
    }
  },
)
