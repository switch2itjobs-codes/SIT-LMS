import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Timer,
  User,
  UserX,
  Users,
  Video,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type AdminLiveClassDetailPageProps = {
  batchId: string
  classSessionId: string
  onBack: () => void
}

type ClassDetailRow = {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  zoom_status: string | null
  recording_url: string | null
  recording_status: string | null
  trainer_id: string | null
}

type AttendanceRow = {
  studentId: string | null
  studentName: string
  email: string | null
  joinedAt: string | null
  leftAt: string | null
  durationSeconds: number
  status: 'present' | 'partial' | 'absent'
  notes: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTimeRange(start: string, end: string | null) {
  const startText = new Date(start).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  const endText = end
    ? new Date(end).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : null
  return endText ? `${startText} - ${endText}` : startText
}

function formatClockTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDuration(valueSeconds: number) {
  const safeSeconds = Number.isFinite(valueSeconds)
    ? Math.max(0, Math.round(valueSeconds))
    : 0
  if (safeSeconds <= 0) return '0 sec'
  if (safeSeconds < 60) return `${safeSeconds} sec`
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  if (!secs) return `${mins} min`
  return `${mins}m ${secs}s`
}

function getDurationLabel(start: string, end: string | null) {
  const startMs = new Date(start).getTime()
  const endMs = end ? new Date(end).getTime() : startMs + 60 * 60 * 1000
  const minutes = Math.max(1, Math.round((endMs - startMs) / (1000 * 60)))
  return `${minutes} Minutes`
}

function getStatusText(status: string | null) {
  if (status === 'ended') return 'Completed'
  if (status === 'started') return 'Live'
  if (status === 'cancelled') return 'Cancelled'
  return 'Scheduled'
}

function getStatusClass(status: string | null) {
  if (status === 'ended') return 'is-completed'
  if (status === 'started') return 'is-live'
  if (status === 'cancelled') return 'is-cancelled'
  return 'is-scheduled'
}

export function AdminLiveClassDetailPage({
  batchId,
  classSessionId,
  onBack,
}: AdminLiveClassDetailPageProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState<ClassDetailRow | null>(null)
  const [batchCode, setBatchCode] = useState('Batch')
  const [trainerName, setTrainerName] = useState('Trainer')
  const [overviewText, setOverviewText] = useState(
    '-',
  )
  const [attachments, setAttachments] = useState<
    Array<{ name: string; url: string; size: string }>
  >([])
  const [kpis, setKpis] = useState({
    totalStudents: 0,
    presentCount: 0,
    absentCount: 0,
    avgDurationMins: 0,
  })
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([])
  const [feedbackDrawerOpen, setFeedbackDrawerOpen] = useState(false)
  const [feedbackStudentName, setFeedbackStudentName] = useState('')
  const [feedbackStudentId, setFeedbackStudentId] = useState<string | null>(null)
  const [feedbackStatus, setFeedbackStatus] = useState<'present' | 'absent'>('absent')
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSaving, setFeedbackSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      const { data: sessionRow, error: sessionError } = await supabase
        .from('class_sessions')
        .select(
          'id,title,description,starts_at,ends_at,zoom_status,recording_url,recording_status,trainer_id,batch_id',
        )
        .eq('id', classSessionId)
        .eq('batch_id', batchId)
        .maybeSingle()

      if (sessionError || !sessionRow) {
        setError(sessionError?.message ?? 'Class details not found.')
        setLoading(false)
        return
      }

      setSession(sessionRow as ClassDetailRow)
      const normalizedDescription = String(sessionRow.description ?? '').trim()
      if (
        normalizedDescription &&
        !normalizedDescription.startsWith('http://') &&
        !normalizedDescription.startsWith('https://') &&
        !normalizedDescription.startsWith('www.')
      ) {
        setOverviewText(normalizedDescription)
      } else {
        setOverviewText('-')
      }

      const [
        { data: batchRow },
        { data: trainerRow },
        { data: assignmentRows },
        { data: enrollmentRows },
        { data: participantRows },
        { data: studentRows },
        { data: attendanceStoredRows },
      ] = await Promise.all([
        supabase.from('batches').select('batch_code').eq('id', batchId).maybeSingle(),
        sessionRow.trainer_id
          ? supabase
              .from('trainers')
              .select('trainer_name')
              .eq('id', sessionRow.trainer_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('assignments')
          .select('attachment_url,title')
          .eq('class_session_id', classSessionId),
        supabase
          .from('student_batches')
          .select('students!inner(id,email,student_name)')
          .eq('batch_id', batchId)
          .eq('is_active', true),
        supabase
          .from('class_session_participants')
          .select('user_name,user_email,join_time,leave_time,duration_seconds')
          .eq('class_session_id', classSessionId),
        supabase.from('students').select('id,student_name,email'),
        supabase
          .from('class_attendance')
          .select('student_id,status,notes')
          .eq('class_session_id', classSessionId),
      ])

      if (batchRow?.batch_code) setBatchCode(batchRow.batch_code)
      if (trainerRow?.trainer_name) setTrainerName(trainerRow.trainer_name)

      const files: Array<{ name: string; url: string; size: string }> = []
      if (normalizedDescription) {
        const directClassUrl = normalizedDescription.startsWith('www.')
          ? `https://${normalizedDescription}`
          : normalizedDescription
        if (
          directClassUrl.startsWith('http://') ||
          directClassUrl.startsWith('https://')
        ) {
          files.push({
            name: decodeURIComponent(
              directClassUrl.split('/').pop() || 'Class_Attachment',
            ),
            url: directClassUrl,
            size: 'File',
          })
        }
      }

      for (const row of assignmentRows ?? []) {
        if (!row.attachment_url) continue
        files.push({
          name: row.title || decodeURIComponent(row.attachment_url.split('/').pop() || 'Attachment'),
          url: row.attachment_url,
          size: 'File',
        })
      }
      setAttachments(files)

      const enrolledStudents = (enrollmentRows ?? [])
        .map((row) => {
          const studentRel = row.students as
            | { id?: string | null; email?: string | null; student_name?: string | null }
            | Array<{
                id?: string | null
                email?: string | null
                student_name?: string | null
              }>
            | null
          const student = Array.isArray(studentRel) ? studentRel[0] : studentRel
          return {
            id: student?.id ? String(student.id) : null,
            email: String(student?.email ?? '')
              .trim()
              .toLowerCase(),
            studentName: String(student?.student_name ?? '').trim(),
          }
        })
        .filter((item) => Boolean(item.email))
      const enrolledEmails = new Set(enrolledStudents.map((item) => item.email))
      const enrolledStudentByEmail = new Map(
        enrolledStudents.map((item) => [item.email, item]),
      )
      const attendanceStoredByStudentId = new Map(
        (attendanceStoredRows ?? []).map((item) => [item.student_id, item]),
      )
      const durationByEmail = new Map<string, number>()
      const participantRowsByEmail = new Map<
        string,
        Array<{
          user_name: string | null
          user_email: string | null
          join_time: string | null
          leave_time: string | null
          duration_seconds: number | null
        }>
      >()
      for (const row of participantRows ?? []) {
        const email = String(row.user_email ?? '').trim().toLowerCase()
        if (!email || !enrolledEmails.has(email)) continue
        const next = (durationByEmail.get(email) ?? 0) + Number(row.duration_seconds ?? 0)
        durationByEmail.set(email, next)
        const list = participantRowsByEmail.get(email) ?? []
        list.push(row)
        participantRowsByEmail.set(email, list)
      }

      const totalStudents = enrolledEmails.size
      const presentCount = Array.from(durationByEmail.values()).filter((sec) => sec > 0).length
      const absentCount = Math.max(totalStudents - presentCount, 0)
      const avgDurationMins = presentCount
        ? Math.round(
            Array.from(durationByEmail.values()).reduce((sum, sec) => sum + sec, 0) /
              presentCount /
              60,
          )
        : 0

      setKpis({
        totalStudents,
        presentCount,
        absentCount,
        avgDurationMins,
      })

      const studentNameByEmail = new Map(
        (studentRows ?? []).map((item) => [
          String(item.email ?? '').trim().toLowerCase(),
          item.student_name,
        ]),
      )
      const studentIdByEmail = new Map(
        (studentRows ?? []).map((item) => [
          String(item.email ?? '').trim().toLowerCase(),
          item.id ? String(item.id) : null,
        ]),
      )
      const scheduledDurationMinutes = Math.max(
        1,
        Math.round(
          (new Date(sessionRow.ends_at ?? sessionRow.starts_at).getTime() -
            new Date(sessionRow.starts_at).getTime()) /
            (1000 * 60),
        ) || 60,
      )
      const rows: AttendanceRow[] = Array.from(enrolledEmails)
        .map((email) => {
          const parts = participantRowsByEmail.get(email) ?? []
          const durationSec = durationByEmail.get(email) ?? 0
          const enrolledStudent = enrolledStudentByEmail.get(email) ?? null
          const stored = enrolledStudent?.id
            ? attendanceStoredByStudentId.get(enrolledStudent.id)
            : null
          const joinedAt =
            parts.length > 0
              ? parts
                  .map((p) => p.join_time)
                  .filter((v): v is string => Boolean(v))
                  .sort()[0] ?? null
              : null
          const leftAt =
            parts.length > 0
              ? parts
                  .map((p) => p.leave_time)
                  .filter((v): v is string => Boolean(v))
                  .sort()
                  .slice(-1)[0] ?? null
              : null
          const joinedMs = joinedAt ? new Date(joinedAt).getTime() : null
          const leftMs = leftAt ? new Date(leftAt).getTime() : null
          const durationFromTimes =
            joinedMs !== null && leftMs !== null && leftMs >= joinedMs
              ? Math.round((leftMs - joinedMs) / 1000)
              : null
          const durationSeconds = Number.isFinite(durationFromTimes ?? durationSec)
            ? Number(durationFromTimes ?? durationSec)
            : 0
          const ratio = durationSeconds / (scheduledDurationMinutes * 60)
          const status: AttendanceRow['status'] =
            durationSeconds <= 0
              ? 'absent'
              : ratio >= 0.75
                ? 'present'
                : 'partial'
          return {
            studentId: enrolledStudent?.id ?? studentIdByEmail.get(email) ?? null,
            studentName: studentNameByEmail.get(email) ?? parts[0]?.user_name ?? 'Student',
            email,
            joinedAt,
            leftAt,
            durationSeconds,
            status,
            notes: String(stored?.notes ?? ''),
          }
        })
        .sort((a, b) => {
          if (a.joinedAt && b.joinedAt) return a.joinedAt.localeCompare(b.joinedAt)
          if (a.joinedAt) return -1
          if (b.joinedAt) return 1
          return a.studentName.localeCompare(b.studentName)
        })
      setAttendanceRows(rows)
      setLoading(false)
    }

    void load()
  }, [batchId, classSessionId])

  if (loading) {
    return <p className="muted-dark">Loading class details...</p>
  }

  if (error || !session) {
    return (
      <div className="admin-live-class-detail">
        <button type="button" className="admin-live-class-back" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Live Classes
        </button>
        <p className="error">{error || 'Unable to load class details.'}</p>
      </div>
    )
  }

  const handleExportAttendance = () => {
    if (!attendanceRows.length) return
    const csv = [
          ['Student Name', 'Email', 'Joined At', 'Left At', 'Duration', 'Status'].join(','),
      ...attendanceRows.map((row) =>
        [
          row.studentName,
          row.email ?? '',
          row.joinedAt ?? '',
          row.leftAt ?? '',
          formatDuration(row.durationSeconds),
          row.status,
          row.notes,
        ]
          .map((item) => `"${String(item).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${session.title.replace(/\s+/g, '_')}_attendance.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenFeedback = (row: AttendanceRow) => {
    setFeedbackStudentName(row.studentName)
    setFeedbackStudentId(row.studentId)
    setFeedbackStatus(
      row.status === 'absent' ? 'absent' : 'present',
    )
    setFeedbackText(row.notes ?? '')
    setFeedbackDrawerOpen(true)
  }

  const handleSaveFeedback = async () => {
    if (!session || !feedbackStudentId) return
    try {
      setFeedbackSaving(true)
      const { error: upsertError } = await supabase.from('class_attendance').upsert(
        {
          class_session_id: session.id,
          student_id: feedbackStudentId,
          status: feedbackStatus,
          notes: feedbackText.trim() || null,
        },
        { onConflict: 'class_session_id,student_id', ignoreDuplicates: false },
      )
      if (upsertError) throw upsertError

      setAttendanceRows((prev) =>
        prev.map((item) =>
          item.studentId === feedbackStudentId
            ? {
                ...item,
                notes: feedbackText.trim(),
              }
            : item,
        ),
      )
      setFeedbackDrawerOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save feedback.')
    } finally {
      setFeedbackSaving(false)
    }
  }

  return (
    <div className="admin-live-class-detail">
      <button type="button" className="admin-live-class-back" onClick={onBack}>
        <ArrowLeft size={14} /> Back to Live Classes
      </button>

      <section className="admin-live-class-hero">
        <div className="admin-live-class-hero-icon">
          <Video size={34} />
        </div>
        <div className="admin-live-class-hero-main">
          <span className={`admin-live-class-status ${getStatusClass(session.zoom_status)}`}>
            {getStatusText(session.zoom_status)}
          </span>
          <h1>{session.title}</h1>
          <div className="admin-live-class-meta">
            <p>
              <Users size={13} />
              <span>Batch</span>
              <strong>{batchCode}</strong>
            </p>
            <p>
              <User size={13} />
              <span>Trainer</span>
              <strong>{trainerName}</strong>
            </p>
            <p>
              <CalendarDays size={13} />
              <span>Date</span>
              <strong>{formatDate(session.starts_at)}</strong>
            </p>
            <p>
              <Clock3 size={13} />
              <span>Time</span>
              <strong>{formatTimeRange(session.starts_at, session.ends_at)}</strong>
            </p>
            <p>
              <Timer size={13} />
              <span>Duration</span>
              <strong>{getDurationLabel(session.starts_at, session.ends_at)}</strong>
            </p>
          </div>
        </div>
      </section>

      <section className="admin-live-class-summary-grid">
        <article className="admin-live-class-card admin-live-class-kpi-card">
          <div className="admin-live-class-kpi-grid">
            <div className="admin-live-class-kpi is-students">
              <Users size={18} />
              <h4>{session.zoom_status === 'ended' ? kpis.totalStudents : '-'}</h4>
              <p>Total Students</p>
            </div>
            <div className="admin-live-class-kpi is-present">
              <CheckCircle2 size={18} />
              <h4>{session.zoom_status === 'ended' ? kpis.presentCount : '-'}</h4>
              <p>
                Present
                <span className="admin-live-class-kpi-inline-meta">
                  <i />
                  {session.zoom_status === 'ended'
                    ? kpis.totalStudents
                      ? `${Math.round((kpis.presentCount / kpis.totalStudents) * 100)}%`
                      : '0%'
                    : '-'}
                </span>
              </p>
            </div>
            <div className="admin-live-class-kpi is-absent">
              <UserX size={18} />
              <h4>{session.zoom_status === 'ended' ? kpis.absentCount : '-'}</h4>
              <p>
                Absent
                <span className="admin-live-class-kpi-inline-meta">
                  <i />
                  {session.zoom_status === 'ended'
                    ? kpis.totalStudents
                      ? `${Math.round((kpis.absentCount / kpis.totalStudents) * 100)}%`
                      : '0%'
                    : '-'}
                </span>
              </p>
            </div>
            <div className="admin-live-class-kpi is-duration">
              <Clock3 size={18} />
              <h4>{session.zoom_status === 'ended' ? `${kpis.avgDurationMins} min` : '-'}</h4>
              <p>Avg Duration</p>
            </div>
          </div>
        </article>

        <article className="admin-live-class-card admin-live-class-overview-card">
          <h3>Class Overview</h3>
          <p>{overviewText}</p>
          <h4>Attachments ({attachments.length})</h4>
          {attachments.length ? (
            <div className="admin-live-class-attachment-list">
              {attachments.map((item) => (
                <a key={item.url} href={item.url} target="_blank" rel="noreferrer">
                  <span>{item.name}</span>
                  <small>{item.size}</small>
                </a>
              ))}
            </div>
          ) : (
            <p className="muted-dark">-</p>
          )}
        </article>
      </section>

      <section className="admin-live-class-bottom-grid admin-live-class-bottom-grid-single">
        <article className="admin-live-class-card">
          <header className="admin-live-class-card-head">
            <h3>Attendance</h3>
            {session.zoom_status === 'ended' ? (
              <button type="button" onClick={handleExportAttendance}>
                <Download size={14} /> Export Report
              </button>
            ) : null}
          </header>
          {session.zoom_status !== 'ended' ? (
            <p className="muted-dark">Attendance report will appear after class is completed.</p>
          ) : (
            <div className="admin-live-class-attendance-wrap">
              <table className="admin-live-class-attendance-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student Name</th>
                    <th>Joined At</th>
                    <th>Left At</th>
                    <th>Duration</th>
                    <th>Notes</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRows.map((row, index) => (
                    <tr key={`${row.email ?? row.studentName}-${index}`}>
                      <td>{index + 1}</td>
                      <td>
                        {row.studentId ? (
                          <button
                            type="button"
                            className="student-name-link"
                            onClick={() => navigate(`/admin/students/${row.studentId}`)}
                          >
                            {row.studentName}
                          </button>
                        ) : (
                          <span>{row.studentName}</span>
                        )}
                      </td>
                      <td>{formatClockTime(row.joinedAt)}</td>
                      <td>{formatClockTime(row.leftAt)}</td>
                      <td>{formatDuration(row.durationSeconds)}</td>
                      <td>{row.notes || '-'}</td>
                      <td>
                        <span className={`admin-live-class-att-status is-${row.status}`}>
                          {row.status === 'present'
                            ? 'Present'
                            : row.status === 'partial'
                              ? 'Partial'
                              : 'Absent'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-live-class-feedback-btn"
                          onClick={() => handleOpenFeedback(row)}
                        >
                          Give Feedback
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      {feedbackDrawerOpen ? (
        <div className="admin-feedback-drawer-overlay" onClick={() => setFeedbackDrawerOpen(false)}>
          <aside
            className="admin-feedback-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-feedback-drawer-head">
              <div>
                <h3>Give Feedback</h3>
                <p>
                  <User size={14} /> {feedbackStudentName}
                </p>
              </div>
              <button
                type="button"
                className="admin-feedback-drawer-close"
                onClick={() => setFeedbackDrawerOpen(false)}
              >
                <X size={16} />
              </button>
            </header>
            <label className="admin-feedback-drawer-field">
              Feedback
              <textarea
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
                placeholder="Write notes and feedback for this student..."
                rows={7}
              />
            </label>
            <footer className="admin-feedback-drawer-actions">
              <button type="button" onClick={() => setFeedbackDrawerOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={feedbackSaving || !feedbackStudentId}
                onClick={handleSaveFeedback}
              >
                {feedbackSaving ? 'Saving...' : 'Give Feedback'}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
