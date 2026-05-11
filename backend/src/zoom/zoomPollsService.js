import { zoomRequest } from './zoomClient.js'

/**
 * Fetch poll results for a past meeting.
 * https://developers.zoom.us/docs/api/meetings/#tag/meetings/get/past_meetings/{meetingId}/polls
 *
 * Note: `meetingId` here can be a Zoom meeting ID (numeric) or meeting UUID.
 * For UUIDs containing "/" or starting with "==", they must be double-URL-encoded.
 */
export async function getPastMeetingPolls(meetingId) {
  if (!meetingId) return null
  let pathId = encodeURIComponent(String(meetingId))
  // Double-encode for UUIDs that contain "/" or start with "=="
  if (String(meetingId).startsWith('==') || String(meetingId).includes('/')) {
    pathId = encodeURIComponent(pathId)
  }
  try {
    const data = await zoomRequest('GET', `/past_meetings/${pathId}/polls`)
    return data ?? null
  } catch (error) {
    if (String(error.message).includes('(404)')) return null
    throw error
  }
}
