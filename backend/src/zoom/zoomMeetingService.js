import { zoomRequest } from './zoomClient.js'

export async function createMeeting(hostUserId, classData) {
  const payload = {
    topic: classData.topic,
    agenda: classData.agenda ?? null,
    type: 2,
    start_time: classData.startTime,
    duration: classData.durationMinutes,
    timezone: classData.timezone ?? 'Asia/Kolkata',
    settings: {
      host_video: true,
      participant_video: true,
      waiting_room: true,
      auto_recording: 'cloud',
      join_before_host: false,
      mute_upon_entry: true,
      approval_type: 0,
      registration_type: 1,
    },
  }

  return await zoomRequest(
    'POST',
    `/users/${encodeURIComponent(hostUserId)}/meetings`,
    payload,
  )
}

export async function createMeetingRegistrant(
  zoomMeetingId,
  { email, firstName, lastName },
) {
  const payload = {
    email,
    first_name: firstName,
    last_name: lastName,
  }
  return await zoomRequest(
    'POST',
    `/meetings/${encodeURIComponent(zoomMeetingId)}/registrants`,
    payload,
  )
}

export async function listMeetingRegistrants(zoomMeetingId, status = 'approved') {
  return await zoomRequest(
    'GET',
    `/meetings/${encodeURIComponent(zoomMeetingId)}/registrants?page_size=300&status=${encodeURIComponent(status)}`,
  )
}

export async function getMeeting(zoomMeetingId) {
  return await zoomRequest(
    'GET',
    `/meetings/${encodeURIComponent(zoomMeetingId)}`,
  )
}

export async function updateMeeting(zoomMeetingId, updates) {
  await zoomRequest(
    'PATCH',
    `/meetings/${encodeURIComponent(zoomMeetingId)}`,
    updates,
  )
  return await getMeeting(zoomMeetingId)
}

export async function deleteMeeting(zoomMeetingId) {
  return await zoomRequest(
    'DELETE',
    `/meetings/${encodeURIComponent(zoomMeetingId)}`,
  )
}

export async function listZoomHosts() {
  const response = await zoomRequest(
    'GET',
    '/users?status=active&page_size=300',
  )

  return (response.users ?? [])
    .filter((user) => user.type !== 99)
    .map((user) => ({
      id: user.id,
      email: user.email ?? null,
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      display_name:
        user.display_name ||
        `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
        user.email ||
        user.id,
      type: user.type,
    }))
}
