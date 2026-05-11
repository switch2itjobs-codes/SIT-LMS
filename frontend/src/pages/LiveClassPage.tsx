import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getBackendOrigin } from '../lib/backendOrigin'

type ClassSession = {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  zoom_meeting_id: string | null
  zoom_password?: string | null
}

type SdkSignatureResponse = {
  signature: string
  sdkKey: string
  meetingNumber: string
  passcode: string | null
  role: 0 | 1
}

/**
 * Embedded Zoom Meeting SDK page.
 * Route: /home/classes/:classId/live
 * Lazy-loaded so the SDK bundle (~3 MB) doesn't bloat the app entry.
 */
export default function LiveClassPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const clientRef = useRef<any>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'joining' | 'in-meeting' | 'error'>(
    'loading',
  )
  const [error, setError] = useState('')
  const [classInfo, setClassInfo] = useState<ClassSession | null>(null)

  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined

    async function start() {
      try {
        if (!classId) throw new Error('Missing class id.')

        // 1. Fetch class info
        const sess = (await supabase.auth.getSession()).data.session
        if (!sess) throw new Error('Not signed in.')
        const headers = { Authorization: `Bearer ${sess.access_token}` }

        const cRes = await fetch(`${getBackendOrigin()}/api/classes/${classId}`, { headers })
        if (!cRes.ok) throw new Error(`Class fetch failed (${cRes.status})`)
        const cls: ClassSession = await cRes.json()
        if (cancelled) return
        setClassInfo(cls)

        if (!cls.zoom_meeting_id) {
          throw new Error('No Zoom meeting linked to this class.')
        }

        // 2. Get SDK signature
        const sigRes = await fetch(`${getBackendOrigin()}/api/zoom/sdk-signature`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingNumber: cls.zoom_meeting_id, role: 0 }),
        })
        if (!sigRes.ok) throw new Error(`Signature fetch failed (${sigRes.status})`)
        const sig: SdkSignatureResponse = await sigRes.json()
        if (cancelled) return

        // 3. Lazy-load the Meeting SDK
        const ZoomMtgEmbedded = (await import('@zoom/meetingsdk/embedded')).default

        const client = ZoomMtgEmbedded.createClient()
        clientRef.current = client

        if (!containerRef.current) throw new Error('Container not ready.')

        await client.init({
          zoomAppRoot: containerRef.current,
          language: 'en-US',
          patchJsMedia: true,
          customize: {
            video: { isResizable: true, viewSizes: { default: { width: 1000, height: 600 } } },
            toolbar: { buttons: [] },
          },
        })

        const displayName =
          (sess.user.user_metadata?.full_name as string | undefined) ?? sess.user.email ?? 'Student'

        setPhase('joining')

        await client.join({
          sdkKey: sig.sdkKey,
          signature: sig.signature,
          meetingNumber: sig.meetingNumber,
          password: sig.passcode ?? '',
          userName: displayName,
          userEmail: sess.user.email ?? undefined,
        })

        if (cancelled) {
          await client.leaveMeeting().catch(() => {})
          return
        }
        setPhase('in-meeting')

        // Mark attendance once connected
        fetch(`${getBackendOrigin()}/api/classes/${classId}/attendance/mark`, {
          method: 'POST',
          headers,
        }).catch(() => {})

        cleanup = () => {
          try {
            client.leaveMeeting()
          } catch {}
        }
      } catch (err) {
        if (cancelled) return
        console.error('LiveClassPage error:', err)
        setError(err instanceof Error ? err.message : 'Unable to start the meeting.')
        setPhase('error')
      }
    }

    void start()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [classId])

  return (
    <main className="live-class-page">
      <header className="live-class-topbar">
        <button
          type="button"
          className="live-class-back"
          onClick={() => navigate(-1)}
          aria-label="Leave class"
        >
          <ArrowLeft size={18} /> Leave
        </button>
        <h2 className="live-class-title">{classInfo?.title ?? 'Live Class'}</h2>
        <span className="live-class-status">
          {phase === 'in-meeting' ? (
            <>
              <span className="live-dot" /> Live
            </>
          ) : phase === 'joining' ? (
            'Joining…'
          ) : phase === 'loading' ? (
            'Loading…'
          ) : phase === 'error' ? (
            'Error'
          ) : null}
        </span>
      </header>

      {phase === 'error' ? (
        <div className="live-class-error">
          <p>{error}</p>
          <button type="button" onClick={() => navigate(-1)}>Go back</button>
        </div>
      ) : phase !== 'in-meeting' ? (
        <div className="live-class-loading">
          <Loader2 size={32} className="live-class-spinner" />
          <p>{phase === 'joining' ? 'Connecting to Zoom…' : 'Preparing the meeting…'}</p>
        </div>
      ) : null}

      <div ref={containerRef} id="meetingSDKElement" className="live-class-meeting-root" />
    </main>
  )
}
