import { supabaseAdmin } from '../lib/supabaseAdmin.js'

function parseBearerToken(header = '') {
  if (!header.toLowerCase().startsWith('bearer ')) return null
  return header.slice(7).trim()
}

function resolveRequestRole(user) {
  const raw = user.app_metadata?.role ?? user.user_metadata?.role
  if (raw === 'admin' || raw === 'trainer' || raw === 'student') {
    return raw
  }
  return 'student'
}

export async function requireAuth(req, res, next) {
  try {
    const token = parseBearerToken(req.headers.authorization)
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token.' })
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token.' })
    }

    const role = resolveRequestRole(data.user)
    req.auth = {
      token,
      user: data.user,
      role,
    }
    return next()
  } catch (error) {
    return res.status(500).json({ error: 'Auth middleware failed.' })
  }
}

export function requireRole(...allowedRoles) {
  const allowed = new Set(allowedRoles)
  return (req, res, next) => {
    if (!req.auth?.role || !allowed.has(req.auth.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' })
    }
    return next()
  }
}
