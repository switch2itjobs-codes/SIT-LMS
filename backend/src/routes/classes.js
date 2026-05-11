import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

export const classesRouter = express.Router()

classesRouter.use(requireAuth)

/** Build an RLS-aware Supabase client using the caller's access token. */
function getRlsClient(accessToken) {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

/**
 * Resolve a classId from the URL.  Supports two forms:
 *   - UUID (class_sessions.id)
 *   - Zoom meeting ID (numeric string) — looked up via zoom_meeting_id
 */
async function resolveClassSession(db, classId) {
  if (!classId) return null
  // UUID format check
  const looksUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)
  const query = db
    .from('class_sessions')
    .select(
      'id,batch_id,trainer_id,title,description,starts_at,ends_at,zoom_meeting_id,zoom_meeting_uuid,recording_url,has_recording,recording_status,zoom_status',
    )
    .limit(1)
  const { data, error } = looksUuid
    ? await query.eq('id', classId).maybeSingle()
    : await query.eq('zoom_meeting_id', String(classId)).maybeSingle()
  if (error) throw error
  return data
}

/* ───────────────────────────── Class core info ─────────────────────────── */
classesRouter.get('/:classId', async (req, res) => {
  try {
    const db = getRlsClient(req.auth.token)
    const session = await resolveClassSession(db, req.params.classId)
    if (!session) return res.status(404).json({ error: 'Class not found.' })
    return res.json(session)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

/* ───────────────────────────── Recordings ──────────────────────────────── */
classesRouter.get('/:classId/recordings', async (req, res) => {
  try {
    const db = getRlsClient(req.auth.token)
    const session = await resolveClassSession(db, req.params.classId)
    if (!session) return res.status(404).json({ error: 'Class not found.' })
    const { data, error } = await db
      .from('class_session_recordings')
      .select('*')
      .eq('class_session_id', session.id)
      .order('recording_start', { ascending: true })
    if (error) throw error
    return res.json({ recordings: data ?? [] })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

/* ───────────────────────────── Chat messages ───────────────────────────── */
classesRouter.get('/:classId/chat', async (req, res) => {
  try {
    const db = getRlsClient(req.auth.token)
    const session = await resolveClassSession(db, req.params.classId)
    if (!session) return res.status(404).json({ error: 'Class not found.' })
    const { data, error } = await db
      .from('class_chat_messages')
      .select('id,sender_name,sender_email,message_text,sent_at,source')
      .eq('class_session_id', session.id)
      .order('sent_at', { ascending: true })
      .limit(2000)
    if (error) throw error
    return res.json({ messages: data ?? [] })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

/* ───────────────────────────── Polls ───────────────────────────────────── */
classesRouter.get('/:classId/polls', async (req, res) => {
  try {
    const db = getRlsClient(req.auth.token)
    const session = await resolveClassSession(db, req.params.classId)
    if (!session) return res.status(404).json({ error: 'Class not found.' })
    const { data, error } = await db
      .from('class_polls')
      .select('id,zoom_poll_id,poll_title,status,anonymous,poll_type,questions,responses,fetched_at')
      .eq('class_session_id', session.id)
      .order('fetched_at', { ascending: true })
    if (error) throw error
    return res.json({ polls: data ?? [] })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

/* ───────────────────────────── Attendance ──────────────────────────────── */
classesRouter.get('/:classId/attendance', async (req, res) => {
  try {
    const db = getRlsClient(req.auth.token)
    const session = await resolveClassSession(db, req.params.classId)
    if (!session) return res.status(404).json({ error: 'Class not found.' })

    // Two sources: our class_attendance table (student-mapped) + raw zoom participants
    const [attRes, partRes] = await Promise.all([
      db
        .from('class_attendance')
        .select('id,student_id,status,marked_at,join_time,leave_time,duration_seconds,notes')
        .eq('class_session_id', session.id),
      db
        .from('class_session_participants')
        .select('id,zoom_user_id,user_email,user_name,join_time,leave_time,duration_seconds')
        .eq('class_session_id', session.id)
        .order('join_time', { ascending: true }),
    ])

    if (attRes.error) throw attRes.error
    if (partRes.error) throw partRes.error

    return res.json({
      attendance: attRes.data ?? [],
      participants: partRes.data ?? [],
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

/* ───────────────────────────── Engagement report ───────────────────────── */
classesRouter.get('/:classId/report', async (req, res) => {
  try {
    const db = getRlsClient(req.auth.token)
    const session = await resolveClassSession(db, req.params.classId)
    if (!session) return res.status(404).json({ error: 'Class not found.' })
    const { data, error } = await db
      .from('class_reports')
      .select('*')
      .eq('class_session_id', session.id)
      .maybeSingle()
    if (error) throw error
    return res.json({ report: data ?? null })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

/**
 * Mark attendance for the calling student when they connect to the embedded meeting.
 * Frontend calls this when the Meeting SDK fires its 'connection-change: connected' event.
 */
classesRouter.post('/:classId/attendance/mark', express.json(), async (req, res) => {
  try {
    const db = getRlsClient(req.auth.token)
    const session = await resolveClassSession(db, req.params.classId)
    if (!session) return res.status(404).json({ error: 'Class not found.' })

    // Find the student record for this user
    const { data: student, error: stErr } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('profile_id', req.auth.user.id)
      .maybeSingle()
    if (stErr) throw stErr
    if (!student) return res.status(403).json({ error: 'Not a student account.' })

    const row = {
      class_session_id: session.id,
      student_id: student.id,
      status: 'present',
      marked_at: new Date().toISOString(),
      join_time: new Date().toISOString(),
    }

    const { error: upErr } = await supabaseAdmin
      .from('class_attendance')
      .upsert(row, { onConflict: 'class_session_id,student_id' })
    if (upErr) throw upErr
    return res.json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})
