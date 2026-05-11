import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquare,
  PlayCircle,
  Users,
  Video,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getBackendOrigin } from '../lib/backendOrigin'

type ClassSession = {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  zoom_meeting_id: string | null
  recording_url: string | null
  has_recording: boolean
  recording_status: string
  zoom_status: string
  batch_id: string
}
type Recording = {
  id: string
  file_type: string
  recording_start: string | null
  recording_end: string | null
  play_url: string | null
  download_url: string | null
  file_size: number | null
}
type ChatMessage = {
  id: string
  sender_name: string | null
  sender_email: string | null
  message_text: string
  sent_at: string
  source: 'webhook_live' | 'recording_file'
}
type Poll = {
  id: string
  poll_title: string | null
  status: string | null
  questions: Array<{ name: string; type?: string; answers?: string[] }> | null
  responses: any
}
type AttendanceRow = {
  id: string
  student_id: string
  status: string
  marked_at: string
  join_time: string | null
  leave_time: string | null
  duration_seconds: number | null
}
type Participant = {
  id: string
  user_email: string | null
  user_name: string | null
  join_time: string | null
  leave_time: string | null
  duration_seconds: number | null
}
type Report = {
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  participants_count: number | null
  unique_participants: number | null
}

type Tab = 'recording' | 'chat' | 'polls' | 'attendance' | 'report'

function formatBytes(n: number | null | undefined) {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatTime(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function formatDuration(seconds?: number | null) {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('recording')
  const [session, setSession] = useState<ClassSession | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (!classId) throw new Error('Missing class id')
        const sess = (await supabase.auth.getSession()).data.session
        if (!sess) throw new Error('Not signed in')
        const headers = { Authorization: `Bearer ${sess.access_token}` }

        const base = `${getBackendOrigin()}/api/classes/${classId}`
        const [c, r, ch, p, a, rep] = await Promise.all([
          fetch(base, { headers }).then((r) => r.json()),
          fetch(`${base}/recordings`, { headers }).then((r) => r.json()),
          fetch(`${base}/chat`, { headers }).then((r) => r.json()),
          fetch(`${base}/polls`, { headers }).then((r) => r.json()),
          fetch(`${base}/attendance`, { headers }).then((r) => r.json()),
          fetch(`${base}/report`, { headers }).then((r) => r.json()),
        ])
        if (cancelled) return
        setSession(c)
        setRecordings(r.recordings ?? [])
        setChat(ch.messages ?? [])
        setPolls(p.polls ?? [])
        setAttendance(a.attendance ?? [])
        setParticipants(a.participants ?? [])
        setReport(rep.report ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load class')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [classId])

  const primaryRecording = useMemo(
    () =>
      recordings.find((r) => r.file_type === 'MP4' && r.play_url) ??
      recordings.find((r) => r.play_url || r.download_url),
    [recordings],
  )

  const isLive = session?.zoom_status === 'started'

  if (loading) {
    return (
      <main className="class-detail-page">
        <p style={{ padding: 24 }}>Loading…</p>
      </main>
    )
  }
  if (error || !session) {
    return (
      <main className="class-detail-page">
        <p style={{ padding: 24, color: '#DC2626' }}>{error || 'Class not found.'}</p>
        <button onClick={() => navigate(-1)} style={{ margin: 24 }}>
          Go back
        </button>
      </main>
    )
  }

  return (
    <main className="class-detail-page">
      <header className="class-detail-topbar">
        <button type="button" className="class-detail-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="class-detail-headings">
          <h2>{session.title}</h2>
          <p className="class-detail-meta">
            <CalendarDays size={13} />{' '}
            {new Date(session.starts_at).toLocaleString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        {isLive ? (
          <button
            type="button"
            className="class-detail-join"
            onClick={() => navigate(`/classes/${session.id}/live`)}
          >
            <Video size={14} /> Join Live
          </button>
        ) : null}
      </header>

      <nav className="class-detail-tabs">
        <button
          type="button"
          className={`cdt-tab ${tab === 'recording' ? 'active' : ''}`}
          onClick={() => setTab('recording')}
        >
          <PlayCircle size={15} /> Recording
        </button>
        <button
          type="button"
          className={`cdt-tab ${tab === 'chat' ? 'active' : ''}`}
          onClick={() => setTab('chat')}
        >
          <MessageSquare size={15} /> Chat ({chat.length})
        </button>
        <button
          type="button"
          className={`cdt-tab ${tab === 'polls' ? 'active' : ''}`}
          onClick={() => setTab('polls')}
        >
          <FileText size={15} /> Polls ({polls.length})
        </button>
        <button
          type="button"
          className={`cdt-tab ${tab === 'attendance' ? 'active' : ''}`}
          onClick={() => setTab('attendance')}
        >
          <Users size={15} /> Attendance ({attendance.length})
        </button>
        <button
          type="button"
          className={`cdt-tab ${tab === 'report' ? 'active' : ''}`}
          onClick={() => setTab('report')}
        >
          <BarChart3 size={15} /> Report
        </button>
      </nav>

      <section className="class-detail-body">
        {tab === 'recording' && (
          <div className="cdt-pane">
            {primaryRecording?.play_url ? (
              <video
                key={primaryRecording.id}
                controls
                preload="metadata"
                src={primaryRecording.play_url}
                style={{ width: '100%', borderRadius: 12, background: '#000' }}
              />
            ) : (
              <p className="cdt-empty">No recording available yet.</p>
            )}
            {recordings.length > 0 && (
              <ul className="cdt-recording-list">
                {recordings.map((r) => (
                  <li key={r.id}>
                    <span>
                      <FileText size={14} /> {r.file_type}
                    </span>
                    <span className="muted">{formatBytes(r.file_size)}</span>
                    {r.play_url && (
                      <a href={r.play_url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="cdt-pane">
            {chat.length === 0 ? (
              <p className="cdt-empty">No chat messages captured.</p>
            ) : (
              <ul className="cdt-chat-list">
                {chat.map((m) => (
                  <li key={m.id} className="cdt-chat-msg">
                    <div className="cdt-chat-head">
                      <strong>{m.sender_name ?? 'Unknown'}</strong>
                      <span className="muted">{formatTime(m.sent_at)}</span>
                    </div>
                    <p>{m.message_text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'polls' && (
          <div className="cdt-pane">
            {polls.length === 0 ? (
              <p className="cdt-empty">No polls were run in this class.</p>
            ) : (
              polls.map((p) => (
                <article key={p.id} className="cdt-poll-card">
                  <h3>{p.poll_title ?? 'Poll'}</h3>
                  {(p.questions ?? []).map((q, i) => (
                    <div key={i} className="cdt-poll-question">
                      <p className="cdt-q">{q.name}</p>
                      {q.answers?.map((a, j) => (
                        <div key={j} className="cdt-q-option">
                          {a}
                        </div>
                      ))}
                    </div>
                  ))}
                </article>
              ))
            )}
          </div>
        )}

        {tab === 'attendance' && (
          <div className="cdt-pane">
            <h4>Mapped Students ({attendance.length})</h4>
            <table className="cdt-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Marked at</th>
                  <th>Join</th>
                  <th>Leave</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.status === 'present' ? (
                        <span className="cdt-pill is-green">
                          <CheckCircle2 size={12} /> Present
                        </span>
                      ) : (
                        <span className="cdt-pill">{a.status}</span>
                      )}
                    </td>
                    <td>{formatTime(a.marked_at)}</td>
                    <td>{formatTime(a.join_time)}</td>
                    <td>{formatTime(a.leave_time)}</td>
                    <td>{formatDuration(a.duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ marginTop: 24 }}>All Zoom Participants ({participants.length})</h4>
            <table className="cdt-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Join</th>
                  <th>Leave</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id}>
                    <td>{p.user_name ?? '—'}</td>
                    <td className="muted">{p.user_email ?? '—'}</td>
                    <td>{formatTime(p.join_time)}</td>
                    <td>{formatTime(p.leave_time)}</td>
                    <td>{formatDuration(p.duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'report' && (
          <div className="cdt-pane">
            {report ? (
              <div className="cdt-report-grid">
                <div className="cdt-report-kpi">
                  <Clock3 size={18} />
                  <span className="muted">Duration</span>
                  <strong>{report.duration_minutes ?? '—'} min</strong>
                </div>
                <div className="cdt-report-kpi">
                  <Users size={18} />
                  <span className="muted">Participants</span>
                  <strong>{report.participants_count ?? '—'}</strong>
                </div>
                <div className="cdt-report-kpi">
                  <Users size={18} />
                  <span className="muted">Unique people</span>
                  <strong>{report.unique_participants ?? '—'}</strong>
                </div>
                <div className="cdt-report-kpi">
                  <CalendarDays size={18} />
                  <span className="muted">Started</span>
                  <strong>{formatTime(report.start_time)}</strong>
                </div>
                <div className="cdt-report-kpi">
                  <CalendarDays size={18} />
                  <span className="muted">Ended</span>
                  <strong>{formatTime(report.end_time)}</strong>
                </div>
              </div>
            ) : (
              <p className="cdt-empty">Report not generated yet (typically 1–2 min after meeting ends).</p>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
