import express from 'express'
import multer from 'multer'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { uploadToR2 } from '../lib/r2.js'

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

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const extOk = /\.(jpg|jpeg|png|webp)$/i.test(file.originalname)
    const mimeOk = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    if (extOk && mimeOk) {
      cb(null, true)
      return
    }
    cb(new Error('Only JPG, PNG, or WebP images are allowed.'))
  },
})

export const adminStudentsRouter = express.Router()


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

      const cleanName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      const resumeKey = `${studentId}/${Date.now()}-${cleanName}`
      const resumeUrl = await uploadToR2('resumes', resumeKey, req.file.buffer, req.file.mimetype || 'application/octet-stream')
      return res.json({ resume_url: resumeUrl })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed.'
      return res.status(500).json({ error: msg })
    }
  },
)

adminStudentsRouter.post(
  '/:studentId/avatar',
  requireAuth,
  requireRole('admin'),
  (req, res, next) => {
    uploadAvatar.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message ?? 'Upload failed.' })
      }
      next()
    })
  },
  async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Missing image file.' })
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

      const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 'jpg'
      const avatarKey = `${studentId}/avatar-${Date.now()}.${ext}`
      const avatarUrl = await uploadToR2('avatars', avatarKey, req.file.buffer, req.file.mimetype || 'image/jpeg')

      // Save avatar_url on the student record
      const { error: saveErr } = await supabaseAdmin
        .from('students')
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq('id', studentId)
      if (saveErr) {
        console.warn('Could not save avatar_url on student:', saveErr.message)
      }

      return res.json({ avatar_url: avatarUrl })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed.'
      return res.status(500).json({ error: msg })
    }
  },
)

adminStudentsRouter.post(
  '/:studentId/payments',
  requireAuth,
  requireRole('admin'),
  express.json({ limit: '512kb' }),
  async (req, res) => {
    try {
      const { studentId } = req.params
      const b = req.body ?? {}

      const amount = Number.parseFloat(String(b.amount ?? ''))
      if (!amount || Number.isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0.' })
      }

      const paidOn = typeof b.paid_on === 'string' && b.paid_on.trim() ? b.paid_on.trim() : null
      const paymentMode = ['cash', 'card', 'upi', 'bank_transfer', 'other'].includes(b.payment_mode)
        ? b.payment_mode
        : 'other'
      const notes = typeof b.notes === 'string' ? b.notes.trim() || null : null

      // Verify student exists and get current totals
      const { data: st, error: stErr } = await supabaseAdmin
        .from('students')
        .select('id,course_fee,amount_paid')
        .eq('id', studentId)
        .maybeSingle()
      if (stErr || !st) {
        return res.status(404).json({ error: 'Student not found.' })
      }

      const courseFee = Number(st.course_fee ?? 0)
      const alreadyPaid = Number(st.amount_paid ?? 0)
      const pendingAmount = Math.max(0, courseFee - alreadyPaid)

      if (amount > pendingAmount && pendingAmount > 0) {
        return res.status(400).json({
          error: `Amount (₹${amount}) exceeds pending amount (₹${pendingAmount}).`,
        })
      }

      // Insert payment record
      const { error: insertErr } = await supabaseAdmin.from('payments').insert({
        student_id: studentId,
        amount,
        paid_on: paidOn,
        payment_mode: paymentMode,
        notes,
      })
      if (insertErr) {
        return res.status(400).json({ error: insertErr.message })
      }

      // Update amount_paid on student
      const newTotal = alreadyPaid + amount
      const newStatus = newTotal >= courseFee ? 'paid' : 'partial'
      const { error: upErr } = await supabaseAdmin
        .from('students')
        .update({
          amount_paid: newTotal,
          payment_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', studentId)
      if (upErr) {
        console.error('Failed to update student amount_paid:', upErr.message)
      }

      return res.json({ ok: true, amount_paid: newTotal, payment_status: newStatus })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Payment failed.'
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

      const feeRaw = b.course_fee
      const courseFee =
        feeRaw === '' || feeRaw == null ? null : Number.parseFloat(String(feeRaw))

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
        ...(courseFee != null && !Number.isNaN(courseFee) ? { course_fee: courseFee } : {}),
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
