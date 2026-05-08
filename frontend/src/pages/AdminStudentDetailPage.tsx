import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SpxLoader } from '../components/SpxLoader'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle,
  CreditCard,
  Eye,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers,
  Link2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Send,
  Search,
  TrendingUp,
  Upload,
  User,
  UserMinus,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react'
import { getBackendOrigin } from '../lib/backendOrigin'
import { supabase } from '../lib/supabase'

export type AdminStudentDetailPageProps = {
  studentId: string
  onBack: () => void
}

type StudentRecord = {
  id: string
  student_name: string
  email: string
  phone: string | null
  gender: string | null
  location: string | null
  degree: string | null
  previous_company: string | null
  previous_job_role: string | null
  experience_years: number | null
  domain: string | null
  enrollment_date: string | null
  resume_url: string | null
  linkedin_url: string | null
  naukri_url: string | null
  portfolio_url: string | null
  stage: string
  payment_status: string
  attendance_pct: number | null
  progress_pct: number | null
  trainer_rating: number | null
  comments: string | null
  last_activity_at: string | null
  course_fee: number
  amount_paid: number
  avatar_url: string | null
}

type BatchRow = { id: string; batch_code: string; trainer_id: string | null }

type PaymentRow = {
  id: string
  amount: number
  paid_on: string | null
  payment_mode: string
  notes: string | null
}

type InterviewRow = {
  id: string
  company_name: string
  role_title: string | null
  stage: string
  interview_date: string | null
}

type ActivityRow = {
  id: number
  activity_type: string
  status: string
  activity_date: string | null
  notes: string | null
  created_at: string
}

type PlacementRow = {
  id: string
  company_name: string
  job_role: string | null
  salary_package: number | null
  placement_date: string | null
  notes: string | null
  created_at: string
}

type MockInterviewRow = {
  id: string
  trainer_id: string | null
  scheduled_at: string | null
  status: string
  overall_rating: number | null
  notes: string | null
  created_at: string
}

type ClassAttendanceRaw = {
  id: string
  class_session_id: string
  status: string
  marked_at: string | null
  class_sessions: Array<{
    id: string
    title: string | null
    starts_at: string | null
    batch_id: string | null
  }>
}

type ClassAttendanceRow = {
  id: string
  class_session_id: string
  status: string
  marked_at: string | null
  class_sessions: {
    id: string
    title: string | null
    starts_at: string | null
    batch_id: string | null
  } | null
}

type StudentBatchHistoryRaw = {
  id: string
  batch_id: string
  joined_at: string | null
  is_active: boolean
  left_at: string | null
  dropout_reason: string | null
  created_at: string
  batches: Array<{ id: string; batch_code: string }>
}

type StudentBatchHistoryRow = {
  id: string
  batch_id: string
  joined_at: string | null
  is_active: boolean
  left_at: string | null
  dropout_reason: string | null
  created_at: string
  batches: { id: string; batch_code: string } | null
}

type TimelineCategory =
  | 'activity'
  | 'payment'
  | 'interview'
  | 'placement'
  | 'mock_interview'
  | 'class_attendance'
  | 'batch_enrollment'
  | 'stage_change'

type TabKey = 'personal' | 'timeline'

function displayDash(v: string | null | undefined): string {
  if (v == null || String(v).trim() === '') return '—'
  return String(v)
}

function isFilled(v: string | null | undefined): boolean {
  return v != null && String(v).trim() !== ''
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(d))
  } catch {
    return d
  }
}

function humanizeStage(stage: string): string {
  return stage
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function studentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

function isActiveStudent(lastActivity: string | null): boolean {
  if (!lastActivity) return true
  const t = new Date(lastActivity).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() - t < 14 * 24 * 60 * 60 * 1000
}

function FieldBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="spx-field-lbl">{label}</div>
      <div className="spx-field-val">{isFilled(value) ? value! : '—'}</div>
    </div>
  )
}

type FieldEditableProps = {
  label: string
  value?: string | null
  editing: boolean
  onChange?: (v: string) => void
  type?: 'text' | 'number' | 'email' | 'tel' | 'date' | 'url'
  options?: { value: string; label: string }[]
  placeholder?: string
}

function FieldEditable({
  label,
  value,
  editing,
  onChange,
  type = 'text',
  options,
  placeholder,
}: FieldEditableProps) {
  return (
    <div>
      <div className="spx-field-lbl">{label}</div>
      {editing ? (
        options ? (
          <select
            className="spx-inline-input"
            value={value ?? ''}
            onChange={(e) => onChange?.(e.target.value)}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="spx-inline-input"
            type={type}
            value={value ?? ''}
            placeholder={placeholder}
            onChange={(e) => onChange?.(e.target.value)}
          />
        )
      ) : (
        <div className="spx-field-val">{isFilled(value) ? value! : '—'}</div>
      )}
    </div>
  )
}

function ProgressBar({ pct, color = '#2563EB' }: { pct: number; color?: string }) {
  return (
    <div className="spx-prog">
      <div className="spx-prog-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function CircleProgress({ pct, size = 56, stroke = 5 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8E6E1" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#2563EB"
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill="#1D4ED8"
      >
        {pct}%
      </text>
    </svg>
  )
}

function StarRating({ filled, total = 3 }: { filled: number; total?: number }) {
  return (
    <span className="spx-stars">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={i < filled ? 'spx-star-filled' : 'spx-star-empty'}>
          ★
        </span>
      ))}
    </span>
  )
}

export function AdminStudentDetailPage({ studentId, onBack }: AdminStudentDetailPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [student, setStudent] = useState<StudentRecord | null>(null)
  const [primaryBatch, setPrimaryBatch] = useState<{
    batch_code: string
    trainer_name: string | null
    joined_at: string | null
  } | null>(null)
  const navigate = useNavigate()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [interviews, setInterviews] = useState<InterviewRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [mockInterviews, setMockInterviews] = useState<MockInterviewRow[]>([])
  const [classAttendance, setClassAttendance] = useState<ClassAttendanceRow[]>([])
  const [batchHistory, setBatchHistory] = useState<StudentBatchHistoryRow[]>([])
  const [tab, setTab] = useState<TabKey>('personal')
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [paySubmitting, setPaySubmitting] = useState(false)
  const [payError, setPayError] = useState('')
  const [payForm, setPayForm] = useState({
    amount: '',
    paid_on: new Date().toISOString().slice(0, 10),
    payment_mode: 'upi' as string,
    notes: '',
  })
  // Add to Batch modal
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [allBatches, setAllBatches] = useState<{ id: string; batch_code: string; status: string }[]>([])
  const [batchSearch, setBatchSearch] = useState('')
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set())
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchError, setBatchError] = useState('')

  // Remove from Batch modal
  const [removeBatchModalOpen, setRemoveBatchModalOpen] = useState(false)
  const [activeBatches, setActiveBatches] = useState<{ id: string; batch_id: string; batch_code: string }[]>([])
  const [removeBatchSubmitting, setRemoveBatchSubmitting] = useState(false)
  const [removeBatchError, setRemoveBatchError] = useState('')

  // Update Stage modal
  const [stageModalOpen, setStageModalOpen] = useState(false)
  const [stageForm, setStageForm] = useState({ stage: '', notes: '' })
  const [stageSubmitting, setStageSubmitting] = useState(false)
  const [stageError, setStageError] = useState('')

  // Feedback modal
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [feedbackForm, setFeedbackForm] = useState({ rating: 0, hoverRating: 0, notes: '' })
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const [latestFeedback, setLatestFeedback] = useState<{
    notes: string; rating: number; given_by: string; date: string
  } | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingResumeFile, setPendingResumeFile] = useState<File | null>(null)
  const [editForm, setEditForm] = useState({
    student_name: '',
    email: '',
    phone: '',
    gender: '',
    location: '',
    degree: '',
    previous_company: '',
    previous_job_role: '',
    experience_years: '' as string,
    domain: '',
    stage: '',
    payment_status: '',
    resume_url: '',
    linkedin_url: '',
    naukri_url: '',
    portfolio_url: '',
    comments: '',
    course_fee: '' as string,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data: st, error: stErr } = await supabase
      .from('students')
      .select(
        'id,student_name,email,phone,gender,location,degree,previous_company,previous_job_role,experience_years,domain,enrollment_date,resume_url,linkedin_url,naukri_url,portfolio_url,stage,payment_status,attendance_pct,progress_pct,trainer_rating,comments,last_activity_at,course_fee,amount_paid,avatar_url',
      )
      .eq('id', studentId)
      .maybeSingle()

    if (stErr || !st) {
      setError(stErr?.message ?? 'Student not found.')
      setStudent(null)
      setLoading(false)
      return
    }

    setStudent(st as StudentRecord)

    const [
      { data: sbRows, error: sbErr },
      { data: payRows },
      { data: intRows },
      { data: actRows },
      { data: placementRows },
      { data: mockRows },
      { data: attendanceRows },
      { data: batchHistRows },
    ] = await Promise.all([
        supabase
          .from('student_batches')
          .select('batch_id,joined_at')
          .eq('student_id', studentId)
          .eq('is_active', true),
        supabase
          .from('payments')
          .select('id,amount,paid_on,payment_mode,notes')
          .eq('student_id', studentId)
          .order('paid_on', { ascending: false }),
        supabase
          .from('interviews')
          .select('id,company_name,role_title,stage,interview_date')
          .eq('student_id', studentId)
          .order('interview_date', { ascending: false }),
        supabase
          .from('progress_activities')
          .select('id,activity_type,status,activity_date,notes,created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('placements')
          .select('id,company_name,job_role,salary_package,placement_date,notes,created_at')
          .eq('student_id', studentId)
          .order('placement_date', { ascending: false }),
        supabase
          .from('mock_interviews')
          .select('id,trainer_id,scheduled_at,status,overall_rating,notes,created_at')
          .eq('student_id', studentId)
          .order('scheduled_at', { ascending: false }),
        supabase
          .from('class_attendance')
          .select('id,class_session_id,status,marked_at,class_sessions(id,title,starts_at,batch_id)')
          .eq('student_id', studentId)
          .order('marked_at', { ascending: false })
          .limit(100),
        supabase
          .from('student_batches')
          .select('id,batch_id,joined_at,is_active,left_at,dropout_reason,created_at,batches(id,batch_code)')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false }),
      ])

    if (sbErr) setError(sbErr.message)

    setPayments((payRows ?? []) as PaymentRow[])
    setInterviews((intRows ?? []) as InterviewRow[])
    setActivities((actRows ?? []) as ActivityRow[])
    setPlacements((placementRows ?? []) as PlacementRow[])
    setMockInterviews((mockRows ?? []) as MockInterviewRow[])
    setClassAttendance(
      ((attendanceRows ?? []) as ClassAttendanceRaw[]).map((r) => ({
        ...r,
        class_sessions: Array.isArray(r.class_sessions) ? r.class_sessions[0] ?? null : r.class_sessions ?? null,
      })),
    )
    setBatchHistory(
      ((batchHistRows ?? []) as StudentBatchHistoryRaw[]).map((r) => ({
        ...r,
        batches: Array.isArray(r.batches) ? r.batches[0] ?? null : r.batches ?? null,
      })),
    )

    // Fetch latest feedback
    const { data: fbRow } = await supabase
      .from('progress_activities')
      .select('notes,progress_score,completion_feedback,activity_date')
      .eq('student_id', studentId)
      .eq('activity_type', 'feedback')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (fbRow) {
      setLatestFeedback({
        notes: fbRow.notes ?? '',
        rating: Math.round((fbRow.progress_score ?? 0) / 20),
        given_by: fbRow.completion_feedback ?? 'Admin',
        date: fbRow.activity_date ?? '',
      })
    } else {
      setLatestFeedback(null)
    }

    const links = sbRows ?? []
    if (links.length === 0) {
      setPrimaryBatch(null)
      setLoading(false)
      return
    }

    let earliest = links[0]!
    for (const l of links) {
      const a = l.joined_at ?? ''
      const b = earliest.joined_at ?? ''
      if (a && (!b || a < b)) earliest = l
      else if (!b && a) earliest = l
    }

    const batchIds = [...new Set(links.map((l) => l.batch_id))]
    const { data: batchRows } = await supabase
      .from('batches')
      .select('id,batch_code,trainer_id')
      .in('id', batchIds)

    const batchMap = new Map((batchRows as BatchRow[] | null)?.map((b) => [b.id, b]) ?? [])
    const batch = batchMap.get(earliest.batch_id)
    let trainerName: string | null = null
    if (batch?.trainer_id) {
      const { data: tr } = await supabase
        .from('trainers')
        .select('trainer_name')
        .eq('id', batch.trainer_id)
        .maybeSingle()
      trainerName = tr?.trainer_name ?? null
    }

    setPrimaryBatch(
      batch
        ? { batch_code: batch.batch_code, trainer_name: trainerName, joined_at: earliest.joined_at ?? null }
        : null,
    )
    setLoading(false)
  }, [studentId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!moreOpen) return
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [moreOpen])

  const openEdit = () => {
    if (!student) return
    setPendingResumeFile(null)
    setEditForm({
      student_name: student.student_name,
      email: student.email,
      phone: student.phone ?? '',
      gender: student.gender ?? '',
      location: student.location ?? '',
      degree: student.degree ?? '',
      previous_company: student.previous_company ?? '',
      previous_job_role: student.previous_job_role ?? '',
      experience_years: student.experience_years != null ? String(student.experience_years) : '',
      domain: student.domain ?? '',
      stage: student.stage,
      payment_status: student.payment_status,
      resume_url: student.resume_url ?? '',
      linkedin_url: student.linkedin_url ?? '',
      naukri_url: student.naukri_url ?? '',
      portfolio_url: student.portfolio_url ?? '',
      comments: student.comments ?? '',
      course_fee: student.course_fee != null ? String(student.course_fee) : '',
    })
    setEditMode(true)
    setMoreOpen(false)
  }
  const cancelEdit = () => {
    setEditMode(false)
    setPendingResumeFile(null)
  }

  const saveEdit = async () => {
    if (!student) return
    setSaving(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('You must be signed in to save changes.')
        return
      }

      const origin = getBackendOrigin()

      let resumeUrl: string | null = editForm.resume_url.trim() || null
      if (pendingResumeFile) {
        const fd = new FormData()
        fd.append('file', pendingResumeFile)
        const uploadUrl = `${origin}/api/admin/students/${student.id}/resume`
        const upRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: fd,
        })
        const upBody = (await upRes.json().catch(() => ({}))) as {
          error?: string
          resume_url?: string
        }
        if (!upRes.ok) {
          setError(upBody.error ?? `Resume upload failed (${upRes.status}).`)
          return
        }
        if (!upBody.resume_url) {
          setError('Upload succeeded but no file URL was returned.')
          return
        }
        resumeUrl = upBody.resume_url
      }

      const exp = editForm.experience_years.trim() ? Number.parseFloat(editForm.experience_years) : null
      const fee = editForm.course_fee.trim() ? Number.parseFloat(editForm.course_fee) : null

      const patchBody = {
        student_name: editForm.student_name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        gender: editForm.gender.trim() || null,
        location: editForm.location.trim() || null,
        degree: editForm.degree.trim() || null,
        previous_company: editForm.previous_company.trim() || null,
        previous_job_role: editForm.previous_job_role.trim() || null,
        experience_years: exp != null && !Number.isNaN(exp) ? exp : null,
        domain: editForm.domain.trim() || null,
        stage: editForm.stage,
        payment_status: editForm.payment_status,
        resume_url: resumeUrl,
        linkedin_url: editForm.linkedin_url.trim() || null,
        naukri_url: editForm.naukri_url.trim() || null,
        portfolio_url: editForm.portfolio_url.trim() || null,
        comments: editForm.comments.trim() || null,
        course_fee: fee != null && !Number.isNaN(fee) ? fee : null,
      }

      const patchUrl = `${origin}/api/admin/students/${student.id}`
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patchBody),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? `Save failed (${res.status}).`)
        return
      }

      setPendingResumeFile(null)
      setEditMode(false)
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed unexpectedly.')
    } finally {
      setSaving(false)
    }
  }

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setError(`Could not copy ${label}`)
    }
    setMoreOpen(false)
  }

  const openPayModal = () => {
    setPayForm({
      amount: '',
      paid_on: new Date().toISOString().slice(0, 10),
      payment_mode: 'upi',
      notes: '',
    })
    setPayError('')
    setPayModalOpen(true)
  }

  const submitPayment = async () => {
    if (!student) return
    const amt = Number.parseFloat(payForm.amount)
    if (!amt || Number.isNaN(amt) || amt <= 0) {
      setPayError('Enter a valid amount greater than 0.')
      return
    }
    const currentPending = Math.max(0, Number(student.course_fee ?? 0) - Number(student.amount_paid ?? 0))
    if (amt > currentPending && currentPending > 0) {
      setPayError(`Amount (₹${amt.toLocaleString('en-IN')}) exceeds pending amount (₹${currentPending.toLocaleString('en-IN')}).`)
      return
    }
    if (!payForm.paid_on) {
      setPayError('Please select a payment date.')
      return
    }
    setPayError('')
    setPaySubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setPayError('Not authenticated.')
        return
      }
      const res = await fetch(`${getBackendOrigin()}/api/admin/students/${student.id}/payments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amt,
          paid_on: payForm.paid_on,
          payment_mode: payForm.payment_mode,
          notes: payForm.notes.trim() || null,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setPayError(body.error ?? `Payment failed (${res.status}).`)
        return
      }
      setPayModalOpen(false)
      void load()
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Payment failed.')
    } finally {
      setPaySubmitting(false)
    }
  }

  // ── Add to Batch ──
  const openBatchModal = async () => {
    setBatchError('')
    setSelectedBatchIds(new Set())
    setBatchSearch('')
    setBatchModalOpen(true)
    const { data } = await supabase
      .from('batches')
      .select('id,batch_code,status')
      .in('status', ['active', 'planned'])
      .order('batch_code')
    setAllBatches((data ?? []) as { id: string; batch_code: string; status: string }[])
  }

  const toggleBatchSelection = (id: string) => {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submitAddBatch = async () => {
    if (selectedBatchIds.size === 0) { setBatchError('Select at least one batch.'); return }
    setBatchSubmitting(true)
    setBatchError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const rows = [...selectedBatchIds].map((bid) => ({
        student_id: studentId,
        batch_id: bid,
        joined_at: today,
        is_active: true,
      }))
      const { error } = await supabase.from('student_batches').upsert(rows, { onConflict: 'student_id,batch_id' })
      if (error) { setBatchError(error.message); return }
      setBatchModalOpen(false)
      void load()
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : 'Failed to add.')
    } finally {
      setBatchSubmitting(false)
    }
  }

  const filteredBatches = useMemo(() => {
    const q = batchSearch.toLowerCase().trim()
    if (!q) return allBatches
    return allBatches.filter((b) => b.batch_code.toLowerCase().includes(q))
  }, [allBatches, batchSearch])

  // ── Remove from Batch ──
  const openRemoveBatchModal = async () => {
    setRemoveBatchError('')
    setRemoveBatchModalOpen(true)
    const { data } = await supabase
      .from('student_batches')
      .select('id,batch_id,batches(batch_code)')
      .eq('student_id', studentId)
      .eq('is_active', true)
    const rows = ((data ?? []) as Array<{ id: string; batch_id: string; batches: Array<{ batch_code: string }> | { batch_code: string } | null }>).map((r) => ({
      id: r.id,
      batch_id: r.batch_id,
      batch_code: Array.isArray(r.batches) ? r.batches[0]?.batch_code ?? '—' : r.batches?.batch_code ?? '—',
    }))
    setActiveBatches(rows)
  }

  const removeBatch = async (sbId: string) => {
    setRemoveBatchSubmitting(true)
    setRemoveBatchError('')
    try {
      const { error } = await supabase
        .from('student_batches')
        .update({ is_active: false, left_at: new Date().toISOString().slice(0, 10) })
        .eq('id', sbId)
      if (error) { setRemoveBatchError(error.message); return }
      setActiveBatches((prev) => prev.filter((b) => b.id !== sbId))
      if (activeBatches.length <= 1) {
        setRemoveBatchModalOpen(false)
      }
      void load()
    } catch (e) {
      setRemoveBatchError(e instanceof Error ? e.message : 'Failed.')
    } finally {
      setRemoveBatchSubmitting(false)
    }
  }

  // ── Update Stage ──
  const stageOptions = [
    { value: 'training', label: 'Training' },
    { value: 'trial_classes', label: 'Trial Classes' },
    { value: 'mock_interviews', label: 'Mock Interviews' },
    { value: 'searching_for_jobs', label: 'Searching for Jobs' },
    { value: 'taking_interviews', label: 'Taking Interviews' },
    { value: 'placed', label: 'Placed' },
    { value: 'inactive', label: 'Inactive' },
  ]

  const openStageModal = () => {
    if (!student) return
    setStageForm({ stage: student.stage, notes: '' })
    setStageError('')
    setStageModalOpen(true)
  }

  const submitStageUpdate = async () => {
    if (!student || !stageForm.stage) { setStageError('Select a stage.'); return }
    if (stageForm.stage === student.stage) { setStageError('Stage is already set to this value.'); return }
    setStageSubmitting(true)
    setStageError('')
    try {
      const { error } = await supabase
        .from('students')
        .update({ stage: stageForm.stage, updated_at: new Date().toISOString() })
        .eq('id', studentId)
      if (error) { setStageError(error.message); return }
      // Log as progress activity
      await supabase.from('progress_activities').insert({
        student_id: studentId,
        activity_type: 'stage_change',
        status: 'completed',
        activity_date: new Date().toISOString().slice(0, 10),
        notes: `Stage updated to ${stageForm.stage}${stageForm.notes.trim() ? ` — ${stageForm.notes.trim()}` : ''}`,
      })
      setStageModalOpen(false)
      void load()
    } catch (e) {
      setStageError(e instanceof Error ? e.message : 'Failed.')
    } finally {
      setStageSubmitting(false)
    }
  }

  // ── Feedback ──
  const openFeedbackModal = () => {
    setFeedbackForm({ rating: 0, hoverRating: 0, notes: '' })
    setFeedbackError('')
    setFeedbackModalOpen(true)
  }

  const submitFeedback = async () => {
    if (feedbackForm.rating === 0) { setFeedbackError('Please select a star rating.'); return }
    if (!feedbackForm.notes.trim()) { setFeedbackError('Feedback notes are required.'); return }
    setFeedbackSubmitting(true)
    setFeedbackError('')
    try {
      // Determine who is giving feedback
      const { data: { session } } = await supabase.auth.getSession()
      const userEmail = session?.user?.email ?? ''
      let giverLabel = 'Admin'
      if (userEmail) {
        // Check if it's a trainer
        const { data: trRow } = await supabase
          .from('trainers')
          .select('trainer_name')
          .eq('email', userEmail)
          .maybeSingle()
        if (trRow?.trainer_name) giverLabel = trRow.trainer_name
      }

      // Insert as progress_activity so it appears in timeline
      const { error: actErr } = await supabase.from('progress_activities').insert({
        student_id: studentId,
        activity_type: 'feedback',
        status: 'completed',
        activity_date: new Date().toISOString().slice(0, 10),
        progress_score: feedbackForm.rating * 20, // 1-3 → 20-60
        notes: feedbackForm.notes.trim(),
        completion_feedback: giverLabel,
      })
      if (actErr) { setFeedbackError(actErr.message); return }

      // Update trainer_rating on student to the latest rating
      const { error: upErr } = await supabase
        .from('students')
        .update({
          trainer_rating: feedbackForm.rating,
          comments: feedbackForm.notes.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', studentId)
      if (upErr) { setFeedbackError(upErr.message); return }

      setFeedbackModalOpen(false)
      void load()
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : 'Failed.')
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  // ── Simple actions ──
  const handleUploadResume = () => {
    setTab('personal')
    openEdit()
  }

  const handleSendWhatsApp = () => {
    if (!student?.phone) return
    const cleaned = student.phone.replace(/[^0-9]/g, '')
    const num = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
    window.open(`https://wa.me/${num}`, '_blank')
  }

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !student) return
    // Reset input so same file can be re-selected
    e.target.value = ''

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, or WebP images are allowed.')
      return
    }
    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2 MB.')
      return
    }

    // Validate dimensions — must be ≤ 500x500
    const valid = await new Promise<boolean>((resolve) => {
      const img = new Image()
      img.onload = () => {
        if (img.width > 500 || img.height > 500) {
          setError(`Image is ${img.width}×${img.height}px — must be 500×500px or smaller.`)
          resolve(false)
        } else {
          resolve(true)
        }
      }
      img.onerror = () => { setError('Could not read image.'); resolve(false) }
      img.src = URL.createObjectURL(file)
    })
    if (!valid) return

    setAvatarUploading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setError('Not authenticated.'); return }

      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch(`${getBackendOrigin()}/api/admin/students/${student.id}/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; avatar_url?: string }
      if (!res.ok) {
        setError(body.error ?? 'Avatar upload failed.')
        return
      }
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Avatar upload failed.')
    } finally {
      setAvatarUploading(false)
    }
  }

  const hasPhone = !!(student && student.phone && student.phone.trim())

  const categoryConfig: Record<TimelineCategory, { color: string; label: string }> = {
    activity: { color: '#2563EB', label: 'Activity' },
    payment: { color: '#16A34A', label: 'Payment' },
    interview: { color: '#D97706', label: 'Interview' },
    placement: { color: '#7C3AED', label: 'Placement' },
    mock_interview: { color: '#EC4899', label: 'Mock Interview' },
    class_attendance: { color: '#0891B2', label: 'Live Class' },
    batch_enrollment: { color: '#4F46E5', label: 'Batch' },
    stage_change: { color: '#F59E0B', label: 'Stage Update' },
  }

  const timelineItems = useMemo(() => {
    type Item = {
      id: string
      sort: number
      title: string
      sub: string
      dateLabel: string
      category: TimelineCategory
      viewLink?: string
    }
    const out: Item[] = []

    // Progress activities
    for (const a of activities) {
      const d = a.activity_date ?? a.created_at?.slice(0, 10) ?? null
      const isStageChange = a.activity_type?.toLowerCase().includes('stage')
      out.push({
        id: `act-${a.id}`,
        sort: d ? new Date(d).getTime() : 0,
        title: isStageChange ? `Stage updated to ${humanizeStage(a.notes ?? a.activity_type)}` : humanizeStage(a.activity_type),
        sub: isStageChange ? (a.notes ? `${a.notes}` : '—') : displayDash(a.notes),
        dateLabel: formatDate(d),
        category: isStageChange ? 'stage_change' : 'activity',
      })
    }

    // Payments
    for (const p of payments) {
      out.push({
        id: `pay-${p.id}`,
        sort: p.paid_on ? new Date(p.paid_on).getTime() : 0,
        title: `Payment ₹${Number(p.amount).toLocaleString('en-IN')}`,
        sub: `${humanizeStage(p.payment_mode)}${p.notes ? ` · ${p.notes}` : ''}`,
        dateLabel: formatDate(p.paid_on),
        category: 'payment',
      })
    }

    // Interviews
    for (const i of interviews) {
      out.push({
        id: `int-${i.id}`,
        sort: i.interview_date ? new Date(i.interview_date).getTime() : 0,
        title: `Interview · ${i.company_name}`,
        sub: `${humanizeStage(i.stage)}${i.role_title ? ` · ${i.role_title}` : ''}`,
        dateLabel: formatDate(i.interview_date),
        category: 'interview',
        viewLink: '/admin/placement',
      })
    }

    // Placements
    for (const pl of placements) {
      const d = pl.placement_date ?? pl.created_at?.slice(0, 10) ?? null
      const salaryStr = pl.salary_package ? ` · ₹${Number(pl.salary_package).toLocaleString('en-IN')} LPA` : ''
      out.push({
        id: `plc-${pl.id}`,
        sort: d ? new Date(d).getTime() : 0,
        title: `Placed at ${pl.company_name}`,
        sub: `${pl.job_role ?? 'Role N/A'}${salaryStr}${pl.notes ? ` · ${pl.notes}` : ''}`,
        dateLabel: formatDate(d),
        category: 'placement',
        viewLink: '/admin/placement',
      })
    }

    // Mock interviews
    for (const m of mockInterviews) {
      const d = m.scheduled_at?.slice(0, 10) ?? m.created_at?.slice(0, 10) ?? null
      const ratingStr = m.overall_rating != null ? ` · Rating: ${m.overall_rating}/10` : ''
      out.push({
        id: `mock-${m.id}`,
        sort: d ? new Date(d).getTime() : 0,
        title: `Mock Interview ${humanizeStage(m.status)}`,
        sub: `${m.notes ?? '—'}${ratingStr}`,
        dateLabel: formatDate(d),
        category: 'mock_interview',
        viewLink: '/admin/placement',
      })
    }

    // Class attendance (live classes attended)
    for (const ca of classAttendance) {
      const session = ca.class_sessions
      const d = ca.marked_at?.slice(0, 10) ?? session?.starts_at?.slice(0, 10) ?? null
      const className = session?.title ?? 'Untitled Class'
      const statusLabel = ca.status === 'present' ? 'Attended' : ca.status === 'late' ? 'Late' : ca.status === 'excused' ? 'Excused' : 'Absent'
      out.push({
        id: `cls-${ca.id}`,
        sort: d ? new Date(d).getTime() : 0,
        title: `Live Class · ${className}`,
        sub: statusLabel,
        dateLabel: formatDate(d),
        category: 'class_attendance',
        viewLink: session?.batch_id ? `/admin/batches/${session.batch_id}/classes/${session.id}` : undefined,
      })
    }

    // Batch enrollment history
    for (const bh of batchHistory) {
      const batchCode = bh.batches?.batch_code ?? 'Unknown Batch'
      const batchId = bh.batches?.id ?? bh.batch_id

      // Enrolled event
      const joinDate = bh.joined_at ?? bh.created_at?.slice(0, 10) ?? null
      out.push({
        id: `benr-${bh.id}`,
        sort: joinDate ? new Date(joinDate).getTime() : 0,
        title: `Enrolled in ${batchCode}`,
        sub: bh.is_active ? 'Currently active' : 'No longer active',
        dateLabel: formatDate(joinDate),
        category: 'batch_enrollment',
        viewLink: `/admin/batches/${batchId}/overview`,
      })

      // Left / dropped out event
      if (bh.left_at) {
        out.push({
          id: `bleft-${bh.id}`,
          sort: new Date(bh.left_at).getTime(),
          title: `Left ${batchCode}`,
          sub: bh.dropout_reason ? `Reason: ${bh.dropout_reason}` : 'No reason specified',
          dateLabel: formatDate(bh.left_at),
          category: 'batch_enrollment',
          viewLink: `/admin/batches/${batchId}/overview`,
        })
      }
    }

    out.sort((x, y) => y.sort - x.sort)
    return out
  }, [activities, payments, interviews, placements, mockInterviews, classAttendance, batchHistory])

  if (loading) {
    return <SpxLoader label="Loading student…" />
  }

  if (error && !student) {
    return (
      <div className="spx-page">
        <div className="spx-topbar">
          <button type="button" className="spx-back-btn" onClick={onBack}>
            <ArrowLeft size={15} /> Back to Students
          </button>
        </div>
        <div style={{ padding: 32, color: '#DC2626' }}>{error}</div>
      </div>
    )
  }

  if (!student) return null

  const activeNow = isActiveStudent(student.last_activity_at)
  const progressPct = Math.min(100, Math.max(0, Math.round(student.progress_pct ?? 0)))
  const attendPct = Math.min(100, Math.max(0, Math.round(student.attendance_pct ?? 0)))
  const courseFee = Number(student.course_fee ?? 0)
  const amountPaid = Number(student.amount_paid ?? 0)
  const pending = Math.max(0, courseFee - amountPaid)
  const payPct = courseFee > 0 ? Math.round((amountPaid / courseFee) * 100) : 0
  const filledStars = Math.min(3, Math.max(0, Math.round(student.trainer_rating ?? 0)))

  return (
    <div className="spx-page">
      <div className="spx-topbar">
        <button type="button" className="spx-back-btn" onClick={onBack}>
          <ArrowLeft size={15} /> Back to Students
        </button>
        <div className="spx-topbar-right" ref={moreRef}>
          {editMode ? (
            <>
              <button type="button" className="spx-msg-btn" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className="spx-primary-action"
                style={{ width: 'auto', margin: 0, padding: '7px 16px' }}
                onClick={() => void saveEdit()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="spx-msg-btn" onClick={openEdit}>
                <Pencil size={14} /> Edit
              </button>
              <button
                type="button"
                className="spx-more-btn"
                onClick={() => setMoreOpen((o) => !o)}
                aria-label="More actions"
              >
                <MoreHorizontal size={18} />
              </button>
              {moreOpen && (
                <div className="spx-dropdown">
                  <button type="button" onClick={() => copyText('Student ID', student.id)}>
                    Copy student ID
                  </button>
                  <button type="button" onClick={() => copyText('Email', student.email)}>
                    Copy email
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {error && <div className="spx-error-banner">{error}</div>}

      <div className="spx-body">
        <div className="spx-col-main">
          {/* Hero */}
          <div className="spx-hero">
            <div className="spx-hero-top">
              <div className="spx-avatar-wrap" onClick={() => avatarInputRef.current?.click()} title="Click to upload photo">
                {student.avatar_url ? (
                  <img src={student.avatar_url} alt={student.student_name} className="spx-avatar spx-avatar-img" />
                ) : (
                  <div className="spx-avatar">{studentInitials(student.student_name)}</div>
                )}
                <div className={`spx-avatar-overlay${avatarUploading ? ' uploading' : ''}`}>
                  {avatarUploading ? (
                    <span className="spx-avatar-spinner" />
                  ) : (
                    <>
                      <Upload size={18} />
                      <span>Upload</span>
                    </>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => void handleAvatarSelect(e)}
                />
                {activeNow && <div className="spx-online-dot" />}
              </div>
              <div className="spx-hero-info">
                <div className="spx-hero-name-row">
                  <span className="spx-hero-name">{student.student_name}</span>
                  <StarRating filled={filledStars} total={3} />
                </div>
                <div className="spx-hero-meta">
                  <span className="spx-meta-item">
                    <Mail size={14} /> {displayDash(student.email)}
                  </span>
                  {isFilled(student.phone) && (
                    <span className="spx-meta-item">
                      <Phone size={14} /> {student.phone}
                    </span>
                  )}
                </div>
                <div className="spx-badge-row">
                  <span className="spx-badge spx-badge-training">{humanizeStage(student.stage)}</span>
                  {student.payment_status === 'paid' && (
                    <span className="spx-badge spx-badge-pay">
                      <CheckCircle size={11} /> Payment Clear
                    </span>
                  )}
                  <span
                    className={`spx-badge ${activeNow ? 'spx-badge-active' : 'spx-badge-inactive'}`}
                  >
                    <CheckCircle size={11} /> {activeNow ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="spx-hero-stats">
              <div className="spx-stat">
                <div className="spx-stat-lbl">Current Batch</div>
                <div className="spx-stat-val">{primaryBatch?.batch_code ?? '—'}</div>
              </div>
              <div className="spx-stat">
                <div className="spx-stat-lbl">Current Stage</div>
                <div className="spx-stat-val">{humanizeStage(student.stage)}</div>
              </div>
              <div className="spx-stat">
                <div className="spx-stat-lbl">Trainer</div>
                <div className="spx-stat-val">{primaryBatch?.trainer_name ?? '—'}</div>
              </div>
              <div className="spx-stat">
                <div className="spx-stat-lbl">Attendance</div>
                <div className="spx-stat-val">
                  {student.attendance_pct != null ? `${attendPct}%` : '—'}
                </div>
                {student.attendance_pct != null && <ProgressBar pct={attendPct} />}
              </div>
              <div className="spx-stat">
                <div className="spx-stat-lbl">Joined On</div>
                <div className="spx-stat-val">{formatDate(primaryBatch?.joined_at)}</div>
              </div>
              <div className="spx-stat">
                <div className="spx-stat-lbl">Progress</div>
                <div className="spx-stat-val">
                  {student.progress_pct != null ? `${progressPct}%` : '—'}
                </div>
                {student.progress_pct != null && (
                  <ProgressBar pct={progressPct} color="#F59E0B" />
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="spx-tabs">
            <button
              type="button"
              className={`spx-tab ${tab === 'personal' ? 'active' : ''}`}
              onClick={() => setTab('personal')}
            >
              Personal Details
            </button>
            <button
              type="button"
              className={`spx-tab ${tab === 'timeline' ? 'active' : ''}`}
              onClick={() => setTab('timeline')}
            >
              Activity Timeline
            </button>
          </div>

          {tab === 'personal' && (
            <>
              {/* Basic Details */}
              <div className="spx-section">
                <div className="spx-section-hdr">
                  <span className="spx-section-title">
                    <User size={16} /> Basic Details
                  </span>
                </div>
                <div className="spx-fields spx-fields-5">
                  <FieldEditable
                    label="Full Name"
                    editing={editMode}
                    value={editMode ? editForm.student_name : student.student_name}
                    onChange={(v) => setEditForm((f) => ({ ...f, student_name: v }))}
                  />
                  <FieldEditable
                    label="Email"
                    type="email"
                    editing={editMode}
                    value={editMode ? editForm.email : student.email}
                    onChange={(v) => setEditForm((f) => ({ ...f, email: v }))}
                  />
                  <FieldEditable
                    label="Phone"
                    type="tel"
                    editing={editMode}
                    value={editMode ? editForm.phone : student.phone}
                    onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                  />
                  <FieldEditable
                    label="Gender"
                    editing={editMode}
                    value={editMode ? editForm.gender : student.gender}
                    onChange={(v) => setEditForm((f) => ({ ...f, gender: v }))}
                    options={
                      editMode
                        ? [
                            { value: '', label: '—' },
                            { value: 'Male', label: 'Male' },
                            { value: 'Female', label: 'Female' },
                            { value: 'Other', label: 'Other' },
                          ]
                        : undefined
                    }
                  />
                  <FieldEditable
                    label="City"
                    editing={editMode}
                    value={editMode ? editForm.location : student.location}
                    onChange={(v) => setEditForm((f) => ({ ...f, location: v }))}
                  />
                </div>
              </div>

              {/* Education & Professional Background — merged */}
              <div className="spx-section">
                <div className="spx-section-hdr">
                  <span className="spx-section-title">
                    <GraduationCap size={16} /> Education &amp; Professional Background
                  </span>
                </div>
                <div className="spx-fields spx-fields-5">
                  <FieldEditable
                    label="Degree"
                    editing={editMode}
                    value={editMode ? editForm.degree : student.degree}
                    onChange={(v) => setEditForm((f) => ({ ...f, degree: v }))}
                    options={[{ value: '', label: '—' }, { value: 'MBA', label: 'MBA' }, { value: 'ME/ MTech', label: 'ME/ MTech' }, { value: 'BE/ BTech', label: 'BE/ BTech' }, { value: 'BBA', label: 'BBA' }, { value: 'BCom', label: 'BCom' }, { value: 'BSc', label: 'BSc' }, { value: "master's_degree", label: "Master's Degree" }, { value: 'diploma', label: 'Diploma' }, { value: "bachelor's_degree", label: "Bachelor's Degree" }, { value: 'other', label: 'Other' }]}
                  />
                  <FieldEditable
                    label="Previous Company"
                    editing={editMode}
                    value={editMode ? editForm.previous_company : student.previous_company}
                    onChange={(v) => setEditForm((f) => ({ ...f, previous_company: v }))}
                  />
                  <FieldEditable
                    label="Previous Role"
                    editing={editMode}
                    value={editMode ? editForm.previous_job_role : student.previous_job_role}
                    onChange={(v) => setEditForm((f) => ({ ...f, previous_job_role: v }))}
                  />
                  <FieldEditable
                    label="Experience"
                    type="number"
                    editing={editMode}
                    value={
                      editMode
                        ? editForm.experience_years
                        : student.experience_years != null
                          ? `${student.experience_years} Years`
                          : null
                    }
                    onChange={(v) => setEditForm((f) => ({ ...f, experience_years: v }))}
                    placeholder="Years"
                  />
                  <FieldEditable
                    label="Domain"
                    editing={editMode}
                    value={editMode ? editForm.domain : student.domain}
                    onChange={(v) => setEditForm((f) => ({ ...f, domain: v }))}
                    options={[{ value: '', label: '—' }, { value: 'Sales', label: 'Sales' }, { value: 'Operations', label: 'Operations' }, { value: 'Banking', label: 'Banking' }, { value: 'Finance', label: 'Finance' }, { value: "BPO's", label: "BPO's" }, { value: 'Healthcare', label: 'Healthcare' }, { value: 'Fresher', label: 'Fresher' }, { value: 'Teacher', label: 'Teacher' }, { value: 'Developer', label: 'Developer' }, { value: 'Testing', label: 'Testing' }, { value: 'HR Recruiters', label: 'HR Recruiters' }, { value: 'Digital Marketing', label: 'Digital Marketing' }, { value: 'Engineers', label: 'Engineers' }, { value: 'Support', label: 'Support' }]}
                  />
                </div>
              </div>

              {/* LMS & Batch Details */}
              <div className="spx-section">
                <div className="spx-section-hdr">
                  <span className="spx-section-title">
                    <Layers size={16} /> LMS &amp; Batch Details
                  </span>
                </div>
                <div className="spx-fields">
                  <FieldBlock label="Batch Name" value={primaryBatch?.batch_code} />
                  <FieldBlock label="Trainer" value={primaryBatch?.trainer_name} />
                  <FieldBlock label="Enrollment Date" value={formatDate(student.enrollment_date)} />
                  <FieldEditable
                    label="Current Stage"
                    editing={editMode}
                    value={editMode ? editForm.stage : humanizeStage(student.stage)}
                    onChange={(v) => setEditForm((f) => ({ ...f, stage: v }))}
                    options={
                      editMode
                        ? [
                            { value: 'training', label: 'Training' },
                            { value: 'trial_classes', label: 'Trial Classes' },
                            { value: 'mock_interviews', label: 'Mock Interviews' },
                            { value: 'searching_for_jobs', label: 'Searching for Jobs' },
                            { value: 'taking_interviews', label: 'Taking Interviews' },
                            { value: 'placed', label: 'Placed' },
                            { value: 'inactive', label: 'Inactive' },
                          ]
                        : undefined
                    }
                  />
                  <div>
                    <div className="spx-field-lbl">Attendance</div>
                    <div className="spx-field-val">
                      {student.attendance_pct != null ? `${attendPct}%` : '—'}
                    </div>
                    {student.attendance_pct != null && <ProgressBar pct={attendPct} />}
                  </div>
                  <div>
                    <div className="spx-field-lbl">Progress</div>
                    <div className="spx-field-val">
                      {student.progress_pct != null ? `${progressPct}%` : '—'}
                    </div>
                    {student.progress_pct != null && (
                      <ProgressBar pct={progressPct} color="#F59E0B" />
                    )}
                  </div>
                  <FieldBlock
                    label="Last Active"
                    value={student.last_activity_at ? formatDate(student.last_activity_at) : null}
                  />
                </div>
              </div>

              {/* Payment Details */}
              <div className="spx-section">
                <div className="spx-section-hdr">
                  <span className="spx-section-title">
                    <CreditCard size={16} /> Payment Details
                  </span>
                  {pending > 0 && !editMode && (
                    <button type="button" className="spx-add-pay-btn" onClick={openPayModal}>
                      + Add Payment
                    </button>
                  )}
                </div>
                <div className="spx-pay-summary">
                  <div className="spx-pay-card">
                    <div className="spx-pay-lbl">Total fee</div>
                    {editMode ? (
                      <input
                        className="spx-inline-input"
                        type="number"
                        value={editForm.course_fee}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, course_fee: e.target.value }))
                        }
                        placeholder="0"
                      />
                    ) : (
                      <div className="spx-pay-val">₹{courseFee.toLocaleString('en-IN')}</div>
                    )}
                  </div>
                  <div className="spx-pay-card">
                    <div className="spx-pay-lbl">Paid amount</div>
                    <div className="spx-pay-val">₹{amountPaid.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="spx-pay-card">
                    <div className="spx-pay-lbl">Pending amount</div>
                    <div className="spx-pay-val red">₹{pending.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="spx-pay-card spx-pay-circle-wrap">
                    <CircleProgress pct={payPct} />
                    <div>
                      <div className="spx-pay-lbl">Payment status</div>
                      <div className="spx-pay-status">{humanizeStage(student.payment_status)}</div>
                    </div>
                  </div>
                </div>
                {payments.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="spx-ptable">
                      <thead>
                        <tr>
                          <th>Payment date</th>
                          <th>Amount</th>
                          <th>Method</th>
                          <th>Notes</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td>{formatDate(p.paid_on)}</td>
                            <td style={{ fontWeight: 500 }}>
                              ₹{Number(p.amount).toLocaleString('en-IN')}
                            </td>
                            <td>{humanizeStage(p.payment_mode)}</td>
                            <td>{displayDash(p.notes)}</td>
                            <td>
                              <span className="spx-success-pill">
                                <CheckCircle size={11} /> Success
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Profile Links */}
              <div className="spx-section">
                <div className="spx-section-hdr">
                  <span className="spx-section-title">
                    <Link2 size={16} /> Profile Links
                  </span>
                </div>
                {editMode ? (
                  <div className="spx-fields spx-fields-5">
                    <FieldEditable
                      label="Resume URL"
                      type="url"
                      editing
                      value={editForm.resume_url}
                      onChange={(v) => setEditForm((f) => ({ ...f, resume_url: v }))}
                      placeholder="https://…"
                    />
                    <FieldEditable
                      label="LinkedIn"
                      type="url"
                      editing
                      value={editForm.linkedin_url}
                      onChange={(v) => setEditForm((f) => ({ ...f, linkedin_url: v }))}
                      placeholder="https://linkedin.com/in/…"
                    />
                    <FieldEditable
                      label="Naukri"
                      type="url"
                      editing
                      value={editForm.naukri_url}
                      onChange={(v) => setEditForm((f) => ({ ...f, naukri_url: v }))}
                      placeholder="https://…"
                    />
                    <FieldEditable
                      label="Portfolio"
                      type="url"
                      editing
                      value={editForm.portfolio_url}
                      onChange={(v) => setEditForm((f) => ({ ...f, portfolio_url: v }))}
                      placeholder="https://…"
                    />
                    <div>
                      <div className="spx-field-lbl">Resume File</div>
                      <input
                        type="file"
                        className="spx-inline-input"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setPendingResumeFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="spx-plinks">
                    {student.resume_url ? (
                      <a
                        className="spx-plink"
                        href={student.resume_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText size={14} /> Resume — View / Download
                      </a>
                    ) : (
                      <span className="spx-plink is-disabled">
                        <FileText size={14} /> Resume — Not added
                      </span>
                    )}
                    {student.linkedin_url ? (
                      <a
                        className="spx-plink"
                        href={student.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Link2 size={14} /> LinkedIn
                      </a>
                    ) : (
                      <span className="spx-plink is-disabled">
                        <Link2 size={14} /> LinkedIn — Not added
                      </span>
                    )}
                    {student.naukri_url ? (
                      <a
                        className="spx-plink"
                        href={student.naukri_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={14} /> Naukri
                      </a>
                    ) : (
                      <span className="spx-plink is-disabled">
                        <ExternalLink size={14} /> Naukri — Not added
                      </span>
                    )}
                    {student.portfolio_url && (
                      <a
                        className="spx-plink"
                        href={student.portfolio_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={14} /> Portfolio
                      </a>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'timeline' && (
            <div className="spx-section">
              <div className="spx-section-hdr">
                <span className="spx-section-title">
                  <Activity size={16} /> Activity Timeline
                </span>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{timelineItems.length} events</span>
              </div>
              {timelineItems.length === 0 ? (
                <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                  No activity recorded yet — payments, interviews, classes, placements, and batch events will appear here.
                </div>
              ) : (
                <ul className="spx-timeline">
                  {timelineItems.map((row) => {
                    const cfg = categoryConfig[row.category]
                    return (
                      <li key={row.id} className="spx-timeline-item">
                        <div className="spx-timeline-dot" style={{ background: cfg.color }} />
                        <div className="spx-timeline-body">
                          <div className="spx-timeline-top">
                            <div className="spx-timeline-title-row">
                              <strong>{row.title}</strong>
                              <span className="spx-timeline-badge" style={{ background: `${cfg.color}14`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                                {cfg.label}
                              </span>
                            </div>
                            <div className="spx-timeline-right">
                              <span className="spx-timeline-date">{row.dateLabel}</span>
                              {row.viewLink && (
                                <button
                                  type="button"
                                  className="spx-timeline-view-btn"
                                  onClick={() => navigate(row.viewLink!)}
                                  title={`View ${cfg.label}`}
                                >
                                  <Eye size={13} /> View
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="spx-timeline-sub">{row.sub}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Side column */}
        <div className="spx-col-side">
          <div className="spx-side-card">
            <div className="spx-side-title">
              <Zap size={14} /> Quick Actions
            </div>
            {editMode ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  className="spx-primary-action"
                  style={{ margin: 0 }}
                  onClick={() => void saveEdit()}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="spx-action-btn"
                  style={{ margin: 0, justifyContent: 'center', border: '1px solid #E8E6E1' }}
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="spx-primary-action" onClick={openEdit}>
                <Pencil size={14} /> Edit Details
              </button>
            )}
            <button type="button" className="spx-action-btn" onClick={openPayModal}>
              <CreditCard size={15} /> Add Payment
            </button>
            <button type="button" className="spx-action-btn" onClick={() => void openBatchModal()}>
              <Users size={15} /> Add to Batch
            </button>
            <button type="button" className="spx-action-btn danger" onClick={() => void openRemoveBatchModal()}>
              <UserMinus size={15} /> Remove from Batch
            </button>
            <button type="button" className="spx-action-btn" onClick={() => navigate('/admin/placement')}>
              <Calendar size={15} /> Schedule Interview
            </button>
            <button type="button" className="spx-action-btn" onClick={() => navigate('/admin/placement')}>
              <Video size={15} /> Schedule Mock Interview
            </button>
            <button type="button" className="spx-action-btn" onClick={handleUploadResume}>
              <Upload size={15} /> Upload Resume
            </button>
            <button
              type="button"
              className={`spx-action-btn${!hasPhone ? ' disabled' : ''}`}
              onClick={handleSendWhatsApp}
              disabled={!hasPhone}
              title={!hasPhone ? 'No phone number available' : `WhatsApp ${student.phone}`}
            >
              <Send size={15} /> Send WhatsApp
            </button>
            <button type="button" className="spx-action-btn" onClick={openStageModal}>
              <TrendingUp size={15} /> Update Stage
            </button>
            <button type="button" className="spx-action-btn" onClick={openFeedbackModal}>
              <MessageSquare size={15} /> Give Feedback
            </button>
          </div>

          <div className="spx-side-card">
            <div className="spx-side-title">
              <Award size={14} /> Trainer Feedback
            </div>
            {latestFeedback ? (
              <>
                <div className="spx-feedback-row">
                  <span className="spx-fb-lbl">Rating</span>
                  <StarRating
                    filled={Math.min(3, Math.max(0, latestFeedback.rating))}
                    total={3}
                  />
                </div>
                <div className="spx-trainer-note">{latestFeedback.notes}</div>
                <div className="spx-feedback-meta">
                  <span className="spx-feedback-giver">{latestFeedback.given_by}</span>
                  {latestFeedback.date && (
                    <span className="spx-feedback-date">{formatDate(latestFeedback.date)}</span>
                  )}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#9CA3AF', padding: '4px 0' }}>No feedback yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Add Payment Modal */}
      {payModalOpen && (
        <div className="spx-modal-overlay" onClick={() => !paySubmitting && setPayModalOpen(false)}>
          <div className="spx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="spx-modal-hdr">
              <h3 className="spx-modal-title">
                <CreditCard size={18} /> Add Payment
              </h3>
              <button
                type="button"
                className="spx-modal-close"
                onClick={() => !paySubmitting && setPayModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="spx-modal-body">
              {payError && (
                <div className="spx-modal-error">{payError}</div>
              )}

              <div className="spx-modal-summary">
                <div className="spx-modal-summary-item">
                  <span>Total Fee</span>
                  <strong>₹{courseFee.toLocaleString('en-IN')}</strong>
                </div>
                <div className="spx-modal-summary-item">
                  <span>Paid Till Now</span>
                  <strong>₹{amountPaid.toLocaleString('en-IN')}</strong>
                </div>
                <div className="spx-modal-summary-item pending">
                  <span>Pending</span>
                  <strong>₹{pending.toLocaleString('en-IN')}</strong>
                </div>
              </div>

              <div className="spx-modal-fields">
                <div className="spx-modal-field">
                  <label className="spx-modal-label">Amount <span className="spx-req">*</span></label>
                  <div className="spx-input-prefix-wrap">
                    <span className="spx-input-prefix">₹</span>
                    <input
                      className="spx-modal-input spx-input-with-prefix"
                      type="number"
                      min="1"
                      max={pending}
                      step="0.01"
                      placeholder="0.00"
                      value={payForm.amount}
                      onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  {pending > 0 && (
                    <span className="spx-modal-hint">Max: ₹{pending.toLocaleString('en-IN')}</span>
                  )}
                </div>

                <div className="spx-modal-field">
                  <label className="spx-modal-label">Payment Date <span className="spx-req">*</span></label>
                  <input
                    className="spx-modal-input"
                    type="date"
                    value={payForm.paid_on}
                    onChange={(e) => setPayForm((f) => ({ ...f, paid_on: e.target.value }))}
                  />
                </div>

                <div className="spx-modal-field">
                  <label className="spx-modal-label">Payment Mode</label>
                  <select
                    className="spx-modal-input"
                    value={payForm.payment_mode}
                    onChange={(e) => setPayForm((f) => ({ ...f, payment_mode: e.target.value }))}
                  >
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="spx-modal-field full">
                  <label className="spx-modal-label">Notes</label>
                  <textarea
                    className="spx-modal-input spx-modal-textarea"
                    rows={2}
                    placeholder="Optional payment notes..."
                    value={payForm.notes}
                    onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="spx-modal-footer">
              <button
                type="button"
                className="spx-modal-btn secondary"
                onClick={() => setPayModalOpen(false)}
                disabled={paySubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="spx-modal-btn primary"
                onClick={() => void submitPayment()}
                disabled={paySubmitting}
              >
                {paySubmitting ? 'Processing…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Batch Modal */}
      {batchModalOpen && (
        <div className="spx-modal-overlay" onClick={() => !batchSubmitting && setBatchModalOpen(false)}>
          <div className="spx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="spx-modal-hdr">
              <h3 className="spx-modal-title"><Users size={18} /> Add to Batch</h3>
              <button type="button" className="spx-modal-close" onClick={() => !batchSubmitting && setBatchModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="spx-modal-body">
              {batchError && <div className="spx-modal-error">{batchError}</div>}
              <div className="spx-search-wrap">
                <Search size={15} className="spx-search-icon" />
                <input
                  className="spx-modal-input spx-search-input"
                  type="text"
                  placeholder="Search batches..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="spx-batch-list">
                {filteredBatches.length === 0 ? (
                  <div className="spx-batch-empty">No batches found</div>
                ) : (
                  filteredBatches.map((b) => {
                    const alreadyEnrolled = batchHistory.some((bh) => bh.batch_id === b.id && bh.is_active)
                    const selected = selectedBatchIds.has(b.id)
                    return (
                      <label
                        key={b.id}
                        className={`spx-batch-row${selected ? ' selected' : ''}${alreadyEnrolled ? ' enrolled' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected || alreadyEnrolled}
                          disabled={alreadyEnrolled}
                          onChange={() => toggleBatchSelection(b.id)}
                        />
                        <span className="spx-batch-code">{b.batch_code}</span>
                        {alreadyEnrolled && <span className="spx-batch-tag">Already enrolled</span>}
                        <span className="spx-batch-status">{humanizeStage(b.status)}</span>
                      </label>
                    )
                  })
                )}
              </div>
              {selectedBatchIds.size > 0 && (
                <div className="spx-batch-sel-count">{selectedBatchIds.size} batch{selectedBatchIds.size > 1 ? 'es' : ''} selected</div>
              )}
            </div>
            <div className="spx-modal-footer">
              <button type="button" className="spx-modal-btn secondary" onClick={() => setBatchModalOpen(false)} disabled={batchSubmitting}>
                Cancel
              </button>
              <button type="button" className="spx-modal-btn primary" onClick={() => void submitAddBatch()} disabled={batchSubmitting || selectedBatchIds.size === 0}>
                {batchSubmitting ? 'Adding…' : 'Enroll in Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove from Batch Modal */}
      {removeBatchModalOpen && (
        <div className="spx-modal-overlay" onClick={() => !removeBatchSubmitting && setRemoveBatchModalOpen(false)}>
          <div className="spx-modal" onClick={(e) => e.stopPropagation()}>
            <div className="spx-modal-hdr">
              <h3 className="spx-modal-title"><UserMinus size={18} /> Remove from Batch</h3>
              <button type="button" className="spx-modal-close" onClick={() => !removeBatchSubmitting && setRemoveBatchModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="spx-modal-body">
              {removeBatchError && <div className="spx-modal-error">{removeBatchError}</div>}
              {activeBatches.length === 0 ? (
                <div className="spx-batch-empty">Not enrolled in any active batch.</div>
              ) : (
                <div className="spx-batch-list">
                  {activeBatches.map((b) => (
                    <div key={b.id} className="spx-batch-row spx-remove-row">
                      <span className="spx-batch-code">{b.batch_code}</span>
                      <button
                        type="button"
                        className="spx-remove-btn"
                        onClick={() => void removeBatch(b.id)}
                        disabled={removeBatchSubmitting}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="spx-modal-footer">
              <button type="button" className="spx-modal-btn secondary" onClick={() => setRemoveBatchModalOpen(false)} disabled={removeBatchSubmitting}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Stage Modal */}
      {stageModalOpen && (
        <div className="spx-modal-overlay" onClick={() => !stageSubmitting && setStageModalOpen(false)}>
          <div className="spx-modal spx-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="spx-modal-hdr">
              <h3 className="spx-modal-title"><TrendingUp size={18} /> Update Stage</h3>
              <button type="button" className="spx-modal-close" onClick={() => !stageSubmitting && setStageModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="spx-modal-body">
              {stageError && <div className="spx-modal-error">{stageError}</div>}
              {student && (
                <div className="spx-stage-current">
                  Current stage: <strong>{humanizeStage(student.stage)}</strong>
                </div>
              )}
              <div className="spx-modal-fields" style={{ gridTemplateColumns: '1fr' }}>
                <div className="spx-modal-field">
                  <label className="spx-modal-label">New Stage <span className="spx-req">*</span></label>
                  <select
                    className="spx-modal-input"
                    value={stageForm.stage}
                    onChange={(e) => setStageForm((f) => ({ ...f, stage: e.target.value }))}
                  >
                    {stageOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="spx-modal-field">
                  <label className="spx-modal-label">Notes (optional)</label>
                  <textarea
                    className="spx-modal-input spx-modal-textarea"
                    rows={3}
                    placeholder="Reason for stage change..."
                    value={stageForm.notes}
                    onChange={(e) => setStageForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="spx-modal-footer">
              <button type="button" className="spx-modal-btn secondary" onClick={() => setStageModalOpen(false)} disabled={stageSubmitting}>
                Cancel
              </button>
              <button type="button" className="spx-modal-btn primary" onClick={() => void submitStageUpdate()} disabled={stageSubmitting}>
                {stageSubmitting ? 'Updating…' : 'Update Stage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Give Feedback Modal */}
      {feedbackModalOpen && (
        <div className="spx-modal-overlay" onClick={() => !feedbackSubmitting && setFeedbackModalOpen(false)}>
          <div className="spx-modal spx-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="spx-modal-hdr">
              <h3 className="spx-modal-title"><MessageSquare size={18} /> Give Feedback</h3>
              <button type="button" className="spx-modal-close" onClick={() => !feedbackSubmitting && setFeedbackModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="spx-modal-body">
              {feedbackError && <div className="spx-modal-error">{feedbackError}</div>}

              <div className="spx-feedback-stars-wrap">
                <label className="spx-modal-label">Rating <span className="spx-req">*</span></label>
                <div className="spx-feedback-stars">
                  {[1, 2, 3].map((star) => {
                    const active = star <= (feedbackForm.hoverRating || feedbackForm.rating)
                    return (
                      <button
                        key={star}
                        type="button"
                        className={`spx-star-btn${active ? ' active' : ''}`}
                        onClick={() => setFeedbackForm((f) => ({ ...f, rating: star }))}
                        onMouseEnter={() => setFeedbackForm((f) => ({ ...f, hoverRating: star }))}
                        onMouseLeave={() => setFeedbackForm((f) => ({ ...f, hoverRating: 0 }))}
                      >
                        ★
                      </button>
                    )
                  })}
                  {feedbackForm.rating > 0 && (
                    <span className={`spx-star-label${feedbackForm.rating === 1 ? ' bad' : feedbackForm.rating === 2 ? ' good' : ' excellent'}`}>
                      {feedbackForm.rating === 1 ? 'Bad' : feedbackForm.rating === 2 ? 'Good' : 'Excellent'}
                    </span>
                  )}
                </div>
              </div>

              <div className="spx-modal-field" style={{ marginTop: 16 }}>
                <label className="spx-modal-label">Feedback Notes <span className="spx-req">*</span></label>
                <textarea
                  className="spx-modal-input spx-modal-textarea"
                  rows={4}
                  placeholder="Write your feedback about this student..."
                  value={feedbackForm.notes}
                  onChange={(e) => setFeedbackForm((f) => ({ ...f, notes: e.target.value }))}
                  autoFocus
                />
              </div>
            </div>
            <div className="spx-modal-footer">
              <button type="button" className="spx-modal-btn secondary" onClick={() => setFeedbackModalOpen(false)} disabled={feedbackSubmitting}>
                Cancel
              </button>
              <button type="button" className="spx-modal-btn primary" onClick={() => void submitFeedback()} disabled={feedbackSubmitting}>
                {feedbackSubmitting ? 'Submitting…' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
