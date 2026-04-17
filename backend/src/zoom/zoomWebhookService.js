import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { getMeetingParticipants } from './zoomReportsService.js'
import {
  getRecordingForMeeting,
  setMeetingRecordingNoPasscode,
} from './zoomRecordingService.js'

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
      .select('id,zoom_meeting_id,zoom_meeting_uuid,batch_id')
      .eq('zoom_meeting_id', String(meetingId))
      .limit(1)
      .maybeSingle()
    if (byMeetingIdError) throw byMeetingIdError
    if (byMeetingId) return byMeetingId
  }

  if (meetingUuid) {
    const { data: byUuid, error: byUuidError } = await supabaseAdmin
      .from('class_sessions')
      .select('id,zoom_meeting_id,zoom_meeting_uuid,batch_id')
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

async function syncParticipantsForSession(classSessionId, zoomMeetingId) {
  const participants = await getMeetingParticipants(zoomMeetingId)
  const rows = participants.map((participant) => ({
    class_session_id: classSessionId,
    zoom_user_id: participant.id ? String(participant.id) : null,
    user_email: participant.user_email ?? null,
    user_name: participant.name ?? null,
    join_time: participant.join_time ?? null,
    leave_time: participant.leave_time ?? null,
    duration_seconds: participant.duration
      ? Math.round(Number(participant.duration) * 60)
      : null,
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
    await syncParticipantsForSession(classSession.id, String(meetingId))
  }

  if (event === 'recording.completed') {
    await syncRecordingsForSession(
      classSession.id,
      String(meetingId ?? classSession.zoom_meeting_id ?? ''),
      body?.payload?.object ?? null,
    )
  }
}
