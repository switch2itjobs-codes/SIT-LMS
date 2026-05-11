import crypto from 'node:crypto'

/**
 * Sign a JWT for the Zoom Meeting SDK (Web/Component View).
 *
 * Reference:
 * https://developers.zoom.us/docs/meeting-sdk/auth/#generate-a-meeting-sdk-jwt
 *
 * @param {object} opts
 * @param {string} opts.sdkKey       Meeting SDK Key (a.k.a. Client ID in newer apps)
 * @param {string} opts.sdkSecret    Meeting SDK Secret
 * @param {string|number} opts.meetingNumber  Zoom meeting ID
 * @param {0|1} opts.role            0 = attendee, 1 = host
 * @param {number} [opts.expirationSeconds=7200] JWT validity window (default 2h)
 * @returns {{ signature: string, sdkKey: string }}
 */
export function signMeetingSdkJwt({ sdkKey, sdkSecret, meetingNumber, role, expirationSeconds = 7200 }) {
  if (!sdkKey || !sdkSecret) {
    throw new Error('Missing Meeting SDK key/secret.')
  }
  if (meetingNumber == null) {
    throw new Error('meetingNumber is required.')
  }
  const validRole = role === 1 ? 1 : 0
  const now = Math.floor(Date.now() / 1000)
  const exp = now + expirationSeconds

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }
  const payload = {
    appKey: sdkKey,
    sdkKey: sdkKey,
    mn: String(meetingNumber),
    role: validRole,
    iat: now,
    exp,
    tokenExp: exp,
  }

  const base64url = (input) =>
    Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const headerSegment = base64url(JSON.stringify(header))
  const payloadSegment = base64url(JSON.stringify(payload))
  const data = `${headerSegment}.${payloadSegment}`

  const signature = crypto
    .createHmac('sha256', sdkSecret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return { signature: `${data}.${signature}`, sdkKey }
}
