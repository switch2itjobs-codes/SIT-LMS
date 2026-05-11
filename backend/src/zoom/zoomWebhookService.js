import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { getMeetingParticipants, getMeetingReport } from './zoomReportsService.js'
import {
  getRecordingForMeeting,
  setMeetingRecordingNoPasscode,
} from './zoomRecordingService.js'
import { getPastMeetingPolls } from './zoomPollsService.js'
import { fetchAndParseZoomChatFile } from './zoomChatParser.js'
import { getAccessToken as getZoomAccessToken } from './zoomTokenManager.js'

function hmacHex(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex')
}

export function buildEndpointValidationResponse(plainToken) {
  return {
    plainToken,
    encryptedToken: hmacHex(env.zoomWebhookSecretToken, plainToken),
  }
}

export function verifyZoomWebhookSignature(req) {
  const timestamp = req.headers['x-zm-request-timestamp']
  const signature = req.headers['x-zm-signature']
  if (!timestamp || !signature) return false
  const rawBody =
    typeof req.rawBody === 'string' && req.rawBody.length
      ? req.rawBody
      : JSON.stringify(req.body)
  const message = `v0:${timestamp}:${rawBody}`
  const hash = hmacHex(env.zoomWebhookSecretToken, message)
  return signature === `v0=${hash}`
}

async function getClassSessionByZoomIdentifiers(meetingId, meetingUuid) {
  if (meetingId) {
    const { data: byMeetingId, error: byMeetingIdError } = await supabaseAdmin
      .from('class_sessions')
      .select('id,zoom_meeting_id,zoom_meeting_uuid,batch_id,trainer_id,zoom_host_user_id')
      .eq('zoom_meeting_id', String(meetingId))
      .limit(1)
      .maybeSingle()
    if (byMeetingIdError) throw byMeetingIdError
    if (byMeetingId) return byMeetingId
  }

  if (meetingUuid) {
    const { data: byUuid, error: byUuidError } = await supabaseAdmin
      .from('class_sessions')
      .select('id,zoom_meeting_id,zoom_meeting_uuid,batch_id,trainer_id,zoom_host_user_id')
      .eq('zoom_meeting_uuid', meetingUuid)
      .limit(1)
      .maybeSingle()
    if (byUuidError) throw byUuidError
    return byUuid
  }

  return null
}

async function hasNewerMeetingEndedEvent(meetingUuid, currentEventTs) {
  if (!meetingUuid || !currentEventTs) return false
  const { data, error } = await supabaseAdmin
    .from('zoom_webhook_events')
    .select('event_ts')
    .eq('event_name', 'meeting.ended')
    .eq('meeting_uuid', meetingUuid)
    .gt('event_ts', Number(currentEventTs))
    .limit(1)
  if (error) throw error
  return Boolean(data?.length)
}

async function upsertWebhookEvent(event, payload, signatureValid) {
  const meetingUuid = payload?.payload?.object?.uuid ?? null
  const { error } = await supabaseAdmin.from('zoom_webhook_events').upsert(
    {
      event_name: event,
      event_ts: payload?.event_ts ?? null,
      meeting_uuid: meetingUuid,
      payload_json: payload,
      signature_valid: signatureValid,
      processed_at: new Date().toISOString(),
    },
    {
      onConflict: 'event_name,event_ts,meeting_uuid',
      ignoreDuplicates: true,
    },
  )
  if (error) throw error
}

async function syncParticipantsForSession(
  classSessionId,
  zoomMeetingId,
  trainerId = null,
  zoomHostUserId = null,
) {
  const participants = await getMeetingParticipants(zoomMeetingId)
  let trainerEmail = null
  if (trainerId) {
    const { data: trainer, error: trainerError } = await supabaseAdmin
      .from('trainers')
      .select('email')
      .eq('id', trainerId)
      .maybeSingle()
    if (trainerError) throw trainerError
    trainerEmail = trainer?.email
      ? String(trainer.email).trim().toLowerCase()
      : null
  }
  const filteredParticipants = participants.filter((participant) => {
    const participantZoomUserId = String(
      participant.id ?? participant.user_id ?? '',
    )
      .trim()
      .toLowerCase()
    const normalizedHostZoomUserId = zoomHostUserId
      ? String(zoomHostUserId).trim().toLowerCase()
      : null
    if (
      normalizedHostZoomUserId &&
      participantZoomUserId &&
      participantZoomUserId === normalizedHostZoomUserId
    ) {
      return false
    }
    if (!trainerEmail) return true
    const participantEmail = String(participant.user_email ?? '')
      .trim()
      .toLowerCase()
    return !participantEmail || participantEmail !== trainerEmail
  })
  const rows = filteredParticipants.map((participant) => ({
    class_session_id: classSessionId,
    zoom_user_id: participant.id ? String(participant.id) : null,
    user_email: participant.user_email ?? null,
    user_name: participant.name ?? null,
    join_time: participant.join_time ?? null,
    leave_time: participant.leave_time ?? null,
    duration_seconds: participant.duration ? Math.round(Number(participant.duration)) : null,
    source: 'zoom_report',
  }))

  if (!rows.length) return

  const { error } = await supabaseAdmin.from('class_session_participants').upsert(
    rows,
    {
      onConflict: 'class_session_id,user_email,join_time',
      ignoreDuplicates: false,
    },
  )
  if (error) throw error
}

async function syncRecordingsForSession(
  classSessionId,
  zoomMeetingId,
  recordingObject = null,
) {
  let details = null
  let files = []

  if (recordingObject?.recording_files?.length) {
    details = {
      meeting_uuid: recordingObject.uuid ?? null,
      recording_files: recordingObject.recording_files,
    }
    files = recordingObject.recording_files
  } else if (zoomMeetingId) {
    details = await getRecordingForMeeting(zoomMeetingId)
    files = details.recording_files ?? []
  }

  if (!files.length) {
    const { error: processingError } = await supabaseAdmin
      .from('class_sessions')
      .update({
        recording_status: 'processing',
        has_recording: false,
        last_zoom_sync_at: new Date().toISOString(),
      })
      .eq('id', classSessionId)
    if (processingError) throw processingError
    return
  }

  const rows = files.map((file) => ({
    class_session_id: classSessionId,
    zoom_recording_id:
      details?.meeting_uuid ?? recordingObject?.uuid ?? null,
    zoom_file_id: file.id,
    file_type: file.file_type,
    recording_start: file.recording_start,
    recording_end: file.recording_end,
    play_url: file.play_url,
    download_url: file.download_url,
    file_size: file.file_size,
    status: file.status,
  }))

  const { error } = await supabaseAdmin.from('class_session_recordings').upsert(
    rows,
    {
      onConflict: 'class_session_id,zoom_file_id',
      ignoreDuplicates: false,
    },
  )
  if (error) throw error

  const primaryVideo =
    rows.find((row) => row.file_type === 'MP4' && row.play_url) ??
    rows.find((row) => row.play_url || row.download_url) ??
    rows[0]
  const playbackUrl =
    primaryVideo?.play_url ?? primaryVideo?.download_url ?? null

  const { error: updateError } = await supabaseAdmin
    .from('class_sessions')
    .update({
      has_recording: Boolean(playbackUrl),
      recording_status: playbackUrl ? 'available' : 'processing',
      recording_url: playbackUrl,
      last_zoom_sync_at: new Date().toISOString(),
    })
    .eq('id', classSessionId)
  if (updateError) throw updateError

  // Best effort: keep playback links open without passcode prompts.
  if (zoomMeetingId) {
    try {
      await setMeetingRecordingNoPasscode(String(zoomMeetingId))
    } catch (error) {
      console.warn(
        'Unable to update recording settings for no-passcode access:',
        error.message,
      )
    }
  }

  // Capture chat messages from the recording's chat file (if present)
  const chatFile = files.find(
    (f) => f.file_type === 'CHAT' || f.file_type === 'CC' || f.recording_type === 'chat_file',
  )
  if (chatFile?.download_url) {
    try {
      await syncChatFromRecordingFile(
        classSessionId,
        String(zoomMeetingId ?? ''),
        chatFile,
      )
    } catch (error) {
      console.warn('Failed to capture chat from recording file:', error.message)
    }
  }
}

/**
 * Download Zoom's chat file (from a recording) and insert one row per message
 * into class_chat_messages.
 */
async function syncChatFromRecordingFile(classSessionId, zoomMeetingId, chatFile) {
  const token = await getZoomAccessToken()
  const meetingStart = chatFile.recording_start
    ? new Date(chatFile.recording_start)
    : new Date()
  const messages = await fetchAndParseZoomChatFile(
    chatFile.download_url,
    token,
    meetingStart,
  )
  if (!messages.length) return

  const rows = messages.map((m) => ({
    class_session_id: classSessionId,
    zoom_meeting_id: zoomMeetingId || null,
    sender_name: m.sender_name,
    message_text: m.message_text,
    sent_at: m.sent_at,
    source: 'recording_file',
  }))

  const { error } = await supabaseAdmin.from('class_chat_messages').insert(rows)
  if (error) {
    // Ignore unique-violation noise if we re-run on the same meeting
    console.warn('class_chat_messages insert (recording):', error.message)
  }
}

/**
 * Pull poll questions + responses from Zoom REST and upsert into class_polls.
 */
async function syncPollsForSession(classSessionId, zoomMeetingId, meetingUuid) {
  if (!zoomMeetingId && !meetingUuid) return
  const polls = await getPastMeetingPolls(zoomMeetingId || meetingUuid)
  if (!polls) return

  const questions = Array.isArray(polls.questions) ? polls.questions : []
  if (!questions.length) return

  const row = {
    class_session_id: classSessionId,
    zoom_meeting_id: zoomMeetingId ? String(zoomMeetingId) : null,
    zoom_meeting_uuid: meetingUuid ?? null,
    zoom_poll_id: polls.id ?? null,
    poll_title: polls.title ?? null,
    status: polls.status ?? null,
    anonymous: Boolean(polls.anonymous),
    poll_type: polls.poll_type ?? null,
    questions,
    responses: polls.responses ?? null,
  }

  const { error } = await supabaseAdmin
    .from('class_polls')
    .upsert(row, { onConflict: 'class_session_id,zoom_poll_id' })
  if (error) console.warn('class_polls upsert:', error.message)
}

/**
 * Fetch the Zoom report for the meeting and store a snapshot.
 */
async function syncReportForSession(classSessionId, zoomMeetingId, meetingUuid) {
  if (!zoomMeetingId && !meetingUuid) return
  try {
    const [report, participants] = await Promise.all([
      getMeetingReport(String(zoomMeetingId || meetingUuid)),
      getMeetingParticipants(String(zoomMeetingId || meetingUuid)),
    ])

    const row = {
      class_session_id: classSessionId,
      zoom_meeting_id: zoomMeetingId ? String(zoomMeetingId) : null,
      zoom_meeting_uuid: meetingUuid ?? null,
      start_time: report?.start_time ?? null,
      end_time: report?.end_time ?? null,
      duration_minutes: report?.duration ?? null,
      participants_count: report?.participants_count ?? participants.length ?? null,
      unique_participants: new Set(
        participants.map((p) => (p.user_email || p.id || '').toLowerCase()).filter(Boolean),
      ).size,
      raw: { report, participants },
    }

    const { error } = await supabaseAdmin
      .from('class_reports')
      .upsert(row, { onConflict: 'class_session_id' })
    if (error) console.warn('class_reports upsert:', error.message)
  } catch (error) {
    console.warn('syncReportForSession failed:', error.message)
  }
}

/**
 * Insert a single live chat message captured via webhook.
 */
async function insertLiveChatMessage(classSessionId, payload) {
  const obj = payload?.payload?.object
  if (!obj) return
  const row = {
    class_session_id: classSessionId,
    zoom_meeting_id: obj.id ? String(obj.id) : null,
    zoom_meeting_uuid: obj.uuid ?? null,
    sender_name: obj.participant?.user_name ?? null,
    sender_email: obj.participant?.email ?? null,
    sender_zoom_user_id: obj.participant?.user_id ?? null,
    message_text: obj.message ?? obj.content ?? '',
    sent_at: obj.date_time ?? new Date(payload.event_ts ?? Date.now()).toISOString(),
    source: 'webhook_live',
  }
  if (!row.message_text) return
  const { error } = await supabaseAdmin.from('class_chat_messages').insert(row)
  if (error) console.warn('class_chat_messages insert (live):', error.message)
}

export async function processZoomWebhookEvent(event, body, signatureValid) {
  await upsertWebhookEvent(event, body, signatureValid)

  const meetingId = body?.payload?.object?.id
  const meetingUuid = body?.payload?.object?.uuid
  if (!meetingId && !meetingUuid) return

  const classSession = await getClassSessionByZoomIdentifiers(meetingId, meetingUuid)
  if (!classSession) return

  if (event === 'meeting.started') {
    const isStaleStartedEvent = await hasNewerMeetingEndedEvent(
      meetingUuid,
      body?.event_ts ?? null,
    )
    if (isStaleStartedEvent) return

    const { error } = await supabaseAdmin
      .from('class_sessions')
      .update({
        zoom_status: 'started',
        recording_status: 'pending',
        last_zoom_sync_at: new Date().toISOString(),
      })
      .eq('id', classSession.id)
    if (error) throw error
  }

  if (event === 'meeting.ended') {
    const { error } = await supabaseAdmin
      .from('class_sessions')
      .update({
        zoom_status: 'ended',
        recording_status: 'processing',
        last_zoom_sync_at: new Date().toISOString(),
      })
      .eq('id', classSession.id)
    if (error) throw error
    await syncParticipantsForSession(
      classSession.id,
      String(meetingId),
      classSession.trainer_id ?? null,
      classSession.zoom_host_user_id ?? null,
    )
    // Pull polls + engagement report (best effort — wait briefly for Zoom to finalize)
    setTimeout(() => {
      syncPollsForSession(classSession.id, meetingId, meetingUuid).catch((e) =>
        console.warn('syncPollsForSession async:', e.message),
      )
      syncReportForSession(classSession.id, meetingId, meetingUuid).catch((e) =>
        console.warn('syncReportForSession async:', e.message),
      )
    }, 60_000).unref?.()
  }

  if (event === 'recording.completed') {
    await syncRecordingsForSession(
      classSession.id,
      String(meetingId ?? classSession.zoom_meeting_id ?? ''),
      body?.payload?.object ?? null,
    )
  }

  if (event === 'meeting.chat_message_sent') {
    await insertLiveChatMessage(classSession.id, body)
  }
}
