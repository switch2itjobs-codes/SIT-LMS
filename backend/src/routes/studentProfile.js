import express from 'express'
import multer from 'multer'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'

const uploadResume = multer({
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

async function ensureBucket(name, opts) {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  if (buckets?.some((b) => b.id === name || b.name === name)) return
  const { error } = await supabaseAdmin.storage.createBucket(name, opts)
  if (error && !String(error.message ?? '').toLowerCase().includes('exist')) throw error
}

export const studentProfileRouter = express.Router()

// --- Check email/phone uniqueness (no auth required) ---
studentProfileRouter.post('/check-duplicate', express.json(), async (req, res) => {
  try {
    const { email, phone } = req.body
    const errors = []

    if (email) {
      const { data } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()
      if (data) errors.push('email')
    }

    if (phone) {
      const digits = phone.replace(/[^0-9]/g, '')
      const { data } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('phone', digits)
        .maybeSingle()
      if (data) errors.push('phone')
    }

    return res.json({ duplicates: errors })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Check failed.' })
  }
})

// --- Signup: create auth user + student record + upload files atomically ---
const signupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
}).fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
])

studentProfileRouter.post('/signup', (req, res, next) => {
  signupUpload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message ?? 'Upload failed.' })
    next()
  })
}, async (req, res) => {
  try {
    const { email, password, fullName, phone, gender, city, degree, prevCompany, prevRole, experience, domain, linkedinUrl, naukriUrl } = req.body

    if (!email || !password || !fullName || !phone) {
      return res.status(400).json({ error: 'Missing required fields.' })
    }

    const cleanEmail = email.trim().toLowerCase()
    const digits = phone.replace(/[^0-9]/g, '')

    // Check duplicates in students table
    const { data: emailDup } = await supabaseAdmin.from('students').select('id').eq('email', cleanEmail).maybeSingle()
    if (emailDup) return res.status(409).json({ error: 'An account with this email already exists.', field: 'email' })

    const { data: phoneDup } = await supabaseAdmin.from('students').select('id').eq('phone', digits).maybeSingle()
    if (phoneDup) return res.status(409).json({ error: 'An account with this phone number already exists.', field: 'phone' })

    // Check for orphan auth user and clean up
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuth = authList?.users?.find(u => u.email?.toLowerCase() === cleanEmail)
    if (existingAuth) {
      const { data: linked } = await supabaseAdmin.from('students').select('id').eq('profile_id', existingAuth.id).maybeSingle()
      if (linked) {
        return res.status(409).json({ error: 'An account with this email already exists.', field: 'email' })
      }
      await supabaseAdmin.auth.admin.deleteUser(existingAuth.id)
    }

    // Create auth user
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      user_metadata: { full_name: fullName.trim(), role: 'student' },
      app_metadata: { role: 'student' },
      email_confirm: true,
    })
    if (authErr) return res.status(400).json({ error: authErr.message })

    const userId = authData.user.id

    // Create student record
    const studentRow = {
      profile_id: userId,
      student_name: fullName.trim(),
      email: cleanEmail,
      phone: digits,
      gender: gender || null,
      location: city?.trim() || null,
      degree: degree || null,
      previous_company: prevCompany?.trim() || null,
      previous_job_role: prevRole?.trim() || null,
      experience_years: experience ? Number(experience) : null,
      domain: domain || null,
      linkedin_url: linkedinUrl?.trim() || null,
      naukri_url: naukriUrl?.trim() || null,
      enrollment_date: new Date().toISOString().split('T')[0],
    }

    const { data: studentData, error: insertErr } = await supabaseAdmin.from('students').insert(studentRow).select('id').single()

    if (insertErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
      const msg = insertErr.message || ''
      if (msg.includes('students_phone_unique') || msg.includes('phone')) {
        return res.status(409).json({ error: 'An account with this phone number already exists.', field: 'phone' })
      }
      if (msg.includes('students_email_key') || msg.includes('email')) {
        return res.status(409).json({ error: 'An account with this email already exists.', field: 'email' })
      }
      return res.status(500).json({ error: msg })
    }

    const studentId = studentData.id

    // Upload avatar if provided
    const avatarFile = req.files?.['avatar']?.[0]
    if (avatarFile) {
      try {
        await ensureBucket('student-avatars', { public: true, fileSizeLimit: 2 * 1024 * 1024 })
        const ext = avatarFile.originalname.split('.').pop()?.toLowerCase() || 'jpg'
        const avatarPath = `${studentId}/avatar-${Date.now()}.${ext}`
        const { error: upErr } = await supabaseAdmin.storage.from('student-avatars').upload(avatarPath, avatarFile.buffer, {
          cacheControl: '3600', upsert: true, contentType: avatarFile.mimetype || 'image/jpeg',
        })
        if (!upErr) {
          const { data: pub } = supabaseAdmin.storage.from('student-avatars').getPublicUrl(avatarPath)
          await supabaseAdmin.from('students').update({ avatar_url: pub.publicUrl }).eq('id', studentId)
        }
      } catch { /* ignore avatar errors */ }
    }

    // Upload resume if provided
    const resumeFile = req.files?.['resume']?.[0]
    if (resumeFile) {
      try {
        await ensureBucket('student-resumes', { public: true, fileSizeLimit: 52428800 })
        const cleanName = resumeFile.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
        const resumePath = `${studentId}/${Date.now()}-${cleanName}`
        const { error: upErr } = await supabaseAdmin.storage.from('student-resumes').upload(resumePath, resumeFile.buffer, {
          cacheControl: '3600', upsert: true, contentType: resumeFile.mimetype || 'application/octet-stream',
        })
        if (!upErr) {
          const { data: pub } = supabaseAdmin.storage.from('student-resumes').getPublicUrl(resumePath)
          await supabaseAdmin.from('students').update({ resume_url: pub.publicUrl }).eq('id', studentId)
        }
      } catch { /* ignore resume errors */ }
    }

    return res.json({ success: true, user_id: userId })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Signup failed.' })
  }
})

// --- Resume upload ---
studentProfileRouter.post(
  '/resume',
  requireAuth,
  requireRole('student'),
  (req, res, next) => {
    uploadResume.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message ?? 'Upload failed.' })
      next()
    })
  },
  async (req, res) => {
    try {
      if (!req.file?.buffer) return res.status(400).json({ error: 'Missing file.' })

      // Find student record by auth user id
      const userId = req.auth.user.id
      const { data: student, error: stErr } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle()
      if (stErr || !student) return res.status(404).json({ error: 'Student not found.' })

      await ensureBucket('student-resumes', { public: true, fileSizeLimit: 52428800 })

      const cleanName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      const objectPath = `${student.id}/${Date.now()}-${cleanName}`
      const { error: upErr } = await supabaseAdmin.storage
        .from('student-resumes')
        .upload(objectPath, req.file.buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: req.file.mimetype || 'application/octet-stream',
        })
      if (upErr) return res.status(500).json({ error: upErr.message })

      const { data: pub } = supabaseAdmin.storage.from('student-resumes').getPublicUrl(objectPath)
      const resumeUrl = pub.publicUrl

      // Save resume_url on student record
      await supabaseAdmin.from('students').update({ resume_url: resumeUrl, updated_at: new Date().toISOString() }).eq('id', student.id)

      return res.json({ resume_url: resumeUrl })
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Upload failed.' })
    }
  },
)

// --- Avatar upload ---
studentProfileRouter.post(
  '/avatar',
  requireAuth,
  requireRole('student'),
  (req, res, next) => {
    uploadAvatar.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message ?? 'Upload failed.' })
      next()
    })
  },
  async (req, res) => {
    try {
      if (!req.file?.buffer) return res.status(400).json({ error: 'Missing file.' })

      const userId = req.auth.user.id
      const { data: student, error: stErr } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle()
      if (stErr || !student) return res.status(404).json({ error: 'Student not found.' })

      await ensureBucket('student-avatars', { public: true, fileSizeLimit: 2 * 1024 * 1024 })

      const ext = req.file.originalname.split('.').pop()?.toLowerCase() || 'jpg'
      const objectPath = `${student.id}/avatar-${Date.now()}.${ext}`
      const { error: upErr } = await supabaseAdmin.storage
        .from('student-avatars')
        .upload(objectPath, req.file.buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: req.file.mimetype || 'image/jpeg',
        })
      if (upErr) return res.status(500).json({ error: upErr.message })

      const { data: pub } = supabaseAdmin.storage.from('student-avatars').getPublicUrl(objectPath)
      const avatarUrl = pub.publicUrl

      await supabaseAdmin.from('students').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', student.id)

      return res.json({ avatar_url: avatarUrl })
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Upload failed.' })
    }
  },
)
