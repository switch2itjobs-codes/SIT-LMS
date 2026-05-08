import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Briefcase,
  FileText,
  Flame,
  FolderOpen,
  Library,
  Link2,
  LayoutDashboard,
  MessageSquare,
  MoreVertical,
  LogOut,
  Megaphone,
  PlayCircle,
  Play,
  PieChart,
  Rocket,
  Search,
  Settings,
  Speech,
  Video,
  Upload,
  X,
  User,
  Users,
  TrendingUp,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getJoinUrl } from '../lib/zoomApi'
import { BatchCommunityChat } from '../components/BatchCommunityChat/BatchCommunityChat'

type HomePageProps = {
  session: Session
}

type ClassSessionItem = {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  zoom_meeting_id: string | null
  zoom_status: string | null
  join_url: string | null
  recording_url: string | null
  batch_id: string
  batch_code: string
  trainer_name: string
}

type AnnouncementItem = {
  id: string
  title: string
  body: string
  published_at: string
  is_important: boolean
  batch_id: string | null
  attachment_url: string | null
}
type AnnouncementReactionType = 'thumbs_up' | 'fire' | 'clap' | 'heart'
type AnnouncementReactionItem = {
  announcement_id: string
  student_id: string
  reaction_type: AnnouncementReactionType
}

type AssignmentItem = {
  id: string
  title: string
  due_at: string
  batch_id: string
  class_session_id: string | null
  attachment_url: string | null
  max_marks: number | null
  description: string | null
}

type AssignmentSubmissionItem = {
  assignment_id: string
  submitted_at: string | null
  marks: number | null
  file_url: string | null
  text_answer: string | null
  feedback: string | null
  feedback_file: string | null
}

type ProgramWeek = {
  week: number
  dayRange: string
  title: string
  topics: string[]
}

type BatchItem = {
  id: string
  batch_code: string
  status: string
  batch_type: string
  trainer_name: string
  start_date: string | null
  end_date: string | null
}

type SessionStatus = 'upcoming' | 'live' | 'completed'
type BatchDetailTab = 'overview' | 'classes' | 'assignments' | 'schedule' | 'announcements' | 'community' | 'materials'

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
    topics: [
      'DBMS Basics',
      'SQL 1',
      'SQL 2',
      'SQL Revision',
    ],
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
type AssignmentTableStatus = 'pending' | 'submitted' | 'under-evaluation' | 'evaluated' | 'overdue'
type AssignmentDrawerMode = 'submit' | 'view'

export function HomePage({ session }: HomePageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const userRole = (session.user.app_metadata.role as string | undefined) ?? 'student'
  const displayName =
    (session.user.user_metadata.full_name as string | undefined) ??
    session.user.email
  const firstName = displayName?.split(' ')[0] ?? 'Student'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [allClasses, setAllClasses] = useState<ClassSessionItem[]>([])
  const [todayClasses, setTodayClasses] = useState<ClassSessionItem[]>([])
  const [upcomingClasses, setUpcomingClasses] = useState<ClassSessionItem[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [myBatches, setMyBatches] = useState<BatchItem[]>([])
  const [assignments, setAssignments] = useState<AssignmentItem[]>([])
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmissionItem[]>([])
  const [announcementReactions, setAnnouncementReactions] = useState<AnnouncementReactionItem[]>([])
  const [previousClassesPage, setPreviousClassesPage] = useState(1)
  const [batchesOpen, setBatchesOpen] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [studentView, setStudentView] = useState<'dashboard' | 'batch-detail'>('dashboard')
  const [batchDetailTab, setBatchDetailTab] = useState<BatchDetailTab>(
    userRole === 'student' ? 'overview' : 'community',
  )
  const [expandedScheduleWeeks, setExpandedScheduleWeeks] = useState<number[]>([1, 2, 3, 4])
  const [upcomingClassesExpanded, setUpcomingClassesExpanded] = useState(false)
  const [pastClassesExpanded, setPastClassesExpanded] = useState(false)
  const [assignmentPage, setAssignmentPage] = useState(1)
  const [assignmentDrawerOpen, setAssignmentDrawerOpen] = useState(false)
  const [assignmentDrawerMode, setAssignmentDrawerMode] = useState<AssignmentDrawerMode>('submit')
  const [activeAssignment, setActiveAssignment] = useState<AssignmentItem | null>(null)
  const [activeSubmissionSnapshot, setActiveSubmissionSnapshot] = useState<AssignmentSubmissionItem | null>(null)
  const [submissionText, setSubmissionText] = useState('')
  const [submissionFile, setSubmissionFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [assignmentSubmitError, setAssignmentSubmitError] = useState('')
  const [assignmentSubmitSuccess, setAssignmentSubmitSuccess] = useState('')
  const [joinBusyMeetingId, setJoinBusyMeetingId] = useState<string | null>(null)
  const [openReactionAnnouncementId, setOpenReactionAnnouncementId] = useState<string | null>(null)
  const [announcementsLastSeenAt, setAnnouncementsLastSeenAt] = useState<string | null>(null)
  const [communityLastSeenAt, setCommunityLastSeenAt] = useState<string | null>(null)
  const [unreadCommunityCount, setUnreadCommunityCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const isBatchWorkspaceView = studentView === 'batch-detail' && Boolean(selectedBatchId)

  const onSignOut = async () => {
    await supabase.auth.signOut()
  }

  useEffect(() => {
    const loadDashboardData = async () => {
      if (userRole === 'trainer') {
        setLoading(true)
        setError('')

        const { data: trainer, error: trainerError } = await supabase
          .from('trainers')
          .select('id,trainer_name')
          .eq('profile_id', session.user.id)
          .maybeSingle()

        if (trainerError || !trainer) {
          setError(trainerError?.message ?? 'Trainer profile not linked yet. Please contact admin.')
          setLoading(false)
          return
        }

        const { data: batchRows, error: batchError } = await supabase
          .from('batches')
          .select('id,batch_code,status,batch_type,trainer_id,start_date,end_date')
          .eq('trainer_id', trainer.id)

        if (batchError) {
          setError(batchError.message)
          setLoading(false)
          return
        }

        setMyBatches(
          (batchRows ?? []).map((batch) => ({
            id: batch.id,
            batch_code: batch.batch_code,
            status: batch.status,
            batch_type: batch.batch_type,
            trainer_name: trainer.trainer_name,
            start_date: batch.start_date,
            end_date: batch.end_date,
          })),
        )

        // Trainer community chat MVP doesn't require student-only data.
        setAllClasses([])
        setTodayClasses([])
        setUpcomingClasses([])
        setAnnouncements([])
        setAssignments([])
        setAnnouncementReactions([])
        setAssignmentSubmissions([])
        setLoading(false)
        return
      }

      if (userRole !== 'student') {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', session.user.id)
        .single()

      if (studentError || !student) {
        setError('Student profile not linked yet. Please contact admin.')
        setLoading(false)
        return
      }
      setStudentId(student.id)

      const { data: studentBatchRows, error: studentBatchError } = await supabase
        .from('student_batches')
        .select('batch_id')
        .eq('student_id', student.id)
        .eq('is_active', true)

      if (studentBatchError) {
        setError(studentBatchError.message)
        setLoading(false)
        return
      }

      const batchIds = (studentBatchRows ?? []).map((row) => row.batch_id)

      if (!batchIds.length) {
        setAllClasses([])
        setTodayClasses([])
        setUpcomingClasses([])
        setAnnouncements([])
        setAnnouncementReactions([])
        setMyBatches([])
        setLoading(false)
        return
      }

      const [{ data: batchRows, error: batchError }, { data: classRows, error: classError }, { data: announcementRows, error: announcementError }, { data: assignmentRows, error: assignmentError }] =
        await Promise.all([
          supabase
            .from('batches')
            .select('id,batch_code,status,batch_type,trainer_id,start_date,end_date')
            .in('id', batchIds),
          supabase
            .from('class_sessions')
            .select(
              'id,title,description,starts_at,ends_at,zoom_meeting_id,zoom_status,join_url,recording_url,batch_id,trainer_id',
            )
            .in('batch_id', batchIds)
            .order('starts_at', { ascending: true }),
          supabase
            .from('announcements')
            .select('id,title,body,batch_id,published_at,is_important,expires_at,attachment_url')
            .order('published_at', { ascending: false }),
          supabase
            .from('assignments')
            .select('id,title,due_at,batch_id,class_session_id,attachment_url,max_marks,description')
            .in('batch_id', batchIds)
            .order('due_at', { ascending: true }),
        ])

      if (batchError || classError || announcementError) {
        setError(batchError?.message ?? classError?.message ?? announcementError?.message ?? 'Failed to load dashboard data.')
        setLoading(false)
        return
      }

      if (assignmentError && assignmentError.code !== '42P01') {
        setError(assignmentError.message)
        setLoading(false)
        return
      }

      const trainerIds = Array.from(
        new Set(
          (batchRows ?? [])
            .map((batch) => batch.trainer_id)
            .filter((trainerId): trainerId is string => Boolean(trainerId)),
        ),
      )

      const { data: trainerRows } = trainerIds.length
        ? await supabase
            .from('trainers')
            .select('id,trainer_name')
            .in('id', trainerIds)
        : { data: [] as Array<{ id: string; trainer_name: string }> }

      const trainerNameById = new Map((trainerRows ?? []).map((row) => [row.id, row.trainer_name]))
      const batchById = new Map((batchRows ?? []).map((row) => [row.id, row]))

      const classItems: ClassSessionItem[] = (classRows ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        starts_at: item.starts_at,
        ends_at: item.ends_at,
        zoom_meeting_id: item.zoom_meeting_id ?? null,
        zoom_status: item.zoom_status ?? null,
        join_url: item.join_url,
        recording_url: item.recording_url,
        batch_id: item.batch_id,
        batch_code: batchById.get(item.batch_id)?.batch_code ?? 'Batch',
        trainer_name:
          trainerNameById.get(item.trainer_id ?? '') ??
          trainerNameById.get(batchById.get(item.batch_id)?.trainer_id ?? '') ??
          'Trainer',
      }))

      const now = new Date()
      setAllClasses(classItems)
      const dayStart = new Date(now)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      setTodayClasses(
        classItems.filter((item) => {
          const when = new Date(item.starts_at)
          return when >= dayStart && when < dayEnd
        }),
      )

      setUpcomingClasses(
        classItems.filter((item) => {
          const when = new Date(item.starts_at)
          return when >= dayEnd
        }),
      )

      const batchIdSet = new Set(batchIds)
      const nowIso = now.toISOString()
      setAnnouncements(
        (announcementRows ?? [])
          .filter((item) => !item.batch_id || batchIdSet.has(item.batch_id))
          .filter((item) => !item.expires_at || item.expires_at > nowIso)
          .map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            published_at: item.published_at,
            is_important: item.is_important,
            batch_id: item.batch_id ?? null,
            attachment_url: item.attachment_url ?? null,
          })),
      )
      const visibleAnnouncementIds = (announcementRows ?? [])
        .filter((item) => !item.batch_id || batchIdSet.has(item.batch_id))
        .filter((item) => !item.expires_at || item.expires_at > nowIso)
        .map((item) => item.id)
      if (visibleAnnouncementIds.length) {
        const { data: reactionRows, error: reactionError } = await supabase
          .from('announcement_reactions')
          .select('announcement_id,student_id,reaction_type')
          .in('announcement_id', visibleAnnouncementIds)
        if (reactionError && reactionError.code !== '42P01') {
          setError(reactionError.message)
          setLoading(false)
          return
        }
        setAnnouncementReactions((reactionRows ?? []) as AnnouncementReactionItem[])
      } else {
        setAnnouncementReactions([])
      }

      setMyBatches(
        (batchRows ?? []).map((batch) => ({
          id: batch.id,
          batch_code: batch.batch_code,
          status: batch.status,
          batch_type: batch.batch_type,
          trainer_name: trainerNameById.get(batch.trainer_id ?? '') ?? 'Trainer',
          start_date: batch.start_date,
          end_date: batch.end_date,
        })),
      )

      const assignmentItems = (assignmentRows ?? []) as AssignmentItem[]
      setAssignments(assignmentItems)

      if (assignmentItems.length) {
        const { data: submissionRows, error: submissionError } = await supabase
          .from('assignment_submissions')
          .select('assignment_id,submitted_at,marks,file_url,text_answer,feedback,feedback_file')
          .eq('student_id', student.id)
          .in(
            'assignment_id',
            assignmentItems.map((item) => item.id),
          )

        if (submissionError && submissionError.code !== '42P01') {
          setError(submissionError.message)
          setLoading(false)
          return
        }
        setAssignmentSubmissions((submissionRows ?? []) as AssignmentSubmissionItem[])
      } else {
        setAssignmentSubmissions([])
      }

      setLoading(false)
    }

    void loadDashboardData()
  }, [session.user.id, userRole])

  useEffect(() => {
    const match = location.pathname.match(
      /^\/home\/batches\/([^/]+)(?:\/(overview|classes|assignments|schedule|announcements|community|materials))?\/?$/,
    )
    if (match) {
      setSelectedBatchId(match[1])
      setStudentView('batch-detail')
      setBatchDetailTab((match[2] as BatchDetailTab | undefined) ?? (userRole === 'student' ? 'overview' : 'community'))
      return
    }
    setStudentView('dashboard')
  }, [location.pathname, userRole])

  const getSessionStatus = (item: ClassSessionItem): SessionStatus => {
    if (item.zoom_status === 'started') {
      return 'live'
    }
    if (item.zoom_status === 'ended') {
      return 'completed'
    }
    if (item.zoom_status === 'waiting' || item.zoom_status === 'not_started') {
      return 'upcoming'
    }

    const now = Date.now()
    const startsAt = new Date(item.starts_at).getTime()
    const endsAt = item.ends_at ? new Date(item.ends_at).getTime() : null
    if (startsAt > now) return 'upcoming'
    if (endsAt && now > endsAt) return 'completed'
    return 'live'
  }

  const submissionByAssignmentId = useMemo(
    () => new Map(assignmentSubmissions.map((item) => [item.assignment_id, item])),
    [assignmentSubmissions],
  )

  const liveNowClasses = useMemo(
    () => allClasses.filter((item) => getSessionStatus(item) === 'live'),
    [allClasses],
  )

  const upcomingTodayClasses = useMemo(() => {
    const now = Date.now()
    return todayClasses
      .filter((item) => new Date(item.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  }, [todayClasses])

  const dueSoonAssignments = useMemo(() => {
    const now = Date.now()
    return assignments
      .filter((item) => {
        const submitted = submissionByAssignmentId.get(item.id)?.submitted_at
        return !submitted && new Date(item.due_at).getTime() >= now
      })
      .slice(0, 4)
  }, [assignments, submissionByAssignmentId])

  const pendingAssignments = useMemo(() => {
    return assignments
      .filter((item) => !submissionByAssignmentId.get(item.id)?.submitted_at)
      .slice(0, 4)
  }, [assignments, submissionByAssignmentId])

  const previousClasses = useMemo(() => {
    return allClasses
      .filter((item) => item.zoom_status === 'ended')
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
  }, [allClasses])

  const previousClassesPageSize = 5
  const previousClassesTotalPages = Math.max(
    1,
    Math.ceil(previousClasses.length / previousClassesPageSize),
  )
  const pagedPreviousClasses = useMemo(() => {
    const start = (previousClassesPage - 1) * previousClassesPageSize
    return previousClasses.slice(start, start + previousClassesPageSize)
  }, [previousClasses, previousClassesPage])

  useEffect(() => {
    setPreviousClassesPage(1)
  }, [previousClasses.length])

  const primaryContinueClass = useMemo(() => {
    if (liveNowClasses.length) return liveNowClasses[0]
    if (upcomingTodayClasses.length) return upcomingTodayClasses[0]
    return upcomingClasses[0] ?? null
  }, [liveNowClasses, upcomingTodayClasses, upcomingClasses])

  const completionPct = allClasses.length
    ? Math.max(10, Math.min(95, Math.round((todayClasses.length / allClasses.length) * 100 + 30)))
    : 42

  const submittedCount = assignmentSubmissions.filter((item) => Boolean(item.submitted_at)).length
  const avgScore = assignmentSubmissions.length
    ? Math.round(
        (assignmentSubmissions.reduce((sum, item) => sum + (item.marks ?? 0), 0) /
          Math.max(1, assignmentSubmissions.filter((item) => item.marks !== null).length)) *
          10,
      ) / 10
    : 0
  const attendancePct = todayClasses.length ? Math.max(70, 100 - upcomingTodayClasses.length * 8) : 85
  const progressPct = completionPct

  const learningStreakDays = useMemo(() => {
    const activeDateKeys = new Set<string>()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    activeDateKeys.add(today.toISOString().slice(0, 10))

    for (const item of assignmentSubmissions) {
      if (!item.submitted_at) continue
      const submittedDay = new Date(item.submitted_at)
      submittedDay.setHours(0, 0, 0, 0)
      activeDateKeys.add(submittedDay.toISOString().slice(0, 10))
    }

    let streak = 0
    const cursor = new Date(today)
    while (true) {
      const key = cursor.toISOString().slice(0, 10)
      if (!activeDateKeys.has(key)) break
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    return streak
  }, [assignmentSubmissions])

  const dynamicInsight = useMemo(() => {
    if (liveNowClasses.length) return `${liveNowClasses.length} class is live now. Join immediately.`
    if (upcomingTodayClasses.length) {
      const next = new Date(upcomingTodayClasses[0].starts_at)
      return `You have ${upcomingTodayClasses.length} class today at ${next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
    }
    if (dueSoonAssignments.length) return `${dueSoonAssignments.length} assignment due soon. Submit today.`
    return `You improved +${Math.max(8, Math.min(18, progressPct - 30))}% this week. Keep going.`
  }, [dueSoonAssignments.length, liveNowClasses.length, progressPct, upcomingTodayClasses])

  const focusText = useMemo(() => {
    const focusItems: string[] = []
    if (upcomingTodayClasses[0]) {
      const starts = new Date(upcomingTodayClasses[0].starts_at)
      focusItems.push(`Attend ${starts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} class`)
    }
    if (pendingAssignments[0]) {
      focusItems.push('Submit pending assignment')
    }
    if (!focusItems.length) focusItems.push('Stay consistent with your learning')
    return `Today's Focus: ${focusItems.join(' • ')}`
  }, [pendingAssignments, upcomingTodayClasses])

  const activityItems = useMemo(() => {
    const fromAnnouncements = announcements.slice(0, 3).map((item) => ({
      id: `a-${item.id}`,
      title: item.title,
      sub: item.body,
      time: new Date(item.published_at).toLocaleDateString(),
      action: 'View update',
    }))

    const fromFeedback = assignmentSubmissions
      .filter((item) => item.feedback)
      .slice(0, 2)
      .map((item) => ({
        id: `f-${item.assignment_id}`,
        title: 'Feedback added on your assignment',
        sub: item.feedback ?? 'Feedback available',
        time: item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : 'Recently',
        action: 'View feedback',
      }))

    return [...fromFeedback, ...fromAnnouncements].slice(0, 5)
  }, [announcements, assignmentSubmissions])

  const resourceItems = useMemo(() => {
    const latestRecording = allClasses.find((item) => Boolean(item.recording_url))
    return [
      latestRecording
        ? {
            id: 'r1',
            title: 'Latest Recording',
            sub: latestRecording.title,
            action: 'Watch',
            href: latestRecording.recording_url,
          }
        : null,
      {
        id: 'r2',
        title: 'Study Material',
        sub: 'React Cheat Sheet.pdf',
        action: 'Open',
        href: '#',
      },
      {
        id: 'r3',
        title: 'Important Link',
        sub: 'Course Resources',
        action: 'Open',
        href: '#',
      },
    ].filter((item): item is { id: string; title: string; sub: string; action: string; href: string } => Boolean(item))
  }, [allClasses])

  const selectedBatch = useMemo(
    () => myBatches.find((item) => item.id === selectedBatchId) ?? null,
    [myBatches, selectedBatchId],
  )

  const selectedBatchClasses = useMemo(
    () => allClasses.filter((item) => item.batch_id === selectedBatchId),
    [allClasses, selectedBatchId],
  )
  const selectedBatchAssignments = useMemo(
    () => assignments.filter((item) => item.batch_id === selectedBatchId),
    [assignments, selectedBatchId],
  )
  const selectedBatchAnnouncements = useMemo(
    () => announcements.filter((item) => !item.batch_id || item.batch_id === selectedBatchId),
    [announcements, selectedBatchId],
  )
  const announcementsStorageKey = useMemo(
    () => `student-announcements-last-seen:${studentId ?? 'unknown'}:${selectedBatchId ?? 'all'}`,
    [studentId, selectedBatchId],
  )
  const unreadAnnouncementsCount = useMemo(() => {
    if (!selectedBatchAnnouncements.length) return 0
    if (!announcementsLastSeenAt) return selectedBatchAnnouncements.length
    const lastSeenTs = new Date(announcementsLastSeenAt).getTime()
    return selectedBatchAnnouncements.filter((item) => new Date(item.published_at).getTime() > lastSeenTs).length
  }, [announcementsLastSeenAt, selectedBatchAnnouncements])
  const communityStorageKey = useMemo(
    () => `batch-community-last-seen:${session.user.id}:${selectedBatchId ?? 'none'}`,
    [selectedBatchId, session.user.id],
  )
  const announcementReactionSummary = useMemo(() => {
    const map = new Map<
      string,
      { counts: Record<AnnouncementReactionType, number>; reactedStudentCount: number }
    >()
    for (const row of announcementReactions) {
      const current = map.get(row.announcement_id) ?? {
        counts: { thumbs_up: 0, fire: 0, clap: 0, heart: 0 },
        reactedStudentCount: 0,
      }
      current.counts[row.reaction_type] += 1
      map.set(row.announcement_id, current)
    }
    for (const [announcementId, value] of map.entries()) {
      const uniqueStudents = new Set(
        announcementReactions
          .filter((row) => row.announcement_id === announcementId)
          .map((row) => row.student_id),
      )
      value.reactedStudentCount = uniqueStudents.size
      map.set(announcementId, value)
    }
    return map
  }, [announcementReactions])
  const announcementMyReactions = useMemo(() => {
    const map = new Map<string, Set<AnnouncementReactionType>>()
    if (!studentId) return map
    for (const row of announcementReactions) {
      if (row.student_id !== studentId) continue
      const set = map.get(row.announcement_id) ?? new Set<AnnouncementReactionType>()
      set.add(row.reaction_type)
      map.set(row.announcement_id, set)
    }
    return map
  }, [announcementReactions, studentId])

  useEffect(() => {
    const savedLastSeen = localStorage.getItem(announcementsStorageKey)
    setAnnouncementsLastSeenAt(savedLastSeen)
  }, [announcementsStorageKey])

  useEffect(() => {
    const saved = localStorage.getItem(communityStorageKey)
    setCommunityLastSeenAt(saved)
  }, [communityStorageKey])

  const markCommunityAsRead = () => {
    if (!selectedBatchId) return
    const nowIso = new Date().toISOString()
    setCommunityLastSeenAt(nowIso)
    setUnreadCommunityCount(0)
    localStorage.setItem(communityStorageKey, nowIso)
  }

  useEffect(() => {
    if (!selectedBatchId) {
      setUnreadCommunityCount(0)
      return
    }

    const normalize = (value: string | null | undefined) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
    const meName = normalize(displayName)
    const meRole = (userRole ?? '').toLowerCase()

    const refreshCommunityUnread = async () => {
      const { data, error: msgError } = await supabase
        .from('batch_community_messages')
        .select('created_at,sender_name,sender_role')
        .eq('batch_id', selectedBatchId)
        .order('created_at', { ascending: false })
        .limit(400)

      if (msgError) return

      const rows = data ?? []
      if (!rows.length) {
        setUnreadCommunityCount(0)
        return
      }

      const seenTs = communityLastSeenAt ? new Date(communityLastSeenAt).getTime() : 0
      const unreadCount = rows.filter((row) => {
        const createdTs = new Date(row.created_at).getTime()
        if (!Number.isFinite(createdTs) || createdTs <= seenTs) return false
        const senderName = normalize(row.sender_name)
        const senderRole = normalize(row.sender_role)
        return !(senderName === meName && senderRole === meRole)
      }).length

      setUnreadCommunityCount(unreadCount)
    }

    void refreshCommunityUnread()

    const channel = supabase
      .channel(`homepage_community_unread:${selectedBatchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'batch_community_messages',
          filter: `batch_id=eq.${selectedBatchId}`,
        },
        () => {
          if (batchDetailTab === 'community') {
            markCommunityAsRead()
          } else {
            void refreshCommunityUnread()
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [batchDetailTab, communityLastSeenAt, displayName, selectedBatchId, userRole, communityStorageKey])

  useEffect(() => {
    if (batchDetailTab !== 'announcements') return
    const nowIso = new Date().toISOString()
    setAnnouncementsLastSeenAt(nowIso)
    localStorage.setItem(announcementsStorageKey, nowIso)
  }, [announcementsStorageKey, batchDetailTab])

  useEffect(() => {
    if (batchDetailTab !== 'community') return
    markCommunityAsRead()
  }, [batchDetailTab, selectedBatchId])
  const selectedBatchNextClass = useMemo(() => {
    const now = Date.now()
    return selectedBatchClasses
      .filter((item) => new Date(item.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0]
  }, [selectedBatchClasses])
  const selectedBatchLiveClass = useMemo(
    () => selectedBatchClasses.find((item) => getSessionStatus(item) === 'live') ?? null,
    [selectedBatchClasses],
  )
  const selectedBatchClassBuckets = useMemo(() => {
    const live = selectedBatchClasses.filter((item) => getSessionStatus(item) === 'live')
    const upcoming = selectedBatchClasses.filter((item) => getSessionStatus(item) === 'upcoming')
    const completed = selectedBatchClasses.filter((item) => getSessionStatus(item) === 'completed')
    return { live, upcoming, completed }
  }, [selectedBatchClasses])
  const currentScheduleWeek = useMemo(() => {
    const start = selectedBatch?.start_date
    if (!start) return 1
    const startDate = new Date(start)
    if (Number.isNaN(startDate.getTime())) return 1
    const diffMs = Date.now() - startDate.getTime()
    if (diffMs <= 0) return 1
    const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
    return Math.max(1, Math.min(8, week))
  }, [selectedBatch?.start_date])
  const upcomingClassTableRows = useMemo(
    () =>
      selectedBatchClasses
        .filter((item) => getSessionStatus(item) === 'upcoming')
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [selectedBatchClasses],
  )
  const pastClassTableRows = useMemo(
    () =>
      selectedBatchClasses
        .filter((item) => getSessionStatus(item) === 'completed')
        .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()),
    [selectedBatchClasses],
  )
  const visibleUpcomingClassRows = useMemo(
    () => (upcomingClassesExpanded ? upcomingClassTableRows : upcomingClassTableRows.slice(0, 6)),
    [upcomingClassTableRows, upcomingClassesExpanded],
  )
  const visiblePastClassRows = useMemo(
    () => (pastClassesExpanded ? pastClassTableRows : pastClassTableRows.slice(0, 6)),
    [pastClassTableRows, pastClassesExpanded],
  )
  const selectedBatchPendingAssignments = useMemo(
    () =>
      selectedBatchAssignments.filter(
        (item) => !submissionByAssignmentId.get(item.id)?.submitted_at && new Date(item.due_at).getTime() >= Date.now(),
      ),
    [selectedBatchAssignments, submissionByAssignmentId],
  )
  const selectedBatchOverdueAssignments = useMemo(
    () =>
      selectedBatchAssignments.filter(
        (item) => !submissionByAssignmentId.get(item.id)?.submitted_at && new Date(item.due_at).getTime() < Date.now(),
      ),
    [selectedBatchAssignments, submissionByAssignmentId],
  )
  const selectedBatchSubmittedAssignments = useMemo(
    () => selectedBatchAssignments.filter((item) => Boolean(submissionByAssignmentId.get(item.id)?.submitted_at)),
    [selectedBatchAssignments, submissionByAssignmentId],
  )
  const assignmentRows = useMemo(() => {
    const sorted = [...selectedBatchAssignments].sort(
      (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime(),
    )
    return sorted.map((item) => {
      const submission = submissionByAssignmentId.get(item.id)
      const hasSubmission = Boolean(submission?.submitted_at)
      const hasMarks = submission?.marks !== null && submission?.marks !== undefined
      const hasFeedback = Boolean(submission?.feedback)
      const overdue = !hasSubmission && new Date(item.due_at).getTime() < Date.now()
      let status: AssignmentTableStatus = 'pending'
      if (overdue) status = 'overdue'
      else if (hasMarks || hasFeedback) status = 'evaluated'
      else if (hasSubmission) status = 'under-evaluation'

      return { item, submission, status }
    })
  }, [selectedBatchAssignments, submissionByAssignmentId])
  const assignmentPageSize = 8
  const assignmentTotalPages = Math.max(1, Math.ceil(assignmentRows.length / assignmentPageSize))
  const paginatedAssignmentRows = useMemo(() => {
    const start = (assignmentPage - 1) * assignmentPageSize
    return assignmentRows.slice(start, start + assignmentPageSize)
  }, [assignmentPage, assignmentRows])
  const classAssignmentsBySessionId = useMemo(() => {
    const map = new Map<string, AssignmentItem[]>()
    for (const assignment of selectedBatchAssignments) {
      if (!assignment.class_session_id) continue
      const list = map.get(assignment.class_session_id) ?? []
      list.push(assignment)
      map.set(assignment.class_session_id, list)
    }
    return map
  }, [selectedBatchAssignments])
  const selectedBatchProgress = selectedBatchClasses.length
    ? Math.round((selectedBatchClassBuckets.completed.length / selectedBatchClasses.length) * 100)
    : 0
  const selectedBatchAttendance = selectedBatchClasses.length
    ? Math.max(60, 100 - selectedBatchClassBuckets.upcoming.length * 5)
    : 0
  const selectedBatchAvgScore = selectedBatchSubmittedAssignments.length
    ? Math.round(
        (selectedBatchSubmittedAssignments.reduce(
          (sum, item) => sum + (submissionByAssignmentId.get(item.id)?.marks ?? 0),
          0,
        ) / Math.max(1, selectedBatchSubmittedAssignments.filter((item) => submissionByAssignmentId.get(item.id)?.marks !== null).length)) *
          10,
      ) / 10
    : 0

  const immediateClassAction = useMemo(() => {
    const now = Date.now()
    const twelveHoursMs = 12 * 60 * 60 * 1000
    const candidates = selectedBatchClasses
      .filter((item) => {
        const status = getSessionStatus(item)
        const startsAt = new Date(item.starts_at).getTime()
        return status === 'live' || (startsAt >= now && startsAt - now <= twelveHoursMs)
      })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    return candidates[0] ?? null
  }, [selectedBatchClasses])

  const assignmentAction = useMemo(() => {
    if (selectedBatchOverdueAssignments.length) return selectedBatchOverdueAssignments[0]
    if (selectedBatchPendingAssignments.length) return selectedBatchPendingAssignments[0]
    return null
  }, [selectedBatchOverdueAssignments, selectedBatchPendingAssignments])

  const revisionActionClass = useMemo(
    () => selectedBatchClassBuckets.completed[0] ?? null,
    [selectedBatchClassBuckets.completed],
  )

  const preparationActionClass = useMemo(() => {
    const now = Date.now()
    const upcoming = selectedBatchClassBuckets.upcoming
      .filter((item) => new Date(item.starts_at).getTime() > now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    if (!upcoming.length) return null
    if (immediateClassAction && upcoming[0].id === immediateClassAction.id) {
      return upcoming[1] ?? null
    }
    return upcoming[0]
  }, [selectedBatchClassBuckets.upcoming, immediateClassAction])

  const formatDateTimeShort = (value: string | null) =>
    value ? new Date(value).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD'

  const formatTimeRange = (start: string | null, end: string | null) => {
    if (!start) return 'TBD'
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

  const formatClassActionLabel = (item: ClassSessionItem) => {
    const status = getSessionStatus(item)
    if (status === 'live') return 'Live Class Now'
    const diffMs = new Date(item.starts_at).getTime() - Date.now()
    const totalMins = Math.max(0, Math.round(diffMs / (1000 * 60)))
    if (totalMins < 60) return `Live Class in ${totalMins} min`
    const hours = Math.floor(totalMins / 60)
    const mins = totalMins % 60
    return mins ? `Live Class in ${hours}h ${mins}m` : `Live Class in ${hours}h`
  }

  const formatNextClassWhen = (value: string | null) => {
    if (!value) return 'TBD'
    const target = new Date(value)
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate())
    const diffDays = Math.floor(
      (startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
    )
    const timePart = target.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    if (diffDays === 0) return `Today, ${timePart}`
    if (diffDays === 1) return `Tomorrow, ${timePart}`
    if (diffDays > 1 && diffDays <= 7) {
      const weekday = target.toLocaleDateString([], { weekday: 'long' })
      return `${weekday}, ${timePart}`
    }
    return target.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const formatDateOnly = (value: string | null | undefined) =>
    value
      ? new Date(value).toLocaleDateString([], {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'TBD'

  const formatMonthShort = (value: string | null) =>
    value ? new Date(value).toLocaleDateString([], { month: 'short' }) : 'TBD'

  const hasClassAttachment = (description: string | null) => {
    if (!description) return false
    const value = description.trim().toLowerCase()
    return (
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('www.')
    )
  }

  const getClassAttachmentUrl = (description: string | null) => {
    if (!description) return null
    const trimmed = description.trim()
    if (!trimmed) return null
    if (trimmed.toLowerCase().startsWith('www.')) {
      return `https://${trimmed}`
    }
    return hasClassAttachment(trimmed) ? trimmed : null
  }

  const getClassRowHint = (item: ClassSessionItem) => {
    const status = getSessionStatus(item)
    if (status === 'live') return 'Live'
    const diffMs = new Date(item.starts_at).getTime() - Date.now()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    if (diffMinutes >= 0 && diffMinutes <= 10) return `Starts in ${diffMinutes} min`
    return ''
  }

  const toGoogleCalendarDate = (value: string) =>
    new Date(value).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const handleAddToCalendar = (item: ClassSessionItem) => {
    const startAt = item.starts_at
    const endAt =
      item.ends_at ??
      new Date(new Date(item.starts_at).getTime() + 60 * 60 * 1000).toISOString()

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: item.title,
      dates: `${toGoogleCalendarDate(startAt)}/${toGoogleCalendarDate(endAt)}`,
      details: `${item.description ?? 'Scheduled class'}\nTrainer: ${item.trainer_name}\nBatch: ${item.batch_code}`,
    })

    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  const openInNewTab = (url: string) => {
    const popup = window.open(url, '_blank', 'noopener,noreferrer')
    if (!popup) {
      window.location.href = url
    }
  }

  const handleJoinClass = async (item: ClassSessionItem | null) => {
    if (!item) return

    if (!item.zoom_meeting_id) {
      setError('Unique join URL is not available for this class yet.')
      return
    }

    try {
      setError('')
      setJoinBusyMeetingId(item.zoom_meeting_id)
      const data = await getJoinUrl(item.zoom_meeting_id)
      if (data.join_url) {
        openInNewTab(data.join_url)
      } else {
        setError('Unique join URL is not available for this class yet.')
      }
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to fetch join URL.')
    } finally {
      setJoinBusyMeetingId(null)
    }
  }

  useEffect(() => {
    setAssignmentPage((prev) => Math.min(Math.max(1, prev), assignmentTotalPages))
  }, [assignmentTotalPages])

  const getAssignmentStatusLabel = (status: AssignmentTableStatus) => {
    if (status === 'under-evaluation') return 'Under Evaluation'
    return status
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  const getAssignmentStatusClass = (status: AssignmentTableStatus) => {
    if (status === 'under-evaluation') return 'is-under-evaluation'
    return `is-${status}`
  }

  const openAssignmentDrawer = (
    assignment: AssignmentItem,
    mode: AssignmentDrawerMode = 'submit',
    submissionSnapshot?: AssignmentSubmissionItem,
  ) => {
    const existing = submissionSnapshot ?? submissionByAssignmentId.get(assignment.id)
    setActiveAssignment(assignment)
    setSubmissionText(existing?.text_answer ?? '')
    setActiveSubmissionSnapshot(existing ?? null)
    setSubmissionFile(null)
    setIsDragOver(false)
    setAssignmentSubmitError('')
    setAssignmentSubmitSuccess('')
    setAssignmentDrawerMode(mode)
    setAssignmentDrawerOpen(true)
  }

  const closeAssignmentDrawer = () => {
    setAssignmentDrawerOpen(false)
    setActiveAssignment(null)
    setSubmissionFile(null)
    setIsDragOver(false)
    setAssignmentSubmitError('')
    setAssignmentSubmitSuccess('')
    setAssignmentDrawerMode('submit')
    setActiveSubmissionSnapshot(null)
  }

  const handleAssignmentSubmit = async () => {
    if (!activeAssignment || !studentId || !submissionFile) return
    const cleanName = submissionFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${studentId}/${activeAssignment.id}/${Date.now()}-${cleanName}`
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('assignment-submissions')
      .upload(filePath, submissionFile, { upsert: true })

    if (uploadError) {
      setAssignmentSubmitError(uploadError.message)
      setAssignmentSubmitSuccess('')
      return
    }

    const payload = {
      assignment_id: activeAssignment.id,
      student_id: studentId,
      submitted_at: new Date().toISOString(),
      text_answer: submissionText || null,
      feedback: submissionText || null,
      file_url: uploadData?.path ?? null,
    }
    const { error: submitError } = await supabase.from('assignment_submissions').upsert(payload, {
      onConflict: 'assignment_id,student_id',
    })
    if (submitError) {
      setAssignmentSubmitError(submitError.message)
      setAssignmentSubmitSuccess('')
      return
    }
    setAssignmentSubmissions((prev) => {
      const filtered = prev.filter((row) => row.assignment_id !== activeAssignment.id)
      return [
        ...filtered,
        {
          assignment_id: activeAssignment.id,
          submitted_at: payload.submitted_at,
          marks: null,
          file_url: payload.file_url,
          text_answer: payload.text_answer,
          feedback: null,
          feedback_file: null,
        },
      ]
    })
    setAssignmentSubmitError('')
    setAssignmentSubmitSuccess('Assignment submitted successfully')
  }

  const handleAssignmentFileSelect = (file: File | null) => {
    if (!file) return
    setAssignmentSubmitError('')
    setSubmissionFile(file)
  }
  const handleToggleAnnouncementReaction = async (announcementId: string, reactionType: AnnouncementReactionType) => {
    if (!studentId) return
    const alreadyReacted = announcementReactions.some(
      (row) =>
        row.announcement_id === announcementId &&
        row.student_id === studentId &&
        row.reaction_type === reactionType,
    )
    if (alreadyReacted) {
      const { error: deleteError } = await supabase
        .from('announcement_reactions')
        .delete()
        .eq('announcement_id', announcementId)
        .eq('student_id', studentId)
        .eq('reaction_type', reactionType)
      if (deleteError) return
      setAnnouncementReactions((prev) =>
        prev.filter(
          (row) =>
            !(
              row.announcement_id === announcementId &&
              row.student_id === studentId &&
              row.reaction_type === reactionType
            ),
        ),
      )
      setOpenReactionAnnouncementId(null)
      return
    }
    const { error: insertError } = await supabase.from('announcement_reactions').insert({
      announcement_id: announcementId,
      student_id: studentId,
      reaction_type: reactionType,
    })
    if (insertError) return
    setAnnouncementReactions((prev) => [
      ...prev,
      { announcement_id: announcementId, student_id: studentId, reaction_type: reactionType },
    ])
    setOpenReactionAnnouncementId(null)
  }
  const handleOpenSubmittedFile = async (filePath: string) => {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      window.open(filePath, '_blank', 'noopener,noreferrer')
      return
    }
    const { data, error: signedUrlError } = await supabase
      .storage
      .from('assignment-submissions')
      .createSignedUrl(filePath, 60 * 10)
    if (!signedUrlError && data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
      return
    }

    const { data: feedbackData, error: feedbackSignedUrlError } = await supabase
      .storage
      .from('assignment-feedback')
      .createSignedUrl(filePath, 60 * 10)
    if (feedbackSignedUrlError || !feedbackData?.signedUrl) {
      setAssignmentSubmitError(feedbackSignedUrlError?.message ?? signedUrlError?.message ?? 'Unable to open uploaded file.')
      return
    }
    window.open(feedbackData.signedUrl, '_blank', 'noopener,noreferrer')
  }
  const activeSubmission = useMemo(
    () => (activeAssignment ? activeSubmissionSnapshot ?? submissionByAssignmentId.get(activeAssignment.id) : undefined),
    [activeAssignment, activeSubmissionSnapshot, submissionByAssignmentId],
  )

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

  // Trainers are allowed to access only the batch "Community" tab for now.

  if (loading) {
    return <div className="center-screen dashboard-loading">Loading dashboard...</div>
  }

  if (error) {
    return (
      <main className="auth-layout">
        <section className="card home-card">
          <h1>Unable to load dashboard</h1>
          <p className="error">{error}</p>
          <button onClick={onSignOut}>Sign Out</button>
        </section>
      </main>
    )
  }

  return (
    <main className={`student-layout ${isBatchWorkspaceView ? 'admin-batch-workspace-shell' : ''}`}>
      {!isBatchWorkspaceView ? (
      <aside className="student-sidebar">
        <div>
          <div className="brand">
            <img src="/sit-logo.png" alt="SIT logo" className="brand-logo" />
            <span>LearnPro</span>
          </div>
          <nav className="sidebar-nav">
            <button
              className={`sidebar-item ${studentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => navigate('/home')}
            >
              <LayoutDashboard size={16} />
              Dashboard
            </button>
            <div className="student-batches-nav-wrap">
              <button
                className={`sidebar-item ${studentView === 'batch-detail' ? 'active' : ''}`}
                onClick={() => setBatchesOpen((prev) => !prev)}
              >
                <Users size={16} />
                Your Batches
                <span className="student-batches-nav-chevron">
                  {batchesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              </button>
              {batchesOpen ? (
                <div className="student-batches-nav-list">
                  {myBatches.length ? (
                    myBatches.map((batch) => (
                      <button
                        key={batch.id}
                        type="button"
                        className={`student-batch-nav-item ${selectedBatchId === batch.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedBatchId(batch.id)
                          navigate(`/home/batches/${batch.id}/${userRole === 'student' ? 'overview' : 'community'}`)
                        }}
                      >
                        {batch.batch_code}
                      </button>
                    ))
                  ) : (
                    <p className="student-batch-nav-empty">No enrolled batches</p>
                  )}
                </div>
              ) : null}
            </div>
            <button className="sidebar-item">
              <CalendarDays size={16} />
              My Classes
            </button>
            <button className="sidebar-item">
              <BookOpen size={16} />
              Assignments
            </button>
            <button className="sidebar-item">
              <PlayCircle size={16} />
              Recordings
            </button>
            <button className="sidebar-item">
              <Library size={16} />
              Study Materials
            </button>
            <button className="sidebar-item">
              <Rocket size={16} />
              Performance
            </button>
            <button className="sidebar-item">
              <Megaphone size={16} />
              Announcements
            </button>
            <button className="sidebar-item">
              <MessageSquare size={16} />
              Messages
            </button>
            <button className="sidebar-item">
              <User size={16} />
              Profile
            </button>
            <button className="sidebar-item">
              <Settings size={16} />
              Settings
            </button>
          </nav>
        </div>

        <button className="sidebar-user" onClick={onSignOut}>
          <div className="avatar">{firstName[0]?.toUpperCase()}</div>
          <div className="user-meta">
            <p>{displayName}</p>
            <span>{session.user.email}</span>
          </div>
          <LogOut size={14} />
        </button>
      </aside>
      ) : null}

      <section className={`student-content student-v2-content ${isBatchWorkspaceView ? 'admin-batch-workspace-content' : ''}`}>
        {studentView === 'batch-detail' ? (
          <section className="student-batch-detail-page student-batch-detail-revamp">
            <aside className="admin-batch-detail-left">
              <button type="button" className="batch-detail-back admin-batch-detail-back" onClick={() => navigate('/home')}>
                ← Back to Dashboard
              </button>

              <div className="admin-batch-detail-context">
                <img
                  src="http://switch2itjobs.com/wp-content/uploads/2026/04/BA-Cover-1.jpg"
                  alt="Course"
                  className="admin-batch-detail-course-image"
                />
                <span className={`student-batch-status-pill ${getBatchStatusClass(selectedBatch?.status)}`}>
                  {toTitleCase(selectedBatch?.status ?? 'in_progress')}
                </span>
                <h2 className="admin-batch-detail-program-title">SIT&apos;S BUSINESS ANALYST PROGRAM</h2>
                <div className="admin-batch-detail-divider" aria-hidden="true" />
                <p className="student-batch-hero-sub admin-batch-detail-sub">
                  <span>
                    <Briefcase size={13} /> {selectedBatch?.batch_code ?? 'N/A'}
                  </span>
                  <span>•</span>
                  <span>
                    <CalendarDays size={13} /> {formatDateOnly(selectedBatch?.start_date)} - {formatDateOnly(selectedBatch?.end_date)}
                  </span>
                </p>
              </div>

              <div className="student-batch-next-card admin-batch-detail-next-card">
                <p>Next Class</p>
                <h4>{selectedBatchNextClass?.title ?? 'No class scheduled'}</h4>
                <span className="student-batch-next-time">
                  {selectedBatchNextClass ? formatNextClassWhen(selectedBatchNextClass.starts_at) : 'Today, 06:30 PM'}
                </span>
                <button
                  type="button"
                  className="student-batch-hero-primary"
                  disabled={
                    Boolean(joinBusyMeetingId) &&
                    joinBusyMeetingId ===
                      (selectedBatchLiveClass?.zoom_meeting_id ??
                        selectedBatchNextClass?.zoom_meeting_id ??
                        null)
                  }
                  onClick={() => handleJoinClass(selectedBatchLiveClass ?? selectedBatchNextClass ?? null)}
                >
                  <Play size={13} /> Join Class
                </button>
              </div>
            </aside>

            <section className="admin-batch-detail-main">
            <nav className="batch-detail-tabs admin-batch-detail-tabs">
              {[
                { id: 'overview' as BatchDetailTab, label: 'Overview', icon: <LayoutDashboard size={14} /> },
                { id: 'classes' as BatchDetailTab, label: 'Classes', icon: <CalendarDays size={14} /> },
                { id: 'assignments' as BatchDetailTab, label: 'Assignments', icon: <FileText size={14} /> },
                { id: 'schedule' as BatchDetailTab, label: 'Schedule', icon: <CalendarRange size={14} /> },
                { id: 'announcements' as BatchDetailTab, label: 'Announcements', icon: <Speech size={14} /> },
                { id: 'community' as BatchDetailTab, label: 'Community', icon: <Users size={14} /> },
                { id: 'materials' as BatchDetailTab, label: 'Materials', icon: <Library size={14} /> },
              ]
                .filter((tab) => (userRole === 'student' ? true : tab.id === 'community'))
                .map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`batch-detail-tab ${batchDetailTab === id ? 'active' : ''}`}
                  onClick={() => {
                    setBatchDetailTab(id)
                    if (selectedBatchId) navigate(`/home/batches/${selectedBatchId}/${id}`)
                  }}
                >
                  {icon}
                  {label}
                  {id === 'announcements' && unreadAnnouncementsCount > 0 ? (
                    <span className="student-tab-badge">{unreadAnnouncementsCount}</span>
                  ) : null}
                  {id === 'community' && unreadCommunityCount > 0 ? (
                    <span className="student-tab-badge">{unreadCommunityCount}</span>
                  ) : null}
                </button>
              ))}
            </nav>

            <section className="student-batch-tab-content">
              {batchDetailTab === 'overview' ? (
                <div className="student-batch-overview-split">
                  <article className="student-batch-overview-card">
                    <h3 className="student-batch-overview-title">Today's Plan</h3>
                    <div className="student-batch-plan-list">
                      {immediateClassAction ? (
                        <article className="student-batch-plan-item is-live-item">
                          <div>
                            <p className="student-batch-plan-label is-live">
                              {formatClassActionLabel(immediateClassAction)}
                            </p>
                            <p className="student-batch-plan-time">
                              {formatTimeRange(immediateClassAction.starts_at, immediateClassAction.ends_at)}
                            </p>
                            <p className="student-batch-plan-main">{immediateClassAction.title}</p>
                            <p className="student-batch-plan-meta">{selectedBatch?.trainer_name ?? 'Trainer'}</p>
                          </div>
                          <button
                            type="button"
                            className="student-batch-btn student-batch-btn-success"
                            disabled={joinBusyMeetingId === immediateClassAction.zoom_meeting_id}
                            onClick={() => handleJoinClass(immediateClassAction)}
                          >
                            Join Now
                          </button>
                        </article>
                      ) : null}

                      {assignmentAction ? (
                        <article className="student-batch-plan-item">
                          <div>
                            <p className="student-batch-plan-label is-assignment">
                              {selectedBatchOverdueAssignments.some((item) => item.id === assignmentAction.id)
                                ? 'Assignment Overdue'
                                : 'Assignment Pending'}
                            </p>
                            <p className="student-batch-plan-main">{assignmentAction.title}</p>
                            <p className="student-batch-plan-meta">
                              Due: {formatDateTimeShort(assignmentAction.due_at)}
                            </p>
                          </div>
                          <button type="button" className="student-batch-btn student-batch-btn-warning">
                            Submit
                          </button>
                        </article>
                      ) : null}

                      {revisionActionClass ? (
                        <article className="student-batch-plan-item">
                          <div>
                            <p className="student-batch-plan-label is-revision">Revision</p>
                            <p className="student-batch-plan-main">
                              Revise: {revisionActionClass.title}
                            </p>
                            <p className="student-batch-plan-meta">
                              Last class: {formatDateTimeShort(revisionActionClass.starts_at)}
                            </p>
                          </div>
                          <a
                            href={revisionActionClass.recording_url ?? '#'}
                            className="student-batch-btn student-batch-btn-revision"
                            target={revisionActionClass.recording_url ? '_blank' : undefined}
                            rel={revisionActionClass.recording_url ? 'noreferrer' : undefined}
                          >
                            Revise
                          </a>
                        </article>
                      ) : null}

                      {preparationActionClass ? (
                        <article className="student-batch-plan-item">
                          <div>
                            <p className="student-batch-plan-label is-next">Preparation</p>
                            <p className="student-batch-plan-main">
                              Prepare: {preparationActionClass.title}
                            </p>
                            <p className="student-batch-plan-meta">
                              {formatTimeRange(preparationActionClass.starts_at, preparationActionClass.ends_at)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="student-batch-btn student-batch-btn-primary-outline"
                            disabled={joinBusyMeetingId === preparationActionClass.zoom_meeting_id}
                            onClick={() => handleJoinClass(preparationActionClass)}
                          >
                            View
                          </button>
                        </article>
                      ) : null}

                      {!immediateClassAction &&
                      !assignmentAction &&
                      !revisionActionClass &&
                      !preparationActionClass ? (
                        <p className="empty-state">No pending action items.</p>
                      ) : null}
                    </div>
                  </article>

                  <article className="student-batch-overview-card">
                    <h3 className="student-batch-overview-title">Batch Overview</h3>
                    <section className="student-batch-kpi-grid">
                      <article className="student-batch-kpi-card kpi-blue">
                        <div>
                          <p className="student-batch-kpi-title">Overall Progress</p>
                          <h4 className="student-batch-kpi-value">{selectedBatchProgress}%</h4>
                          <p className="student-batch-kpi-sub">You're on track for completion</p>
                        </div>
                        <TrendingUp className="student-batch-kpi-icon" />
                      </article>

                      <article className="student-batch-kpi-card kpi-green">
                        <div>
                          <p className="student-batch-kpi-title">Average Score</p>
                          <h4 className="student-batch-kpi-value">{selectedBatchAvgScore} / 10</h4>
                          <p className="student-batch-kpi-sub">Batch Average: 6.4 / 10</p>
                        </div>
                        <BarChart3 className="student-batch-kpi-icon" />
                      </article>

                      <article className="student-batch-kpi-card kpi-purple">
                        <div>
                          <p className="student-batch-kpi-title">Assignments Completed</p>
                          <h4 className="student-batch-kpi-value">
                            {selectedBatchSubmittedAssignments.length} / {selectedBatchAssignments.length || 0}
                          </h4>
                          <p className="student-batch-kpi-sub">Submission consistency</p>
                        </div>
                        <ClipboardCheck className="student-batch-kpi-icon" />
                      </article>

                      <article className="student-batch-kpi-card kpi-yellow">
                        <div>
                          <p className="student-batch-kpi-title">Attendance</p>
                          <h4 className="student-batch-kpi-value">{selectedBatchAttendance}%</h4>
                          <p className="student-batch-kpi-sub">Keep attendance above 80%</p>
                        </div>
                        <PieChart className="student-batch-kpi-icon" />
                      </article>
                    </section>
                  </article>
                </div>
              ) : null}

              {batchDetailTab === 'classes' ? (
                <section className="student-batch-classes-tab">
                  {selectedBatchClassBuckets.live[0] ? (
                    <div className="student-classes-block">
                      <h4 className="student-classes-block-title is-live-head">
                        <span className="live-dot" /> Live Now
                      </h4>
                      <article className="student-classes-live-card">
                        <div className="student-classes-live-left">
                          <div className="student-classes-live-cover">
                            <span>LIVE</span>
                            <Play size={30} />
                          </div>
                          <div>
                            <p className="student-classes-live-time">
                              {formatTimeRange(selectedBatchClassBuckets.live[0].starts_at, selectedBatchClassBuckets.live[0].ends_at)}
                            </p>
                            <h3>{selectedBatchClassBuckets.live[0].title}</h3>
                            <p className="student-classes-live-trainer">
                              <User size={14} /> {selectedBatchClassBuckets.live[0].trainer_name}
                            </p>
                          </div>
                        </div>
                        <div className="student-classes-live-right">
                          <div className="student-classes-live-counter">
                            <p>Started at</p>
                            <h5>
                              {new Date(selectedBatchClassBuckets.live[0].starts_at).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })}
                            </h5>
                          </div>
                          <button
                            type="button"
                            disabled={joinBusyMeetingId === selectedBatchClassBuckets.live[0].zoom_meeting_id}
                            onClick={() => handleJoinClass(selectedBatchClassBuckets.live[0])}
                          >
                            <Video size={14} /> Join Now
                          </button>
                        </div>
                      </article>
                    </div>
                  ) : null}

                  <div className="student-classes-section-head">
                    <h4><CalendarDays size={16} /> Upcoming Classes</h4>
                    <button type="button" onClick={() => setUpcomingClassesExpanded((prev) => !prev)}>
                      {upcomingClassesExpanded ? 'Show Less' : 'View All'}
                    </button>
                  </div>
                  <article className="student-classes-table-card is-upcoming-table">
                    <table className="student-classes-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Topic</th>
                          <th>Time</th>
                          <th>Attachments</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleUpcomingClassRows.map((item) => {
                          const hint = getClassRowHint(item)
                          const status = getSessionStatus(item)
                          const classAssignments = classAssignmentsBySessionId.get(item.id) ?? []
                          const primaryClassAssignment = classAssignments[0]
                          const classSubmission = primaryClassAssignment
                            ? submissionByAssignmentId.get(primaryClassAssignment.id)
                            : undefined
                          const showSubmitAssignment = Boolean(primaryClassAssignment)
                          const submitAssignmentLabel = classSubmission?.submitted_at ? 'View Submission' : 'Submit Assignment'
                          const assignmentAttachmentCount = classAssignments.filter((assignment) =>
                            Boolean(assignment.attachment_url),
                          ).length
                          const classAttachmentUrl = getClassAttachmentUrl(item.description)
                          const attachmentUrls = [
                            ...classAssignments
                              .map((assignment) => assignment.attachment_url)
                              .filter((url): url is string => Boolean(url)),
                            ...(classAttachmentUrl ? [classAttachmentUrl] : []),
                          ]
                          const attachmentCount =
                            assignmentAttachmentCount + (classAttachmentUrl ? 1 : 0)
                          return (
                            <tr key={item.id} className={status === 'live' ? 'is-live' : ''}>
                              <td>
                                <div className={`student-classes-table-date weekday-${new Date(item.starts_at).getDay()}`}>
                                  <span>{new Date(item.starts_at).toLocaleDateString([], { weekday: 'short' })}</span>
                                  <strong>{new Date(item.starts_at).getDate()}</strong>
                                  <small>{formatMonthShort(item.starts_at)}</small>
                                </div>
                              </td>
                              <td>
                                <p className="student-classes-topic">{item.title}</p>
                                {hint ? <small className="student-classes-hint">{hint}</small> : null}
                              </td>
                              <td className="student-classes-time-cell">{formatTimeRange(item.starts_at, item.ends_at)}</td>
                              <td>
                                {attachmentCount ? (
                                  <button
                                    type="button"
                                    className="student-classes-attachment-btn"
                                    onClick={() =>
                                      window.open(attachmentUrls[0], '_blank', 'noopener,noreferrer')
                                    }
                                  >
                                    <Link2 size={13} /> {attachmentCount} {attachmentCount === 1 ? 'File' : 'Files'}
                                  </button>
                                ) : (
                                  <span className="student-classes-attachment-empty">-</span>
                                )}
                              </td>
                              <td>
                                <div className="student-classes-actions">
                                  <button
                                    type="button"
                                    className="join"
                                    disabled={joinBusyMeetingId === item.zoom_meeting_id}
                                    onClick={() => handleJoinClass(item)}
                                  >
                                    <Video size={12} /> Join
                                  </button>
                                  {showSubmitAssignment ? (
                                    <button
                                      type="button"
                                      className="assignment"
                                      onClick={() => {
                                        openAssignmentDrawer(
                                          primaryClassAssignment,
                                          classSubmission?.submitted_at ? 'view' : 'submit',
                                          classSubmission,
                                        )
                                      }}
                                    >
                                      {submitAssignmentLabel === 'View Submission' ? <FileText size={12} /> : <Upload size={12} />}
                                      {submitAssignmentLabel}
                                    </button>
                                  ) : null}
                                  <button type="button" className="calendar" onClick={() => handleAddToCalendar(item)}>
                                    <CalendarDays size={12} /> Add to Calendar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div className="student-classes-table-foot">
                      <p>Showing {Math.min(visibleUpcomingClassRows.length, 6)} of {upcomingClassTableRows.length} classes</p>
                      <button type="button" onClick={() => setUpcomingClassesExpanded((prev) => !prev)}>
                        {upcomingClassesExpanded ? 'Show Less' : 'View All'}
                      </button>
                    </div>
                  </article>

                  <div className="student-classes-section-head">
                    <h4><Clock3 size={16} /> Past Classes</h4>
                    <button type="button" onClick={() => setPastClassesExpanded((prev) => !prev)}>
                      {pastClassesExpanded ? 'Show Less' : 'View All'}
                    </button>
                  </div>
                  <article className="student-classes-table-card is-past-table">
                    <table className="student-classes-table past-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Topic</th>
                          <th>Attachments</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePastClassRows.map((item) => (
                          (() => {
                            const classAssignments = classAssignmentsBySessionId.get(item.id) ?? []
                            const primaryClassAssignment = classAssignments[0]
                            const classSubmission = primaryClassAssignment
                              ? submissionByAssignmentId.get(primaryClassAssignment.id)
                              : undefined
                            const showAssignmentAction = Boolean(primaryClassAssignment)
                            const assignmentLabel = classSubmission?.submitted_at ? 'View Submission' : 'Submit Assignment'
                            const assignmentAttachmentCount = classAssignments.filter((assignment) =>
                              Boolean(assignment.attachment_url),
                            ).length
                            const classAttachmentUrl = getClassAttachmentUrl(item.description)
                            const attachmentUrls = [
                              ...classAssignments
                                .map((assignment) => assignment.attachment_url)
                                .filter((url): url is string => Boolean(url)),
                              ...(classAttachmentUrl ? [classAttachmentUrl] : []),
                            ]
                            const attachmentCount =
                              assignmentAttachmentCount + (classAttachmentUrl ? 1 : 0)
                            return (
                              <tr key={item.id}>
                                <td>
                                  <div className="student-classes-table-date is-neutral">
                                    <span>{new Date(item.starts_at).toLocaleDateString([], { weekday: 'short' })}</span>
                                    <strong>{new Date(item.starts_at).getDate()}</strong>
                                    <small>{formatMonthShort(item.starts_at)}</small>
                                  </div>
                                </td>
                                <td><p className="student-classes-topic">{item.title}</p></td>
                                <td>
                                  {attachmentCount ? (
                                    <button
                                      type="button"
                                      className="student-classes-attachment-btn"
                                      onClick={() =>
                                        window.open(attachmentUrls[0], '_blank', 'noopener,noreferrer')
                                      }
                                    >
                                      <Link2 size={13} /> {attachmentCount} {attachmentCount === 1 ? 'File' : 'Files'}
                                    </button>
                                  ) : (
                                    <span className="student-classes-attachment-empty">-</span>
                                  )}
                                </td>
                                <td>
                                  <div className="student-classes-actions">
                                    {item.recording_url ? (
                                      <a href={item.recording_url} target="_blank" rel="noreferrer" className="watch">
                                        <Play size={12} /> Watch Recording
                                      </a>
                                    ) : null}
                                    {showAssignmentAction ? (
                                      <button
                                        type="button"
                                        className="assignment"
                                        onClick={() =>
                                          openAssignmentDrawer(
                                            primaryClassAssignment,
                                            classSubmission?.submitted_at ? 'view' : 'submit',
                                            classSubmission,
                                          )
                                        }
                                      >
                                        {assignmentLabel === 'View Submission' ? <FileText size={12} /> : <Upload size={12} />}
                                        {assignmentLabel}
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            )
                          })()
                        ))}
                      </tbody>
                    </table>
                    <div className="student-classes-table-foot">
                      <p>Showing {Math.min(visiblePastClassRows.length, 6)} of {pastClassTableRows.length} classes</p>
                      <button type="button" onClick={() => setPastClassesExpanded((prev) => !prev)}>
                        {pastClassesExpanded ? 'Show Less' : 'View All'}
                      </button>
                    </div>
                  </article>
                </section>
              ) : null}

              {batchDetailTab === 'assignments' ? (
                <section className="student-assignments-tab">
                  <div className="student-assignments-table-wrap">
                    <table className="student-assignments-table">
                      <thead>
                        <tr>
                          <th>Assignment</th>
                          <th>Due Date</th>
                          <th>Status</th>
                          <th>Marks</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedAssignmentRows.map(({ item, submission, status }) => {
                          const actionLabel =
                            status === 'evaluated'
                              ? 'View Feedback'
                              : status === 'under-evaluation'
                                ? 'View Submission'
                                : status === 'overdue'
                                  ? 'Submit Late'
                                  : 'Submit'
                          const canSubmit = status === 'pending' || status === 'overdue'
                          return (
                            <tr key={item.id}>
                              <td>
                                <div className="student-assignment-cell-main">
                                  <span className="student-assignment-icon">
                                    <FileText size={14} />
                                  </span>
                                  <div>
                                    <p>{item.title}</p>
                                    <small>{item.description || 'Assignment details available in submission drawer.'}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="student-assignment-due-cell">
                                  <p>{formatDateOnly(item.due_at)}</p>
                                  <small>
                                    {new Date(item.due_at).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true,
                                    })}
                                  </small>
                                </div>
                              </td>
                              <td>
                                <span className={`student-assignment-status ${getAssignmentStatusClass(status)}`}>
                                  {getAssignmentStatusLabel(status)}
                                </span>
                              </td>
                              <td className="student-assignment-marks">
                                {submission?.marks !== null && submission?.marks !== undefined
                                  ? `${submission.marks} / ${item.max_marks ?? 10}`
                                  : '—'}
                              </td>
                              <td>
                                <div className="student-assignment-actions">
                                  <button
                                    type="button"
                                    className="student-assignment-primary-btn"
                                    onClick={() => {
                                      if (canSubmit) openAssignmentDrawer(item, 'submit')
                                      else openAssignmentDrawer(item, 'view', submission ?? undefined)
                                    }}
                                  >
                                    {actionLabel}
                                  </button>
                                  <button type="button" className="student-assignment-more-btn" aria-label="More actions">
                                    <MoreVertical size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {!assignmentRows.length ? <p className="empty-state">No assignments in this batch.</p> : null}
                  </div>

                  <div className="student-assignments-footer">
                    <p>
                      Showing {assignmentRows.length ? (assignmentPage - 1) * assignmentPageSize + 1 : 0} to{' '}
                      {Math.min(assignmentPage * assignmentPageSize, assignmentRows.length)} of {assignmentRows.length} assignments
                    </p>
                    <div className="student-assignments-pagination">
                      <button type="button" disabled={assignmentPage <= 1} onClick={() => setAssignmentPage((prev) => Math.max(1, prev - 1))}>
                        {'<'}
                      </button>
                      <button type="button" className="active">{assignmentPage}</button>
                      <button type="button" disabled={assignmentPage >= assignmentTotalPages} onClick={() => setAssignmentPage((prev) => Math.min(assignmentTotalPages, prev + 1))}>
                        {'>'}
                      </button>
                    </div>
                  </div>

                  <div className={`student-assignment-drawer-backdrop ${assignmentDrawerOpen ? 'open' : ''}`} onClick={closeAssignmentDrawer} />
                  <aside className={`student-assignment-drawer ${assignmentDrawerOpen ? 'open' : ''}`}>
                    <header>
                      <div className="student-assignment-drawer-title">
                        <span className="student-assignment-icon">
                          <FileText size={14} />
                        </span>
                        <div className="student-assignment-drawer-title-text">
                          <h4>{activeAssignment?.title ?? 'Assignment'}</h4>
                          <p>Assignment Details</p>
                        </div>
                      </div>
                      <button type="button" onClick={closeAssignmentDrawer} aria-label="Close assignment drawer">
                        <X size={16} />
                      </button>
                    </header>
                    <div className="student-assignment-drawer-body">
                      {assignmentDrawerMode === 'view' ? (
                        <>
                          <section className="student-assignment-drawer-section">
                            <h5>Submission</h5>
                            <div className="student-assignment-view-box">
                              <p className="student-assignment-view-meta">
                                Submitted at: {activeSubmission?.submitted_at ? formatDateTimeShort(activeSubmission.submitted_at) : 'N/A'}
                              </p>
                              <h6>Text Answer</h6>
                              <p>{activeSubmission?.text_answer || 'No text response submitted.'}</p>
                              <h6>Uploaded File</h6>
                              {activeSubmission?.file_url ? (
                                <button
                                  type="button"
                                  className="student-assignment-view-file"
                                  onClick={() => handleOpenSubmittedFile(activeSubmission.file_url as string)}
                                >
                                  View Uploaded File
                                </button>
                              ) : (
                                <p>No file uploaded.</p>
                              )}
                            </div>
                          </section>

                          {(activeSubmission?.feedback || activeSubmission?.feedback_file) ? (
                            <section className="student-assignment-drawer-section">
                              <h5>Feedback</h5>
                              <div className="student-assignment-view-box">
                                <h6>Trainer Comments</h6>
                                <p>{activeSubmission?.feedback || 'No text feedback provided.'}</p>
                                <h6>Review File</h6>
                                {activeSubmission?.feedback_file ? (
                                  <button
                                    type="button"
                                    className="student-assignment-view-file"
                                    onClick={() => handleOpenSubmittedFile(activeSubmission.feedback_file as string)}
                                  >
                                    View Feedback File
                                  </button>
                                ) : (
                                  <p>No feedback file uploaded.</p>
                                )}
                              </div>
                            </section>
                          ) : null}
                        </>
                      ) : (
                        <>
                      {assignmentSubmitSuccess ? (
                        <div className="student-assignment-submit-success">
                          <span className="student-assignment-success-icon">✓</span>
                          <div>
                            <strong>{assignmentSubmitSuccess}</strong>
                            <p>Your submission is saved. You can close this panel.</p>
                          </div>
                          <button type="button" onClick={closeAssignmentDrawer}>Close</button>
                        </div>
                      ) : (
                        <>
                          {assignmentSubmitError ? (
                            <p className="student-assignment-submit-error">{assignmentSubmitError}</p>
                          ) : null}
                          <div className="student-assignment-drawer-topmeta">
                            <span className={`student-assignment-status ${getAssignmentStatusClass('pending')}`}>Pending</span>
                            <p>
                              Due:{' '}
                              {activeAssignment?.due_at
                                ? new Date(activeAssignment.due_at).toLocaleString([], {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                  })
                                : 'TBD'}
                            </p>
                          </div>

                          <section className="student-assignment-drawer-section">
                            <h5>Description</h5>
                            <p>{activeAssignment?.description || 'Complete and submit your assignment file for evaluation.'}</p>
                          </section>

                          <section className="student-assignment-drawer-section">
                            <h5>Instructions</h5>
                            <ul>
                              <li>Submit your final assignment file in supported format.</li>
                              <li>After submission, trainer will review and share feedback.</li>
                            </ul>
                          </section>

                          <section className="student-assignment-drawer-section">
                            <h5>Submission</h5>
                            <label className="student-assignment-answer-field">
                              <textarea
                                value={submissionText}
                                onChange={(event) => setSubmissionText(event.target.value)}
                                placeholder="Write your notes or answer here..."
                                rows={4}
                              />
                            </label>
                            <button
                              type="button"
                              className={`student-assignment-upload-box ${isDragOver ? 'drag-over' : ''}`}
                              onDragOver={(event) => {
                                event.preventDefault()
                                setIsDragOver(true)
                              }}
                              onDragLeave={() => setIsDragOver(false)}
                              onDrop={(event) => {
                                event.preventDefault()
                                setIsDragOver(false)
                                handleAssignmentFileSelect(event.dataTransfer.files?.[0] ?? null)
                              }}
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Upload size={20} />
                              <strong>Drag &amp; drop your files here</strong>
                              <span>or</span>
                              <em>Choose Files</em>
                              <small>Accepted formats: zip, rar, pdf, docx (Max 50 MB)</small>
                            </button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              className="student-assignment-hidden-file-input"
                              accept=".zip,.rar,.pdf,.doc,.docx"
                              onChange={(event) => handleAssignmentFileSelect(event.target.files?.[0] ?? null)}
                            />
                            {submissionFile ? (
                              <p className="student-assignment-selected-file">Selected: {submissionFile.name}</p>
                            ) : null}
                          </section>
                        </>
                      )}
                        </>
                      )}
                    </div>
                    {!assignmentSubmitSuccess && assignmentDrawerMode !== 'view' ? (
                      <footer>
                        <button type="button" className="student-assignment-cancel" onClick={closeAssignmentDrawer}>Cancel</button>
                        <button type="button" className="student-assignment-submit" onClick={handleAssignmentSubmit} disabled={!submissionFile}>
                          Submit Assignment
                        </button>
                      </footer>
                    ) : null}
                  </aside>
                </section>
              ) : null}

              {batchDetailTab === 'schedule' ? (
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

              {batchDetailTab === 'announcements' ? (
                <section className="student-announcements-list">
                  {selectedBatchAnnouncements.map((item) => {
                    const summary = announcementReactionSummary.get(item.id) ?? {
                      counts: { thumbs_up: 0, fire: 0, clap: 0, heart: 0 },
                      reactedStudentCount: 0,
                    }
                    const myReactions = announcementMyReactions.get(item.id) ?? new Set<AnnouncementReactionType>()
                    const reactionConfig: Array<{ id: AnnouncementReactionType; emoji: string }> = [
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
                            <h4>{item.title}</h4>
                            <p className="student-announcement-meta">
                              {new Date(item.published_at).toLocaleDateString([], { weekday: 'long' })},{' '}
                              {new Date(item.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </p>
                            <p className="student-announcement-body">{item.body}</p>
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
                          <button
                            type="button"
                            className="student-announcement-react-btn"
                            onClick={() =>
                              setOpenReactionAnnouncementId((prev) => (prev === item.id ? null : item.id))
                            }
                          >
                            React
                          </button>
                          {openReactionAnnouncementId === item.id ? (
                            <div className="student-announcement-reaction-picker">
                              {reactionConfig.map((reaction) => (
                                <button
                                  key={reaction.id}
                                  type="button"
                                  className={myReactions.has(reaction.id) ? 'active' : ''}
                                  onClick={() => handleToggleAnnouncementReaction(item.id, reaction.id)}
                                >
                                  {reaction.emoji}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="student-announcement-reacted">
                          <div className="student-announcement-avatars">
                            <span />
                            <span />
                            <span />
                          </div>
                          <p>{summary.reactedStudentCount} students reacted</p>
                        </div>
                      </div>
                    </article>
                    )
                  })}
                </section>
              ) : null}

              {batchDetailTab === 'community' ? (
                selectedBatchId ? (
                  <BatchCommunityChat
                    batchId={selectedBatchId}
                    senderRole={userRole as 'student' | 'trainer' | 'admin'}
                    senderName={displayName ?? 'User'}
                  />
                ) : (
                  <article className="student-v2-panel">
                    <div className="student-v2-panel-head"><h3>Community</h3></div>
                    <div className="student-v2-assignment-block">
                      <p className="empty-state">Select a batch to view community chat.</p>
                    </div>
                  </article>
                )
              ) : null}

              {batchDetailTab === 'materials' ? (
                <article className="student-v2-panel">
                  <div className="student-v2-panel-head"><h3>Materials</h3></div>
                  <div className="student-v2-resource-list">
                    {selectedBatchClassBuckets.completed.map((item) => (
                      <a key={item.id} href={item.recording_url ?? '#'} target="_blank" rel="noreferrer" className="student-v2-resource-item">
                        <div><h4>{item.title}</h4><p>{formatDateTimeShort(item.starts_at)}</p></div>
                        <PlayCircle size={14} />
                      </a>
                    ))}
                  </div>
                </article>
              ) : null}

              {batchDetailTab !== 'assignments' ? (
                <>
                  <div className={`student-assignment-drawer-backdrop ${assignmentDrawerOpen ? 'open' : ''}`} onClick={closeAssignmentDrawer} />
                  <aside className={`student-assignment-drawer ${assignmentDrawerOpen ? 'open' : ''}`}>
                    <header>
                      <div className="student-assignment-drawer-title">
                        <span className="student-assignment-icon">
                          <FileText size={14} />
                        </span>
                        <div className="student-assignment-drawer-title-text">
                          <h4>{activeAssignment?.title ?? 'Assignment'}</h4>
                          <p>Assignment Details</p>
                        </div>
                      </div>
                      <button type="button" onClick={closeAssignmentDrawer} aria-label="Close assignment drawer">
                        <X size={16} />
                      </button>
                    </header>
                    <div className="student-assignment-drawer-body">
                      {assignmentDrawerMode === 'view' ? (
                        <>
                          <section className="student-assignment-drawer-section">
                            <h5>Submission</h5>
                            <div className="student-assignment-view-box">
                              <p className="student-assignment-view-meta">
                                Submitted at: {activeSubmission?.submitted_at ? formatDateTimeShort(activeSubmission.submitted_at) : 'N/A'}
                              </p>
                              <h6>Text Answer</h6>
                              <p>{activeSubmission?.text_answer || 'No text response submitted.'}</p>
                              <h6>Uploaded File</h6>
                              {activeSubmission?.file_url ? (
                                <button
                                  type="button"
                                  className="student-assignment-view-file"
                                  onClick={() => handleOpenSubmittedFile(activeSubmission.file_url as string)}
                                >
                                  View Uploaded File
                                </button>
                              ) : (
                                <p>No file uploaded.</p>
                              )}
                            </div>
                          </section>

                          {(activeSubmission?.feedback || activeSubmission?.feedback_file) ? (
                            <section className="student-assignment-drawer-section">
                              <h5>Feedback</h5>
                              <div className="student-assignment-view-box">
                                <h6>Trainer Comments</h6>
                                <p>{activeSubmission?.feedback || 'No text feedback provided.'}</p>
                                <h6>Review File</h6>
                                {activeSubmission?.feedback_file ? (
                                  <button
                                    type="button"
                                    className="student-assignment-view-file"
                                    onClick={() => handleOpenSubmittedFile(activeSubmission.feedback_file as string)}
                                  >
                                    View Feedback File
                                  </button>
                                ) : (
                                  <p>No feedback file uploaded.</p>
                                )}
                              </div>
                            </section>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {assignmentSubmitSuccess ? (
                            <div className="student-assignment-submit-success">
                              <span className="student-assignment-success-icon">✓</span>
                              <div>
                                <strong>{assignmentSubmitSuccess}</strong>
                                <p>Your submission is saved. You can close this panel.</p>
                              </div>
                              <button type="button" onClick={closeAssignmentDrawer}>Close</button>
                            </div>
                          ) : (
                            <>
                              {assignmentSubmitError ? (
                                <p className="student-assignment-submit-error">{assignmentSubmitError}</p>
                              ) : null}
                              <div className="student-assignment-drawer-topmeta">
                                <span className={`student-assignment-status ${getAssignmentStatusClass('pending')}`}>Pending</span>
                                <p>
                                  Due:{' '}
                                  {activeAssignment?.due_at
                                    ? new Date(activeAssignment.due_at).toLocaleString([], {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true,
                                      })
                                    : 'TBD'}
                                </p>
                              </div>

                              <section className="student-assignment-drawer-section">
                                <h5>Description</h5>
                                <p>{activeAssignment?.description || 'Complete and submit your assignment file for evaluation.'}</p>
                              </section>

                              <section className="student-assignment-drawer-section">
                                <h5>Instructions</h5>
                                <ul>
                                  <li>Submit your final assignment file in supported format.</li>
                                  <li>After submission, trainer will review and share feedback.</li>
                                </ul>
                              </section>

                              <section className="student-assignment-drawer-section">
                                <h5>Submission</h5>
                                <label className="student-assignment-answer-field">
                                  <textarea
                                    value={submissionText}
                                    onChange={(event) => setSubmissionText(event.target.value)}
                                    placeholder="Write your notes or answer here..."
                                    rows={4}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className={`student-assignment-upload-box ${isDragOver ? 'drag-over' : ''}`}
                                  onDragOver={(event) => {
                                    event.preventDefault()
                                    setIsDragOver(true)
                                  }}
                                  onDragLeave={() => setIsDragOver(false)}
                                  onDrop={(event) => {
                                    event.preventDefault()
                                    setIsDragOver(false)
                                    handleAssignmentFileSelect(event.dataTransfer.files?.[0] ?? null)
                                  }}
                                  onClick={() => fileInputRef.current?.click()}
                                >
                                  <Upload size={20} />
                                  <strong>Drag &amp; drop your files here</strong>
                                  <span>or</span>
                                  <em>Choose Files</em>
                                  <small>Accepted formats: zip, rar, pdf, docx (Max 50 MB)</small>
                                </button>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  className="student-assignment-hidden-file-input"
                                  accept=".zip,.rar,.pdf,.doc,.docx"
                                  onChange={(event) => handleAssignmentFileSelect(event.target.files?.[0] ?? null)}
                                />
                                {submissionFile ? (
                                  <p className="student-assignment-selected-file">Selected: {submissionFile.name}</p>
                                ) : null}
                              </section>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    {!assignmentSubmitSuccess && assignmentDrawerMode !== 'view' ? (
                      <footer>
                        <button type="button" className="student-assignment-cancel" onClick={closeAssignmentDrawer}>Cancel</button>
                        <button type="button" className="student-assignment-submit" onClick={handleAssignmentSubmit} disabled={!submissionFile}>
                          Submit Assignment
                        </button>
                      </footer>
                    ) : null}
                  </aside>
                </>
              ) : null}
            </section>
            </section>
          </section>
        ) : (
          <>
        <header className="student-v2-topbar">
          <h2>Dashboard</h2>
          <div className="student-v2-top-actions">
            <label className="student-v2-search">
              <Search size={14} />
              <input placeholder="Search for classes, assignments..." />
            </label>
            <button type="button" className="student-v2-icon-btn">
              <Bell size={16} />
            </button>
            <div className="student-v2-avatar">{firstName[0]?.toUpperCase()}</div>
          </div>
        </header>

        <section className="student-v2-greeting">
          <img
            src="/student-greeting-bg.png"
            alt=""
            className="student-v2-greeting-bg"
            aria-hidden="true"
          />
          <div className="student-v2-greeting-copy">
            <h1>
              Good Evening, <span>{firstName}!</span> 👋
            </h1>
            <p>{dynamicInsight}</p>
            <div className="student-v2-mini-metrics">
              <span className="is-class">
                <CalendarDays size={13} />
                {todayClasses.length} Class Today
              </span>
              <span className="is-assignment">
                <Clock3 size={13} />
                {dueSoonAssignments.length} Assignment Due
              </span>
              <span className="is-streak">
                <Flame size={13} />
                {learningStreakDays} {learningStreakDays === 1 ? 'Day' : 'Days'} Streak
              </span>
            </div>
          </div>
          <img
            src="/student-greeting-boy.png"
            alt="Student greeting illustration"
            className="student-v2-hero-illus"
          />
        </section>

        <section className="student-v2-focus-strip">{focusText}</section>

        <section className="student-v2-continue">
          <p className="student-v2-continue-title">Continue Learning</p>
          <div className="student-v2-continue-body">
            <div className="student-v2-continue-thumb">
              <img src="/course-cover.png" alt="Course cover" />
              <span className="student-v2-continue-play">
                <PlayCircle size={18} />
              </span>
            </div>
            <div className="student-v2-continue-meta">
              <h3>{myBatches[0]?.batch_code ?? 'BAMAR19/26-MADHAV-MORNING'}</h3>
              <p>Last activity: SDLC - Planning</p>
              <div className="student-v2-progress-row">
                <div className="student-v2-progress">
                  <div style={{ width: `${progressPct}%` }} />
                </div>
                <span>{progressPct}%</span>
              </div>
            </div>
            <div className="student-v2-continue-cta">
              <a
                className="student-v2-primary-btn"
                href={primaryContinueClass?.join_url ?? '#'}
                target={primaryContinueClass?.join_url ? '_blank' : undefined}
                rel={primaryContinueClass?.join_url ? 'noreferrer' : undefined}
              >
                <Play size={13} />
                Continue Learning
              </a>
            </div>
          </div>
        </section>

        <section className="student-v2-grid-two">
          <article className="student-v2-panel">
            <div className="student-v2-panel-head">
              <h3>Previous Classes</h3>
              <a href="/student/classes">View All</a>
            </div>
            <div className="student-v2-class-list">
              {liveNowClasses.length ? (
                <article className="student-v2-class-item is-live">
                  <div>
                    <p className="student-v2-status-line">
                      <span className="dot-live" /> Live Now
                    </p>
                    <h4>{liveNowClasses[0].title}</h4>
                    <span>{new Date(liveNowClasses[0].starts_at).toLocaleTimeString()}</span>
                  </div>
                  <button
                    type="button"
                    disabled={joinBusyMeetingId === liveNowClasses[0].zoom_meeting_id}
                    onClick={() => handleJoinClass(liveNowClasses[0])}
                  >
                    Join Now
                  </button>
                </article>
              ) : null}
              {upcomingTodayClasses.map((item) => (
                <article className="student-v2-class-item" key={item.id}>
                  <div>
                    <p className="student-v2-status-line">
                      <CalendarDays size={12} /> {new Date(item.starts_at).toLocaleTimeString()}
                    </p>
                    <h4>{item.title}</h4>
                    <span>{item.trainer_name}</span>
                  </div>
                  <button
                    type="button"
                    disabled={joinBusyMeetingId === item.zoom_meeting_id}
                    onClick={() => handleJoinClass(item)}
                  >
                    Join
                  </button>
                </article>
              ))}
              {pagedPreviousClasses.length ? (
                <div className="student-v2-assignment-block student-v2-recording-block">
                  {pagedPreviousClasses.map((item) => (
                    <article key={item.id} className="student-v2-assignment-item">
                      <div>
                        <h4>{item.title}</h4>
                        <span>{new Date(item.starts_at).toLocaleString()}</span>
                      </div>
                      {item.recording_url ? (
                        <a href={item.recording_url} target="_blank" rel="noreferrer">
                          Watch
                        </a>
                      ) : (
                        <button type="button" disabled>
                          N/A
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              ) : null}
              {previousClasses.length > previousClassesPageSize ? (
                <div className="student-v2-mini-pagination">
                  <button
                    type="button"
                    disabled={previousClassesPage === 1}
                    onClick={() =>
                      setPreviousClassesPage((prev) => Math.max(1, prev - 1))
                    }
                  >
                    ‹
                  </button>
                  <span>
                    {previousClassesPage} / {previousClassesTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={previousClassesPage === previousClassesTotalPages}
                    onClick={() =>
                      setPreviousClassesPage((prev) =>
                        Math.min(previousClassesTotalPages, prev + 1),
                      )
                    }
                  >
                    ›
                  </button>
                </div>
              ) : null}
            </div>
          </article>

          <article className="student-v2-panel">
            <div className="student-v2-panel-head">
              <h3>Announcements</h3>
              <a href="/student/announcements">View All</a>
            </div>
            <div className="student-v2-assignment-block student-v2-announcement-block">
              {announcements.slice(0, 5).map((item) => (
                <article key={item.id} className="student-v2-assignment-item">
                  <div>
                    <h4>{item.title}</h4>
                    <span>{new Date(item.published_at).toLocaleString()}</span>
                  </div>
                  <a href="/student/announcements">View</a>
                </article>
              ))}
              {!announcements.length ? <p className="empty-state">No announcements yet.</p> : null}
            </div>
          </article>
        </section>

        <section className="student-v2-kpi-grid">
          <article className="student-v2-kpi-card">
            <p>Overall Progress</p>
            <h3>{progressPct}%</h3>
            <span>You're above batch average</span>
          </article>
          <article className="student-v2-kpi-card">
            <p>Average Score</p>
            <h3>{avgScore} / 10</h3>
            <span>Batch average: 6.4/10</span>
          </article>
          <article className="student-v2-kpi-card">
            <p>Assignments Completed</p>
            <h3>
              {submittedCount} / {Math.max(assignments.length, 1)}
            </h3>
            <span>Keep submissions on time</span>
          </article>
          <article className="student-v2-kpi-card">
            <p>Attendance</p>
            <h3>{attendancePct}%</h3>
            <span>Great consistency this week</span>
          </article>
        </section>

        <section className="student-v2-grid-two">
          <article className="student-v2-panel">
            <div className="student-v2-panel-head">
              <h3>Recent Activity</h3>
            </div>
            <div className="student-v2-activity-list">
              {activityItems.map((item) => (
                <article key={item.id} className="student-v2-activity-item">
                  <div className="student-v2-activity-icon">
                    <CheckCircle2 size={13} />
                  </div>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.sub}</p>
                  </div>
                  <span>{item.time}</span>
                </article>
              ))}
              {!activityItems.length ? <p className="empty-state">No recent activity.</p> : null}
            </div>
          </article>

          <article className="student-v2-panel">
            <div className="student-v2-panel-head">
              <h3>Quick Resources</h3>
            </div>
            <div className="student-v2-resource-list">
              {resourceItems.map((item) => (
                <a key={item.id} href={item.href} target="_blank" rel="noreferrer" className="student-v2-resource-item">
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.sub}</p>
                  </div>
                  {item.id === 'r1' ? <PlayCircle size={14} /> : item.id === 'r2' ? <FolderOpen size={14} /> : <Link2 size={14} />}
                </a>
              ))}
            </div>
          </article>
        </section>

        <section className="student-v2-footer-banner">
          <div>
            <h3>Stay Consistent, Achieve Your Goals! 🚀</h3>
            <p>You're on the right track. Keep learning every day.</p>
          </div>
          <div className="student-v2-streak-pill">
            <Flame size={16} />
            <span>
              {learningStreakDays} {learningStreakDays === 1 ? 'Day' : 'Days'}
            </span>
          </div>
          <button type="button" className="student-v2-primary-btn">
            View My Progress
          </button>
        </section>
          </>
        )}
      </section>
    </main>
  )
}
