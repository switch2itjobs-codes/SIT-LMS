import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  LogOut,
  Users,
  CalendarDays,
  MessageSquare,
  Handshake,
  LifeBuoy,
  BarChart3,
  UserCog,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
  GraduationCap,
  Briefcase,
  CalendarCheck2,
  UserPlus,
  Megaphone,
  Upload,
  PlusCircle,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AdminStudentsPage } from './AdminStudentsPage'
import { AdminStudentDetailPage } from './AdminStudentDetailPage'
import { AdminBatchesPage } from './AdminBatchesPage'
import {
  AdminBatchDetailPage,
  type BatchDetailTab,
} from './AdminBatchDetailPage'
import { AdminCreateClassPage } from './AdminCreateClassPage'
import { AdminAssignmentDetailPage } from './AdminAssignmentDetailPage'
import { AdminLiveClassDetailPage } from './AdminLiveClassDetailPage'
import { AdminPlaceholderPage } from './AdminPlaceholderPage'
import { AdminPlacementCellPage } from './AdminPlacementCellPage'
import { AdminTrainersPage } from './AdminTrainersPage'

type AdminHomePageProps = {
  session: Session
}

type DashboardClass = {
  id: string
  title: string
  starts_at: string
  status: string | null
}

type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'

type RiskAlertItem = {
  id: string
  severity: RiskSeverity
  title: string
  summary: string
  affected: string
  cta: string
  route: string
  timestamp: string
}

type AdminSearchResult = {
  id: string
  label: string
  sublabel: string
  kind: 'student' | 'batch' | 'class' | 'assignment'
  navigateTo: string
}

type AdminActivityItem = {
  id: string
  title: string
  sub: string
  time: string
}

export function AdminHomePage({ session }: AdminHomePageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const displayName =
    (session.user.user_metadata.full_name as string | undefined) ??
    session.user.email
  const firstName = displayName?.split(' ')[0] ?? 'Admin'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [usersNavOpen, setUsersNavOpen] = useState(false)
  const [upcomingClasses, setUpcomingClasses] = useState<DashboardClass[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [batchCount, setBatchCount] = useState(0)
  const [placementCount, setPlacementCount] = useState(0)
  const [classesTodayCount, setClassesTodayCount] = useState(0)
  const [classesConductedMonthCount, setClassesConductedMonthCount] = useState(0)
  const [averageAttendancePct, setAverageAttendancePct] = useState(0)
  const [interviewsCount, setInterviewsCount] = useState(0)
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0)
  const [atRiskStudentsCount, setAtRiskStudentsCount] = useState(0)
  const [riskAlerts, setRiskAlerts] = useState<RiskAlertItem[]>([])
  const [adminActivity, setAdminActivity] = useState<AdminActivityItem[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<AdminSearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  const onSignOut = async () => {
    await supabase.auth.signOut()
  }

  useEffect(() => {
    const loadMetrics = async () => {
      setLoading(true)
      setError('')
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const endOfToday = new Date(startOfToday)
      endOfToday.setDate(endOfToday.getDate() + 1)
      const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1)
      const endOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 1)
      const startIso = startOfToday.toISOString()
      const endIso = endOfToday.toISOString()
      const monthStartDate = startOfMonth.toISOString().slice(0, 10)
      const monthEndDate = endOfMonth.toISOString().slice(0, 10)

      const [
        studentsCountRes,
        activeBatchCountRes,
        todayClassCountRes,
        monthlyPlacementCountRes,
        monthlyConductedClassesRes,
        monthlyAttendanceRowsRes,
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('batches').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase
          .from('class_sessions')
          .select('*', { count: 'exact', head: true })
          .gte('starts_at', startIso)
          .lt('starts_at', endIso),
        supabase
          .from('placements')
          .select('*', { count: 'exact', head: true })
          .gte('placement_date', monthStartDate)
          .lt('placement_date', monthEndDate),
        supabase
          .from('class_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('starts_at', startOfMonth.toISOString())
          .lt('starts_at', endOfMonth.toISOString()),
        supabase
          .from('class_attendance')
          .select('status,class_sessions!inner(starts_at,status)')
          .gte('class_sessions.starts_at', startOfMonth.toISOString())
          .lt('class_sessions.starts_at', endOfMonth.toISOString())
          .eq('class_sessions.status', 'completed'),
      ])

      const attendanceRows = monthlyAttendanceRowsRes.data ?? []
      const attendedCount = attendanceRows.filter((row) =>
        ['present', 'late', 'excused'].includes(String(row.status ?? '').toLowerCase()),
      ).length
      const attendanceAverage =
        attendanceRows.length > 0 ? Math.round((attendedCount / attendanceRows.length) * 100) : 0

      setStudentCount(studentsCountRes.count ?? 0)
      setBatchCount(activeBatchCountRes.count ?? 0)
      setClassesTodayCount(todayClassCountRes.count ?? 0)
      setPlacementCount(monthlyPlacementCountRes.count ?? 0)
      setClassesConductedMonthCount(monthlyConductedClassesRes.count ?? 0)
      setAverageAttendancePct(attendanceAverage)
      setLoading(false)
    }

    const loadOverviewFeed = async () => {
      const nowIso = new Date().toISOString()
      const now = new Date()
      const daysAgo = (days: number) => {
        const date = new Date(now)
        date.setDate(date.getDate() - days)
        return date.toISOString()
      }
      const nextDaysIso = (days: number) => {
        const date = new Date(now)
        date.setDate(date.getDate() + days)
        return date.toISOString()
      }
      const [
        classesRes,
        pendingReviewsRes,
        atRiskRes,
        interviewsRes,
        studentsRiskRes,
        mockInterviewsRes,
        recentInterviewsRes,
        assignmentsRes,
        submissionsRes,
        activeBatchesRes,
        studentBatchesRes,
        upcomingFiveDaysClassesRes,
        recentStudentsRes,
        recentSubmissionFeedRes,
        recentInterviewFeedRes,
        recentAnnouncementFeedRes,
        recentBatchesFeedRes,
        recentPlacementsFeedRes,
        recentMockInterviewFeedRes,
        recentClassSessionFeedRes,
      ] = await Promise.all([
        supabase
          .from('class_sessions')
          .select('id,title,starts_at,status')
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
          .limit(6),
        supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .is('feedback', null),
        supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .or('attendance_pct.lt.65,progress_pct.lt.50'),
        supabase
          .from('interviews')
          .select('*', { count: 'exact', head: true })
          .in('stage', ['scheduled', 'interviewing']),
        supabase
          .from('students')
          .select(
            'id,student_name,last_activity_at,attendance_pct,progress_pct,resume_url,stage,no_of_applications,no_of_interviews,updated_at',
          ),
        supabase.from('mock_interviews').select('student_id'),
        supabase
          .from('interviews')
          .select('student_id,interview_date')
          .gte('interview_date', daysAgo(30).slice(0, 10)),
        supabase.from('assignments').select('id,batch_id,created_at').order('created_at', { ascending: false }),
        supabase.from('submissions').select('student_id,assignment_id'),
        supabase.from('batches').select('id,batch_code,status').eq('status', 'active'),
        supabase.from('student_batches').select('student_id,batch_id,is_active').eq('is_active', true),
        supabase
          .from('class_sessions')
          .select('id,batch_id,starts_at')
          .gte('starts_at', nowIso)
          .lt('starts_at', nextDaysIso(5)),
        supabase
          .from('students')
          .select('id,student_name,created_at')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('submissions')
          .select('id,student_id,submitted_at,created_at')
          .order('submitted_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('interviews')
          .select('id,student_id,company_name,updated_at,created_at')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('announcements')
          .select('id,title,published_at')
          .order('published_at', { ascending: false })
          .limit(6),
        supabase
          .from('batches')
          .select('id,batch_code,status,created_at,updated_at')
          .order('updated_at', { ascending: false })
          .limit(6),
        supabase
          .from('placements')
          .select('id,student_id,company_name,created_at')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('mock_interviews')
          .select('id,student_id,status,scheduled_at,updated_at,created_at')
          .order('updated_at', { ascending: false })
          .limit(6),
        supabase
          .from('class_sessions')
          .select('id,title,starts_at,zoom_status,recording_url,created_at,updated_at')
          .order('updated_at', { ascending: false })
          .limit(8),
      ])

      if (!classesRes.error) {
        const mappedClasses: DashboardClass[] = (classesRes.data ?? []).map((item) => ({
          id: item.id,
          title: item.title ?? 'Untitled class',
          starts_at: item.starts_at,
          status: item.status ?? null,
        }))
        setUpcomingClasses(mappedClasses)
      }

      setPendingReviewsCount(pendingReviewsRes.count ?? 0)
      setAtRiskStudentsCount(atRiskRes.count ?? 0)
      setInterviewsCount(interviewsRes.count ?? 0)

      const students = studentsRiskRes.data ?? []
      const mockStudentIds = new Set((mockInterviewsRes.data ?? []).map((row) => row.student_id))
      const recentInterviewStudentIds = new Set((recentInterviewsRes.data ?? []).map((row) => row.student_id))
      const activeBatches = activeBatchesRes.data ?? []
      const activeBatchMap = new Map(activeBatches.map((b) => [b.id, b.batch_code]))
      const studentActiveBatchMap = new Map(
        (studentBatchesRes.data ?? []).map((sb) => [sb.student_id, sb.batch_id]),
      )
      const assignmentsByBatch = new Map<string, Array<{ id: string; created_at: string | null }>>()
      for (const assignment of assignmentsRes.data ?? []) {
        if (!assignment.batch_id) continue
        const list = assignmentsByBatch.get(assignment.batch_id) ?? []
        list.push({ id: assignment.id, created_at: assignment.created_at ?? null })
        assignmentsByBatch.set(assignment.batch_id, list)
      }
      const submissionSet = new Set(
        (submissionsRes.data ?? []).map((row) => `${row.student_id}:${row.assignment_id}`),
      )
      const upcomingBatchSet = new Set((upcomingFiveDaysClassesRes.data ?? []).map((row) => row.batch_id))

      const criticalInactive = students.filter(
        (s) => s.last_activity_at && new Date(s.last_activity_at).getTime() < new Date(daysAgo(10)).getTime(),
      )
      const warningInactive = students.filter(
        (s) =>
          s.last_activity_at &&
          new Date(s.last_activity_at).getTime() < new Date(daysAgo(5)).getTime() &&
          new Date(s.last_activity_at).getTime() >= new Date(daysAgo(10)).getTime(),
      )
      const attendanceCritical = students.filter(
        (s) => typeof s.attendance_pct === 'number' && s.attendance_pct < 60,
      )
      const attendanceWarning = students.filter(
        (s) => typeof s.attendance_pct === 'number' && s.attendance_pct >= 60 && s.attendance_pct < 75,
      )
      const interviewReadinessRisk = students.filter(
        (s) => !s.resume_url || !mockStudentIds.has(s.id),
      )
      const noInterviewCalls = students.filter(
        (s) =>
          ['training', 'searching_for_jobs', 'taking_interviews', 'mock_interviews'].includes(String(s.stage ?? '')) &&
          !recentInterviewStudentIds.has(s.id),
      )
      const resumeNotShortlisted = students.filter(
        (s) => Number(s.no_of_applications ?? 0) >= 10 && Number(s.no_of_interviews ?? 0) === 0,
      )
      const placementStagnation = students.filter(
        (s) =>
          String(s.stage ?? '') === 'searching_for_jobs' &&
          s.updated_at &&
          new Date(s.updated_at).getTime() < new Date(daysAgo(45)).getTime(),
      )
      const noSubmissionTwoTasks = students.filter((s) => {
        const batchId = studentActiveBatchMap.get(s.id)
        if (!batchId) return false
        const assignments = (assignmentsByBatch.get(batchId) ?? []).slice(0, 2)
        if (assignments.length < 2) return false
        return assignments.every((a) => !submissionSet.has(`${s.id}:${a.id}`))
      })
      const noUpcomingClassBatches = activeBatches.filter((b) => !upcomingBatchSet.has(b.id))

      const alerts: RiskAlertItem[] = [
        {
          id: 'inactive-critical',
          severity: 'critical',
          title: `${criticalInactive.length} students inactive for 10+ days`,
          summary: 'Immediate follow-up required',
          affected: criticalInactive.length > 0 ? `Affected: ${criticalInactive.length} students` : 'Affected: none',
          cta: 'Open Students',
          route: '/admin/students',
          timestamp: 'Today',
        },
        {
          id: 'inactive-warning',
          severity: 'medium',
          title: `${warningInactive.length} students inactive for 5+ days`,
          summary: 'Warning threshold reached',
          affected: `Affected: ${warningInactive.length} students`,
          cta: 'Notify Trainers',
          route: '/admin/users/trainers',
          timestamp: 'Today',
        },
        {
          id: 'attendance-risk',
          severity: attendanceCritical.length > 0 ? 'critical' : 'high',
          title: `Attendance risk: ${attendanceCritical.length} critical, ${attendanceWarning.length} warning`,
          summary: 'Students may become disengaged',
          affected: `Affected: ${attendanceCritical.length + attendanceWarning.length} students`,
          cta: 'View Batch',
          route: '/admin/batches',
          timestamp: 'Today',
        },
        {
          id: 'assignment-miss',
          severity: noSubmissionTwoTasks.length > 0 ? 'high' : 'low',
          title: `${noSubmissionTwoTasks.length} students missed 2 consecutive assignments`,
          summary: 'No assignment submission risk',
          affected: `Affected: ${noSubmissionTwoTasks.length} students`,
          cta: 'Review Assignments',
          route: '/admin/batches',
          timestamp: 'Today',
        },
        {
          id: 'interview-readiness',
          severity: interviewReadinessRisk.length > 0 ? 'medium' : 'low',
          title: `${interviewReadinessRisk.length} students not interview-ready`,
          summary: 'Resume incomplete or mock interview not attempted',
          affected: `Affected: ${interviewReadinessRisk.length} students`,
          cta: 'Open Placement',
          route: '/admin/placement',
          timestamp: 'Today',
        },
        {
          id: 'no-interview-calls',
          severity: noInterviewCalls.length > 0 ? 'critical' : 'low',
          title: `${noInterviewCalls.length} trained students with no interview calls in 30 days`,
          summary: 'Very important placement escalation',
          affected: `Affected: ${noInterviewCalls.length} students`,
          cta: 'Open Placement',
          route: '/admin/placement',
          timestamp: 'Today',
        },
        {
          id: 'resume-shortlist',
          severity: resumeNotShortlisted.length > 0 ? 'high' : 'low',
          title: `${resumeNotShortlisted.length} students have 10+ applications with 0 callbacks`,
          summary: 'Resume not shortlisted risk',
          affected: `Affected: ${resumeNotShortlisted.length} students`,
          cta: 'Review Profiles',
          route: '/admin/students',
          timestamp: 'Yesterday',
        },
        {
          id: 'placement-stagnation',
          severity: placementStagnation.length > 0 ? 'high' : 'low',
          title: `${placementStagnation.length} students stagnating in placement phase (45+ days)`,
          summary: 'No progress detected in placement journey',
          affected: `Affected: ${placementStagnation.length} students`,
          cta: 'Open Placement',
          route: '/admin/placement',
          timestamp: 'Earlier',
        },
        {
          id: 'batch-no-upcoming',
          severity: noUpcomingClassBatches.length > 0 ? 'high' : 'low',
          title: `${noUpcomingClassBatches.length} active batches have no classes in next 5 days`,
          summary: 'Batch scheduling risk',
          affected:
            noUpcomingClassBatches.length > 0
              ? `Affected: ${noUpcomingClassBatches.slice(0, 2).map((b) => activeBatchMap.get(b.id) ?? b.batch_code).join(', ')}`
              : 'Affected: none',
          cta: 'Schedule Classes',
          route: '/admin/batches',
          timestamp: 'Today',
        },
      ]
      setRiskAlerts(alerts.filter((alert) => !alert.title.startsWith('0 ') && !alert.title.includes('none')))

      const submissionFeed = recentSubmissionFeedRes.data ?? []
      const interviewFeed = recentInterviewFeedRes.data ?? []
      const feedStudentIds = Array.from(
        new Set(
          [...submissionFeed.map((s) => s.student_id), ...interviewFeed.map((i) => i.student_id)].filter(Boolean),
        ),
      )
      const studentNamesRes = feedStudentIds.length
        ? await supabase.from('students').select('id,student_name').in('id', feedStudentIds)
        : { data: [] as Array<{ id: string; student_name: string | null }> }
      const studentNameMap = new Map((studentNamesRes.data ?? []).map((s) => [s.id, s.student_name ?? 'Student']))

      const dynamicFeed: Array<AdminActivityItem & { at: number }> = []
      for (const row of recentStudentsRes.data ?? []) {
        const atValue = row.created_at ? new Date(row.created_at).getTime() : Date.now()
        dynamicFeed.push({
          id: `student-${row.id}`,
          title: `New student ${row.student_name ?? 'Student'} added`,
          sub: 'Student onboarding updated in cohort records.',
          time: formatRelativeTime(row.created_at),
          at: atValue,
        })
      }
      for (const row of submissionFeed) {
        const atIso = row.submitted_at ?? row.created_at
        const atValue = atIso ? new Date(atIso).getTime() : Date.now()
        dynamicFeed.push({
          id: `submission-${row.id}`,
          title: `Assignment submitted by ${studentNameMap.get(row.student_id) ?? 'Student'}`,
          sub: 'Submission pending trainer review.',
          time: formatRelativeTime(atIso),
          at: atValue,
        })
      }
      for (const row of interviewFeed) {
        const atIso = row.updated_at ?? row.created_at
        const atValue = atIso ? new Date(atIso).getTime() : Date.now()
        dynamicFeed.push({
          id: `interview-${row.id}`,
          title: `Placement interview scheduled for ${studentNameMap.get(row.student_id) ?? 'Student'}`,
          sub: row.company_name ? `Company: ${row.company_name}` : 'Interview stage updated in placement cell.',
          time: formatRelativeTime(atIso),
          at: atValue,
        })
      }
      for (const row of recentAnnouncementFeedRes.data ?? []) {
        const atIso = row.published_at
        const atValue = atIso ? new Date(atIso).getTime() : Date.now()
        dynamicFeed.push({
          id: `announcement-${row.id}`,
          title: `Announcement published: ${row.title ?? 'Update'}`,
          sub: 'Communication sent to all relevant users.',
          time: formatRelativeTime(atIso),
          at: atValue,
        })
      }
      for (const row of recentBatchesFeedRes.data ?? []) {
        const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0
        const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : createdAt
        const isCreatedEvent = Math.abs(updatedAt - createdAt) < 5 * 60 * 1000
        dynamicFeed.push({
          id: `batch-${row.id}`,
          title: isCreatedEvent
            ? `Batch created: ${row.batch_code ?? 'Unnamed batch'}`
            : `Batch updated: ${row.batch_code ?? 'Unnamed batch'}`,
          sub: `Status: ${row.status ?? 'active'}`,
          time: formatRelativeTime(row.updated_at ?? row.created_at),
          at: updatedAt || createdAt || Date.now(),
        })
      }
      for (const row of recentPlacementsFeedRes.data ?? []) {
        const atIso = row.created_at
        const atValue = atIso ? new Date(atIso).getTime() : Date.now()
        dynamicFeed.push({
          id: `placement-${row.id}`,
          title: `Placement achieved for ${studentNameMap.get(row.student_id) ?? 'Student'}`,
          sub: row.company_name ? `Company: ${row.company_name}` : 'Placement record added.',
          time: formatRelativeTime(atIso),
          at: atValue,
        })
      }
      for (const row of recentMockInterviewFeedRes.data ?? []) {
        const atIso = row.updated_at ?? row.created_at
        const atValue = atIso ? new Date(atIso).getTime() : Date.now()
        const statusText = String(row.status ?? '').toLowerCase()
        dynamicFeed.push({
          id: `mock-${row.id}`,
          title:
            statusText === 'completed'
              ? `Mock interview completed for ${studentNameMap.get(row.student_id) ?? 'Student'}`
              : `Mock interview scheduled for ${studentNameMap.get(row.student_id) ?? 'Student'}`,
          sub:
            row.scheduled_at
              ? `Scheduled at: ${new Date(row.scheduled_at).toLocaleString()}`
              : 'Mock interview workflow updated.',
          time: formatRelativeTime(atIso),
          at: atValue,
        })
      }
      for (const row of recentClassSessionFeedRes.data ?? []) {
        const atIso = row.updated_at ?? row.created_at ?? row.starts_at
        const atValue = atIso ? new Date(atIso).getTime() : Date.now()
        const nowTs = Date.now()
        const startTs = row.starts_at ? new Date(row.starts_at).getTime() : 0
        const zoomStatus = String(row.zoom_status ?? '').toLowerCase()
        let title = `Live class scheduled: ${row.title ?? 'Untitled class'}`
        if (zoomStatus.includes('cancel')) {
          title = `Live class cancelled: ${row.title ?? 'Untitled class'}`
        } else if (row.recording_url || startTs < nowTs - 90 * 60 * 1000) {
          title = `Live class conducted: ${row.title ?? 'Untitled class'}`
        }
        dynamicFeed.push({
          id: `class-feed-${row.id}`,
          title,
          sub: row.starts_at ? `Class time: ${new Date(row.starts_at).toLocaleString()}` : 'Class event updated.',
          time: formatRelativeTime(atIso),
          at: atValue,
        })
      }
      dynamicFeed.sort((a, b) => b.at - a.at)
      setAdminActivity(dynamicFeed.slice(0, 8).map(({ at, ...item }) => item))
    }

    void loadMetrics()
    void loadOverviewFeed()
  }, [])

  useEffect(() => {
    if (location.pathname === '/admin' || location.pathname === '/admin/') {
      navigate('/admin/overview', { replace: true })
    }
  }, [location.pathname, navigate])

  const adminPath =
    location.pathname === '/admin' ? '/admin/overview' : location.pathname
  const match = adminPath.match(
    /^\/admin\/batches\/([^/]+)(?:\/(overview|live-classes|students|schedule|announcements|community|assignments))?\/?$/,
  )
  const batchIdFromPath = match?.[1] ?? null
  const batchTabFromPath = (match?.[2] as BatchDetailTab | undefined) ?? 'overview'
  const createClassMatch = adminPath.match(/^\/admin\/batches\/([^/]+)\/create-class\/?$/)
  const createClassBatchId = createClassMatch?.[1] ?? null
  const assignmentDetailMatch = adminPath.match(
    /^\/admin\/batches\/([^/]+)\/assignments\/([^/]+)\/?$/,
  )
  const assignmentBatchId = assignmentDetailMatch?.[1] ?? null
  const assignmentIdFromPath = assignmentDetailMatch?.[2] ?? null
  const classDetailMatch = adminPath.match(
    /^\/admin\/batches\/([^/]+)\/classes\/([^/]+)\/?$/,
  )
  const classBatchId = classDetailMatch?.[1] ?? null
  const classSessionIdFromPath = classDetailMatch?.[2] ?? null

  const studentDetailMatch = adminPath.match(/^\/admin\/students\/([^/]+)\/?$/)
  const studentIdFromPath = studentDetailMatch?.[1] ?? null

  type AdminSection =
    | 'overview'
    | 'students'
    | 'student-detail'
    | 'batches'
    | 'batch-detail'
    | 'batch-create-class'
    | 'assignment-detail'
    | 'class-detail'
    | 'communication'
    | 'placement'
    | 'support'
    | 'reports'
    | 'users-trainers'
    | 'users-admins'
    | 'settings'

  const section: AdminSection = createClassBatchId
    ? 'batch-create-class'
    : assignmentIdFromPath
      ? 'assignment-detail'
      : classSessionIdFromPath
        ? 'class-detail'
    : batchIdFromPath
    ? 'batch-detail'
    : studentIdFromPath
      ? 'student-detail'
      : adminPath === '/admin/students'
        ? 'students'
        : adminPath === '/admin/batches'
        ? 'batches'
        : adminPath === '/admin/communication'
          ? 'communication'
          : adminPath === '/admin/placement'
            ? 'placement'
            : adminPath === '/admin/support'
              ? 'support'
              : adminPath === '/admin/reports'
                ? 'reports'
                : adminPath === '/admin/users/trainers'
                  ? 'users-trainers'
                  : adminPath === '/admin/users/admins'
                    ? 'users-admins'
                    : adminPath === '/admin/settings'
                      ? 'settings'
                      : 'overview'
  const isBatchWorkspaceView = section === 'batch-detail' && Boolean(batchIdFromPath)
  const greetingByHour = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  })()
  const formatRelativeTime = (isoLike: string | null | undefined) => {
    if (!isoLike) return 'just now'
    const value = new Date(isoLike).getTime()
    if (!Number.isFinite(value)) return 'just now'
    const diffMs = Date.now() - value
    if (diffMs < 60_000) return 'just now'
    const diffMin = Math.floor(diffMs / 60_000)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}d ago`
  }
  const operationCards = [
    {
      id: 'op1',
      title: 'Assignment Reviews',
      description: 'Submissions waiting for your feedback',
      count: pendingReviewsCount,
      cta: 'Review Now',
      icon: <ClipboardCheck size={16} />,
      onClick: () => navigate('/admin/batches'),
    },
    {
      id: 'op2',
      title: 'Students At Risk',
      description: 'Students need immediate attention',
      count: atRiskStudentsCount,
      cta: 'View Students',
      icon: <ShieldAlert size={16} />,
      onClick: () => navigate('/admin/students'),
    },
    {
      id: 'op4',
      title: 'Current Interviews',
      description: 'Interviews scheduled for students',
      count: interviewsCount,
      cta: 'View Interviews',
      icon: <Briefcase size={16} />,
      onClick: () => navigate('/admin/placement'),
    },
    {
      id: 'op5',
      title: 'Resume Reviews',
      description: 'Resumes pending review',
      count: Math.max(0, Math.round(pendingReviewsCount * 0.6)),
      cta: 'Review Resumes',
      icon: <Users size={16} />,
      onClick: () => navigate('/admin/placement'),
    },
  ]
  useEffect(() => {
    if (adminPath.startsWith('/admin/users')) {
      setUsersNavOpen(true)
    }
  }, [adminPath])

  useEffect(() => {
    const query = searchText.trim()
    if (query.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)

    const timer = setTimeout(async () => {
      const like = `%${query}%`
      const [studentsRes, batchesRes, classesRes, assignmentsRes] = await Promise.all([
        supabase
          .from('students')
          .select('id,student_name,email')
          .or(`student_name.ilike.${like},email.ilike.${like}`)
          .limit(6),
        supabase
          .from('batches')
          .select('id,batch_code,status')
          .ilike('batch_code', like)
          .limit(6),
        supabase
          .from('class_sessions')
          .select('id,title,batch_id,starts_at')
          .ilike('title', like)
          .limit(6),
        supabase
          .from('assignments')
          .select('id,title,batch_id')
          .ilike('title', like)
          .limit(6),
      ])

      if (cancelled) return

      const studentItems: AdminSearchResult[] = (studentsRes.data ?? []).map((item) => ({
        id: `student-${item.id}`,
        label: item.student_name ?? 'Unnamed student',
        sublabel: item.email ? `Student • ${item.email}` : 'Student',
        kind: 'student',
        navigateTo: `/admin/students/${item.id}`,
      }))

      const batchItems: AdminSearchResult[] = (batchesRes.data ?? []).map((item) => ({
        id: `batch-${item.id}`,
        label: item.batch_code ?? 'Unnamed batch',
        sublabel: `Batch • ${item.status ?? 'unknown status'}`,
        kind: 'batch',
        navigateTo: `/admin/batches/${item.id}/overview`,
      }))

      const classItems: AdminSearchResult[] = (classesRes.data ?? []).map((item) => ({
        id: `class-${item.id}`,
        label: item.title ?? 'Untitled class',
        sublabel: `Class • ${item.starts_at ? new Date(item.starts_at).toLocaleString() : 'No time'}`,
        kind: 'class',
        navigateTo: item.batch_id ? `/admin/batches/${item.batch_id}/classes/${item.id}` : '/admin/batches',
      }))

      const assignmentItems: AdminSearchResult[] = (assignmentsRes.data ?? []).map((item) => ({
        id: `assignment-${item.id}`,
        label: item.title ?? 'Untitled assignment',
        sublabel: 'Assignment',
        kind: 'assignment',
        navigateTo: item.batch_id ? `/admin/batches/${item.batch_id}/assignments/${item.id}` : '/admin/batches',
      }))

      setSearchResults(
        [...studentItems, ...batchItems, ...classItems, ...assignmentItems].slice(0, 10),
      )
      setSearchLoading(false)
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchText])

  if (loading) {
    return <div className="center-screen dashboard-loading">Loading admin overview...</div>
  }

  if (error) {
    return (
      <main className="auth-layout">
        <section className="card home-card">
          <h1>Admin dashboard error</h1>
          <p className="error">{error}</p>
          <button onClick={onSignOut}>Sign Out</button>
        </section>
      </main>
    )
  }

  return (
    <main
      className={`student-layout ${
        isBatchWorkspaceView ? 'admin-batch-workspace-shell' : ''
      }`}
    >
      {!isBatchWorkspaceView ? (
      <aside className="student-sidebar admin-ds-sidebar">
        <div>
          <div className="brand">
            <img src="/sit-logo.png" alt="SIT logo" className="brand-logo" />
            <span>Admin Panel</span>
          </div>
          <nav className="sidebar-nav">
            <button
              className={`sidebar-item ${
                section === 'overview' ? 'active' : ''
              }`}
              onClick={() => {
                navigate('/admin/overview')
              }}
            >
              <LayoutDashboard size={16} />
              Overview
            </button>
            <button
              className={`sidebar-item ${
                section === 'students' || section === 'student-detail'
                  ? 'active'
                  : ''
              }`}
              onClick={() => {
                navigate('/admin/students')
              }}
            >
              <Users size={16} />
              Students
            </button>
            <button
              className={`sidebar-item ${
                section === 'batches' || section === 'batch-detail'
                  ? 'active'
                  : ''
              }`}
              onClick={() => {
                navigate('/admin/batches')
              }}
            >
              <CalendarDays size={16} />
              Batches
            </button>
            <button
              className={`sidebar-item ${
                section === 'communication' ? 'active' : ''
              }`}
              type="button"
              onClick={() => navigate('/admin/communication')}
            >
              <MessageSquare size={16} />
              Communication
            </button>
            <button
              className={`sidebar-item ${
                section === 'placement' ? 'active' : ''
              }`}
              type="button"
              onClick={() => navigate('/admin/placement')}
            >
              <Handshake size={16} />
              Placement Cell
            </button>
            <button
              className={`sidebar-item ${
                section === 'support' ? 'active' : ''
              }`}
              type="button"
              onClick={() => navigate('/admin/support')}
            >
              <LifeBuoy size={16} />
              Support
            </button>
            <button
              className={`sidebar-item ${
                section === 'reports' ? 'active' : ''
              }`}
              type="button"
              onClick={() => navigate('/admin/reports')}
            >
              <BarChart3 size={16} />
              Reports
            </button>

            <div className="sidebar-nav-group">
              <button
                type="button"
                className={`sidebar-item sidebar-parent ${
                  section === 'users-trainers' || section === 'users-admins'
                    ? 'active'
                    : ''
                }`}
                onClick={() => setUsersNavOpen((open) => !open)}
              >
                <UserCog size={16} />
                <span className="sidebar-parent-label">Users</span>
                {usersNavOpen ? (
                  <ChevronDown size={16} className="sidebar-chevron" />
                ) : (
                  <ChevronRight size={16} className="sidebar-chevron" />
                )}
              </button>
              {usersNavOpen ? (
                <div className="sidebar-subnav">
                  <button
                    type="button"
                    className={`sidebar-item sidebar-subitem ${
                      section === 'users-trainers' ? 'active' : ''
                    }`}
                    onClick={() => navigate('/admin/users/trainers')}
                  >
                    Trainers
                  </button>
                  <button
                    type="button"
                    className={`sidebar-item sidebar-subitem ${
                      section === 'users-admins' ? 'active' : ''
                    }`}
                    onClick={() => navigate('/admin/users/admins')}
                  >
                    Admins
                  </button>
                </div>
              ) : null}
            </div>

            <button
              className={`sidebar-item ${
                section === 'settings' ? 'active' : ''
              }`}
              type="button"
              onClick={() => navigate('/admin/settings')}
            >
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

      <section
        className={`student-content ${
          section === 'student-detail' ? 'student-content-wide' : ''
        } ${isBatchWorkspaceView ? 'admin-batch-workspace-content' : ''} ${
          section === 'placement' ? 'admin-placement-shell' : ''
        } ${section === 'overview' ? 'admin-ds-content' : ''}`}
      >
        {section === 'overview' ? (
          <>
            <div className="admin-ds-overview">
              <header className="student-v2-topbar admin-ds-utility">
                <h2 className="admin-ds-page-title">Admin Dashboard</h2>
                <div className="student-v2-top-actions">
                  <label className="student-v2-search admin-mc-search">
                    <Search size={14} />
                    <input
                      placeholder="Search students, batches, classes..."
                      value={searchText}
                      onChange={(event) => {
                        setSearchText(event.target.value)
                        setSearchOpen(true)
                      }}
                      onFocus={() => setSearchOpen(true)}
                    />
                    {searchOpen ? (
                      <div className="admin-mc-search-results">
                        {searchLoading ? <p className="admin-mc-search-empty">Searching...</p> : null}
                        {!searchLoading && !searchResults.length && searchText.trim().length >= 2 ? (
                          <p className="admin-mc-search-empty">No results found.</p>
                        ) : null}
                        {!searchLoading
                          ? searchResults.map((result) => (
                              <button
                                key={result.id}
                                type="button"
                                className="admin-mc-search-item"
                                onClick={() => {
                                  navigate(result.navigateTo)
                                  setSearchOpen(false)
                                  setSearchText('')
                                }}
                              >
                                <strong>{result.label}</strong>
                                <span>{result.sublabel}</span>
                              </button>
                            ))
                          : null}
                      </div>
                    ) : null}
                  </label>
                  <button
                    type="button"
                    className="student-v2-icon-btn"
                    onClick={() => setNotificationsOpen(true)}
                  >
                    <Bell size={16} />
                  </button>
                  <div className="student-v2-avatar">{firstName[0]?.toUpperCase()}</div>
                </div>
              </header>

              <section className="admin-mc-hero">
                <div className="admin-mc-hero-left">
                  <h1>
                    {greetingByHour}, {firstName}! 👋
                  </h1>
                  <p>Here&apos;s what&apos;s happening with your institute today.</p>
                  <div className="admin-mc-hero-stats">
                    <span><CalendarDays size={14} /> {batchCount} Active Batches</span>
                    <span><GraduationCap size={14} /> {classesTodayCount} Classes Today</span>
                    <span><Briefcase size={14} /> {interviewsCount} Interviews</span>
                  </div>
                </div>
                <img
                  src="/student-greeting-boy.png"
                  alt="Admin dashboard illustration"
                  className="admin-mc-hero-illus"
                />
              </section>

              <section className="admin-mc-upper-grid">
                <div className="admin-mc-left-stack">
                  <section className="admin-mc-action-center">
                    <div className="panel-head-row">
                      <div>
                        <h3>Action Center</h3>
                        <p>Your priority actions</p>
                      </div>
                      <div className="admin-mc-action-nav">
                        <button type="button" aria-label="Previous actions">
                          <ChevronLeft size={14} />
                        </button>
                        <button type="button" aria-label="Next actions">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="admin-mc-action-cards">
                      {operationCards.map((card) => (
                        <article key={card.id} className="admin-mc-action-card">
                          <div className="admin-mc-action-top">
                            <span className="icon">{card.icon}</span>
                            <strong>{card.count}</strong>
                          </div>
                          <h4>{card.title}</h4>
                          <p>{card.description}</p>
                          <button type="button" onClick={card.onClick}>{card.cta}</button>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="admin-mc-kpi-grid">
                    <article className="admin-mc-kpi-card">
                      <p>Student Base</p>
                      <h3>{studentCount}</h3>
                      <span>total students</span>
                      <div className="sparkline blue"><i /><i /><i /><i /><i /></div>
                    </article>
                    <article className="admin-mc-kpi-card">
                      <p>Placement Outcomes</p>
                      <h3>{placementCount}</h3>
                      <span>this month</span>
                      <div className="sparkline green"><i /><i /><i /><i /><i /></div>
                    </article>
                    <article className="admin-mc-kpi-card">
                      <p>Classes Conducted</p>
                  <h3>{classesConductedMonthCount}</h3>
                      <span>this month</span>
                      <div className="sparkline purple"><i /><i /><i /><i /><i /></div>
                    </article>
                    <article className="admin-mc-kpi-card">
                      <p>Average Attendance</p>
                  <h3>{averageAttendancePct}%</h3>
                      <span>this month</span>
                      <div className="sparkline orange"><i /><i /><i /><i /><i /></div>
                    </article>
                  </section>
                </div>

                <aside className="admin-mc-right-column">
                  <section className="admin-mc-alerts admin-mc-alerts-tall">
                    <div className="panel-head-row">
                      <h3>Alerts & Notifications</h3>
                    </div>
                    {riskAlerts.map((alert) => (
                      <article key={alert.id} className={`admin-mc-alert-item severity-${alert.severity}`}>
                        <span className="admin-mc-alert-dot" aria-hidden="true" />
                        <div>
                          <h4>{alert.title}</h4>
                          <p>{alert.summary}</p>
                          <small>{alert.affected}</small>
                          <button type="button" onClick={() => navigate(alert.route)}>{alert.cta}</button>
                        </div>
                        <span>{alert.timestamp}</span>
                      </article>
                    ))}
                  </section>
                </aside>
              </section>

              <section className="admin-mc-bottom-grid">
                <article className="admin-mc-bottom-unified">
                  <section className="admin-mc-bottom-col">
                    <h3>Quick Actions</h3>
                    <div className="admin-mc-quick-actions admin-mc-quick-actions-inline">
                      <button type="button" onClick={() => navigate('/admin/batches')}><PlusCircle size={15} /> Create New Batch</button>
                      <button type="button" onClick={() => navigate('/admin/batches')}><CalendarCheck2 size={15} /> Schedule Class</button>
                      <button type="button" onClick={() => navigate('/admin/placement')}><Briefcase size={15} /> Add Placement</button>
                      <button type="button" onClick={() => navigate('/admin/communication')}><Megaphone size={15} /> Broadcast Announcement</button>
                      <button type="button" onClick={() => navigate('/admin/students')}><UserPlus size={15} /> Add Student</button>
                      <button type="button" onClick={() => navigate('/admin/batches')}><Upload size={15} /> Upload Material</button>
                    </div>
                  </section>

                  <section className="admin-mc-bottom-col">
                    <div className="panel-head-row">
                      <h3>Upcoming Classes</h3>
                    </div>
                    <div className="admin-mc-classes admin-mc-col-scroll">
                      {upcomingClasses.slice(0, 4).map((item) => (
                        <div key={item.id}>
                          <span>{new Date(item.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <div>
                            <h4>{item.title}</h4>
                            <p>{item.status ?? 'Upcoming'}</p>
                          </div>
                          <button type="button" onClick={() => navigate('/admin/batches')}>Open</button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="admin-mc-bottom-col">
                    <h3>Recent Activity</h3>
                    <div className="admin-mc-activity admin-mc-col-scroll">
                      {adminActivity.map((item) => (
                        <div key={item.id}>
                          <CheckCircle2 size={14} />
                          <div>
                            <h4>{item.title}</h4>
                            <p>{item.sub}</p>
                          </div>
                          <span>{item.time}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </article>
              </section>

              {notificationsOpen ? (
                <div className="admin-mc-notification-overlay" onClick={() => setNotificationsOpen(false)}>
                  <aside className="admin-mc-notification-drawer" onClick={(event) => event.stopPropagation()}>
                    <header>
                      <h3>Notifications</h3>
                      <button type="button" onClick={() => setNotificationsOpen(false)}>
                        <X size={16} />
                      </button>
                    </header>
                    <section>
                      <h4>Today</h4>
                      {riskAlerts
                        .filter((alert) => alert.timestamp === 'Today')
                        .map((alert) => (
                          <article key={`today-${alert.id}`} className={`severity-${alert.severity}`}>
                            <div>
                              <strong>{alert.title}</strong>
                              <p>{alert.summary}</p>
                            </div>
                            <button type="button" onClick={() => navigate(alert.route)}>Open</button>
                          </article>
                        ))}
                    </section>
                    <section>
                      <h4>Yesterday</h4>
                      {riskAlerts
                        .filter((alert) => alert.timestamp === 'Yesterday')
                        .map((alert) => (
                          <article key={`y-${alert.id}`} className={`severity-${alert.severity}`}>
                            <div>
                              <strong>{alert.title}</strong>
                              <p>{alert.summary}</p>
                            </div>
                            <button type="button" onClick={() => navigate(alert.route)}>Open</button>
                          </article>
                        ))}
                    </section>
                    <section>
                      <h4>Earlier</h4>
                      {riskAlerts
                        .filter((alert) => alert.timestamp === 'Earlier')
                        .map((alert) => (
                          <article key={`e-${alert.id}`} className={`severity-${alert.severity}`}>
                            <div>
                              <strong>{alert.title}</strong>
                              <p>{alert.summary}</p>
                            </div>
                            <button type="button" onClick={() => navigate(alert.route)}>Open</button>
                          </article>
                        ))}
                    </section>
                  </aside>
                </div>
              ) : null}
            </div>
          </>
        ) : section === 'student-detail' && studentIdFromPath ? (
          <AdminStudentDetailPage
            studentId={studentIdFromPath}
            onBack={() => navigate('/admin/students')}
          />
        ) : section === 'students' ? (
          <AdminStudentsPage />
        ) : section === 'batches' ? (
          <AdminBatchesPage
            onOpenBatch={(id, code) => {
              navigate(`/admin/batches/${id}/overview`, {
                state: { batchCode: code },
              })
            }}
          />
        ) : section === 'batch-create-class' && createClassBatchId ? (
          <AdminCreateClassPage
            batchId={createClassBatchId}
            onBack={() => navigate(`/admin/batches/${createClassBatchId}/live-classes`)}
            onCreated={() => navigate(`/admin/batches/${createClassBatchId}/live-classes`)}
          />
        ) : section === 'assignment-detail' && assignmentIdFromPath && assignmentBatchId ? (
          <AdminAssignmentDetailPage
            assignmentId={assignmentIdFromPath}
            batchId={assignmentBatchId}
            onBack={() => navigate(`/admin/batches/${assignmentBatchId}/live-classes`)}
          />
        ) : section === 'class-detail' && classSessionIdFromPath && classBatchId ? (
          <AdminLiveClassDetailPage
            classSessionId={classSessionIdFromPath}
            batchId={classBatchId}
            onBack={() => navigate(`/admin/batches/${classBatchId}/live-classes`)}
          />
        ) : section === 'batch-detail' && batchIdFromPath ? (
          <AdminBatchDetailPage
            batchId={batchIdFromPath}
            initialBatchCode={
              (location.state as { batchCode?: string } | null)?.batchCode
            }
            initialTab={batchTabFromPath}
            onTabChange={(tab) => navigate(`/admin/batches/${batchIdFromPath}/${tab}`)}
            onOpenCreateClass={() =>
              navigate(`/admin/batches/${batchIdFromPath}/create-class`)
            }
            onOpenAssignment={(assignmentId, sourceBatchId) =>
              navigate(`/admin/batches/${sourceBatchId}/assignments/${assignmentId}`)
            }
            onOpenClassDetail={(classSessionId) =>
              navigate(`/admin/batches/${batchIdFromPath}/classes/${classSessionId}`)
            }
            onBack={() => {
              navigate('/admin/batches')
            }}
          />
        ) : section === 'communication' ? (
          <AdminPlaceholderPage title="Communication" />
        ) : section === 'placement' ? (
          <AdminPlacementCellPage />
        ) : section === 'support' ? (
          <AdminPlaceholderPage title="Support" />
        ) : section === 'reports' ? (
          <AdminPlaceholderPage title="Reports" />
        ) : section === 'users-trainers' ? (
          <AdminTrainersPage />
        ) : section === 'users-admins' ? (
          <AdminPlaceholderPage title="Users · Admins" />
        ) : section === 'settings' ? (
          <AdminPlaceholderPage title="Settings" />
        ) : null}
      </section>
    </main>
  )
}

