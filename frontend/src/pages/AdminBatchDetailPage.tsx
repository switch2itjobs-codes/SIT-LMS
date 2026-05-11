import { useEffect, useMemo, useRef, useState } from 'react'
import { SpxLoader } from '../components/SpxLoader'
import type { FormEvent, ReactNode } from 'react'
import {
  Bell,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  FileText,
  LayoutDashboard,
  Link as LinkIcon,
  Megaphone,
  MoreVertical,
  Paperclip,
  Pencil,
  PlayCircle,
  Play,
  Upload,
  Trash2,
  Users,
  UserCheck,
  Video,
  Star,
  Activity,
  UserPlus,
  TrendingUp,
  Search,
  ChevronLeft,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getBackendOrigin } from '../lib/backendOrigin'
import { AdminStudentsPage } from './AdminStudentsPage'
import { BatchCommunityChat } from '../components/BatchCommunityChat/BatchCommunityChat'
import {
  getMeetingRecordings,
  getZoomHosts,
  getMeetingParticipantsReport,
  getStartUrl,
  scheduleClass,
} from '../lib/zoomApi'

const TOPIC_OPTION_ADD_NEW = '__add_new_topic__'
const TOPIC_OPTION_OTHERS = '__others__'

const trainerTopicOptions = [
  'Introduction & Training Roadmap',
  'Pre-Project Activities',
  'SDLC - Initiation Phase',
  'SDLC - Project Planning',
  'Requirements Gathering (Elicitation Techniques)',
  'Requirement Documentation (RTM, BRD, FRD)',
  'Project & Requirements Revision',
  'Requirement Analysis (GAP, SMART, MoSCoW)',
  'Stakeholder Management & RACI Matrix',
  'Applications Usage Assignment',
  'Resume Project Conversion',
  'Resume Review & Corrections',
  'Resume Finalization & Upload',
  'Agile & Scrum Framework',
  'Jira & User Stories',
  'Agile, Scrum & Jira Revision',
  'Agile & Jira Practical Preparation',
  'Naukri & Resume Analysis',
  'Types of Requirements',
  'SDLC Phases 3 & 4',
  'SDLC Phase 5',
  'UML Diagrams',
  'Change Request Handling',
  'Interview Preparation',
  'DBMS Fundamentals',
  'SQL Basics',
  'SQL Intermediate',
  'SQL Advanced & Revision',
] as const

export type BatchDetailTab =
  | 'overview'
  | 'live-classes'
  | 'students'
  | 'schedule'
  | 'announcements'
  | 'community'
  | 'assignments'

type AdminBatchDetailPageProps = {
  batchId: string
  initialBatchCode?: string
  onBack: () => void
  onOpenCreateClass?: () => void
  onOpenAssignment?: (assignmentId: string, batchId: string) => void
  onOpenClassDetail?: (classSessionId: string) => void
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
  trainers: { trainer_name: string; email: string | null } | null
}

type ClassSessionRow = {
  id: string
  title: string
  description: string | null
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
  trainer_rating: number | null
  no_of_interviews: number
}

type AnnouncementRow = {
  id: string
  title: string
  body: string
  is_important: boolean
  published_at: string
  attachment_url: string | null
}

type AnnouncementReactionRow = {
  announcement_id: string
  student_id: string
  reaction_type: 'thumbs_up' | 'fire' | 'clap' | 'heart'
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

type ProgramWeek = {
  week: number
  dayRange: string
  title: string
  topics: string[]
}

const PROGRAM_WEEKS: ProgramWeek[] = [
  {
    week: 1,
    dayRange: 'Days 1 - 3',
    title: 'Introduction & Foundation',
    topics: [
      'Introduction & Roadmap',
      'Pre-Project Activities',
      'SDLC Phase 1 - Initiation',
      'Project Planning',
    ],
  },
  {
    week: 2,
    dayRange: 'Days 4 - 8',
    title: 'Requirements Engineering',
    topics: [
      'Requirements Gathering',
      'Documentation (RTM, BRD, FRD)',
      'Revision',
      'Requirement Analysis',
    ],
  },
  {
    week: 3,
    dayRange: 'Days 9 - 13',
    title: 'Stakeholders & Resume Building',
    topics: [
      'Stakeholder Management',
      'Assignment',
      'Resume Building',
      'Review & Corrections',
    ],
  },
  {
    week: 4,
    dayRange: 'Days 14 - 18',
    title: 'Agile, Jira & Practical',
    topics: [
      'Agile & Scrum',
      'Jira',
      'Practical Preparation',
      'Resume Feedback',
    ],
  },
  {
    week: 5,
    dayRange: 'Days 19 - 23',
    title: 'Advanced BA Concepts',
    topics: [
      'Types of Requirements',
      'SDLC Phases',
      'UML Diagrams',
      'CR Handling',
    ],
  },
  {
    week: 6,
    dayRange: 'Days 24 - 28',
    title: 'Technical Skills & SQL',
    topics: ['DBMS Basics', 'SQL 1', 'SQL 2', 'SQL Revision'],
  },
  {
    week: 7,
    dayRange: 'Days 29 - 33',
    title: 'Project Presentations & Feedback',
    topics: ['Project Presentations (Daily Feedback)'],
  },
  {
    week: 8,
    dayRange: 'Days 34 - 38',
    title: 'Final Presentations & Review',
    topics: ['Final Presentations + Feedback'],
  },
]

type ActivityItem = {
  id: string
  type: 'class_completed' | 'class_scheduled' | 'assignment_created' | 'announcement_posted' | 'student_joined'
  description: string
  timestamp: string
  icon: 'check' | 'calendar' | 'clipboard' | 'megaphone' | 'user'
}

type AssignmentSubmissionType = 'file_upload' | 'text_answer' | 'both'

type BatchAssignmentRow = {
  id: string
  batch_id: string
  class_session_id: string | null
  title: string
  description: string | null
  attachment_url: string | null
  due_at: string
  max_marks: number | null
  submission_type: AssignmentSubmissionType
  assign_to_all: boolean
  target_student_ids: string[] | null
  created_at: string
  updated_at: string
}

type AssignmentSubmissionRow = {
  assignment_id: string
  submitted_at: string | null
  marks: number | null
  feedback: string | null
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
  { id: 'community', label: 'Community', icon: <Users size={15} /> },
  { id: 'assignments', label: 'Assignments', icon: <ClipboardList size={15} /> },
]

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

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const absDiff = Math.abs(diffMs)
  const future = diffMs < 0

  if (absDiff < 60_000) return 'just now'
  if (absDiff < 3_600_000) {
    const mins = Math.floor(absDiff / 60_000)
    return future ? `in ${mins}m` : `${mins}m ago`
  }
  if (absDiff < 86_400_000) {
    const hrs = Math.floor(absDiff / 3_600_000)
    return future ? `in ${hrs}h` : `${hrs}h ago`
  }
  const days = Math.floor(absDiff / 86_400_000)
  if (days < 7) return future ? `in ${days}d` : `${days}d ago`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return future ? `in ${weeks}w` : `${weeks}w ago`
  }
  const months = Math.floor(days / 30)
  return future ? `in ${months}mo` : `${months}mo ago`
}

function formatMonthShort(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short' })
}

function hasClassAttachment(description: string | null) {
  if (!description) return false
  const value = description.trim().toLowerCase()
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('www.')
  )
}

function getClassAttachmentUrl(description: string | null) {
  if (!description) return null
  const trimmed = description.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase().startsWith('www.')) {
    return `https://${trimmed}`
  }
  return hasClassAttachment(trimmed) ? trimmed : null
}

function formatTimeOnly(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatSessionTimeRange(startsAt: string, endsAt: string | null) {
  const startLabel = formatTimeOnly(startsAt)
  if (endsAt) {
    return `${startLabel} - ${formatTimeOnly(endsAt)}`
  }
  const fallbackEnd = new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString()
  return `${startLabel} - ${formatTimeOnly(fallbackEnd)}`
}

function toLocalDateInputValue(iso: string) {
  const date = new Date(iso)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toLocalTimeInputValue(iso: string) {
  const date = new Date(iso)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function isSessionLive(s: ClassSessionRow, _now: Date): boolean {
  // Live state must come from Zoom webhook/session status only.
  return s.zoom_status === 'started'
}

function getSessionStateLabel(s: ClassSessionRow, now: Date) {
  if (s.zoom_status === 'started') return 'Live'
  if (s.zoom_status === 'ended') return 'Completed'
  if (s.zoom_status === 'cancelled') return 'Cancelled'
  const start = new Date(s.starts_at).getTime()
  const fallbackEnd = start + 60 * 60 * 1000
  const end = s.ends_at ? new Date(s.ends_at).getTime() : fallbackEnd
  if (now.getTime() < start) return 'Upcoming'
  if (now.getTime() > end) return 'Not Conducted / Cancelled'
  return 'Upcoming'
}

function SessionRows({
  items,
  variant,
  onStart,
  onOpenRecording,
  onReport,
  assignmentCountBySessionId,
  attendanceCountBySessionId,
  assignmentsBySessionId,
  pendingFeedbackBySessionId,
  onEditSession,
  onAddAssignment,
  onViewAssignmentReports,
  onCopyJoinUrl,
  onDeleteSession,
  onOpenClassDetail,
  loadingMeetingId,
}: {
  items: ClassSessionRow[]
  variant: 'live' | 'upcoming' | 'past'
  onStart: (meetingId: string) => void
  onOpenRecording: (session: ClassSessionRow) => void
  onReport: (meetingId: string) => void
  assignmentCountBySessionId: Record<string, number>
  attendanceCountBySessionId: Record<string, number>
  assignmentsBySessionId: Record<string, BatchAssignmentRow[]>
  pendingFeedbackBySessionId: Record<string, number>
  onEditSession: (session: ClassSessionRow) => void
  onAddAssignment: (session: ClassSessionRow) => void
  onViewAssignmentReports: (session: ClassSessionRow) => void
  onCopyJoinUrl: (session: ClassSessionRow) => void
  onDeleteSession: (session: ClassSessionRow) => void
  onOpenClassDetail?: (session: ClassSessionRow) => void
  loadingMeetingId: string | null
}) {
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!openMenuSessionId) return
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.class-card-menu-wrap')) return
      setOpenMenuSessionId(null)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [openMenuSessionId])

  if (items.length === 0) {
    return null
  }

  return (
    <tbody>
      {items.map((s) => {
        const now = new Date()
        const stateLabel = getSessionStateLabel(s, now)
        const assignmentCount = assignmentCountBySessionId[s.id] ?? 0
        const pendingFeedbackCountForSession = pendingFeedbackBySessionId[s.id] ?? 0
        const attendedCountForSession = attendanceCountBySessionId[s.id] ?? 0
        const classAssignments = assignmentsBySessionId[s.id] ?? []
        const classAttachmentUrl = getClassAttachmentUrl(s.description)
        const attachmentUrls = [
          ...classAssignments
            .map((item) => item.attachment_url)
            .filter((url): url is string => Boolean(url)),
          ...(classAttachmentUrl ? [classAttachmentUrl] : []),
        ]
        const totalAttachmentCount = attachmentUrls.length
        const statusTextClass =
          stateLabel === 'Completed'
            ? 'is-completed'
            : stateLabel === 'Cancelled'
              ? 'is-cancelled'
              : 'is-not-conducted'
        return (
          <tr key={s.id} className={stateLabel === 'Live' ? 'is-live' : ''}>
            <td>
              <div
                className={
                  variant === 'past'
                    ? 'student-classes-table-date is-neutral'
                    : `student-classes-table-date weekday-${new Date(s.starts_at).getDay()}`
                }
              >
                <strong>{new Date(s.starts_at).getDate()}</strong>
                <small>{formatMonthShort(s.starts_at)}</small>
              </div>
            </td>
            <td>
              {onOpenClassDetail ? (
                <button
                  type="button"
                  className="admin-class-topic-link"
                  onClick={() => onOpenClassDetail(s)}
                >
                  {s.title}
                </button>
              ) : (
                <p className="student-classes-topic">{s.title}</p>
              )}
            </td>
            {variant === 'past' ? (
              <>
                <td>
                  <span className={`class-status-text ${statusTextClass}`}>{stateLabel}</span>
                </td>
                <td>
                  {attendedCountForSession > 0 ? (
                    <span className="student-classes-attendance-cell">
                      <UserCheck size={14} /> {attendedCountForSession}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </>
            ) : null}
            <td>
              {totalAttachmentCount > 0 ? (
                <button
                  type="button"
                  className="student-classes-attachment-btn"
                  onClick={() => window.open(attachmentUrls[0], '_blank', 'noopener,noreferrer')}
                >
                  <LinkIcon size={13} /> {totalAttachmentCount} {totalAttachmentCount === 1 ? 'File' : 'Files'}
                </button>
              ) : (
                <button
                  type="button"
                  className="student-classes-attachment-btn"
                  onClick={() => onEditSession(s)}
                >
                  <ClipboardList size={13} /> Add Attachment
                </button>
              )}
            </td>
        {variant !== 'past' ? (
          <td className="student-classes-time-cell">{formatSessionTimeRange(s.starts_at, s.ends_at)}</td>
        ) : null}
            <td>
              <div className="student-classes-actions">
                {variant !== 'past' && s.zoom_meeting_id ? (
                  <button
                    type="button"
                    className="join"
                    disabled={loadingMeetingId === s.zoom_meeting_id}
                    onClick={() => onStart(s.zoom_meeting_id as string)}
                  >
                    <PlayCircle size={12} /> Start Class
                  </button>
                ) : null}
                {assignmentCount > 0 ? (
                  <button
                    type="button"
                    className="feedback"
                    onClick={() => onViewAssignmentReports(s)}
                  >
                    <ClipboardList size={12} /> Give Feedback ({pendingFeedbackCountForSession})
                  </button>
                ) : (
                  <button
                    type="button"
                    className="assignment"
                    onClick={() => onAddAssignment(s)}
                  >
                    <ClipboardList size={12} /> Add Assignment
                  </button>
                )}
                <div className="class-card-menu-wrap">
                  <button
                    type="button"
                    className="calendar class-card-menu-btn"
                    onClick={() => setOpenMenuSessionId((prev) => (prev === s.id ? null : s.id))}
                  >
                    <MoreVertical size={12} />
                  </button>
                  {openMenuSessionId === s.id ? (
                    <div className="class-card-menu">
                      <button
                        type="button"
                        disabled={variant === 'live' || !s.join_url}
                        onClick={() => {
                          onCopyJoinUrl(s)
                          setOpenMenuSessionId(null)
                        }}
                      >
                        <Copy size={14} />
                        Copy Join URL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onEditSession(s)
                          setOpenMenuSessionId(null)
                        }}
                      >
                        <Pencil size={14} />
                        Edit / Reschedule Class
                      </button>
                      <button
                        type="button"
                        disabled={!s.zoom_meeting_id}
                        onClick={() => {
                          if (s.zoom_meeting_id) onReport(s.zoom_meeting_id)
                          setOpenMenuSessionId(null)
                        }}
                      >
                        <ClipboardList size={14} />
                        Attendance Report
                      </button>
                      {variant === 'past' ? (
                        <button
                          type="button"
                          disabled={!s.recording_url && !s.zoom_meeting_id}
                          onClick={() => {
                            onOpenRecording(s)
                            setOpenMenuSessionId(null)
                          }}
                        >
                          <Video size={14} />
                          View Recording
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          onDeleteSession(s)
                          setOpenMenuSessionId(null)
                        }}
                      >
                        <Trash2 size={14} />
                        Delete Class
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </td>
          </tr>
        )
      })}
    </tbody>
  )
}

export function AdminBatchDetailPage({
  batchId,
  initialBatchCode,
  onBack,
  onOpenAssignment,
  onOpenClassDetail,
  initialTab = 'overview',
  onTabChange,
}: AdminBatchDetailPageProps) {
  const [activeTab, setActiveTab] = useState<BatchDetailTab>(initialTab)
  const [adminUserId, setAdminUserId] = useState<string | null>(null)
  const [communityLastSeenAt, setCommunityLastSeenAt] = useState<string | null>(null)
  const [unreadCommunityCount, setUnreadCommunityCount] = useState(0)
  const liveSearch = ''
  const liveFilter: 'all' | 'join_link' | 'recording' | 'no_links' = 'all'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [batch, setBatch] = useState<BatchRecord | null>(null)
  const [sessions, setSessions] = useState<ClassSessionRow[]>([])
  const [batchStudents, setBatchStudents] = useState<StudentInBatch[]>([])
  const [assignments, setAssignments] = useState<BatchAssignmentRow[]>([])
  const [_assignmentSubmissionCountBySessionId, setAssignmentSubmissionCountBySessionId] =
    useState<Record<string, number>>({})
  const [pendingFeedbackBySessionId, setPendingFeedbackBySessionId] =
    useState<Record<string, number>>({})
  const [attendanceCountBySessionId, setAttendanceCountBySessionId] = useState<
    Record<string, number>
  >({})
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0)
  const [, setSubmittedAssignmentCount] = useState(0)
  const [upcomingClassesExpanded, setUpcomingClassesExpanded] = useState(false)
  const [liveSearchQuery, setLiveSearchQuery] = useState('')
  const [pastClassesPage, setPastClassesPage] = useState(1)
  const PAST_PAGE_SIZE = 5
  const [assignmentPage, setAssignmentPage] = useState(1)
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmissionRow[]>([])
  const [openAssignmentMenuId, setOpenAssignmentMenuId] = useState<string | null>(null)
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [announcementReactions, setAnnouncementReactions] = useState<AnnouncementReactionRow[]>([])
  const [avgProgress, setAvgProgress] = useState<number | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [expandedScheduleWeeks, setExpandedScheduleWeeks] = useState<number[]>([1, 2, 3, 4])
  const [scheduleBusy, setScheduleBusy] = useState(false)
  const [classAttachmentFile, setClassAttachmentFile] = useState<File | null>(null)
  const [assignmentAttachmentFile, setAssignmentAttachmentFile] = useState<File | null>(null)
  const [assignmentAttachmentDragOver, setAssignmentAttachmentDragOver] = useState(false)
  const classAttachmentInputRef = useRef<HTMLInputElement | null>(null)
  const assignmentAttachmentInputRef = useRef<HTMLInputElement | null>(null)
  const [scheduleTopicOpen, setScheduleTopicOpen] = useState(false)
  const scheduleTopicBoxRef = useRef<HTMLDivElement | null>(null)
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
  const [announceMessageFocused, setAnnounceMessageFocused] = useState(false)
  const [announcementToast, setAnnouncementToast] = useState('')
  const [announcementAttachmentFile, setAnnouncementAttachmentFile] = useState<File | null>(null)
  const announcementAttachmentInputRef = useRef<HTMLInputElement | null>(null)
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null)
  const [editingAnnouncementForm, setEditingAnnouncementForm] = useState({
    title: '',
    body: '',
  })
  const [announcementActionId, setAnnouncementActionId] = useState<string | null>(null)
  const [syllabusSections, setSyllabusSections] = useState<SyllabusSection[]>([])
  const [scheduleForm, setScheduleForm] = useState({
    classSessionId: '',
    topicSelection: '',
    customTopic: '',
    date: '',
    time: '',
    duration: 60,
    hostUserId: '',
    attachmentUrl: '',
    addAssignment: false,
    assignmentId: '',
    assignmentTitle: '',
    assignmentDescription: '',
    assignmentAttachmentUrl: '',
    assignmentDueDate: '',
    assignmentDueTime: '',
    assignmentMaxMarks: '',
    assignmentSubmissionType: 'both' as AssignmentSubmissionType,
    assignmentAssignToAll: true,
    assignmentStudentIds: [] as string[],
  })
  const scheduleTopicValue =
    scheduleForm.topicSelection === TOPIC_OPTION_ADD_NEW ||
    scheduleForm.topicSelection === TOPIC_OPTION_OTHERS
      ? scheduleForm.customTopic
      : scheduleForm.topicSelection
  const filteredScheduleTopics = useMemo(() => {
    const query = scheduleTopicValue.trim().toLowerCase()
    if (!query) return [...trainerTopicOptions]
    return trainerTopicOptions.filter((topic) =>
      topic.toLowerCase().includes(query),
    )
  }, [scheduleTopicValue])
  const communityStorageKey = useMemo(
    () => `admin-community-last-seen:${adminUserId ?? 'unknown'}:${batchId}`,
    [adminUserId, batchId],
  )

  const markCommunityAsRead = () => {
    const nowIso = new Date().toISOString()
    setCommunityLastSeenAt(nowIso)
    setUnreadCommunityCount(0)
    localStorage.setItem(communityStorageKey, nowIso)
  }

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setAdminUserId(data.user?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(communityStorageKey)
    setCommunityLastSeenAt(saved)
  }, [communityStorageKey])

  useEffect(() => {
    const refreshUnread = async () => {
      const { data, error: msgError } = await supabase
        .from('batch_community_messages')
        .select('created_at,sender_role')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false })
        .limit(400)

      if (msgError) return
      const rows = data ?? []
      if (!rows.length) {
        setUnreadCommunityCount(0)
        return
      }

      const seenTs = communityLastSeenAt ? new Date(communityLastSeenAt).getTime() : 0
      const unread = rows.filter((row) => {
        const createdTs = new Date(row.created_at).getTime()
        if (!Number.isFinite(createdTs) || createdTs <= seenTs) return false
        // Admin messages authored from this screen are read instantly because tab is open.
        return true
      }).length

      setUnreadCommunityCount(unread)
    }

    void refreshUnread()

    const channel = supabase
      .channel(`admin_community_unread:${batchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'batch_community_messages',
          filter: `batch_id=eq.${batchId}`,
        },
        () => {
          if (activeTab === 'community') {
            markCommunityAsRead()
          } else {
            void refreshUnread()
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeTab, batchId, communityLastSeenAt, communityStorageKey])

  useEffect(() => {
    if (activeTab !== 'community') return
    markCommunityAsRead()
  }, [activeTab, batchId])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      const { data: batchRow, error: batchError } = await supabase
        .from('batches')
        .select(
          'id,batch_code,status,batch_type,start_date,end_date,batch_capacity,trainer_id,notes,trainers(trainer_name,email)',
        )
        .eq('id', batchId)
        .maybeSingle()

      if (batchError || !batchRow) {
        setError(batchError?.message ?? 'Batch not found.')
        setLoading(false)
        return
      }

      const { trainers: trainerRaw, ...batchRest } = batchRow as BatchRecord & {
        trainers:
          | { trainer_name: string; email: string | null }
          | { trainer_name: string; email: string | null }[]
          | null
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
            'id,title,description,starts_at,ends_at,join_url,recording_url,zoom_meeting_id,zoom_status,zoom_password,recording_status',
          )
          .eq('batch_id', batchId)
          .order('starts_at', { ascending: true }),
        supabase
          .from('student_batches')
          .select('student_id,joined_at,students(id,student_name,email,stage,progress_pct,trainer_rating,no_of_interviews)')
          .eq('batch_id', batchId)
          .eq('is_active', true),
        supabase
          .from('announcements')
          .select('id,title,body,is_important,published_at,attachment_url')
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

      const sessionIdList = (sessionRows ?? []).map((s) => s.id)
      if (sessionIdList.length) {
        const batchStudentEmails = new Set<string>()
        for (const sbRow of sbRows ?? []) {
          const studentRel = (sbRow.students as
            | { email?: string | null }
            | Array<{ email?: string | null } | null>
            | null) ?? null
          const list = Array.isArray(studentRel) ? studentRel : studentRel ? [studentRel] : []
          for (const s of list) {
            const email = s?.email ? String(s.email).trim().toLowerCase() : ''
            if (!email) continue
            batchStudentEmails.add(email)
          }
        }

        // Attendance for past classes must follow the same logic as `AdminLiveClassDetailPage`:
        // Present count = number of enrolled students where summed `duration_seconds` for the session is > 0.
        // Host/trainer won't count because we filter to `student_batches` emails.
        const { data: participantRows, error: participantError } = await supabase
          .from('class_session_participants')
          .select(
            'class_session_id,user_email,duration_seconds',
          )
          .in('class_session_id', sessionIdList)

        if (participantError && participantError.code !== '42P01') {
          setLiveActionError(participantError.message)
          setAttendanceCountBySessionId({})
        } else {
          // sessionId -> (email -> summedDurationSeconds)
          const durationBySessionEmail = new Map<string, Map<string, number>>()
          for (const row of participantRows ?? []) {
            const sessionId = row.class_session_id
            if (!sessionId) continue

            const email = row.user_email ? String(row.user_email).trim().toLowerCase() : ''
            if (!email) continue
            if (!batchStudentEmails.has(email)) continue

            const durationSeconds = Number(row.duration_seconds ?? 0)
            if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) continue

            const sessionMap = durationBySessionEmail.get(sessionId) ?? new Map<string, number>()
            sessionMap.set(email, (sessionMap.get(email) ?? 0) + durationSeconds)
            durationBySessionEmail.set(sessionId, sessionMap)
          }

          const counts: Record<string, number> = {}
          for (const [sessionId, emailDurationMap] of durationBySessionEmail.entries()) {
            // Present = number of enrolled students with durationSeconds > 0 for that session.
            counts[sessionId] = Array.from(emailDurationMap.values()).filter((sec) => sec > 0).length
          }
          setAttendanceCountBySessionId(counts)
        }
      } else {
        setAttendanceCountBySessionId({})
      }

      const { data: assignmentRows, error: assignmentsError } = await supabase
        .from('assignments')
        .select(
          'id,batch_id,class_session_id,title,description,attachment_url,due_at,max_marks,submission_type,assign_to_all,target_student_ids,created_at,updated_at',
        )
        .eq('batch_id', batchId)
        .order('due_at', { ascending: true })

      if (assignmentsError) {
        if (assignmentsError.code !== '42P01') {
          setError(assignmentsError.message)
          setLoading(false)
          return
        }
        setAssignments([])
        setAssignmentSubmissionCountBySessionId({})
        setPendingFeedbackBySessionId({})
        setPendingFeedbackCount(0)
        setSubmittedAssignmentCount(0)
        setAssignmentSubmissions([])
      } else {
        const assignmentList = (assignmentRows as BatchAssignmentRow[]) ?? []
        setAssignments(assignmentList)

        const assignmentToSessionId = new Map<string, string>()
        const assignmentIds: string[] = []
        for (const assignment of assignmentList) {
          if (!assignment.class_session_id) continue
          assignmentIds.push(assignment.id)
          assignmentToSessionId.set(assignment.id, assignment.class_session_id)
        }

        if (!assignmentIds.length) {
          setAssignmentSubmissionCountBySessionId({})
          setPendingFeedbackBySessionId({})
          setPendingFeedbackCount(0)
          setSubmittedAssignmentCount(0)
          setAssignmentSubmissions([])
        } else {
          const { data: submissionRows, error: submissionError } = await supabase
            .from('assignment_submissions')
            .select('assignment_id,submitted_at,marks,feedback')
            .in('assignment_id', assignmentIds)

          if (submissionError && submissionError.code !== '42P01') {
            setLiveActionError(submissionError.message)
            setAssignmentSubmissionCountBySessionId({})
            setPendingFeedbackBySessionId({})
            setPendingFeedbackCount(0)
            setSubmittedAssignmentCount(0)
            setAssignmentSubmissions([])
          } else {
            const countBySessionId: Record<string, number> = {}
            const pendingBySessionId: Record<string, number> = {}
            let pendingFeedback = 0
            let submittedCount = 0
            for (const row of submissionRows ?? []) {
              const sessionId = assignmentToSessionId.get(row.assignment_id)
              if (!sessionId) continue
              countBySessionId[sessionId] = (countBySessionId[sessionId] ?? 0) + 1
              if (row.submitted_at) {
                submittedCount += 1
                if (!row.feedback || !String(row.feedback).trim()) {
                  pendingFeedback += 1
                  pendingBySessionId[sessionId] = (pendingBySessionId[sessionId] ?? 0) + 1
                }
              }
            }
            setAssignmentSubmissionCountBySessionId(countBySessionId)
            setPendingFeedbackBySessionId(pendingBySessionId)
            setPendingFeedbackCount(pendingFeedback)
            setSubmittedAssignmentCount(submittedCount)
            setAssignmentSubmissions((submissionRows as AssignmentSubmissionRow[]) ?? [])
          }
        }
      }

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
              trainer_rating: number | null
              no_of_interviews: number | null
            }
          | {
              id: string
              student_name: string
              email: string
              stage: string
              progress_pct: number | null
              trainer_rating: number | null
              no_of_interviews: number | null
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
            trainer_rating: s.trainer_rating ?? null,
            no_of_interviews: Number(s.no_of_interviews ?? 0),
          })
          if (typeof s.progress_pct === 'number') progressVals.push(s.progress_pct)
        }
      }
      students.sort((a, b) =>
        a.student_name.localeCompare(b.student_name, undefined, {
          sensitivity: 'base',
        }),
      )
      setBatchStudents(students)
      setAvgProgress(
        progressVals.length
          ? Math.round(
              progressVals.reduce((a, b) => a + b, 0) / progressVals.length,
            )
          : null,
      )

      const announcementList = (annRows as AnnouncementRow[]) ?? []
      setAnnouncements(announcementList)
      const announcementIds = announcementList.map((item) => item.id)
      if (!announcementIds.length) {
        setAnnouncementReactions([])
      } else {
        const { data: reactionRows, error: reactionError } = await supabase
          .from('announcement_reactions')
          .select('announcement_id,student_id,reaction_type')
          .in('announcement_id', announcementIds)
        if (reactionError && reactionError.code !== '42P01') {
          setLiveActionError(reactionError.message)
          setAnnouncementReactions([])
        } else {
          setAnnouncementReactions((reactionRows as AnnouncementReactionRow[]) ?? [])
        }
      }
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
        return
      }
      const parsed = JSON.parse(raw) as SyllabusSection[]
      if (!Array.isArray(parsed)) {
        setSyllabusSections([])
        return
      }
      setSyllabusSections(parsed)
    } catch {
      setSyllabusSections([])
    }
  }, [batchId])

  useEffect(() => {
    const storageKey = `batch-syllabus-${batchId}`
    window.localStorage.setItem(storageKey, JSON.stringify(syllabusSections))
  }, [batchId, syllabusSections])

  const title = batch?.batch_code ?? initialBatchCode

  const toTitleCase = (value: string | null | undefined) => {
    if (!value) return 'N/A'
    return value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
  }

  const getBatchStatusClass = (value: string | null | undefined) => {
    const normalized = (value ?? '').toLowerCase()
    if (normalized.includes('in_progress') || normalized.includes('active') || normalized.includes('progress')) {
      return 'is-in-progress'
    }
    if (normalized.includes('planned') || normalized.includes('upcoming')) {
      return 'is-planned'
    }
    if (normalized.includes('completed') || normalized.includes('closed')) {
      return 'is-completed'
    }
    return 'is-default'
  }

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
      const stateLabel = getSessionStateLabel(s, now)
      if (stateLabel === 'Live' || isSessionLive(s, now)) {
        live.push(s)
      } else if (stateLabel === 'Upcoming') {
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
  const heroPrimarySession = useMemo(
    () => liveSessions[0] ?? upcomingSessions[0] ?? null,
    [liveSessions, upcomingSessions],
  )
  const nextPlannedClass = useMemo(
    () => upcomingSessions[0] ?? null,
    [upcomingSessions],
  )
  const currentScheduleWeek = useMemo(() => {
    const start = batch?.start_date
    if (!start) return 1
    const startDate = new Date(start)
    if (Number.isNaN(startDate.getTime())) return 1
    const diffMs = Date.now() - startDate.getTime()
    if (diffMs <= 0) return 1
    const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
    return Math.max(1, Math.min(8, week))
  }, [batch?.start_date])
  const attendanceProxy = useMemo(() => {
    const total = liveSessions.length + upcomingSessions.length + pastSessions.length
    if (!total) return 0
    return Math.max(0, Math.min(100, Math.round((pastSessions.length / total) * 100)))
  }, [liveSessions.length, upcomingSessions.length, pastSessions.length])
  const filteredUpcomingSessions = useMemo(() => {
    if (!liveSearchQuery.trim()) return upcomingSessions
    const q = liveSearchQuery.toLowerCase()
    return upcomingSessions.filter(s => s.title?.toLowerCase().includes(q))
  }, [upcomingSessions, liveSearchQuery])

  const filteredPastSessions = useMemo(() => {
    if (!liveSearchQuery.trim()) return pastSessions
    const q = liveSearchQuery.toLowerCase()
    return pastSessions.filter(s => s.title?.toLowerCase().includes(q))
  }, [pastSessions, liveSearchQuery])

  const visibleUpcomingSessions = useMemo(
    () => (upcomingClassesExpanded ? filteredUpcomingSessions : filteredUpcomingSessions.slice(0, 6)),
    [upcomingClassesExpanded, filteredUpcomingSessions],
  )
  const pastTotalPages = Math.max(1, Math.ceil(filteredPastSessions.length / PAST_PAGE_SIZE))
  const visiblePastSessions = useMemo(
    () => filteredPastSessions.slice((pastClassesPage - 1) * PAST_PAGE_SIZE, pastClassesPage * PAST_PAGE_SIZE),
    [filteredPastSessions, pastClassesPage, PAST_PAGE_SIZE],
  )
  const assignmentRows = useMemo(() => {
    return assignments.map((assignment) => {
      const rows = assignmentSubmissions.filter((item) => item.assignment_id === assignment.id)
      const submittedRows = rows.filter((item) => Boolean(item.submitted_at))
      return {
        assignment,
        submittedCount: submittedRows.length,
      }
    })
  }, [assignments, assignmentSubmissions])
  const assignmentPageSize = 10
  const assignmentTotalPages = Math.max(1, Math.ceil(assignmentRows.length / assignmentPageSize))
  const paginatedAssignmentRows = useMemo(
    () =>
      assignmentRows.slice(
        (assignmentPage - 1) * assignmentPageSize,
        assignmentPage * assignmentPageSize,
      ),
    [assignmentRows, assignmentPage],
  )
  const announcementReactionSummary = useMemo(() => {
    const summaryMap = new Map<
      string,
      {
        counts: Record<'thumbs_up' | 'fire' | 'clap' | 'heart', number>
        reactedStudentCount: number
      }
    >()
    for (const reaction of announcementReactions) {
      const existing = summaryMap.get(reaction.announcement_id) ?? {
        counts: { thumbs_up: 0, fire: 0, clap: 0, heart: 0 },
        reactedStudentCount: 0,
      }
      existing.counts[reaction.reaction_type] += 1
      summaryMap.set(reaction.announcement_id, existing)
    }
    for (const [announcementId, data] of summaryMap) {
      const uniqueStudentIds = new Set(
        announcementReactions
          .filter((item) => item.announcement_id === announcementId)
          .map((item) => item.student_id),
      )
      data.reactedStudentCount = uniqueStudentIds.size
      summaryMap.set(announcementId, data)
    }
    return summaryMap
  }, [announcementReactions])
  useEffect(() => {
    setAssignmentPage((prev) => Math.min(prev, assignmentTotalPages))
  }, [assignmentTotalPages])

  const assignmentsBySessionId = useMemo(() => {
    const map: Record<string, BatchAssignmentRow[]> = {}
    for (const assignment of assignments) {
      if (!assignment.class_session_id) continue
      if (!map[assignment.class_session_id]) {
        map[assignment.class_session_id] = []
      }
      map[assignment.class_session_id].push(assignment)
    }
    return map
  }, [assignments])

  const assignmentCountBySessionId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const assignment of assignments) {
      if (!assignment.class_session_id) continue
      map[assignment.class_session_id] = (map[assignment.class_session_id] ?? 0) + 1
    }
    return map
  }, [assignments])
  const recentlyCompletedWithoutAssignment = useMemo(
    () =>
      pastSessions.find(
        (session) =>
          session.zoom_status === 'ended' &&
          (assignmentCountBySessionId[session.id] ?? 0) === 0,
      ) ?? null,
    [pastSessions, assignmentCountBySessionId],
  )

  /* ── Batch timeline completion ── */
  const batchCompletionPct = useMemo(() => {
    if (!batch?.start_date || !batch?.end_date) return 0
    const start = new Date(batch.start_date).getTime()
    const end = new Date(batch.end_date).getTime()
    const now = Date.now()
    if (now <= start) return 0
    if (now >= end) return 100
    return Math.round(((now - start) / (end - start)) * 100)
  }, [batch?.start_date, batch?.end_date])

  const batchWeekMilestones = useMemo(() => {
    if (!batch?.start_date || !batch?.end_date) return []
    const start = new Date(batch.start_date).getTime()
    const end = new Date(batch.end_date).getTime()
    const totalMs = end - start
    if (totalMs <= 0) return []
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const weeks: { week: number; pct: number }[] = []
    for (let i = 1; i * weekMs < totalMs; i++) {
      weeks.push({ week: i, pct: Math.round((i * weekMs / totalMs) * 100) })
    }
    return weeks
  }, [batch?.start_date, batch?.end_date])

  /* ── Recent activities feed ── */
  const recentActivities = useMemo(() => {
    const items: ActivityItem[] = []

    for (const s of pastSessions) {
      items.push({
        id: `class-past-${s.id}`,
        type: 'class_completed',
        description: `Class completed: ${s.title}`,
        timestamp: s.ends_at ?? s.starts_at,
        icon: 'check',
      })
    }
    for (const s of upcomingSessions) {
      items.push({
        id: `class-upcoming-${s.id}`,
        type: 'class_scheduled',
        description: `Class scheduled: ${s.title}`,
        timestamp: s.starts_at,
        icon: 'calendar',
      })
    }
    for (const a of assignments) {
      items.push({
        id: `assignment-${a.id}`,
        type: 'assignment_created',
        description: `Assignment created: ${a.title}`,
        timestamp: a.created_at,
        icon: 'clipboard',
      })
    }
    for (const ann of announcements) {
      items.push({
        id: `announcement-${ann.id}`,
        type: 'announcement_posted',
        description: `Announcement: ${ann.title}`,
        timestamp: ann.published_at,
        icon: 'megaphone',
      })
    }
    for (const st of batchStudents) {
      if (st.joined_at) {
        items.push({
          id: `student-joined-${st.id}`,
          type: 'student_joined',
          description: `${st.student_name} joined the batch`,
          timestamp: st.joined_at,
          icon: 'user',
        })
      }
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return items.slice(0, 10)
  }, [pastSessions, upcomingSessions, assignments, announcements, batchStudents])

  /* ── Batch Overview KPI derivations ── */
  const threeStarStudentCount = useMemo(
    () => batchStudents.filter(s => s.trainer_rating === 3).length,
    [batchStudents],
  )

  const totalInterviewsScheduled = useMemo(
    () => batchStudents.reduce((sum, s) => sum + s.no_of_interviews, 0),
    [batchStudents],
  )

  const preparePopupWindow = () =>
    window.open('', '_blank', 'noopener,noreferrer')

  const openUrlInNewTab = (url: string, preparedWindow?: Window | null) => {
    if (preparedWindow && !preparedWindow.closed) {
      preparedWindow.location.href = url
      return
    }

    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (!opened) {
      // Fallback when popup is blocked by browser policies.
      window.location.href = url
    }
  }

  const handleStartSession = async (meetingId: string) => {
    const popupWindow = preparePopupWindow()
    try {
      setLiveActionError('')
      setActionBusyMeetingId(meetingId)
      const data = await getStartUrl(meetingId)
      if (data.start_url) {
        openUrlInNewTab(data.start_url, popupWindow)
      } else {
        popupWindow?.close()
      }
    } catch (error) {
      popupWindow?.close()
      setLiveActionError(
        error instanceof Error ? error.message : 'Unable to start class.',
      )
    } finally {
      setActionBusyMeetingId(null)
    }
  }

  const handleOpenRecording = async (session: ClassSessionRow) => {
    if (session.recording_url) {
      setLiveActionError('')
      setRecordingPreview({ title: session.title, url: session.recording_url })
      setSelectedReportRows([])
      return
    }

    if (!session.zoom_meeting_id) {
      setLiveActionError('Recording is not available yet for this class.')
      return
    }

    try {
      setLiveActionError('')
      setActionBusyMeetingId(session.zoom_meeting_id)
      const data = await getMeetingRecordings(session.zoom_meeting_id)
      const latestRecording = data.recordings[0]?.play_url ?? null
      if (!latestRecording) {
        setLiveActionError(
          data.status === 'processing'
            ? 'Recording is still processing in Zoom. Please check again in a few minutes.'
            : 'Recording is not available yet for this class.',
        )
        return
      }

      setSessions((prev) =>
        prev.map((item) =>
          item.id === session.id
            ? {
                ...item,
                recording_url: latestRecording,
                recording_status: 'available',
              }
            : item,
        ),
      )

      // Best effort cache so students/admin can open directly next time.
      await supabase
        .from('class_sessions')
        .update({
          recording_url: latestRecording,
          recording_status: 'available',
          has_recording: true,
        })
        .eq('id', session.id)

      setRecordingPreview({ title: session.title, url: latestRecording })
      setSelectedReportRows([])
    } catch (error) {
      setLiveActionError(
        error instanceof Error ? error.message : 'Unable to fetch recording.',
      )
    } finally {
      setActionBusyMeetingId(null)
    }
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
      let attachmentUrl: string | null = null
      if (announcementAttachmentFile) {
        const safeName = announcementAttachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const fd = new FormData()
        fd.append('file', announcementAttachmentFile)
        fd.append('folder', 'chat')
        fd.append('path', `batch-${batch.id}/announcements/${Date.now()}-${safeName}`)
        const tok = (await supabase.auth.getSession()).data.session?.access_token
        const upRes = await fetch(`${getBackendOrigin()}/api/upload`, {
          method: 'POST',
          headers: tok ? { Authorization: `Bearer ${tok}` } : {},
          body: fd,
        })
        if (!upRes.ok) throw new Error('Upload failed')
        const upBody = await upRes.json()
        attachmentUrl = upBody.url ?? null
      }
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          batch_id: batch.id,
          title,
          body,
          is_important: announcementForm.isImportant,
          attachment_url: attachmentUrl,
          published_at: new Date().toISOString(),
        })
        .select('id,title,body,is_important,published_at,attachment_url')
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
      setAnnouncementAttachmentFile(null)
      setAnnouncementToast('Announcement sent successfully.')
      setTimeout(() => setAnnouncementToast(''), 2200)
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

  const handleStartEditAnnouncement = (announcement: AnnouncementRow) => {
    setLiveActionError('')
    setEditingAnnouncementId(announcement.id)
    setEditingAnnouncementForm({
      title: announcement.title,
      body: announcement.body,
    })
  }

  const handleCancelEditAnnouncement = () => {
    setEditingAnnouncementId(null)
    setEditingAnnouncementForm({
      title: '',
      body: '',
    })
  }

  const handleSaveAnnouncementEdit = async (announcementId: string) => {
    const title = editingAnnouncementForm.title.trim()
    const body = editingAnnouncementForm.body.trim()
    if (!title || !body) {
      setLiveActionError('Announcement title and message are required.')
      return
    }

    try {
      setAnnouncementActionId(announcementId)
      setLiveActionError('')
      const { data, error } = await supabase
        .from('announcements')
        .update({ title, body })
        .eq('id', announcementId)
        .select('id,title,body,is_important,published_at,attachment_url')
        .single()

      if (error) throw error

      if (data) {
        setAnnouncements((prev) =>
          prev.map((item) => (item.id === announcementId ? (data as AnnouncementRow) : item)),
        )
      }
      handleCancelEditAnnouncement()
    } catch (error) {
      setLiveActionError(
        error instanceof Error ? error.message : 'Unable to update announcement.',
      )
    } finally {
      setAnnouncementActionId(null)
    }
  }

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!window.confirm('Delete this announcement? This action cannot be undone.')) return

    try {
      setAnnouncementActionId(announcementId)
      setLiveActionError('')
      const { error } = await supabase.from('announcements').delete().eq('id', announcementId)
      if (error) throw error

      setAnnouncements((prev) => prev.filter((item) => item.id !== announcementId))
      setAnnouncementReactions((prev) =>
        prev.filter((reaction) => reaction.announcement_id !== announcementId),
      )
      if (editingAnnouncementId === announcementId) {
        handleCancelEditAnnouncement()
      }
    } catch (error) {
      setLiveActionError(
        error instanceof Error ? error.message : 'Unable to delete announcement.',
      )
    } finally {
      setAnnouncementActionId(null)
    }
  }

  const openScheduleForNew = (openModal = true) => {
    setLiveActionError('')
    setClassAttachmentFile(null)
    setAssignmentAttachmentDragOver(false)
    setAssignmentAttachmentFile(null)
    setScheduleForm((prev) => ({
      ...prev,
      classSessionId: '',
      topicSelection: '',
      customTopic: '',
      date: '',
      time: '',
      duration: 60,
      attachmentUrl: '',
      addAssignment: false,
      assignmentId: '',
      assignmentTitle: '',
      assignmentDescription: '',
      assignmentAttachmentUrl: '',
      assignmentDueDate: '',
      assignmentDueTime: '',
      assignmentMaxMarks: '',
      assignmentSubmissionType: 'both',
      assignmentAssignToAll: true,
      assignmentStudentIds: [],
    }))
    setScheduleOpen(openModal)
  }

  const handleEditSession = (session: ClassSessionRow, forceAddAssignment = false) => {
    const classDate = toLocalDateInputValue(session.starts_at)
    const classTime = toLocalTimeInputValue(session.starts_at)
    const calculatedDuration =
      session.ends_at && new Date(session.ends_at).getTime() > new Date(session.starts_at).getTime()
        ? Math.max(
            15,
            Math.round(
              (new Date(session.ends_at).getTime() -
                new Date(session.starts_at).getTime()) /
                60000,
            ),
          )
        : 60
    const linkedAssignment = assignmentsBySessionId[session.id]?.[0] ?? null
    const isPresetTopic = (trainerTopicOptions as readonly string[]).includes(
      session.title,
    )
    setLiveActionError('')
    setClassAttachmentFile(null)
    setAssignmentAttachmentDragOver(false)
    setAssignmentAttachmentFile(null)
    setScheduleForm((prev) => ({
      ...prev,
      classSessionId: session.id,
      topicSelection: isPresetTopic ? session.title : TOPIC_OPTION_OTHERS,
      customTopic: isPresetTopic ? '' : session.title,
      date: classDate,
      time: classTime,
      duration: calculatedDuration,
      attachmentUrl: '',
      addAssignment: forceAddAssignment || Boolean(linkedAssignment),
      assignmentId: linkedAssignment?.id ?? '',
      assignmentTitle: linkedAssignment?.title ?? '',
      assignmentDescription: linkedAssignment?.description ?? '',
      assignmentAttachmentUrl: linkedAssignment?.attachment_url ?? '',
      assignmentDueDate: linkedAssignment?.due_at
        ? toLocalDateInputValue(linkedAssignment.due_at)
        : '',
      assignmentDueTime: linkedAssignment?.due_at
        ? toLocalTimeInputValue(linkedAssignment.due_at)
        : '',
      assignmentMaxMarks:
        linkedAssignment?.max_marks === null || linkedAssignment?.max_marks === undefined
          ? ''
          : String(linkedAssignment.max_marks),
      assignmentSubmissionType: linkedAssignment?.submission_type ?? 'both',
      assignmentAssignToAll: linkedAssignment?.assign_to_all ?? true,
      assignmentStudentIds: linkedAssignment?.target_student_ids ?? [],
    }))
    setScheduleOpen(true)
  }

  const handleEditAssignment = (assignment: BatchAssignmentRow) => {
    const linkedSession = sessions.find((session) => session.id === assignment.class_session_id)
    if (!linkedSession) {
      setLiveActionError('Linked class session not found for this assignment.')
      return
    }
    handleEditSession(linkedSession)
  }

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!window.confirm('Delete this assignment? This action cannot be undone.')) return
    const { error: deleteError } = await supabase.from('assignments').delete().eq('id', assignmentId)
    if (deleteError) {
      setLiveActionError(deleteError.message)
      return
    }
    setAssignments((prev) => prev.filter((assignment) => assignment.id !== assignmentId))
    setAssignmentSubmissions((prev) =>
      prev.filter((submission) => submission.assignment_id !== assignmentId),
    )
  }

  const handleAddAssignmentToSession = (session: ClassSessionRow) => {
    handleEditSession(session, true)
  }

  const handleViewAssignmentReportsForSession = (session: ClassSessionRow) => {
    const linkedAssignment = assignmentsBySessionId[session.id]?.[0]
    if (linkedAssignment && onOpenAssignment) {
      onOpenAssignment(linkedAssignment.id, batchId)
      return
    }
    setActiveTab('assignments')
    onTabChange?.('assignments')
  }

  const handleCopyJoinUrl = async (session: ClassSessionRow) => {
    if (!session.join_url) {
      setLiveActionError('Join URL is not available yet for this class.')
      return
    }
    try {
      await navigator.clipboard.writeText(session.join_url)
      setLiveActionError('Join URL copied to clipboard.')
    } catch {
      setLiveActionError('Unable to copy Join URL. Please copy it manually.')
    }
  }

  const handleDeleteSession = async (session: ClassSessionRow) => {
    if (!window.confirm(`Delete class "${session.title}"? This action cannot be undone.`)) {
      return
    }
    const { error: deleteError } = await supabase
      .from('class_sessions')
      .delete()
      .eq('id', session.id)
    if (deleteError) {
      setLiveActionError(deleteError.message)
      return
    }
    setSessions((prev) => prev.filter((s) => s.id !== session.id))
    setAssignments((prev) =>
      prev.map((assignment) =>
        assignment.class_session_id === session.id
          ? { ...assignment, class_session_id: null }
          : assignment,
      ),
    )
    setAssignmentSubmissionCountBySessionId((prev) => {
      const next = { ...prev }
      delete next[session.id]
      return next
    })
  }

  const handleScheduleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!batch) return
    const isCustomTopic =
      scheduleForm.topicSelection === TOPIC_OPTION_ADD_NEW ||
      scheduleForm.topicSelection === TOPIC_OPTION_OTHERS
    const resolvedTopic = (
      isCustomTopic ? scheduleForm.customTopic : scheduleForm.topicSelection
    ).trim()

    if (
      !resolvedTopic ||
      !scheduleForm.date ||
      !scheduleForm.time ||
      !scheduleForm.hostUserId
    ) {
      setLiveActionError(
        'Topic, date, time, and host are required to schedule class.',
      )
      return
    }

    const startIso = new Date(
      `${scheduleForm.date}T${scheduleForm.time}:00`,
    ).toISOString()
    const endIso = new Date(
      new Date(startIso).getTime() + scheduleForm.duration * 60 * 1000,
    ).toISOString()
    const hasAssignment = scheduleForm.addAssignment

    if (hasAssignment) {
      const assignmentTitle = scheduleForm.assignmentTitle.trim()
      const dueDateTimeRaw =
        scheduleForm.assignmentDueDate && scheduleForm.assignmentDueTime
          ? `${scheduleForm.assignmentDueDate}T${scheduleForm.assignmentDueTime}:00`
          : ''
      const dueIso = dueDateTimeRaw ? new Date(dueDateTimeRaw).toISOString() : ''

      if (!assignmentTitle || !dueIso) {
        setLiveActionError(
          'Assignment title and assignment due date/time are required.',
        )
        return
      }
      if (new Date(dueIso).getTime() < new Date(endIso).getTime()) {
        setLiveActionError('Assignment due date/time cannot be before class end time.')
        return
      }
    }

    try {
      setScheduleBusy(true)
      setLiveActionError('')
      let classAttachmentUrl = scheduleForm.attachmentUrl.trim() || ''
      if (classAttachmentFile) {
        const safeName = classAttachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const classFilePath = `batch-${batch.id}/class-attachments/${Date.now()}-${safeName}`
        const { error: classUploadError } = await supabase.storage
          .from('assignments')
          .upload(classFilePath, classAttachmentFile, { upsert: false })
        if (classUploadError) {
          throw classUploadError
        }
        const { data: classPublicData } = supabase.storage
          .from('assignments')
          .getPublicUrl(classFilePath)
        classAttachmentUrl = classPublicData.publicUrl ?? classAttachmentUrl
      }
      const response = await scheduleClass({
        classSessionId: scheduleForm.classSessionId || undefined,
        batchId: batch.id,
        trainerId: batch.trainer_id ?? undefined,
        hostUserId: scheduleForm.hostUserId,
        topic: resolvedTopic,
        attachmentUrl: classAttachmentUrl || undefined,
        startTime: startIso,
        duration: scheduleForm.duration,
      })

      const sessionId = response.classSession.id
      const upsertedSession: ClassSessionRow = {
        id: response.classSession.id,
        title: resolvedTopic,
        description: classAttachmentUrl || null,
        starts_at: startIso,
        ends_at: endIso,
        join_url: response.meeting.join_url ?? null,
        recording_url: null,
        zoom_meeting_id: String(response.meeting.id),
        zoom_status: 'scheduled',
        zoom_password: null,
        recording_status: 'pending',
      }

      if (hasAssignment) {
        const assignmentTitle = scheduleForm.assignmentTitle.trim()
        const dueIso = new Date(
          `${scheduleForm.assignmentDueDate}T${scheduleForm.assignmentDueTime}:00`,
        ).toISOString()
        const maxMarksRaw = scheduleForm.assignmentMaxMarks.trim()
        const parsedMaxMarks = maxMarksRaw ? Number(maxMarksRaw) : null
        let uploadedAttachmentUrl = scheduleForm.assignmentAttachmentUrl.trim() || null
        if (assignmentAttachmentFile) {
          const safeName = assignmentAttachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const filePath = `batch-${batch.id}/${sessionId}/${Date.now()}-${safeName}`
          const { error: uploadError } = await supabase.storage
            .from('assignments')
            .upload(filePath, assignmentAttachmentFile, { upsert: false })
          if (uploadError) {
            throw uploadError
          }
          const { data: publicData } = supabase.storage
            .from('assignments')
            .getPublicUrl(filePath)
          uploadedAttachmentUrl = publicData.publicUrl ?? uploadedAttachmentUrl
        }
        const payload = {
          batch_id: batch.id,
          class_session_id: sessionId,
          title: assignmentTitle,
          description: scheduleForm.assignmentDescription.trim() || null,
          attachment_url: uploadedAttachmentUrl,
          due_at: dueIso,
          max_marks:
            parsedMaxMarks !== null && Number.isFinite(parsedMaxMarks)
              ? parsedMaxMarks
              : null,
          submission_type: scheduleForm.assignmentSubmissionType,
          assign_to_all: scheduleForm.assignmentAssignToAll,
          target_student_ids: scheduleForm.assignmentAssignToAll
            ? null
            : scheduleForm.assignmentStudentIds,
        }
        const assignmentQuery = scheduleForm.assignmentId
          ? supabase
              .from('assignments')
              .update(payload)
              .eq('id', scheduleForm.assignmentId)
          : supabase.from('assignments').insert(payload)
        const { error: assignmentError } = await assignmentQuery
        if (assignmentError) {
          throw assignmentError
        }
      } else if (scheduleForm.assignmentId) {
        const { error: deleteError } = await supabase
          .from('assignments')
          .delete()
          .eq('id', scheduleForm.assignmentId)
        if (deleteError) {
          throw deleteError
        }
      }

      const { data: assignmentRows, error: assignmentsReloadError } = await supabase
        .from('assignments')
        .select(
          'id,batch_id,class_session_id,title,description,attachment_url,due_at,max_marks,submission_type,assign_to_all,target_student_ids,created_at,updated_at',
        )
        .eq('batch_id', batch.id)
        .order('due_at', { ascending: true })
      if (assignmentsReloadError && assignmentsReloadError.code !== '42P01') {
        throw assignmentsReloadError
      }
      setAssignments((assignmentRows as BatchAssignmentRow[]) ?? [])

      setSessions((prev) => {
        const exists = prev.some((session) => session.id === upsertedSession.id)
        const next = exists
          ? prev.map((session) =>
              session.id === upsertedSession.id ? upsertedSession : session,
            )
          : [...prev, upsertedSession]
        return next.sort(
          (a, b) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        )
      })
      setScheduleOpen(false)
      setClassAttachmentFile(null)
      setAssignmentAttachmentFile(null)
      openScheduleForNew(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to schedule class.'
      if (message.includes("public.assignments")) {
        setLiveActionError(
          'Assignments table is missing in Supabase. Run assignments_schema.sql once, then try again.',
        )
        return
      }
      setLiveActionError(
        message,
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

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (scheduleTopicBoxRef.current && !scheduleTopicBoxRef.current.contains(target)) {
        setScheduleTopicOpen(false)
      }
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [])
  useEffect(() => {
    if (!openAssignmentMenuId) return
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.student-assignment-actions .class-card-menu-wrap')) return
      setOpenAssignmentMenuId(null)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [openAssignmentMenuId])
  if (loading) {
    return <SpxLoader label="Loading batch…" />
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
    <div className="batch-detail-page admin-batch-detail-revamp">
      <aside className="admin-batch-detail-left">
        <button
          type="button"
          className="batch-detail-back admin-batch-detail-back"
          onClick={onBack}
        >
          ← Back to Dashboard
        </button>

        <div className="admin-batch-detail-context">
          <img
            src="http://switch2itjobs.com/wp-content/uploads/2026/04/BA-Cover-1.jpg"
            alt="Course"
            className="admin-batch-detail-course-image"
          />
          <span className={`student-batch-status-pill ${getBatchStatusClass(batch?.status)}`}>
            {toTitleCase(batch?.status ?? 'in_progress')}
          </span>
          <h2 className="admin-batch-detail-program-title">SIT&apos;S BUSINESS ANALYST PROGRAM</h2>
          <div className="admin-batch-detail-divider" aria-hidden="true" />
          <p className="student-batch-hero-sub admin-batch-detail-sub">
            <span>
              <Briefcase size={13} /> {title}
            </span>
            <span>•</span>
            <span>
              <CalendarDays size={13} /> {formatDateOnly(batch?.start_date ?? null)} -{' '}
              {formatDateOnly(batch?.end_date ?? null)}
            </span>
          </p>
        </div>

        <div className="bd-quick-stats">
          <div className="bd-quick-stat">
            <span className="bd-quick-stat-value">{batchStudents.length}</span>
            <span className="bd-quick-stat-label">Students</span>
          </div>
          <div className="bd-quick-stat">
            <span className="bd-quick-stat-value">{sessions.length}</span>
            <span className="bd-quick-stat-label">Classes</span>
          </div>
          <div className="bd-quick-stat">
            <span className="bd-quick-stat-value">{batchCompletionPct}%</span>
            <span className="bd-quick-stat-label">Complete</span>
          </div>
        </div>

        <div className="student-batch-next-card admin-batch-detail-next-card">
          <p>Next Class</p>
          <h4>{heroPrimarySession?.title ?? 'No class scheduled'}</h4>
          <span className="student-batch-next-time">
            {heroPrimarySession ? formatDateTime(heroPrimarySession.starts_at) : 'Today, 06:30 PM'}
          </span>
          <button
            type="button"
            className="student-batch-hero-primary"
            disabled={!heroPrimarySession?.zoom_meeting_id || actionBusyMeetingId === heroPrimarySession.zoom_meeting_id}
            onClick={() => {
              if (heroPrimarySession?.zoom_meeting_id) {
                void handleStartSession(heroPrimarySession.zoom_meeting_id)
              }
            }}
          >
            <Play size={13} />{' '}
            {actionBusyMeetingId === heroPrimarySession?.zoom_meeting_id ? 'Starting...' : 'Join Class'}
          </button>
        </div>
      </aside>

      <section className="admin-batch-detail-main">
      <nav className="batch-detail-tabs admin-batch-detail-tabs" role="tablist" aria-label="Batch sections">
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
            {tab.id === 'community' && unreadCommunityCount > 0 ? (
              <span className="student-tab-badge">{unreadCommunityCount}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div
        className={`batch-detail-panel ${
          activeTab === 'live-classes' ||
          activeTab === 'overview' ||
          activeTab === 'announcements' ||
          activeTab === 'community' ||
          activeTab === 'assignments'
            ? 'batch-detail-panel-plain'
            : activeTab === 'students'
              ? 'batch-detail-panel-students'
              : ''
        }`}
        role="tabpanel"
      >
        {activeTab === 'overview' && batch ? (
          <section className="admin-overview-v2">
            {/* ── Batch Progress Timeline (full-width) ── */}
            <article className="admin-overview-v2-panel bd-progress-timeline">
              <div className="bd-timeline-header">
                <h3>Batch Timeline</h3>
                <span className="bd-timeline-pct-badge">{batchCompletionPct}% complete</span>
              </div>
              <div className="bd-timeline-dates">
                <span><CalendarDays size={12} /> {formatDateOnly(batch.start_date)}</span>
                <span><CalendarDays size={12} /> {formatDateOnly(batch.end_date)}</span>
              </div>
              <div className="bd-timeline-track">
                <div className="bd-timeline-fill" style={{ width: `${batchCompletionPct}%` }} />
                {batchCompletionPct > 0 && batchCompletionPct < 100 ? (
                  <div className="bd-timeline-marker" style={{ left: `${batchCompletionPct}%` }}>
                    <span className="bd-timeline-marker-label">Today</span>
                  </div>
                ) : null}
                {batchWeekMilestones.map((m) => (
                  <div key={m.week} className="bd-timeline-week-tick" style={{ left: `${m.pct}%` }}>
                    <span>W{m.week}</span>
                  </div>
                ))}
              </div>
            </article>

            {/* ── Left column: Today's Plan + KPIs ── */}
            <div className="bd-overview-left">
              <article className="admin-overview-v2-panel">
                <h3>Today&apos;s Plan</h3>
                <div className="admin-overview-v2-plan-list">
                  <article className="admin-overview-v2-plan-card is-feedback">
                    <div>
                      <p className="admin-overview-v2-plan-label">Feedback Pending</p>
                      <h4>
                        {pendingFeedbackCount > 0
                          ? `${pendingFeedbackCount} Submission${pendingFeedbackCount > 1 ? 's' : ''}`
                          : 'No Pending Feedback'}
                      </h4>
                      <span>
                        {pendingFeedbackCount > 0
                          ? 'Submitted assignments are waiting for trainer feedback.'
                          : 'All submitted assignments are reviewed.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="admin-overview-v2-plan-btn is-feedback"
                      onClick={() => {
                        setActiveTab('assignments')
                        onTabChange?.('assignments')
                      }}
                    >
                      Review
                    </button>
                  </article>

                  <article className="admin-overview-v2-plan-card is-prepare">
                    <div>
                      <p className="admin-overview-v2-plan-label">Preparation</p>
                      <h4>
                        {nextPlannedClass
                          ? `Prepare: ${nextPlannedClass.title}`
                          : 'No upcoming class scheduled'}
                      </h4>
                      <span>
                        {nextPlannedClass
                          ? formatSessionTimeRange(nextPlannedClass.starts_at, nextPlannedClass.ends_at)
                          : 'Create a class schedule for this batch.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="admin-overview-v2-plan-btn is-prepare"
                      onClick={() => {
                        setActiveTab('live-classes')
                        onTabChange?.('live-classes')
                      }}
                    >
                      View
                    </button>
                  </article>

                  {recentlyCompletedWithoutAssignment ? (
                    <article className="admin-overview-v2-plan-card is-assignment">
                      <div>
                        <p className="admin-overview-v2-plan-label">Assignment Action</p>
                        <h4>Add assignment for completed class</h4>
                        <span>{recentlyCompletedWithoutAssignment.title}</span>
                      </div>
                      <button
                        type="button"
                        className="admin-overview-v2-plan-btn is-assignment"
                        onClick={() =>
                          handleAddAssignmentToSession(recentlyCompletedWithoutAssignment)
                        }
                      >
                        Add Assignment
                      </button>
                    </article>
                  ) : null}
                </div>
              </article>

              <article className="admin-overview-v2-panel">
                <h3>Batch Overview</h3>
                <div className="admin-overview-v2-kpi-grid bd-kpi-grid-2x2">
                  <article className="admin-overview-v2-kpi is-stars">
                    <div className="bd-kpi-icon-wrap is-stars"><Star size={18} /></div>
                    <p>3-Star Students</p>
                    <h4>{threeStarStudentCount}</h4>
                    <span>Out of {batchStudents.length} enrolled</span>
                  </article>
                  <article className="admin-overview-v2-kpi is-interviews">
                    <div className="bd-kpi-icon-wrap is-interviews"><Briefcase size={18} /></div>
                    <p>Interview Calls</p>
                    <h4>{totalInterviewsScheduled}</h4>
                    <span>Scheduled across batch</span>
                  </article>
                  <article className="admin-overview-v2-kpi is-attendance">
                    <div className="bd-kpi-icon-wrap is-attendance"><UserCheck size={18} /></div>
                    <p>Attendance</p>
                    <h4>{attendanceProxy}%</h4>
                    <span>Based on classes completed</span>
                  </article>
                  <article className="admin-overview-v2-kpi is-progress">
                    <div className="bd-kpi-icon-wrap is-progress"><TrendingUp size={18} /></div>
                    <p>Overall Progress</p>
                    <h4>{avgProgress === null ? '—' : `${avgProgress}%`}</h4>
                    <span>Average across students</span>
                  </article>
                </div>
              </article>
            </div>

            {/* ── Right column: Recent Activity (full height) ── */}
            <article className="admin-overview-v2-panel bd-activities-panel">
              <h3><Activity size={16} /> Recent Activity</h3>
              <div className="bd-activity-feed">
                {recentActivities.length === 0 ? (
                  <p className="bd-activity-empty">No recent activity in this batch</p>
                ) : (
                  recentActivities.map((activity) => (
                    <div key={activity.id} className={`bd-activity-item is-${activity.type}`}>
                      <div className="bd-activity-dot">
                        {activity.icon === 'check' && <CheckCircle2 size={14} />}
                        {activity.icon === 'calendar' && <CalendarDays size={14} />}
                        {activity.icon === 'clipboard' && <ClipboardList size={14} />}
                        {activity.icon === 'megaphone' && <Megaphone size={14} />}
                        {activity.icon === 'user' && <UserPlus size={14} />}
                      </div>
                      <div className="bd-activity-content">
                        <p className="bd-activity-desc">{activity.description}</p>
                        <span className="bd-activity-time">{formatRelativeTime(activity.timestamp)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        ) : null}

        {activeTab === 'live-classes' ? (
          <div className="student-classes-table-wrap">
            {/* ── Header toolbar ── */}
            <div className="lc-header">
              <div className="lc-search-wrap">
                <Search size={15} className="lc-search-icon" />
                <input
                  type="text"
                  className="lc-search-input"
                  placeholder="Search classes..."
                  value={liveSearchQuery}
                  onChange={(e) => { setLiveSearchQuery(e.target.value); setPastClassesPage(1) }}
                />
              </div>
              <button
                type="button"
                className="schedule-class-btn"
                onClick={() => openScheduleForNew(true)}
              >
                <CalendarDays size={14} /> Schedule Class
              </button>
            </div>

            {/* ── Upcoming Classes ── */}
            <div className="student-classes-section-head">
              <h4><CalendarDays size={16} /> Upcoming Classes</h4>
            </div>
            {filteredUpcomingSessions.length === 0 ? (
              <article className="student-classes-table-card is-upcoming-table">
                <table className="student-classes-table lc-upcoming-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Topic</th>
                      <th>Time</th>
                      <th>Duration</th>
                      <th>Trainer</th>
                      <th>Attachments</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                </table>
                <div className="lc-empty-state">
                  <div className="lc-empty-icon">
                    <CalendarDays size={32} />
                  </div>
                  <p className="lc-empty-title">No upcoming live classes</p>
                  <p className="lc-empty-desc">Schedule a class to get started.</p>
                  <button
                    type="button"
                    className="lc-empty-cta"
                    onClick={() => openScheduleForNew(true)}
                  >
                    Schedule Your First Class
                  </button>
                </div>
              </article>
            ) : (
              <article className="student-classes-table-card is-upcoming-table">
                <table className="student-classes-table lc-upcoming-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Topic</th>
                      <th>Attachments</th>
                      <th>Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <SessionRows
                    items={visibleUpcomingSessions}
                    variant="upcoming"
                    onStart={handleStartSession}
                    onOpenRecording={handleOpenRecording}
                    onReport={handleViewReport}
                    assignmentCountBySessionId={assignmentCountBySessionId}
                    attendanceCountBySessionId={attendanceCountBySessionId}
                    assignmentsBySessionId={assignmentsBySessionId}
                    pendingFeedbackBySessionId={pendingFeedbackBySessionId}
                    onEditSession={handleEditSession}
                    onAddAssignment={handleAddAssignmentToSession}
                    onViewAssignmentReports={handleViewAssignmentReportsForSession}
                    onCopyJoinUrl={handleCopyJoinUrl}
                    onDeleteSession={handleDeleteSession}
                    onOpenClassDetail={(session) => onOpenClassDetail?.(session.id)}
                    loadingMeetingId={actionBusyMeetingId}
                  />
                </table>
                {filteredUpcomingSessions.length > 6 ? (
                  <div className="student-classes-table-foot">
                    <p>
                      Showing {Math.min(visibleUpcomingSessions.length, 6)} of {filteredUpcomingSessions.length} classes
                    </p>
                    <button type="button" onClick={() => setUpcomingClassesExpanded((prev) => !prev)}>
                      {upcomingClassesExpanded ? 'Show Less' : 'View All'}
                    </button>
                  </div>
                ) : null}
              </article>
            )}

            {/* ── Past Classes ── */}
            <div className="student-classes-section-head lc-past-section-head">
              <h4><Clock3 size={16} /> Past Classes</h4>
            </div>
            <article className="student-classes-table-card is-past-table">
              <table className="student-classes-table past-table lc-past-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Topic</th>
                    <th>Status</th>
                    <th>Attendance</th>
                    <th>Attachments</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <SessionRows
                  items={visiblePastSessions}
                  variant="past"
                  onStart={handleStartSession}
                  onOpenRecording={handleOpenRecording}
                  onReport={handleViewReport}
                  assignmentCountBySessionId={assignmentCountBySessionId}
                  attendanceCountBySessionId={attendanceCountBySessionId}
                  assignmentsBySessionId={assignmentsBySessionId}
                  pendingFeedbackBySessionId={pendingFeedbackBySessionId}
                  onEditSession={handleEditSession}
                  onAddAssignment={handleAddAssignmentToSession}
                  onViewAssignmentReports={handleViewAssignmentReportsForSession}
                  onCopyJoinUrl={handleCopyJoinUrl}
                  onDeleteSession={handleDeleteSession}
                  onOpenClassDetail={(session) => onOpenClassDetail?.(session.id)}
                  loadingMeetingId={actionBusyMeetingId}
                />
              </table>
              {filteredPastSessions.length > 0 ? (
                <div className="student-classes-table-foot lc-pagination-foot">
                  <p>
                    Showing {((pastClassesPage - 1) * PAST_PAGE_SIZE) + 1} to {Math.min(pastClassesPage * PAST_PAGE_SIZE, filteredPastSessions.length)} of {filteredPastSessions.length} classes
                  </p>
                  <div className="lc-pagination">
                    <button
                      type="button"
                      className="lc-page-btn"
                      disabled={pastClassesPage <= 1}
                      onClick={() => setPastClassesPage(p => p - 1)}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: pastTotalPages }, (_, i) => i + 1).map(pg => (
                      <button
                        key={pg}
                        type="button"
                        className={`lc-page-btn ${pg === pastClassesPage ? 'is-active' : ''}`}
                        onClick={() => setPastClassesPage(pg)}
                      >
                        {pg}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="lc-page-btn"
                      disabled={pastClassesPage >= pastTotalPages}
                      onClick={() => setPastClassesPage(p => p + 1)}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ) : null}
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

        {activeTab === 'community' ? (
          <BatchCommunityChat
            batchId={batchId}
            senderRole="admin"
            senderName="Admin"
          />
        ) : null}

        {activeTab === 'schedule' ? (
          <section className="schedule-redesign-wrap">
            <article className="schedule-card">
              <div className="schedule-card-head">
                <h3>Program Journey</h3>
                <p>Your path to become a successful Business Analyst</p>
              </div>
              <div className="schedule-journey-track">
                {[
                  { month: 'Month 1', title: 'Training', badge: 'Weeks 1 - 4' },
                  { month: 'Month 2', title: 'Projects & Revision', badge: 'Weeks 5 - 8' },
                  { month: 'Month 3', title: 'Interview Preparation', badge: 'Ongoing Phase' },
                  { month: 'Month 4', title: 'Support & Improvement', badge: 'Ongoing Phase' },
                ].map((step, index) => {
                  const weekAnchor = Math.min(8, index * 4 + 1)
                  const state =
                    currentScheduleWeek > weekAnchor
                      ? 'completed'
                      : currentScheduleWeek === weekAnchor
                        ? 'active'
                        : 'upcoming'
                  return (
                    <div key={step.month} className={`schedule-journey-step is-${state}`}>
                      <div className="schedule-journey-step-top">
                        <span className="schedule-journey-dot">{index + 1}</span>
                        {index < 3 ? <span className="schedule-journey-line" /> : null}
                      </div>
                      <p>{step.month}</p>
                      <h4>{step.title}</h4>
                      <span className="schedule-journey-badge">{step.badge}</span>
                    </div>
                  )
                })}
              </div>
            </article>

            <article className="schedule-card">
              <div className="schedule-card-head">
                <h3>Learning Schedule (Weeks 1 - 8)</h3>
                <p>Detailed weekly plan for first 2 months</p>
              </div>
              <div className="schedule-week-list">
                {PROGRAM_WEEKS.map((item) => {
                  const status =
                    item.week < currentScheduleWeek
                      ? 'completed'
                      : item.week === currentScheduleWeek
                        ? 'in_progress'
                        : 'upcoming'
                  const isOpen = expandedScheduleWeeks.includes(item.week)
                  return (
                    <article key={item.week} className="schedule-week-card">
                      <button
                        type="button"
                        className="schedule-week-head"
                        onClick={() =>
                          setExpandedScheduleWeeks((prev) =>
                            prev.includes(item.week)
                              ? prev.filter((week) => week !== item.week)
                              : [...prev, item.week],
                          )
                        }
                      >
                        <div className="schedule-week-head-left">
                          <div className={`schedule-week-indicator is-${status}`} aria-hidden="true" />
                          <div>
                            <p className="schedule-week-label">Week {item.week}</p>
                            <span className="schedule-week-days">{item.dayRange}</span>
                          </div>
                          <div>
                            <h4>{item.title}</h4>
                          </div>
                        </div>
                        <div className="schedule-week-head-right">
                          <span className={`schedule-week-status is-${status}`}>
                            {status === 'in_progress' ? 'In Progress' : status === 'completed' ? 'Completed' : 'Upcoming'}
                          </span>
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </button>
                      {isOpen ? (
                        <div className="schedule-week-body">
                          {item.topics.map((topic) => (
                            <div key={topic} className="schedule-week-topic-row">
                              <div>
                                <p className="schedule-week-topic-label">Topic</p>
                                <h5>{topic}</h5>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </article>

            <article className="schedule-phase-card is-month3">
              <div className="schedule-phase-head">
                <h3>Month 3 - Interview Preparation</h3>
                <span>Ongoing Phase</span>
              </div>
              <p>
                You will focus on preparing for real interviews and improving
                confidence.
              </p>
              <div className="schedule-phase-points">
                {[
                  'Mock Interviews',
                  'Resume Improvements',
                  'Real Interview Scenarios',
                  'Confidence Building',
                  'Project Explanation Practice',
                  'Q&A Sessions',
                ].map((point) => (
                  <p key={point}>
                    <CheckCircle2 size={14} />
                    {point}
                  </p>
                ))}
              </div>
            </article>

            <article className="schedule-phase-card is-month4">
              <div className="schedule-phase-head">
                <h3>Month 4 - Support & Improvement</h3>
                <span>Ongoing Phase</span>
              </div>
              <div className="schedule-phase-points">
                {[
                  'Continuous Support',
                  'Placement Assistance',
                  'Doubt Clarification',
                  'Skill Improvement',
                  'Feedback After Interviews',
                ].map((point) => (
                  <p key={point}>
                    <CheckCircle2 size={14} />
                    {point}
                  </p>
                ))}
              </div>
            </article>
          </section>
        ) : null}

        {activeTab === 'announcements' ? (
          <div className="batch-announcements-wrap">
            <div className="batch-announce-compose-card">
              <div className="batch-announce-compose-titlebar">
                <span className="batch-announce-compose-title-icon" aria-hidden="true">
                  <Megaphone size={15} />
                </span>
                <div>
                  <h4>Create Announcement</h4>
                  <p>Share important updates with your students</p>
                </div>
              </div>
              <form className="batch-announce-compose" onSubmit={handleCreateAnnouncement}>
                <input
                  type="text"
                  className="batch-announce-title-input"
                  placeholder="Title"
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
                  className={`batch-announce-message-input ${announceMessageFocused ? 'is-expanded' : ''}`}
                  placeholder="Write announcement..."
                  value={announcementForm.body}
                  onFocus={() => setAnnounceMessageFocused(true)}
                  onBlur={() => setAnnounceMessageFocused(false)}
                  onChange={(event) =>
                    setAnnouncementForm((prev) => ({
                      ...prev,
                      body: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      const title = announcementForm.title.trim()
                      const body = announcementForm.body.trim()
                      if (!title || !body || announcementSaving) return
                      ;(event.currentTarget.form as HTMLFormElement | null)?.requestSubmit()
                    }
                  }}
                  rows={1}
                  required
                />
                <button
                  type="button"
                  className="batch-announce-attach-btn"
                  aria-label="Attach file"
                  title={announcementAttachmentFile ? announcementAttachmentFile.name : 'Attach poster/file'}
                  onClick={() => announcementAttachmentInputRef.current?.click()}
                >
                  <Paperclip size={16} />
                </button>
                <input
                  ref={announcementAttachmentInputRef}
                  type="file"
                  className="batch-community-hidden-file"
                  accept="image/*,.pdf,.doc,.docx,.ppt,.pptx"
                  onChange={(event) => setAnnouncementAttachmentFile(event.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className={`batch-announce-important-toggle ${announcementForm.isImportant ? 'is-active' : ''}`}
                  onClick={() =>
                    setAnnouncementForm((prev) => ({
                      ...prev,
                      isImportant: !prev.isImportant,
                    }))
                  }
                >
                  <Star size={13} />
                  Mark Important
                </button>
                <button
                  type="submit"
                  className="batch-announce-send-btn"
                  disabled={announcementSaving || !announcementForm.title.trim() || !announcementForm.body.trim()}
                >
                  <Megaphone size={14} />
                  <span>{announcementSaving ? 'Sending...' : 'Send'}</span>
                </button>
              </form>
            {announcementAttachmentFile ? (
              <p className="batch-announce-toast">Attached: {announcementAttachmentFile.name}</p>
            ) : null}
            </div>
            {announcementToast ? <p className="batch-announce-toast">{announcementToast}</p> : null}

            {announcements.length === 0 ? (
              <p className="muted-dark batch-empty">
                No announcements for this batch yet.
              </p>
            ) : (
              <section className="student-announcements-list">
                {announcements.map((item) => {
                  const summary = announcementReactionSummary.get(item.id) ?? {
                    counts: { thumbs_up: 0, fire: 0, clap: 0, heart: 0 },
                    reactedStudentCount: 0,
                  }
                  const reactionConfig: Array<{ id: 'thumbs_up' | 'fire' | 'clap' | 'heart'; emoji: string }> = [
                    { id: 'thumbs_up', emoji: '👍' },
                    { id: 'fire', emoji: '🔥' },
                    { id: 'clap', emoji: '👏' },
                    { id: 'heart', emoji: '❤️' },
                  ]
                  return (
                    <article key={item.id} className="student-announcement-card">
                      <div className="student-announcement-top">
                        <div className="student-announcement-left">
                          <span className="student-announcement-icon">
                            <Megaphone size={15} />
                          </span>
                          <div className="student-announcement-copy">
                            {editingAnnouncementId === item.id ? (
                              <input
                                type="text"
                                className="batch-announce-inline-input"
                                value={editingAnnouncementForm.title}
                                onChange={(event) =>
                                  setEditingAnnouncementForm((prev) => ({
                                    ...prev,
                                    title: event.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <h4>{item.title}</h4>
                            )}
                            <p className="student-announcement-meta">
                              {new Date(item.published_at).toLocaleDateString([], { weekday: 'long' })},{' '}
                              {new Date(item.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </p>
                            {editingAnnouncementId === item.id ? (
                              <textarea
                                className="batch-announce-inline-textarea"
                                value={editingAnnouncementForm.body}
                                onChange={(event) =>
                                  setEditingAnnouncementForm((prev) => ({
                                    ...prev,
                                    body: event.target.value,
                                  }))
                                }
                                rows={3}
                              />
                            ) : (
                              <p className="student-announcement-body">{item.body}</p>
                            )}
                            {item.attachment_url ? (
                              <a
                                className="batch-announce-attachment-link"
                                href={item.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {/\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(item.attachment_url) ? (
                                  <img
                                    className="batch-announce-attachment-image"
                                    src={item.attachment_url}
                                    alt="Announcement attachment"
                                  />
                                ) : (
                                  <span>Open attachment</span>
                                )}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="student-announcement-bottom">
                        <div className="student-announcement-reactions">
                          {reactionConfig
                            .filter((reaction) => summary.counts[reaction.id] > 0)
                            .map((reaction) => (
                              <span key={reaction.id}>
                                {reaction.emoji} {summary.counts[reaction.id]}
                              </span>
                            ))}
                        </div>
                        <div className="student-announcement-reacted">
                          <div className="student-announcement-avatars">
                            <span />
                            <span />
                            <span />
                          </div>
                          <p>{summary.reactedStudentCount} students reacted</p>
                          <div className="admin-announcement-actions">
                            {editingAnnouncementId === item.id ? (
                              <>
                                <button
                                  type="button"
                                  className="admin-announcement-action-btn is-primary"
                                  disabled={announcementActionId === item.id}
                                  onClick={() => handleSaveAnnouncementEdit(item.id)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="admin-announcement-action-btn"
                                  disabled={announcementActionId === item.id}
                                  onClick={handleCancelEditAnnouncement}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="admin-announcement-action-btn"
                                  disabled={announcementActionId === item.id}
                                  onClick={() => handleStartEditAnnouncement(item)}
                                >
                                  <Pencil size={12} />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="admin-announcement-action-btn is-danger"
                                  disabled={announcementActionId === item.id}
                                  onClick={() => handleDeleteAnnouncement(item.id)}
                                >
                                  <Trash2 size={12} />
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </section>
            )}
          </div>
        ) : null}

        {activeTab === 'assignments' ? (
          <div className="batch-assignments-wrap">
            {assignments.length === 0 ? (
              <div className="batch-assignments-placeholder">
                <ClipboardList size={32} className="batch-assignments-icon" />
                <h4 className="batch-assignments-title">No assignments yet</h4>
                <p className="muted-dark">
                  Use <strong>Schedule Class</strong> and enable
                  <strong> Add Assignment for this Class</strong> to create one.
                </p>
              </div>
            ) : (
              <>
                <div className="student-assignments-table-wrap admin-assignments-table-wrap">
                  <table className="student-assignments-table">
                    <thead>
                      <tr>
                        <th>Assignment</th>
                        <th>Due Date</th>
                        <th>Submissions</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAssignmentRows.map(({ assignment, submittedCount }) => {
                        return (
                          <tr key={assignment.id}>
                            <td>
                              <div className="student-assignment-cell-main">
                                <span className="student-assignment-icon">
                                  <FileText size={14} />
                                </span>
                                <div>
                                  <p>{assignment.title}</p>
                                  <small>
                                    {assignment.description || 'Submit details available in assignment view.'}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="student-assignment-due-cell">
                                <p>{formatDateOnly(assignment.due_at)}</p>
                                <small>
                                  {new Date(assignment.due_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                  })}
                                </small>
                              </div>
                            </td>
                            <td>
                              <p className="student-assignment-marks">
                                <Users size={13} /> {submittedCount}
                              </p>
                            </td>
                            <td>
                              <div className="student-assignment-actions">
                                <button
                                  type="button"
                                  className="student-assignment-primary-btn admin-assignment-primary-btn"
                                  onClick={() => onOpenAssignment?.(assignment.id, batchId)}
                                >
                                  View Assignment Details
                                </button>
                                <div className="class-card-menu-wrap">
                                  <button
                                    type="button"
                                    className="student-assignment-more-btn"
                                    aria-label="More actions"
                                    onClick={() =>
                                      setOpenAssignmentMenuId((prev) =>
                                        prev === assignment.id ? null : assignment.id,
                                      )
                                    }
                                  >
                                    <MoreVertical size={15} />
                                  </button>
                                  {openAssignmentMenuId === assignment.id ? (
                                    <div className="class-card-menu">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleEditAssignment(assignment)
                                          setOpenAssignmentMenuId(null)
                                        }}
                                      >
                                        <Pencil size={14} />
                                        Edit Assignment
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onOpenAssignment?.(assignment.id, batchId)
                                          setOpenAssignmentMenuId(null)
                                        }}
                                      >
                                        <ClipboardList size={14} />
                                        Open Details
                                      </button>
                                      <button
                                        type="button"
                                        className="danger"
                                        onClick={() => {
                                          void handleDeleteAssignment(assignment.id)
                                          setOpenAssignmentMenuId(null)
                                        }}
                                      >
                                        <Trash2 size={14} />
                                        Delete Assignment
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="student-assignments-footer">
                    <p>
                      Showing {assignmentRows.length ? (assignmentPage - 1) * assignmentPageSize + 1 : 0} to{' '}
                      {Math.min(assignmentPage * assignmentPageSize, assignmentRows.length)} of {assignmentRows.length} assignments
                    </p>
                    <div className="student-assignments-pagination">
                      <button
                        type="button"
                        disabled={assignmentPage <= 1}
                        onClick={() => setAssignmentPage((prev) => Math.max(1, prev - 1))}
                      >
                        {'<'}
                      </button>
                      <button type="button" className="active">
                        {assignmentPage}
                      </button>
                      <button
                        type="button"
                        disabled={assignmentPage >= assignmentTotalPages}
                        onClick={() =>
                          setAssignmentPage((prev) => Math.min(assignmentTotalPages, prev + 1))
                        }
                      >
                        {'>'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
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
              <div className="batch-schedule-modal-title">
                <h3>
                  {scheduleForm.classSessionId ? 'Edit Class' : 'Create New Class'}
                </h3>
                <p>Schedule a new class for this batch</p>
              </div>
              <button
                type="button"
                className="batch-schedule-close"
                onClick={() => !scheduleBusy && setScheduleOpen(false)}
                aria-label="Close schedule drawer"
              >
                ×
              </button>
            </div>
            <form className="batch-schedule-form" onSubmit={handleScheduleSubmit}>
              <section className="batch-schedule-class-card">
                <h4>Class Details</h4>
                <div className="batch-schedule-class-grid">
                  <label className="batch-schedule-field batch-schedule-field-full">
                    Class Title *
                    <div ref={scheduleTopicBoxRef} className="create-class-topic-combobox">
                      <div className="create-class-topic-input-wrap">
                        <input
                          type="text"
                          value={scheduleTopicValue}
                          onFocus={() => setScheduleTopicOpen(true)}
                          onChange={(event) => {
                            const value = event.target.value
                            setScheduleForm((prev) => ({
                              ...prev,
                              topicSelection: TOPIC_OPTION_OTHERS,
                              customTopic: value,
                            }))
                            setScheduleTopicOpen(true)
                          }}
                          placeholder="Search or type class topic"
                          required
                        />
                        <button
                          type="button"
                          className="create-class-topic-chevron"
                          onClick={() => setScheduleTopicOpen((open) => !open)}
                          aria-label="Toggle topics list"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      {scheduleTopicOpen ? (
                        <div className="create-class-topic-dropdown">
                          {filteredScheduleTopics.length ? (
                            <ul>
                              {filteredScheduleTopics.map((topic) => (
                                <li key={topic}>
                                  <button
                                    type="button"
                                    onMouseDown={(event) => {
                                      event.preventDefault()
                                      setScheduleForm((prev) => ({
                                        ...prev,
                                        topicSelection: topic,
                                        customTopic: '',
                                      }))
                                      setScheduleTopicOpen(false)
                                    }}
                                  >
                                    {topic}
                                  </button>
                                </li>
                              ))}
                              <li>
                                <button
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault()
                                    setScheduleForm((prev) => ({
                                      ...prev,
                                      topicSelection: TOPIC_OPTION_OTHERS,
                                      customTopic: prev.customTopic || '',
                                    }))
                                    setScheduleTopicOpen(false)
                                  }}
                                >
                                  Others
                                </button>
                              </li>
                            </ul>
                          ) : (
                            <p>No matching topics. You can type a custom title.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </label>
                  {scheduleForm.topicSelection === TOPIC_OPTION_OTHERS ? (
                    <label className="batch-schedule-field batch-schedule-field-full">
                      Topic Name *
                      <input
                        type="text"
                        placeholder="Enter topic name"
                        value={scheduleForm.customTopic}
                        onChange={(event) =>
                          setScheduleForm((prev) => ({
                            ...prev,
                            customTopic: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                  ) : null}

                  <label className="batch-schedule-field">
                    Date & Time *
                    <input
                      type="datetime-local"
                      value={
                        scheduleForm.date && scheduleForm.time
                          ? `${scheduleForm.date}T${scheduleForm.time}`
                          : ''
                      }
                      onChange={(event) => {
                        const value = event.target.value
                        const [dateValue, timeValue] = value.split('T')
                        setScheduleForm((prev) => ({
                          ...prev,
                          date: dateValue ?? '',
                          time: timeValue ?? '',
                        }))
                      }}
                      required
                    />
                  </label>

                  <label className="batch-schedule-field">
                    Duration *
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

                  <label className="batch-schedule-field batch-schedule-field-full">
                    Host *
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

                  <label className="batch-schedule-field batch-schedule-field-full">
                    Class Attachment (Optional)
                    <button
                      type="button"
                      className="class-attachment-upload-btn"
                      onClick={() => classAttachmentInputRef.current?.click()}
                    >
                      <Upload size={20} />
                      Upload File
                    </button>
                    <input
                      ref={classAttachmentInputRef}
                      type="file"
                      className="student-assignment-hidden-file-input"
                      accept=".zip,.rar,.pdf,.doc,.docx"
                      onChange={(event) =>
                        setClassAttachmentFile(event.target.files?.[0] ?? null)
                      }
                    />
                    {classAttachmentFile ? (
                      <p className="student-assignment-selected-file">
                        Selected: {classAttachmentFile.name}
                      </p>
                    ) : null}
                  </label>
                </div>
              </section>
              <label className="batch-schedule-field batch-schedule-field-full batch-schedule-toggle-row">
                <input
                  type="checkbox"
                  checked={scheduleForm.addAssignment}
                  onChange={(event) =>
                    setScheduleForm((prev) => ({
                      ...prev,
                      addAssignment: event.target.checked,
                    }))
                  }
                />
                <div className="batch-schedule-toggle-text">
                  <span>Add Assignment</span>
                </div>
              </label>

              {scheduleForm.addAssignment ? (
                <div className="batch-assignment-block">
                  <div className="batch-assignment-block-head">
                    <h4>Assignment Details</h4>
                  </div>
                  <label className="batch-schedule-field batch-schedule-field-full">
                    Assignment Title *
                    <input
                      type="text"
                      placeholder="Enter assignment title"
                      value={scheduleForm.assignmentTitle}
                      onChange={(event) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          assignmentTitle: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="batch-schedule-field batch-schedule-field-full">
                    Description (Optional)
                    <input
                      type="text"
                      placeholder="Enter description (optional)"
                      value={scheduleForm.assignmentDescription}
                      onChange={(event) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          assignmentDescription: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="batch-schedule-field batch-schedule-field-full">
                    Assignment Attachment (Optional)
                    <small className="batch-schedule-upload-hint">
                      Upload assignment file or instructions
                    </small>
                    <button
                      type="button"
                      className={`student-assignment-upload-box ${assignmentAttachmentDragOver ? 'drag-over' : ''}`}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setAssignmentAttachmentDragOver(true)
                      }}
                      onDragLeave={() => setAssignmentAttachmentDragOver(false)}
                      onDrop={(event) => {
                        event.preventDefault()
                        setAssignmentAttachmentDragOver(false)
                        setAssignmentAttachmentFile(event.dataTransfer.files?.[0] ?? null)
                      }}
                      onClick={() => assignmentAttachmentInputRef.current?.click()}
                    >
                      <Upload size={20} />
                      <strong>Drag &amp; drop file here or</strong>
                      <span className="class-attachment-upload-browse">Browse File</span>
                      <small>Supported: PDF, DOC, DOCX, PPT, PTX, ZIP (Max. 25MB)</small>
                    </button>
                    <input
                      ref={assignmentAttachmentInputRef}
                      type="file"
                      className="student-assignment-hidden-file-input"
                      accept=".pdf,.doc,.docx,.zip,.rar"
                      onChange={(event) =>
                        setAssignmentAttachmentFile(event.target.files?.[0] ?? null)
                      }
                    />
                    {assignmentAttachmentFile ? (
                      <small className="muted-dark">Selected: {assignmentAttachmentFile.name}</small>
                    ) : null}
                    {scheduleForm.assignmentAttachmentUrl ? (
                      <small className="muted-dark">
                        Existing file attached. Upload a new file only if you want to replace it.
                      </small>
                    ) : null}
                  </label>
                  <label className="batch-schedule-field batch-schedule-field-full">
                    Due Date &amp; Time *
                    <input
                      type="datetime-local"
                      value={
                        scheduleForm.assignmentDueDate && scheduleForm.assignmentDueTime
                          ? `${scheduleForm.assignmentDueDate}T${scheduleForm.assignmentDueTime}`
                          : ''
                      }
                      onChange={(event) => {
                        const value = event.target.value
                        const [dateValue, timeValue] = value.split('T')
                        setScheduleForm((prev) => ({
                          ...prev,
                          assignmentDueDate: dateValue ?? '',
                          assignmentDueTime: timeValue ?? '',
                        }))
                      }}
                      required
                    />
                  </label>
                  <div className="batch-assignment-info-note">
                    Students will be able to view this assignment after the class is completed.
                  </div>
                </div>
              ) : null}
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
                  {scheduleBusy
                    ? 'Saving...'
                    : scheduleForm.classSessionId
                      ? 'Update Class'
                      : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      </section>
    </div>
  )
}
