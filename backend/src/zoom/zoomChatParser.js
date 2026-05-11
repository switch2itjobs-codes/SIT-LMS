/**
 * Parse the contents of a Zoom-generated meeting chat file (CC.txt format).
 *
 * Format is one entry per message, e.g.:
 *   12:37:14 From  Rahul to  Everyone:
 *           Hello team
 *
 * or with newer Zoom format:
 *   12:37:14 From Rahul: Hello team
 *
 * @param {string} text  Raw chat file content
 * @param {Date}   meetingStart  Date to anchor times (file uses time-of-day only)
 * @returns {Array<{ sender_name: string, message_text: string, sent_at: string }>}
 */
export function parseZoomChatFile(text, meetingStart = new Date()) {
  if (typeof text !== 'string' || !text.trim()) return []

  const lines = text.split(/\r?\n/)
  const results = []
  const timeHeader = /^(\d{2}):(\d{2}):(\d{2})\s+From\s+(.+?)(?:\s+to\s+([^:]+))?:\s*(.*)$/

  let current = null

  const flush = () => {
    if (current && current.message_text != null) {
      results.push(current)
    }
    current = null
  }

  for (const rawLine of lines) {
    const line = rawLine ?? ''
    const header = line.match(timeHeader)
    if (header) {
      flush()
      const [, hh, mm, ss, sender, , messagePart] = header
      const sentAt = new Date(meetingStart)
      sentAt.setHours(Number(hh), Number(mm), Number(ss), 0)
      current = {
        sender_name: sender?.trim() ?? null,
        message_text: messagePart?.trim() ?? '',
        sent_at: sentAt.toISOString(),
      }
    } else if (current && line.trim().length > 0) {
      // Continuation line (indented multi-line message)
      current.message_text =
        (current.message_text ? current.message_text + '\n' : '') + line.trim()
    } else if (current && line.trim().length === 0) {
      // Blank line ends a message
      flush()
    }
  }
  flush()
  return results.filter((m) => m.message_text && m.message_text.length > 0)
}

/**
 * Download and parse a Zoom chat file (recording_files entry of type CHAT or CC).
 *
 * @param {string} downloadUrl  The Zoom recording file download URL
 * @param {string} accessToken  Zoom S2S OAuth access token
 * @param {Date}   meetingStart Date to anchor time-of-day timestamps
 */
export async function fetchAndParseZoomChatFile(downloadUrl, accessToken, meetingStart) {
  const url = accessToken
    ? `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`
    : downloadUrl
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Chat file download failed (${res.status})`)
  }
  const text = await res.text()
  return parseZoomChatFile(text, meetingStart)
}
