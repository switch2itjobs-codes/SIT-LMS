function isLocalhostUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
  } catch {
    return false
  }
}

/**
 * Origin for admin API (no trailing slash).
 * In Vite dev, returns '' so requests use `/api/...` on the dev server and the proxy forwards to Express.
 * Set `VITE_BACKEND_URL` to a non-local URL to call a remote API from dev.
 */
export function getBackendOrigin(): string {
  const backendEnv =
    typeof import.meta.env.VITE_BACKEND_URL === 'string'
      ? import.meta.env.VITE_BACKEND_URL.trim()
      : ''

  if (backendEnv) {
    if (import.meta.env.DEV && isLocalhostUrl(backendEnv)) {
      return ''
    }
    return backendEnv.replace(/\/$/, '')
  }

  if (import.meta.env.DEV) {
    return ''
  }

  const zoom = import.meta.env.VITE_ZOOM_API_BASE
  if (typeof zoom === 'string' && zoom.trim() !== '') {
    const origin = zoom.replace(/\/api\/zoom\/?$/i, '').replace(/\/$/, '')
    if (origin) {
      if (!isLocalhostUrl(origin)) {
        return origin
      }
      if (typeof window !== 'undefined') {
        return window.location.origin
      }
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'http://localhost:8787'
}
