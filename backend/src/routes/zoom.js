import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  createMeetingRegistrant,
  createMeeting,
  deleteMeeting,
  getMeeting,
  listMeetingRegistrants,
  listZoomHosts,
  updateMeeting,
} from '../zoom/zoomMeetingService.js'
import {
  getRecordingForMeeting,
  getRecordingsForUser,
  setMeetingRecordingNoPasscode,
} from '../zoom/zoomRecordingService.js'
import {
  getMeetingParticipants,
  getMeetingReport,
  getUserUsageReport,
} from '../zoom/zoomReportsService.js'
import {
  buildEndpointValidationResponse,
  processZoomWebhookEvent,
  verifyZoomWebhookSignature,
} from '../zoom/zoomWebhookService.js'

export const zoomRouter = express.Router()

function parseDateOnly(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function getRlsClient(accessToken) {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

async function getCurrentTrainerId(db, authUserId) {
  const { data, error } = await db
    .from('trainers')
    .select('id')
    .eq('profile_id', authUserId)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

async function getTrainerEmailById(db, trainerId) {
  if (!trainerId) return null
  const { data, error } = await db
    .from('trainers')
    .select('email')
    .eq('id', trainerId)
    .maybeSingle()
  if (error) throw error
  return data?.email ? String(data.email).trim().toLowerCase() : null
}

async function ensureStudentEnrollment(db, authUserId, batchId) {
  const { data: student, error: studentError } = await db
    .from('students')
    .select('id')
    .eq('profile_id', authUserId)
    .maybeSingle()
  if (studentError) throw studentError
  if (!student) return false

  const { data: enrolled, error: enrolledError } = await db
    .from('student_batches')
    .select('id')
    .eq('student_id', student.id)
    .eq('batch_id', batchId)
    .eq('is_active', true)
    .maybeSingle()
  if (enrolledError) throw enrolledError
  return Boolean(enrolled)
}

async function getStudentProfile(db, authUserId) {
  const { data: student, error } = await db
    .from('students')
    .select('id,student_name,email')
    .eq('profile_id', authUserId)
    .maybeSingle()
  if (error) throw error
  return student ?? null
}

async function ensureBatchStudentRegistrants({
  db,
  batchId,
  zoomMeetingId,
}) {
  if (!batchId || !zoomMeetingId) return

  const [{ registrants: approved = [] }, { registrants: pending = [] }] =
    await Promise.all([
      listMeetingRegistrants(String(zoomMeetingId), 'approved'),
      listMeetingRegistrants(String(zoomMeetingId), 'pending'),
    ])

  const existingEmails = new Set(
    [...approved, ...pending]
      .map((item) => String(item.email ?? '').trim().toLowerCase())
      .filter(Boolean),
  )

  const { data: enrolledStudents, error: studentsError } = await db
    .from('student_batches')
    .select('students!inner(student_name,email)')
    .eq('batch_id', batchId)
    .eq('is_active', true)

  if (studentsError) throw studentsError

  const uniqueStudents = new Map()
  for (const row of enrolledStudents ?? []) {
    const student = row.students
    const email = String(student?.email ?? '').trim().toLowerCase()
    if (!email) continue
    if (!uniqueStudents.has(email)) {
      uniqueStudents.set(email, {
        student_name: String(student?.student_name ?? 'Student'),
        email,
      })
    }
  }

  for (const student of uniqueStudents.values()) {
    if (existingEmails.has(student.email)) continue
    const nameParts = student.student_name.trim().split(/\s+/)
    const firstName = nameParts[0] || 'Student'
    const lastName = nameParts.slice(1).join(' ') || 'Learner'
    await createMeetingRegistrant(String(zoomMeetingId), {
      email: student.email,
      firstName,
      lastName,
    })
    existingEmails.add(student.email)
  }
}

async function resolveHostZoomUserId({
  db,
  hostUserId,
  trainerId,
}) {
  if (hostUserId) return hostUserId
  if (!trainerId) throw new Error('hostUserId or trainerId is required.')

  const { data: mapping, error: mappingError } = await db
    .from('trainer_zoom_hosts')
    .select('zoom_user_id,zoom_user_email,is_primary')
    .eq('trainer_id', trainerId)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (mappingError) throw mappingError

  if (mapping?.zoom_user_id) return mapping.zoom_user_id
  if (mapping?.zoom_user_email) return mapping.zoom_user_email

  const { data: trainer, error: trainerError } = await db
    .from('trainers')
    .select('email')
    .eq('id', trainerId)
    .maybeSingle()
  if (trainerError) throw trainerError
  if (!trainer?.email) {
    throw new Error('No Zoom host mapping found for trainer.')
  }
  return trainer.email
}

async function upsertParticipantAttendance(db, classSessionId, participants) {
  if (!participants.length) return []

  const emails = participants
    .map((participant) => participant.user_email?.toLowerCase())
    .filter(Boolean)

  const { data: students } = emails.length
    ? await db
        .from('students')
        .select('id,email')
        .in('email', emails)
    : { data: [] }

  const studentIdByEmail = new Map(
    (students ?? []).map((student) => [student.email.toLowerCase(), student.id]),
  )

  const attendanceRows = participants
    .filter((participant) => participant.user_email)
    .map((participant) => {
      const durationSeconds = Number(participant.duration ?? 0)
      // Persist only two statuses in `class_attendance`:
      // - `present` if the participant attended for any time
      // - `absent` otherwise
      const status = durationSeconds > 0 ? 'present' : 'absent'

      return {
        class_session_id: classSessionId,
        student_id: studentIdByEmail.get(participant.user_email.toLowerCase()) ?? null,
        status,
        notes: `Zoom participant: ${participant.name ?? participant.user_email}`,
      }
    })
    .filter((row) => row.student_id)

  if (!attendanceRows.length) return []

  const { error } = await db.from('class_attendance').upsert(
    attendanceRows,
    {
      onConflict: 'class_session_id,student_id',
      ignoreDuplicates: false,
    },
  )
  if (error) throw error
  return attendanceRows
}

zoomRouter.post(
  '/webhook',
  express.json({
    verify: (req, _res, buffer) => {
      req.rawBody = buffer.toString('utf8')
    },
  }),
  async (req, res) => {
  const event = req.body?.event

  if (event === 'endpoint.url_validation') {
    const plainToken = req.body?.payload?.plainToken
    if (!plainToken) {
      return res.status(400).json({ error: 'Missing plainToken.' })
    }
    return res.json(buildEndpointValidationResponse(plainToken))
  }

  const signatureValid = verifyZoomWebhookSignature(req)
  if (!signatureValid) {
    return res.status(401).send('Invalid signature')
  }

  try {
    await processZoomWebhookEvent(event, req.body, signatureValid)
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
},
)

zoomRouter.use(requireAuth)

zoomRouter.get('/hosts', requireRole('admin', 'trainer'), async (_req, res) => {
  try {
    const hosts = await listZoomHosts()
    return res.json({ hosts })
  } catch (error) {
    return res.status(503).json({
      error: 'Unable to fetch Zoom hosts.',
      details: error.message,
    })
  }
})

zoomRouter.post(
  '/meetings',
  requireRole('admin', 'trainer'),
  express.json(),
  async (req, res) => {
    try {
      const db = getRlsClient(req.auth.token)
      const {
        classSessionId,
        topic,
        startTime,
        duration,
        hostUserId,
        agenda,
        attachmentUrl,
      } = req.body ?? {}

      if (!topic || !startTime || !duration) {
        return res.status(400).json({
          error: 'topic, startTime, and duration are required fields.',
        })
      }

      let classSession = null
      if (classSessionId) {
        const { data, error } = await db
          .from('class_sessions')
          .select('id,batch_id,trainer_id,description')
          .eq('id', classSessionId)
          .maybeSingle()
        if (error) throw error
        classSession = data
      }

      const currentTrainerId =
        req.auth.role === 'trainer'
          ? await getCurrentTrainerId(db, req.auth.user.id)
          : classSession?.trainer_id ?? null

      if (
        req.auth.role === 'trainer' &&
        classSession &&
        classSession.trainer_id !== currentTrainerId
      ) {
        return res.status(403).json({
          error: 'You can only schedule classes for your own batch sessions.',
        })
      }

      const zoomHostUserId = await resolveHostZoomUserId({
        db,
        hostUserId,
        trainerId: classSession?.trainer_id ?? currentTrainerId ?? null,
      })

      const meeting = await createMeeting(zoomHostUserId, {
        topic,
        agenda,
        startTime,
        durationMinutes: Number(duration),
        timezone: 'Asia/Kolkata',
      })

      try {
        await setMeetingRecordingNoPasscode(String(meeting.id))
      } catch (error) {
        // Do not block scheduling if recording-settings scope is missing.
        console.warn(
          'Unable to set meeting recording access to no-passcode:',
          error.message,
        )
      }

      const updatePayload = {
        title: topic,
        description: attachmentUrl?.trim() || classSession?.description || null,
        starts_at: startTime,
        ends_at: new Date(
          new Date(startTime).getTime() + Number(duration) * 60 * 1000,
        ).toISOString(),
        join_url: meeting.join_url ?? null,
        zoom_start_url: meeting.start_url ?? null,
        zoom_password: meeting.password ?? null,
        zoom_meeting_id: String(meeting.id),
        zoom_meeting_uuid: meeting.uuid ?? null,
        zoom_host_user_id: zoomHostUserId,
        provider: 'zoom',
        zoom_status: 'scheduled',
        recording_status: 'pending',
        last_zoom_sync_at: new Date().toISOString(),
      }

      let savedRow = null
      if (classSession) {
        const { data, error } = await db
          .from('class_sessions')
          .update(updatePayload)
          .eq('id', classSession.id)
          .select('*')
          .single()
        if (error) throw error
        savedRow = data
      } else {
        if (!req.body.batchId) {
          return res.status(400).json({
            error: 'batchId is required when classSessionId is not provided.',
          })
        }
        const { data, error } = await db
          .from('class_sessions')
          .insert({
            ...updatePayload,
            batch_id: req.body.batchId,
            trainer_id: req.body.trainerId ?? currentTrainerId,
          })
          .select('*')
          .single()
        if (error) throw error
        savedRow = data
      }

      await ensureBatchStudentRegistrants({
        db,
        batchId: savedRow.batch_id,
        zoomMeetingId: savedRow.zoom_meeting_id,
      })

      return res.status(201).json({
        meeting,
        classSession: savedRow,
      })
    } catch (error) {
      return res.status(503).json({
        error: 'Unable to schedule class at the moment.',
        details: error.message,
      })
    }
  },
)

zoomRouter.get('/meetings/:meetingId/start', async (req, res) => {
  try {
    const db = getRlsClient(req.auth.token)
    const { data: classSession, error: classSessionError } = await db
      .from('class_sessions')
      .select('id,batch_id,trainer_id,zoom_meeting_id,zoom_host_user_id')
      .eq('zoom_meeting_id', String(req.params.meetingId))
      .maybeSingle()
    if (classSessionError) throw classSessionError
    if (!classSession) {
      return res.status(404).json({ error: 'Meeting not mapped to class session.' })
    }

    if (req.auth.role === 'trainer') {
      const trainerId = await getCurrentTrainerId(db, req.auth.user.id)
      if (!trainerId || trainerId !== classSession.trainer_id) {
        return res.status(403).json({ error: 'You are not the class host.' })
      }
    } else if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'Only host/admin can start class.' })
    }

    const meeting = await getMeeting(req.params.meetingId)
    return res.json({ start_url: meeting.start_url })
  } catch (error) {
    return res.status(503).json({
      error: 'Unable to fetch start URL.',
      details: error.message,
    })
  }
})

zoomRouter.get('/meetings/:meetingId/join', async (req, res) => {
  try {
    const db = getRlsClient(req.auth.token)
    const { data: classSession, error: classSessionError } = await db
      .from('class_sessions')
      .select('id,batch_id,trainer_id,zoom_meeting_id,join_url,zoom_password')
      .eq('zoom_meeting_id', String(req.params.meetingId))
      .maybeSingle()
    if (classSessionError) throw classSessionError
    if (!classSession) {
      return res.status(404).json({ error: 'Meeting not mapped to class session.' })
    }

    if (req.auth.role === 'student') {
      const student = await getStudentProfile(db, req.auth.user.id)
      if (!student) {
        return res.status(403).json({ error: 'Student profile not linked.' })
      }

      const enrolled = await ensureStudentEnrollment(db, req.auth.user.id, classSession.batch_id)
      if (!enrolled) {
        return res.status(403).json({ error: 'You are not enrolled in this class.' })
      }

      if (!student.email) {
        return res.status(400).json({
          error: 'Student email is required to generate a unique join URL.',
        })
      }

      const nameParts = String(student.student_name ?? 'Student').trim().split(/\s+/)
      const firstName = nameParts[0] || 'Student'
      const lastName = nameParts.slice(1).join(' ') || 'Learner'
      const normalizedEmail = student.email.trim().toLowerCase()

      let registrantJoinUrl = null
      const approved = await listMeetingRegistrants(req.params.meetingId, 'approved')
      const approvedRegistrant = (approved.registrants ?? []).find(
        (item) => String(item.email ?? '').trim().toLowerCase() === normalizedEmail,
      )

      if (approvedRegistrant?.join_url) {
        registrantJoinUrl = approvedRegistrant.join_url
      } else {
        try {
          const created = await createMeetingRegistrant(req.params.meetingId, {
            email: normalizedEmail,
            firstName,
            lastName,
          })
          registrantJoinUrl = created?.join_url ?? null
        } catch (error) {
          // If registrant already exists in another status, recover by searching pending list.
          if (!String(error.message).includes('"code":300')) {
            throw error
          }
          const pending = await listMeetingRegistrants(req.params.meetingId, 'pending')
          const pendingRegistrant = (pending.registrants ?? []).find(
            (item) => String(item.email ?? '').trim().toLowerCase() === normalizedEmail,
          )
          registrantJoinUrl = pendingRegistrant?.join_url ?? null
        }
      }

      if (!registrantJoinUrl) {
        return res.status(503).json({
          error: 'Unable to generate student-specific join URL.',
          details:
            'This meeting may be legacy/non-registrant. Re-save or reschedule class to enable direct student join.',
        })
      }

      return res.json({
        join_url: registrantJoinUrl,
        password: classSession.zoom_password,
      })
    }

    return res.json({
      join_url: classSession.join_url,
      password: classSession.zoom_password,
    })
  } catch (error) {
    return res.status(503).json({
      error: 'Unable to fetch join URL.',
      details: error.message,
    })
  }
})

zoomRouter.get('/meetings/:meetingId/recordings', async (req, res) => {
  try {
    const db = getRlsClient(req.auth.token)
    const { data: classSession, error: classSessionError } = await db
      .from('class_sessions')
      .select('id,zoom_meeting_id,recording_status')
      .eq('zoom_meeting_id', String(req.params.meetingId))
      .maybeSingle()
    if (classSessionError) throw classSessionError

    const data = await getRecordingForMeeting(req.params.meetingId)
    const recordings = (data.recording_files ?? [])
      .filter((file) => file.file_type === 'MP4' && file.status === 'completed')
      .map((file) => ({
        play_url: file.play_url,
        download_url: file.download_url,
        file_size: file.file_size,
        recording_start: file.recording_start,
        recording_end: file.recording_end,
      }))

    if (!recordings.length) {
      return res.json({
        status: classSession?.recording_status ?? 'processing',
        recordings: [],
      })
    }

    return res.json({ status: 'ready', recordings })
  } catch (error) {
    if (String(error.message).includes('(404)')) {
      return res.json({ status: 'processing', recordings: [] })
    }
    return res.status(503).json({
      error: 'Unable to fetch recordings.',
      details: error.message,
    })
  }
})

zoomRouter.get('/meetings/:meetingId/report', async (req, res) => {
  try {
    const db = getRlsClient(req.auth.token)
    const { data: classSession, error: classSessionError } = await db
      .from('class_sessions')
      .select('id,batch_id,trainer_id,zoom_meeting_id')
      .eq('zoom_meeting_id', String(req.params.meetingId))
      .maybeSingle()
    if (classSessionError) throw classSessionError
    if (!classSession) {
      return res.status(404).json({ error: 'Meeting not mapped to class session.' })
    }

    const participants = await getMeetingParticipants(req.params.meetingId)
    const trainerEmail = await getTrainerEmailById(db, classSession.trainer_id)
    const hostZoomUserId = classSession.zoom_host_user_id
      ? String(classSession.zoom_host_user_id).trim().toLowerCase()
      : null
    const filteredParticipants = participants.filter((participant) => {
      const participantZoomUserId = String(
        participant.id ?? participant.user_id ?? '',
      )
        .trim()
        .toLowerCase()
      if (
        hostZoomUserId &&
        participantZoomUserId &&
        participantZoomUserId === hostZoomUserId
      ) {
        return false
      }
      if (!trainerEmail) return true
      const participantEmail = String(participant.user_email ?? '')
        .trim()
        .toLowerCase()
      return !participantEmail || participantEmail !== trainerEmail
    })
    const emails = filteredParticipants
      .map((participant) => participant.user_email?.toLowerCase())
      .filter(Boolean)

    const { data: studentRows } = emails.length
      ? await db
          .from('students')
          .select('id,student_name,email')
          .in('email', emails)
      : { data: [] }

    const byEmail = new Map(
      (studentRows ?? []).map((student) => [student.email.toLowerCase(), student]),
    )

    const reportRows = filteredParticipants.map((participant) => {
      const matched = participant.user_email
        ? byEmail.get(participant.user_email.toLowerCase())
        : null
      return {
        participant_name: participant.name,
        participant_email: participant.user_email,
        student_id: matched?.id ?? null,
        student_name: matched?.student_name ?? null,
        join_time: participant.join_time,
        leave_time: participant.leave_time,
        duration_seconds: Number(participant.duration ?? 0),
      }
    })

    await upsertParticipantAttendance(db, classSession.id, filteredParticipants)

    return res.json({ participants: reportRows })
  } catch (error) {
    return res.status(503).json({
      error: 'Unable to fetch meeting report.',
      details: error.message,
    })
  }
})

zoomRouter.get('/reports/usage', requireRole('admin'), async (req, res) => {
  try {
    const from = parseDateOnly(req.query.from)
    const to = parseDateOnly(req.query.to)

    if (!from || !to) {
      return res.status(400).json({
        error: 'Valid from and to date query params are required (YYYY-MM-DD).',
      })
    }

    const usage = await getUserUsageReport(from, to)
    return res.json({ usage })
  } catch (error) {
    return res.status(503).json({
      error: 'Unable to fetch usage report.',
      details: error.message,
    })
  }
})

zoomRouter.get('/recordings/user/:hostId', requireRole('admin'), async (req, res) => {
  try {
    const from = parseDateOnly(req.query.from)
    const to = parseDateOnly(req.query.to)
    const recordings = await getRecordingsForUser(req.params.hostId, from, to)
    return res.json({ recordings })
  } catch (error) {
    return res.status(503).json({
      error: 'Unable to fetch user recordings.',
      details: error.message,
    })
  }
})

zoomRouter.patch('/meetings/:meetingId', requireRole('admin', 'trainer'), express.json(), async (req, res) => {
  try {
    const updated = await updateMeeting(req.params.meetingId, req.body ?? {})
    return res.json({ meeting: updated })
  } catch (error) {
    return res.status(503).json({
      error: 'Unable to update meeting.',
      details: error.message,
    })
  }
})

zoomRouter.delete('/meetings/:meetingId', requireRole('admin', 'trainer'), async (req, res) => {
  try {
    await deleteMeeting(req.params.meetingId)
    await supabaseAdmin
      .from('class_sessions')
      .update({ zoom_status: 'cancelled' })
      .eq('zoom_meeting_id', String(req.params.meetingId))
    return res.status(204).send()
  } catch (error) {
    return res.status(503).json({
      error: 'Unable to cancel meeting.',
      details: error.message,
    })
  }
})
