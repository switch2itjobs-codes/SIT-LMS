import dotenv from 'dotenv'

dotenv.config()

const requiredKeys = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ZOOM_ACCOUNT_ID',
  'ZOOM_CLIENT_ID',
  'ZOOM_CLIENT_SECRET',
  'ZOOM_WEBHOOK_SECRET_TOKEN',
]

for (const key of requiredKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  zoomAccountId: process.env.ZOOM_ACCOUNT_ID,
  zoomClientId: process.env.ZOOM_CLIENT_ID,
  zoomClientSecret: process.env.ZOOM_CLIENT_SECRET,
  zoomWebhookSecretToken: process.env.ZOOM_WEBHOOK_SECRET_TOKEN,
  zoomBaseUrl: process.env.ZOOM_BASE_URL ?? 'https://api.zoom.us/v2',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
  allowedOrigins: (process.env.APP_ALLOWED_ORIGINS ?? process.env.APP_BASE_URL ?? 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  enableReconcileJob:
    process.env.ENABLE_RECONCILE_JOB != null
      ? process.env.ENABLE_RECONCILE_JOB === 'true'
      : process.env.VERCEL !== '1',
}
