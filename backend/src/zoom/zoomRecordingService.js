import { zoomRequest } from './zoomClient.js'

function normalizeCompletedRecordingFiles(recordingFiles = []) {
  return recordingFiles
    .filter((file) => file?.status === 'completed')
    .map((file) => ({
      id: file.id,
      meeting_id: file.meeting_id ?? null,
      recording_start: file.recording_start ?? null,
      recording_end: file.recording_end ?? null,
      file_type: file.file_type ?? null,
      file_size: file.file_size ?? null,
      status: file.status ?? null,
      play_url: file.play_url ?? null,
      download_url: file.download_url ?? null,
    }))
}

export async function getRecordingsForUser(hostUserId, fromDate, toDate) {
  const query = new URLSearchParams()
  if (fromDate) query.set('from', fromDate)
  if (toDate) query.set('to', toDate)
  const response = await zoomRequest(
    'GET',
    `/users/${encodeURIComponent(hostUserId)}/recordings?${query.toString()}`,
  )

  return (response.meetings ?? []).map((meeting) => ({
    id: meeting.id,
    uuid: meeting.uuid,
    topic: meeting.topic,
    start_time: meeting.start_time,
    recording_files: normalizeCompletedRecordingFiles(meeting.recording_files),
  }))
}

export async function getRecordingForMeeting(zoomMeetingId) {
  const data = await zoomRequest(
    'GET',
    `/meetings/${encodeURIComponent(zoomMeetingId)}/recordings`,
  )

  return {
    meeting_id: data.id,
    meeting_uuid: data.uuid,
    topic: data.topic,
    recording_files: normalizeCompletedRecordingFiles(data.recording_files),
  }
}

export async function setMeetingRecordingNoPasscode(zoomMeetingId) {
  // Keep recording links shareable without passcode/auth prompts.
  await zoomRequest(
    'PATCH',
    `/meetings/${encodeURIComponent(zoomMeetingId)}/recordings/settings`,
    {
      share_recording: 'publicly',
      recording_authentication: false,
      on_demand: false,
      approval_type: 2,
      viewer_download: true,
    },
  )
}
