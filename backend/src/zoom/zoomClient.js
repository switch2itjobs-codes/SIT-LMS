import { env } from '../config/env.js'
import { getAccessToken, resetZoomTokenCache } from './zoomTokenManager.js'

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function parseJsonSafe(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function zoomRequest(method, path, body = null) {
  let attempt = 0
  let refreshedAfterUnauthorized = false

  while (attempt < 4) {
    const accessToken = await getAccessToken()
    const response = await fetch(`${env.zoomBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (response.status === 401 && !refreshedAfterUnauthorized) {
      refreshedAfterUnauthorized = true
      resetZoomTokenCache()
      attempt += 1
      continue
    }

    if (RETRYABLE_STATUS.has(response.status) && attempt < 3) {
      const retryAfter = Number(response.headers.get('retry-after') ?? 0)
      const waitMs =
        retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 250
      await sleep(waitMs)
      attempt += 1
      continue
    }

    if (!response.ok) {
      const errorBody = await parseJsonSafe(response)
      throw new Error(
        `Zoom API ${method} ${path} failed (${response.status}): ${JSON.stringify(errorBody)}`,
      )
    }

    if (response.status === 204) return null
    return await parseJsonSafe(response)
  }

  throw new Error(`Zoom API ${method} ${path} failed after retries.`)
}
