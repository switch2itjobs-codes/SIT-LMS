# Vercel Production Deployment (Frontend + Backend)

This project has two deployable apps:

- `frontend` (Vite React app)
- `backend` (Express Zoom API + webhook endpoint)

Deploy both as separate Vercel projects from the same GitHub repo.

## 1) Push code to GitHub

From the project root:

```bash
git add .
git commit -m "Prepare production deployment for Vercel"
git push origin <your-branch>
```

## 2) Deploy backend on Vercel

Create a new Vercel project:

- **Root Directory**: `backend`
- Framework preset: `Other`

Set backend environment variables in Vercel (Production + Preview):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_WEBHOOK_SECRET_TOKEN`
- `ZOOM_BASE_URL=https://api.zoom.us/v2`
- `APP_BASE_URL=<your frontend production url>`
- `APP_ALLOWED_ORIGINS=<frontend production url>,<optional preview url>`
- `ENABLE_RECONCILE_JOB=false` (recommended on serverless)

After deploy, note backend URL:

- Example: `https://student-management-backend.vercel.app`

Verify:

- `GET https://<backend-domain>/health` returns `{ "ok": true }`

## 3) Configure Zoom webhook to production backend

In Zoom App Marketplace, set webhook endpoint to:

- `https://<backend-domain>/api/zoom/webhook`

Keep the same webhook secret token as `ZOOM_WEBHOOK_SECRET_TOKEN`.

## 4) Deploy frontend on Vercel

Create another Vercel project:

- **Root Directory**: `frontend`
- Framework preset: `Vite`

Set frontend environment variables in Vercel (Production + Preview):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ZOOM_API_BASE=https://<backend-domain>/api/zoom`

Then deploy.

## 5) Supabase auth redirect configuration

In Supabase Dashboard -> Authentication -> URL Configuration:

- Add your frontend production URL as **Site URL**
- Add preview and production URLs under **Redirect URLs**

## 6) Post-deploy smoke test

1. Login as admin and student.
2. Open admin batches -> schedule a class.
3. Start and end a Zoom class.
4. Confirm webhook events are recorded.
5. Confirm class moves: Upcoming -> Live -> Completed.
6. Confirm recording button works for past classes.

## Notes

- `frontend/vercel.json` handles SPA route refreshes.
- `backend/vercel.json` routes all requests to Express handler.
- Reconciliation interval is disabled by default on Vercel (`ENABLE_RECONCILE_JOB=false`).
