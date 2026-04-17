# Zoom App Setup Guide (One-Time Manual Step)

## 1) Create a Server-to-Server OAuth app
1. Open [Zoom Marketplace](https://marketplace.zoom.us) and sign in as the account owner/admin.
2. Go to **Develop -> Build App**.
3. Choose **Server-to-Server OAuth**.
4. Name it `MyPortal-Zoom` (or similar) and create it.
5. Copy and securely store:
   - `ZOOM_ACCOUNT_ID`
   - `ZOOM_CLIENT_ID`
   - `ZOOM_CLIENT_SECRET`

## 2) Add required scopes
Add scopes required by this integration:
- Meetings read/write (admin)
- Users read (admin)
- Recordings read (admin)
- Cloud Recording settings update (admin)
- Reports read (admin)

Optional scopes:
- Recordings write (admin) if you plan to delete recordings from your app.

## 3) Configure event subscriptions
1. In **Feature**, enable Event Subscriptions.
2. Set webhook URL to your backend:
   - `https://your-domain.com/api/zoom/webhook`
3. Subscribe to:
   - `meeting.started`
   - `meeting.ended`
   - `recording.completed`
   - `meeting.participant_joined` (optional)
   - `meeting.participant_left` (optional)
4. Copy webhook secret and store as:
   - `ZOOM_WEBHOOK_SECRET_TOKEN`

## 4) Activate the app
Activate app and verify token generation from backend logs or test endpoint.

## 5) Optional: Meeting SDK app
Create a **Meeting SDK** app only if you want embedded Zoom UI inside your portal.
Store:
- `ZOOM_SDK_KEY`
- `ZOOM_SDK_SECRET`
