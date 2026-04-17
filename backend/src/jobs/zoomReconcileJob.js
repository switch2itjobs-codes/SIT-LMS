import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { getRecordingForMeeting } from '../zoom/zoomRecordingService.js'

export async function runZoomReconciliationJob() {
  const now = Date.now()
  const since = new Date(now - 48 * 60 * 60 * 1000).toISOString()
  const { data: sessions, error } = await supabaseAdmin
    .from('class_sessions')
    .select('id,zoom_meeting_id,has_recording,recording_status,ends_at,starts_at')
    .not('zoom_meeting_id', 'is', null)
    .gte('starts_at', since)

  if (error) {
    throw error
  }

  for (const session of sessions ?? []) {
    try {
      const details = await getRecordingForMeeting(session.zoom_meeting_id)
      const video = (details.recording_files ?? []).find(
        (file) => file.file_type === 'MP4' && file.play_url,
      )
      if (!video) {
        const endTime = session.ends_at
          ? new Date(session.ends_at).getTime()
          : session.starts_at
            ? new Date(session.starts_at).getTime()
            : null
        const shouldMarkUnavailable =
          endTime !== null && now - endTime > 6 * 60 * 60 * 1000

        await supabaseAdmin
          .from('class_sessions')
          .update({
            recording_status: shouldMarkUnavailable ? 'not_available' : 'processing',
            last_zoom_sync_at: new Date().toISOString(),
          })
          .eq('id', session.id)
        continue
      }

      await supabaseAdmin
        .from('class_sessions')
        .update({
          has_recording: true,
          recording_status: 'available',
          recording_url: video.play_url,
          last_zoom_sync_at: new Date().toISOString(),
        })
        .eq('id', session.id)
    } catch {
      // Best-effort reconciliation; continue processing remaining sessions.
    }
  }
}
