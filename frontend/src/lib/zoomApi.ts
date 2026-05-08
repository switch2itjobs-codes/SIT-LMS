import { supabase } from './supabase'

const zoomApiBase =
  import.meta.env.VITE_ZOOM_API_BASE ?? '/api/zoom'

async function zoomRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    throw new Error('You must be logged in to use Zoom actions.')
  }

  const response = await fetch(`${zoomApiBase}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const data = contentType.includes('application/json')
      ? ((await response.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null)
      : null
    const textFallback = data
      ? ''
      : await response.text().catch(() => '')
    const message = data?.error ?? 'Zoom request failed.'
    const details = data?.details
      ? ` (${data.details})`
      : textFallback
        ? ` (${textFallback.slice(0, 120)})`
        : ''
    throw new Error(`${message}${details}`)
  }

  if (response.status === 204) {
    return null as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const raw = await response.text().catch(() => '')
    throw new Error(
      `Zoom API returned non-JSON response. Check VITE_ZOOM_API_BASE (${zoomApiBase}).${raw ? ` ${raw.slice(0, 120)}` : ''}`,
    )
  }

  return (await response.json()) as T
}

export type ScheduleClassInput = {
  classSessionId?: string
  batchId?: string
  trainerId?: string
  hostUserId?: string
  topic: string
  agenda?: string
  attachmentUrl?: string
  startTime: string
  duration: number
}

export async function scheduleClass(input: ScheduleClassInput) {
  return await zoomRequest<{
    classSession: { id: string; zoom_meeting_id: string }
    meeting: { id: string; join_url: string; start_url: string }
  }>('POST', '/meetings', input)
}

export async function getZoomHosts() {
  return await zoomRequest<{
    hosts: Array<{
      id: string
      email: string | null
      first_name: string
      last_name: string
      display_name: string
      type: number
    }>
  }>('GET', '/hosts')
}

export async function getStartUrl(zoomMeetingId: string) {
  return await zoomRequest<{ start_url: string }>(
    'GET',
    `/meetings/${encodeURIComponent(zoomMeetingId)}/start`,
  )
}

export async function getJoinUrl(zoomMeetingId: string) {
  return await zoomRequest<{ join_url: string; password: string | null }>(
    'GET',
    `/meetings/${encodeURIComponent(zoomMeetingId)}/join`,
  )
}

export async function getMeetingRecordings(zoomMeetingId: string) {
  return await zoomRequest<{
    status: 'ready' | 'processing'
    recordings: Array<{
      play_url: string
      download_url: string
      file_size: number | null
      recording_start: string
      recording_end: string
    }>
  }>('GET', `/meetings/${encodeURIComponent(zoomMeetingId)}/recordings`)
}

export async function getMeetingParticipantsReport(zoomMeetingId: string) {
  return await zoomRequest<{
    participants: Array<{
      participant_name: string
      participant_email: string | null
      student_id: string | null
      student_name: string | null
      join_time: string | null
      leave_time: string | null
      duration_seconds: number
    }>
  }>('GET', `/meetings/${encodeURIComponent(zoomMeetingId)}/report`)
}
