import express from 'express'
import multer from 'multer'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const extOk = /\.(pdf|doc|docx)$/i.test(file.originalname)
    const mimeOk =
      !file.mimetype ||
      [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ].includes(file.mimetype)
    if (extOk && mimeOk) {
      cb(null, true)
      return
    }
    cb(new Error('Only PDF or Word (.pdf, .doc, .docx) are allowed.'))
  },
})

export const adminStudentsRouter = express.Router()

async function ensureStudentResumesBucket() {
  const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets()
  if (listErr) {
    throw listErr
  }
  const exists = buckets?.some((b) => b.id === 'student-resumes' || b.name === 'student-resumes')
  if (exists) {
    return
  }
  const { error: createErr } = await supabaseAdmin.storage.createBucket('student-resumes', {
    public: true,
    fileSizeLimit: 52428800,
  })
  if (
    createErr &&
    !String(createErr.message ?? '').toLowerCase().includes('already') &&
    !String(createErr.message ?? '').toLowerCase().includes('exists')
  ) {
    throw createErr
  }
}

adminStudentsRouter.post(
  '/:studentId/resume',
  requireAuth,
  requireRole('admin'),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message ?? 'Upload failed.' })
      }
      next()
    })
  },
  async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Missing file.' })
      }
      const { studentId } = req.params
      const { data: st, error: stErr } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('id', studentId)
        .maybeSingle()
      if (stErr || !st) {
        return res.status(404).json({ error: 'Student not found.' })
      }

      await ensureStudentResumesBucket()

      const cleanName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      const objectPath = `${studentId}/${Date.now()}-${cleanName}`
      const { error: upErr } = await supabaseAdmin.storage
        .from('student-resumes')
        .upload(objectPath, req.file.buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: req.file.mimetype || 'application/octet-stream',
        })
      if (upErr) {
        return res.status(500).json({ error: upErr.message })
      }
      const { data: pub } = supabaseAdmin.storage.from('student-resumes').getPublicUrl(objectPath)
      return res.json({ resume_url: pub.publicUrl })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed.'
      return res.status(500).json({ error: msg })
    }
  },
)

adminStudentsRouter.patch(
  '/:studentId',
  requireAuth,
  requireRole('admin'),
  express.json({ limit: '512kb' }),
  async (req, res) => {
    try {
      const { studentId } = req.params
      const b = req.body ?? {}

      const expRaw = b.experience_years
      const exp =
        expRaw === '' || expRaw == null ? null : Number.parseFloat(String(expRaw))

      const student_name = typeof b.student_name === 'string' ? b.student_name.trim() : ''
      const email = typeof b.email === 'string' ? b.email.trim() : ''
      if (!student_name || !email) {
        return res.status(400).json({ error: 'student_name and email are required.' })
      }

      const updatePayload = {
        student_name,
        email,
        phone: typeof b.phone === 'string' ? b.phone.trim() || null : null,
        gender: typeof b.gender === 'string' ? b.gender.trim() || null : null,
        location: typeof b.location === 'string' ? b.location.trim() || null : null,
        degree: typeof b.degree === 'string' ? b.degree.trim() || null : null,
        previous_company: typeof b.previous_company === 'string' ? b.previous_company.trim() || null : null,
        previous_job_role: typeof b.previous_job_role === 'string' ? b.previous_job_role.trim() || null : null,
        experience_years: exp != null && !Number.isNaN(exp) ? exp : null,
        domain: typeof b.domain === 'string' ? b.domain.trim() || null : null,
        stage: typeof b.stage === 'string' ? b.stage.trim() : 'training',
        payment_status: typeof b.payment_status === 'string' ? b.payment_status.trim() : 'pending',
        resume_url:
          b.resume_url === '' || b.resume_url == null ? null : String(b.resume_url).trim() || null,
        linkedin_url: typeof b.linkedin_url === 'string' ? b.linkedin_url.trim() || null : null,
        naukri_url: typeof b.naukri_url === 'string' ? b.naukri_url.trim() || null : null,
        portfolio_url: typeof b.portfolio_url === 'string' ? b.portfolio_url.trim() || null : null,
        comments: typeof b.comments === 'string' ? b.comments.trim() || null : null,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabaseAdmin
        .from('students')
        .update(updatePayload)
        .eq('id', studentId)
        .select('id')

      if (error) {
        return res.status(400).json({ error: error.message })
      }
      if (!data?.length) {
        return res.status(404).json({ error: 'Student not found or could not be updated.' })
      }
      return res.json({ ok: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Update failed.'
      return res.status(500).json({ error: msg })
    }
  },
)
