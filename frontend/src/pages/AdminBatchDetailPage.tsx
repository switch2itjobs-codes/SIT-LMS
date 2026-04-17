import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Link as LinkIcon,
  Plus,
  Search,
  Users,
  Video,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AdminStudentsPage } from './AdminStudentsPage'
import {
  getZoomHosts,
  getJoinUrl,
  getMeetingParticipantsReport,
  getStartUrl,
  scheduleClass,
} from '../lib/zoomApi'

export type BatchDetailTab =
  | 'overview'
  | 'live-classes'
  | 'students'
  | 'schedule'
  | 'announcements'
  | 'assignments'

type AdminBatchDetailPageProps = {
  batchId: string
  initialBatchCode?: string
  onBack: () => void
  initialTab?: BatchDetailTab
  onTabChange?: (tab: BatchDetailTab) => void
}

type BatchRecord = {
  id: string
  batch_code: string
  status: string
  batch_type: string
  start_date: string | null
  end_date: string | null
  batch_capacity: number
  trainer_id: string | null
  notes: string | null
  trainers: { trainer_name: string } | null
}

type ClassSessionRow = {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  join_url: string | null
  recording_url: string | null
  zoom_meeting_id: string | null
  zoom_status: string | null
  zoom_password: string | null
  recording_status: 'pending' | 'processing' | 'available' | 'not_available' | null
}

type StudentInBatch = {
  id: string
  student_name: string
  email: string
  stage: string
  progress_pct: number | null
  joined_at: string | null
}

type AnnouncementRow = {
  id: string
  title: string
  body: string
  is_important: boolean
  published_at: string
}

type SyllabusItemType = 'live_class' | 'document' | 'class_upload'

type SyllabusItem = {
  id: string
  type: SyllabusItemType
  title: string
  url: string | null
  class_session_id: string | null
}

type SyllabusSection = {
  id: string
  title: string
  items: SyllabusItem[]
}

const TAB_ITEMS: {
  id: BatchDetailTab
  label: string
  icon: ReactNode
}[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={15} /> },
  { id: 'live-classes', label: 'Live Classes', icon: <Video size={15} /> },
  { id: 'students', label: 'Students', icon: <Users size={15} /> },
  { id: 'schedule', label: 'Schedule', icon: <CalendarDays size={15} /> },
  { id: 'announcements', label: 'Announcements', icon: <Bell size={15} /> },
  { id: 'assignments', label: 'Assignments', icon: <ClipboardList size={15} /> },
]

function formatLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatDateOnly(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

function batchStatusPillClass(status: string) {
  switch (status) {
    case 'active':
      return 'batch-status-pill batch-status-active'
    case 'planned':
      return 'batch-status-pill batch-status-planned'
    case 'completed':
      return 'batch-status-pill batch-status-completed'
    case 'cancelled':
      return 'batch-status-pill batch-status-cancelled'
    default:
      return 'batch-status-pill batch-status-planned'
  }
}

function isSessionLive(s: ClassSessionRow, now: Date): boolean {
  if (s.zoom_status === 'started') {
    if (s.ends_at && now.getTime() > new Date(s.ends_at).getTime()) return false
    return true
  }
  if (s.zoom_status === 'ended' || s.zoom_status === 'cancelled') return false
  const start = new Date(s.starts_at).getTime()
  const t = now.getTime()
  if (t < start) return false
  if (s.ends_at) return t <= new Date(s.ends_at).getTime()
  return true
}

function SessionRows({
  items,
  variant,
  onStart,
  onJoin,
  onOpenRecording,
  onReport,
  loadingMeetingId,
}: {
  items: ClassSessionRow[]
  variant: 'live' | 'upcoming' | 'past'
  onStart: (meetingId: string) => void
  onJoin: (meetingId: string) => void
  onOpenRecording: (session: ClassSessionRow) => void
  onReport: (meetingId: string) => void
  loadingMeetingId: string | null
}) {
  if (items.length === 0) {
    const empty =
      variant === 'live'
        ? 'No class is in session right now.'
        : variant === 'upcoming'
          ? 'No upcoming live classes.'
          : 'No past sessions yet.'
    return <p className="muted-dark batch-empty live-class-card-empty">{empty}</p>
  }

  return (
    <ul className="live-class-card-list">
      {items.map((s) => (
        <li key={s.id} className="live-class-card-row">
          <div>
            <p className="batch-session-title">{s.title}</p>
            <p className="muted-dark batch-session-meta">
              {formatDateTime(s.starts_at)}
            </p>
          </div>
          <div className="live-class-card-actions">
            {s.zoom_meeting_id && variant !== 'past' ? (
              <button
                type="button"
                className="batch-link-btn"
                disabled={loadingMeetingId === s.zoom_meeting_id}
                onClick={() => onStart(s.zoom_meeting_id as string)}
              >
                Start
              </button>
            ) : null}
            {s.zoom_meeting_id && variant !== 'past' ? (
              <button
                type="button"
                className="batch-link-btn"
                disabled={loadingMeetingId === s.zoom_meeting_id}
                onClick={() => onJoin(s.zoom_meeting_id as string)}
              >
                Join
              </button>
            ) : variant !== 'past' && s.join_url ? (
              <a className="batch-link" href={s.join_url} target="_blank" rel="noreferrer">
                Join
              </a>
            ) : null}
            {variant === 'past' ? (
              <button
                type="button"
                className="batch-link-btn"
                disabled={!s.recording_url}
                onClick={() => onOpenRecording(s)}
              >
                {s.recording_url
                  ? 'Recording'
                  : s.recording_status === 'processing' ||
                      s.recording_status === 'pending'
                    ? 'Processing'
                    : 'Recording'}
              </button>
            ) : null}
            {s.zoom_meeting_id && variant === 'past' ? (
              <button
                type="button"
                className="batch-link-btn"
                disabled={loadingMeetingId === s.zoom_meeting_id}
                onClick={() => onReport(s.zoom_meeting_id as string)}
              >
                Report
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function AdminBatchDetailPage({
  batchId,
  initialBatchCode,
  onBack,
  initialTab = 'overview',
  onTabChange,
}: AdminBatchDetailPageProps) {
  const [activeTab, setActiveTab] = useState<BatchDetailTab>(initialTab)
  const [liveSearch, setLiveSearch] = useState('')
  const [liveFilter, setLiveFilter] = useState<
    'all' | 'join_link' | 'recording' | 'no_links'
  >('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [batch, setBatch] = useState<BatchRecord | null>(null)
  const [sessions, setSessions] = useState<ClassSessionRow[]>([])
  const [roster, setRoster] = useState<StudentInBatch[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [avgProgress, setAvgProgress] = useState<number | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleBusy, setScheduleBusy] = useState(false)
  const [actionBusyMeetingId, setActionBusyMeetingId] = useState<string | null>(
    null,
  )
  const [zoomHosts, setZoomHosts] = useState<
    Array<{ id: string; first_name: string; display_name: string }>
  >([])
  const [hostsLoading, setHostsLoading] = useState(false)
  const [liveActionError, setLiveActionError] = useState('')
  const [recordingPreview, setRecordingPreview] = useState<{
    title: string
    url: string
  } | null>(null)
  const [selectedReportRows, setSelectedReportRows] = useState<
    Array<{
      participant_name: string
      participant_email: string | null
      student_name: string | null
      join_time: string | null
      leave_time: string | null
      duration_seconds: number
    }>
  >([])
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    body: '',
    isImportant: false,
  })
  const [announcementSaving, setAnnouncementSaving] = useState(false)
  const [syllabusSections, setSyllabusSections] = useState<SyllabusSection[]>([])
  const [expandedSectionIds, setExpandedSectionIds] = useState<string[]>([])
  const [sectionFormOpen, setSectionFormOpen] = useState(false)
  const [sectionTitle, setSectionTitle] = useState('')
  const [activeItemSectionId, setActiveItemSectionId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState({
    type: 'live_class' as SyllabusItemType,
    title: '',
    url: '',
    classSessionId: '',
  })
  const [scheduleForm, setScheduleForm] = useState({
    topic: '',
    date: '',
    time: '',
    duration: 60,
    hostUserId: '',
    attachmentUrl: '',
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      const { data: batchRow, error: batchError } = await supabase
        .from('batches')
        .select(
          'id,batch_code,status,batch_type,start_date,end_date,batch_capacity,trainer_id,notes,trainers(trainer_name)',
        )
        .eq('id', batchId)
        .maybeSingle()

      if (batchError || !batchRow) {
        setError(batchError?.message ?? 'Batch not found.')
        setLoading(false)
        return
      }

      const { trainers: trainerRaw, ...batchRest } = batchRow as BatchRecord & {
        trainers: { trainer_name: string } | { trainer_name: string }[] | null
      }
      const trainersSingle = Array.isArray(trainerRaw)
        ? trainerRaw[0] ?? null
        : trainerRaw

      setBatch({
        ...batchRest,
        trainers: trainersSingle,
      })

      const [
        { data: sessionRows, error: sessionError },
        { data: sbRows, error: sbError },
        { data: annRows, error: annError },
      ] = await Promise.all([
        supabase
          .from('class_sessions')
          .select(
            'id,title,starts_at,ends_at,join_url,recording_url,zoom_meeting_id,zoom_status,zoom_password,recording_status',
          )
          .eq('batch_id', batchId)
          .order('starts_at', { ascending: true }),
        supabase
          .from('student_batches')
          .select('student_id,joined_at,students(id,student_name,email,stage,progress_pct)')
          .eq('batch_id', batchId)
          .eq('is_active', true),
        supabase
          .from('announcements')
          .select('id,title,body,is_important,published_at')
          .eq('batch_id', batchId)
          .order('published_at', { ascending: false }),
      ])

      if (sessionError || sbError || annError) {
        setError(
          sessionError?.message ??
            sbError?.message ??
            annError?.message ??
            'Failed to load batch data.',
        )
        setLoading(false)
        return
      }

      setSessions(sessionRows ?? [])

      const students: StudentInBatch[] = []
      const progressVals: number[] = []
      for (const row of sbRows ?? []) {
        const raw = row.students as
          | {
              id: string
              student_name: string
              email: string
              stage: string
              progress_pct: number | null
            }
          | {
              id: string
              student_name: string
              email: string
              stage: string
              progress_pct: number | null
            }[]
          | null
        const list = Array.isArray(raw) ? raw : raw ? [raw] : []
        for (const s of list) {
          if (!s?.id) continue
          students.push({
            id: s.id,
            student_name: s.student_name,
            email: s.email,
            stage: s.stage,
            progress_pct: s.progress_pct,
            joined_at: row.joined_at ?? null,
          })
          if (typeof s.progress_pct === 'number') progressVals.push(s.progress_pct)
        }
      }
      students.sort((a, b) =>
        a.student_name.localeCompare(b.student_name, undefined, {
          sensitivity: 'base',
        }),
      )
      setRoster(students)
      setAvgProgress(
        progressVals.length
          ? Math.round(
              progressVals.reduce((a, b) => a + b, 0) / progressVals.length,
            )
          : null,
      )

      setAnnouncements(annRows ?? [])
      setLoading(false)
    }

    void load()
  }, [batchId])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    const storageKey = `batch-syllabus-${batchId}`
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        setSyllabusSections([])
        setExpandedSectionIds([])
        return
      }
      const parsed = JSON.parse(raw) as SyllabusSection[]
      if (!Array.isArray(parsed)) {
        setSyllabusSections([])
        setExpandedSectionIds([])
        return
      }
      setSyllabusSections(parsed)
      setExpandedSectionIds(parsed.map((section) => section.id))
    } catch {
      setSyllabusSections([])
      setExpandedSectionIds([])
    }
  }, [batchId])

  useEffect(() => {
    const storageKey = `batch-syllabus-${batchId}`
    window.localStorage.setItem(storageKey, JSON.stringify(syllabusSections))
  }, [batchId, syllabusSections])

  const title = batch?.batch_code ?? initialBatchCode

  const filteredLiveSessions = useMemo(() => {
    const query = liveSearch.trim().toLowerCase()
    return sessions.filter((s) => {
      const queryOk = !query || s.title.toLowerCase().includes(query)
      const filterOk =
        liveFilter === 'all'
          ? true
          : liveFilter === 'join_link'
            ? Boolean(s.join_url)
            : liveFilter === 'recording'
              ? Boolean(s.recording_url)
              : !s.join_url && !s.recording_url
      return queryOk && filterOk
    })
  }, [sessions, liveSearch, liveFilter])

  const { liveSessions, upcomingSessions, pastSessions } = useMemo(() => {
    const now = new Date()
    const live: ClassSessionRow[] = []
    const upcoming: ClassSessionRow[] = []
    const past: ClassSessionRow[] = []
    for (const s of filteredLiveSessions) {
      if (s.zoom_status === 'started' || isSessionLive(s, now)) {
        live.push(s)
      } else if (s.zoom_status === 'ended') {
        past.push(s)
      } else if (new Date(s.starts_at) > now) {
        upcoming.push(s)
      } else {
        past.push(s)
      }
    }
    live.sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
    upcoming.sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
    past.sort(
      (a, b) =>
        new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
    )
    return {
      liveSessions: live,
      upcomingSessions: upcoming,
      pastSessions: past,
    }
  }, [filteredLiveSessions])

  const openUrlInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleStartSession = async (meetingId: string) => {
    try {
      setLiveActionError('')
      setActionBusyMeetingId(meetingId)
      const data = await getStartUrl(meetingId)
      if (data.start_url) {
        openUrlInNewTab(data.start_url)
      }
    } catch (error) {
      setLiveActionError(
        error instanceof Error ? error.message : 'Unable to start class.',
      )
    } finally {
      setActionBusyMeetingId(null)
    }
  }

  const handleJoinSession = async (meetingId: string) => {
    try {
      setLiveActionError('')
      setActionBusyMeetingId(meetingId)
      const data = await getJoinUrl(meetingId)
      if (data.join_url) {
        openUrlInNewTab(data.join_url)
      }
    } catch (error) {
      setLiveActionError(
        error instanceof Error ? error.message : 'Unable to join class.',
      )
    } finally {
      setActionBusyMeetingId(null)
    }
  }

  const handleOpenRecording = (session: ClassSessionRow) => {
    if (!session.recording_url) {
      setLiveActionError('Recording is not available yet for this class.')
      return
    }
    setLiveActionError('')
    setRecordingPreview({ title: session.title, url: session.recording_url })
    setSelectedReportRows([])
  }

  const handleViewReport = async (meetingId: string) => {
    try {
      setLiveActionError('')
      setActionBusyMeetingId(meetingId)
      const data = await getMeetingParticipantsReport(meetingId)
      setSelectedReportRows(data.participants)
    } catch (error) {
      setLiveActionError(
        error instanceof Error ? error.message : 'Unable to fetch report.',
      )
    } finally {
      setActionBusyMeetingId(null)
    }
  }

  const totalSyllabusLessons = useMemo(
    () =>
      syllabusSections.reduce((count, section) => count + section.items.length, 0),
    [syllabusSections],
  )

  const toggleSectionExpanded = (sectionId: string) => {
    setExpandedSectionIds((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId],
    )
  }

  const handleCreateSection = (event: FormEvent) => {
    event.preventDefault()
    const title = sectionTitle.trim()
    if (!title) return
    const id = crypto.randomUUID()
    setSyllabusSections((prev) => [...prev, { id, title, items: [] }])
    setExpandedSectionIds((prev) => [...prev, id])
    setSectionTitle('')
    setSectionFormOpen(false)
  }

  const handleOpenItemForm = (sectionId: string) => {
    setActiveItemSectionId(sectionId)
    setItemForm({
      type: 'live_class',
      title: '',
      url: '',
      classSessionId: '',
    })
  }

  const handleCreateSyllabusItem = (event: FormEvent) => {
    event.preventDefault()
    if (!activeItemSectionId) return

    let title = itemForm.title.trim()
    let url = itemForm.url.trim() || null
    let classSessionId: string | null = null

    if (itemForm.type === 'live_class') {
      const classSession = sessions.find((s) => s.id === itemForm.classSessionId)
      if (!classSession) {
        setLiveActionError('Please choose a live class to add.')
        return
      }
      classSessionId = classSession.id
      if (!title) title = classSession.title
      url = classSession.join_url || null
    } else {
      if (!title) {
        setLiveActionError('Please add a content title.')
        return
      }
    }

    setSyllabusSections((prev) =>
      prev.map((section) =>
        section.id !== activeItemSectionId
          ? section
          : {
              ...section,
              items: [
                ...section.items,
                {
                  id: crypto.randomUUID(),
                  type: itemForm.type,
                  title,
                  url,
                  class_session_id: classSessionId,
                },
              ],
            },
      ),
    )

    setLiveActionError('')
    setActiveItemSectionId(null)
    setItemForm({
      type: 'live_class',
      title: '',
      url: '',
      classSessionId: '',
    })
  }

  const handleCreateAnnouncement = async (event: FormEvent) => {
    event.preventDefault()
    if (!batch) return

    const title = announcementForm.title.trim()
    const body = announcementForm.body.trim()
    if (!title || !body) {
      setLiveActionError('Announcement title and message are required.')
      return
    }

    try {
      setAnnouncementSaving(true)
      setLiveActionError('')
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          batch_id: batch.id,
          title,
          body,
          is_important: announcementForm.isImportant,
          published_at: new Date().toISOString(),
        })
        .select('id,title,body,is_important,published_at')
        .single()

      if (error) throw error

      if (data) {
        setAnnouncements((prev) => [data as AnnouncementRow, ...prev])
      }
      setAnnouncementForm({
        title: '',
        body: '',
        isImportant: false,
      })
    } catch (error) {
      setLiveActionError(
        error instanceof Error
          ? error.message
          : 'Unable to publish announcement.',
      )
    } finally {
      setAnnouncementSaving(false)
    }
  }

  const handleScheduleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!batch) return
    if (
      !scheduleForm.topic ||
      !scheduleForm.date ||
      !scheduleForm.time ||
      !scheduleForm.hostUserId
    ) {
      setLiveActionError(
        'Topic, date, time, and host are required to schedule class.',
      )
      return
    }

    try {
      setScheduleBusy(true)
      setLiveActionError('')
      const startIso = new Date(
        `${scheduleForm.date}T${scheduleForm.time}:00`,
      ).toISOString()
      const response = await scheduleClass({
        batchId: batch.id,
        trainerId: batch.trainer_id ?? undefined,
        hostUserId: scheduleForm.hostUserId,
        topic: scheduleForm.topic,
        attachmentUrl: scheduleForm.attachmentUrl,
        startTime: startIso,
        duration: scheduleForm.duration,
      })

      const newSession: ClassSessionRow = {
        id: response.classSession.id,
        title: scheduleForm.topic,
        starts_at: startIso,
        ends_at: new Date(
          new Date(startIso).getTime() + scheduleForm.duration * 60 * 1000,
        ).toISOString(),
        join_url: response.meeting.join_url ?? null,
        recording_url: null,
        zoom_meeting_id: String(response.meeting.id),
        zoom_status: 'scheduled',
        zoom_password: null,
        recording_status: 'pending',
      }

      setSessions((prev) =>
        [...prev, newSession].sort(
          (a, b) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        ),
      )
      setScheduleOpen(false)
      setScheduleForm((prev) => ({ ...prev, topic: '', attachmentUrl: '' }))
    } catch (error) {
      setLiveActionError(
        error instanceof Error ? error.message : 'Unable to schedule class.',
      )
    } finally {
      setScheduleBusy(false)
    }
  }

  useEffect(() => {
    if (!scheduleOpen || zoomHosts.length || hostsLoading) return
    const loadHosts = async () => {
      try {
        setHostsLoading(true)
        const data = await getZoomHosts()
        const hosts = (data.hosts ?? []).map((host) => ({
          id: host.id,
          first_name: host.first_name,
          display_name: host.display_name,
        }))
        setZoomHosts(hosts)
        if (hosts[0] && !scheduleForm.hostUserId) {
          setScheduleForm((prev) => ({ ...prev, hostUserId: hosts[0].id }))
        }
      } catch (error) {
        setLiveActionError(
          error instanceof Error ? error.message : 'Unable to load Zoom hosts.',
        )
      } finally {
        setHostsLoading(false)
      }
    }
    void loadHosts()
  }, [scheduleOpen, zoomHosts.length, hostsLoading, scheduleForm.hostUserId])

  if (loading) {
    return (
      <section className="panel">
        <p className="muted-dark">Loading batch…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="panel">
        <button type="button" className="batch-detail-back" onClick={onBack}>
          ← Back to batches
        </button>
        <p className="error">{error}</p>
      </section>
    )
  }

  return (
    <div className="batch-detail-page">
      <button type="button" className="batch-detail-back" onClick={onBack}>
        ← Back to batches
      </button>

      <header className="batch-detail-header">
        <div className="batch-detail-header-text">
          <h1 className="batch-detail-title">{title}</h1>
          {batch ? (
            <div className="batch-detail-meta-row">
              <span className={batchStatusPillClass(batch.status)}>
                {formatLabel(batch.status)}
              </span>
              {batch.trainers?.trainer_name ? (
                <span className="batch-detail-trainer-pill">
                  Trainer: {batch.trainers.trainer_name}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="muted-dark batch-detail-subtitle">
              Manage classes, roster, and announcements for this batch.
            </p>
          )}
        </div>
        <div className="batch-detail-image-placeholder" aria-hidden>
          <img
            src="/course-cover.png"
            alt=""
            className="batch-detail-cover"
          />
        </div>
      </header>

      <nav className="batch-detail-tabs" role="tablist" aria-label="Batch sections">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`batch-detail-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id)
              onTabChange?.(tab.id)
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      <div
        className={`batch-detail-panel ${
          activeTab === 'live-classes'
            ? 'batch-detail-panel-plain'
            : activeTab === 'students'
              ? 'batch-detail-panel-students'
              : ''
        }`}
        role="tabpanel"
      >
        {activeTab === 'overview' && batch ? (
          <div className="batch-overview-grid">
            <article className="batch-stat-card">
              <p className="batch-stat-label">Status</p>
              <p className="batch-stat-value">{formatLabel(batch.status)}</p>
            </article>
            <article className="batch-stat-card">
              <p className="batch-stat-label">Batch type</p>
              <p className="batch-stat-value">{formatLabel(batch.batch_type)}</p>
            </article>
            <article className="batch-stat-card">
              <p className="batch-stat-label">Students</p>
              <p className="batch-stat-value">{roster.length}</p>
            </article>
            <article className="batch-stat-card">
              <p className="batch-stat-label">Avg. progress</p>
              <p className="batch-stat-value">
                {avgProgress === null ? '—' : `${avgProgress}%`}
              </p>
            </article>
            <article className="batch-stat-card batch-stat-wide">
              <p className="batch-stat-label">Schedule</p>
              <p className="batch-stat-value subtle">
                {formatDateOnly(batch.start_date)} → {formatDateOnly(batch.end_date)}
              </p>
            </article>
            <article className="batch-stat-card batch-stat-wide">
              <p className="batch-stat-label">Capacity</p>
              <p className="batch-stat-value subtle">
                {roster.length}
                {batch.batch_capacity > 0
                  ? ` / ${batch.batch_capacity} seats`
                  : ' enrolled'}
              </p>
            </article>
            {batch.notes ? (
              <article className="batch-notes-card batch-stat-full">
                <p className="batch-stat-label">Notes</p>
                <p className="batch-notes-body">{batch.notes}</p>
              </article>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'live-classes' ? (
          <div className="live-classes-cards">
            <div className="live-classes-toolbar">
              <div className="live-classes-filters">
                <label className="live-filter-search">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search classes"
                    value={liveSearch}
                    onChange={(event) => setLiveSearch(event.target.value)}
                  />
                </label>
                <label className="live-filter-select">
                  <span>Filter</span>
                  <select
                    value={liveFilter}
                    onChange={(event) =>
                      setLiveFilter(
                        event.target.value as
                          | 'all'
                          | 'join_link'
                          | 'recording'
                          | 'no_links',
                      )
                    }
                  >
                    <option value="all">All classes</option>
                    <option value="join_link">Has join link</option>
                    <option value="recording">Has recording</option>
                    <option value="no_links">No links</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="schedule-class-btn"
                onClick={() => setScheduleOpen(true)}
              >
                Schedule Class
              </button>
            </div>

            {liveSessions.length > 0 ? (
              <article className="live-class-card live-class-card-live">
                <header className="live-class-card-head">
                  <span className="live-class-card-title">Live</span>
                  <span className="live-now-badge" aria-label="Happening now">
                    <span className="live-now-dot" aria-hidden />
                    Now
                  </span>
                </header>
                <div className="live-class-card-body">
                  <SessionRows
                    items={liveSessions}
                    variant="live"
                    onStart={handleStartSession}
                    onJoin={handleJoinSession}
                    onOpenRecording={handleOpenRecording}
                    onReport={handleViewReport}
                    loadingMeetingId={actionBusyMeetingId}
                  />
                </div>
              </article>
            ) : null}

            <article className="live-class-card">
              <header className="live-class-card-head live-class-card-head-blue">
                <span className="live-class-card-title">Upcoming</span>
              </header>
              <div className="live-class-card-body">
                <SessionRows
                  items={upcomingSessions}
                  variant="upcoming"
                  onStart={handleStartSession}
                  onJoin={handleJoinSession}
                  onOpenRecording={handleOpenRecording}
                  onReport={handleViewReport}
                  loadingMeetingId={actionBusyMeetingId}
                />
              </div>
            </article>

            <article className="live-class-card">
              <header className="live-class-card-head live-class-card-head-blue">
                <span className="live-class-card-title">
                  Past classes &amp; recordings
                </span>
              </header>
              <div className="live-class-card-body">
                <SessionRows
                  items={pastSessions}
                  variant="past"
                  onStart={handleStartSession}
                  onJoin={handleJoinSession}
                  onOpenRecording={handleOpenRecording}
                  onReport={handleViewReport}
                  loadingMeetingId={actionBusyMeetingId}
                />
              </div>
            </article>

            {liveActionError ? (
              <p className="error live-classes-inline-error">{liveActionError}</p>
            ) : null}

            {selectedReportRows.length ? (
              <article className="live-class-card">
                <header className="live-class-card-head">
                  <span className="live-class-card-title">Attendance Report</span>
                </header>
                <div className="live-class-card-body">
                  <div className="batch-table-wrap">
                    <table className="batch-roster-table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Email</th>
                          <th>Duration</th>
                          <th>Joined</th>
                          <th>Left</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReportRows.map((row) => (
                          <tr
                            key={`${row.participant_email ?? row.participant_name}-${row.join_time}`}
                          >
                            <td>{row.student_name ?? row.participant_name}</td>
                            <td>{row.participant_email ?? '-'}</td>
                            <td>{Math.round(row.duration_seconds / 60)} min</td>
                            <td>{row.join_time ? formatDateTime(row.join_time) : '-'}</td>
                            <td>{row.leave_time ? formatDateTime(row.leave_time) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'students' ? <AdminStudentsPage onlyBatchId={batchId} /> : null}

        {activeTab === 'schedule' ? (
          <section className="syllabus-card">
            <header className="syllabus-card-head">
              <div>
                <h3>Syllabus</h3>
                <p className="muted-dark">
                  {syllabusSections.length} sections • {totalSyllabusLessons} lessons
                </p>
              </div>
              <button
                type="button"
                className="batch-link-btn"
                onClick={() => setSectionFormOpen((prev) => !prev)}
              >
                <Plus size={14} />
                Add section
              </button>
            </header>

            {sectionFormOpen ? (
              <form className="syllabus-inline-form" onSubmit={handleCreateSection}>
                <input
                  type="text"
                  placeholder="Section title (e.g. Week 1)"
                  value={sectionTitle}
                  onChange={(event) => setSectionTitle(event.target.value)}
                  required
                />
                <button type="submit" className="batch-link-btn">
                  Create
                </button>
              </form>
            ) : null}

            {syllabusSections.length === 0 ? (
              <p className="muted-dark batch-empty">
                No sections yet. Add your first section to start organizing live
                classes and learning content.
              </p>
            ) : (
              <ul className="syllabus-section-list">
                {syllabusSections.map((section, index) => {
                  const expanded = expandedSectionIds.includes(section.id)
                  return (
                    <li key={section.id} className="syllabus-section-item">
                      <button
                        type="button"
                        className="syllabus-section-toggle"
                        onClick={() => toggleSectionExpanded(section.id)}
                      >
                        <span className="syllabus-section-index">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="syllabus-section-title-wrap">
                          <span className="syllabus-section-title">{section.title}</span>
                          <span className="muted-dark">
                            {section.items.length} lesson
                            {section.items.length === 1 ? '' : 's'}
                          </span>
                        </span>
                        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>

                      {expanded ? (
                        <div className="syllabus-section-body">
                          {section.items.length === 0 ? (
                            <p className="muted-dark batch-empty">No content yet.</p>
                          ) : (
                            <ul className="syllabus-content-list">
                              {section.items.map((item) => (
                                <li key={item.id} className="syllabus-content-item">
                                  <span className="tag-pill badge-blue">
                                    {item.type.replaceAll('_', ' ')}
                                  </span>
                                  <span className="syllabus-content-title">
                                    {item.title}
                                  </span>
                                  {item.url ? (
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="batch-link"
                                    >
                                      <LinkIcon size={13} /> Open
                                    </a>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}

                          {activeItemSectionId === section.id ? (
                            <form
                              className="syllabus-inline-form syllabus-inline-form-item"
                              onSubmit={handleCreateSyllabusItem}
                            >
                              <select
                                value={itemForm.type}
                                onChange={(event) =>
                                  setItemForm((prev) => ({
                                    ...prev,
                                    type: event.target.value as SyllabusItemType,
                                  }))
                                }
                              >
                                <option value="live_class">Live class</option>
                                <option value="document">Document</option>
                                <option value="class_upload">Class upload</option>
                              </select>

                              {itemForm.type === 'live_class' ? (
                                <select
                                  value={itemForm.classSessionId}
                                  onChange={(event) =>
                                    setItemForm((prev) => ({
                                      ...prev,
                                      classSessionId: event.target.value,
                                    }))
                                  }
                                  required
                                >
                                  <option value="">Select class</option>
                                  {sessions.map((session) => (
                                    <option key={session.id} value={session.id}>
                                      {session.title}
                                    </option>
                                  ))}
                                </select>
                              ) : null}

                              <input
                                type="text"
                                placeholder="Content title"
                                value={itemForm.title}
                                onChange={(event) =>
                                  setItemForm((prev) => ({
                                    ...prev,
                                    title: event.target.value,
                                  }))
                                }
                                required={itemForm.type !== 'live_class'}
                              />

                              {itemForm.type !== 'live_class' ? (
                                <input
                                  type="url"
                                  placeholder="Resource URL"
                                  value={itemForm.url}
                                  onChange={(event) =>
                                    setItemForm((prev) => ({
                                      ...prev,
                                      url: event.target.value,
                                    }))
                                  }
                                />
                              ) : null}

                              <button type="submit" className="batch-link-btn">
                                <FileText size={13} />
                                Add content
                              </button>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="batch-link-btn"
                              onClick={() => handleOpenItemForm(section.id)}
                            >
                              <Plus size={13} />
                              Add content
                            </button>
                          )}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ) : null}

        {activeTab === 'announcements' ? (
          <div className="batch-announcements-wrap">
            <form className="batch-announce-compose" onSubmit={handleCreateAnnouncement}>
              <div className="batch-announce-compose-head">
                <h4>Send Announcement</h4>
                <label className="batch-announce-important-toggle">
                  <input
                    type="checkbox"
                    checked={announcementForm.isImportant}
                    onChange={(event) =>
                      setAnnouncementForm((prev) => ({
                        ...prev,
                        isImportant: event.target.checked,
                      }))
                    }
                  />
                  Mark as important
                </label>
              </div>
              <input
                type="text"
                placeholder="Announcement title"
                value={announcementForm.title}
                onChange={(event) =>
                  setAnnouncementForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                required
              />
              <textarea
                placeholder="Write announcement message"
                value={announcementForm.body}
                onChange={(event) =>
                  setAnnouncementForm((prev) => ({
                    ...prev,
                    body: event.target.value,
                  }))
                }
                rows={4}
                required
              />
              <div className="batch-announce-compose-actions">
                <button
                  type="submit"
                  className="batch-schedule-submit"
                  disabled={announcementSaving}
                >
                  {announcementSaving ? 'Publishing...' : 'Send Announcement'}
                </button>
              </div>
            </form>

            {announcements.length === 0 ? (
              <p className="muted-dark batch-empty">
                No announcements for this batch yet.
              </p>
            ) : (
              <ul className="batch-announce-list">
                {announcements.map((a) => (
                  <li key={a.id} className="batch-announce-card">
                    <div className="batch-announce-top">
                      <p className="batch-announce-title">{a.title}</p>
                      {a.is_important ? (
                        <span className="important-tag">Important</span>
                      ) : null}
                    </div>
                    <p className="batch-announce-body">{a.body}</p>
                    <p className="muted-dark batch-announce-date">
                      {formatDateTime(a.published_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {activeTab === 'assignments' ? (
          <div className="batch-assignments-placeholder">
            <ClipboardList size={32} className="batch-assignments-icon" />
            <h4 className="batch-assignments-title">Assignments</h4>
            <p className="muted-dark">
              There is no assignments table in the database yet. Next steps:
              add an <code>assignments</code> table (title, due date, batch_id,
              optional file URL), or surface <strong>progress activities</strong>{' '}
              here as coursework.
            </p>
          </div>
        ) : null}
      </div>

      {recordingPreview ? (
        <div className="batch-recording-overlay" role="presentation">
          <div className="batch-recording-modal" role="dialog" aria-modal="true">
            <div className="batch-recording-head">
              <h3>{recordingPreview.title} - Recording</h3>
              <button
                type="button"
                className="batch-schedule-close"
                onClick={() => setRecordingPreview(null)}
              >
                Close
              </button>
            </div>
            <div className="batch-recording-body">
              <iframe
                title={`${recordingPreview.title} recording preview`}
                src={recordingPreview.url}
                className="batch-recording-frame"
                allow="autoplay; fullscreen"
              />
            </div>
            <div className="batch-recording-actions">
              <a
                className="batch-link"
                href={recordingPreview.url}
                target="_blank"
                rel="noreferrer"
              >
                Open in new tab
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {scheduleOpen ? (
        <div className="batch-schedule-modal-overlay" role="presentation">
          <div className="batch-schedule-modal">
            <div className="batch-schedule-modal-head">
              <h3>Schedule Zoom Class</h3>
              <button
                type="button"
                className="batch-schedule-close"
                onClick={() => !scheduleBusy && setScheduleOpen(false)}
              >
                Close
              </button>
            </div>
            <form className="batch-schedule-form" onSubmit={handleScheduleSubmit}>
              <label className="batch-schedule-field batch-schedule-field-full">
                Topic
                <input
                  type="text"
                  placeholder="Enter class topic"
                  value={scheduleForm.topic}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      topic: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="batch-schedule-field">
                Date
                <input
                  type="date"
                  value={scheduleForm.date}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      date: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="batch-schedule-field">
                Time
                <input
                  type="time"
                  value={scheduleForm.time}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      time: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="batch-schedule-field">
                Duration
                <select
                  value={scheduleForm.duration}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      duration: Number(event.target.value),
                    }))
                  }
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                </select>
              </label>
              <label className="batch-schedule-field">
                Host
                <select
                  value={scheduleForm.hostUserId}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      hostUserId: event.target.value,
                    }))
                  }
                  required
                >
                  {!zoomHosts.length ? (
                    <option value="">
                      {hostsLoading ? 'Loading hosts...' : 'No hosts available'}
                    </option>
                  ) : null}
                  {zoomHosts.map((host) => (
                    <option key={host.id} value={host.id}>
                      {(host.first_name || '').trim() ||
                        host.display_name.split(' ')[0] ||
                        host.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="batch-schedule-field">
                Attachment (optional)
                <input
                  type="url"
                  placeholder="Paste drive/file link"
                  value={scheduleForm.attachmentUrl}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      attachmentUrl: event.target.value,
                    }))
                  }
                />
              </label>
              <p className="batch-schedule-hint">
                Default timezone: IST (Asia/Kolkata)
              </p>

              {liveActionError ? (
                <p className="error live-classes-inline-error">{liveActionError}</p>
              ) : null}

              <div className="batch-schedule-actions">
                <button
                  type="button"
                  className="batch-schedule-cancel"
                  onClick={() => setScheduleOpen(false)}
                  disabled={scheduleBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="batch-schedule-submit"
                  disabled={scheduleBusy}
                >
                  {scheduleBusy ? 'Scheduling...' : 'Schedule Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
