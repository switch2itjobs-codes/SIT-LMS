import { zoomRequest } from './zoomClient.js'

export async function getMeetingParticipants(zoomMeetingId) {
  try {
    const data = await zoomRequest(
      'GET',
      `/report/meetings/${encodeURIComponent(zoomMeetingId)}/participants?page_size=300`,
    )
    return data.participants ?? []
  } catch (error) {
    if (String(error.message).includes('(404)')) {
      return []
    }
    throw error
  }
}

export async function getMeetingReport(zoomMeetingId) {
  return await zoomRequest(
    'GET',
    `/report/meetings/${encodeURIComponent(zoomMeetingId)}`,
  )
}

export async function getUserUsageReport(fromDate, toDate) {
  const query = new URLSearchParams({
    type: 'active',
    from: fromDate,
    to: toDate,
    page_size: '300',
  })
  const data = await zoomRequest('GET', `/report/users?${query.toString()}`)
  return data.users ?? []
}
