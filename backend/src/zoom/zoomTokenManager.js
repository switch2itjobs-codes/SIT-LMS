import { env } from '../config/env.js'

let cachedToken = null
let tokenExpiryMs = 0

export function resetZoomTokenCache() {
  cachedToken = null
  tokenExpiryMs = 0
}

export async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiryMs - 60_000) {
    return cachedToken
  }

  const credentials = Buffer.from(
    `${env.zoomClientId}:${env.zoomClientSecret}`,
  ).toString('base64')

  const tokenUrl = new URL('https://zoom.us/oauth/token')
  tokenUrl.searchParams.set('grant_type', 'account_credentials')
  tokenUrl.searchParams.set('account_id', env.zoomAccountId)

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  const body = await response.json()
  if (!response.ok || !body.access_token) {
    throw new Error(
      `Unable to fetch Zoom token (${response.status}): ${JSON.stringify(body)}`,
    )
  }

  cachedToken = body.access_token
  tokenExpiryMs = Date.now() + Number(body.expires_in ?? 3600) * 1000
  return cachedToken
}
