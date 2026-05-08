import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  Calendar,
  CreditCard,
  ExternalLink,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  Link2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Percent,
  Phone,
  Star,
  Target,
  TrendingUp,
  User,
  Users,
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

type TabKey =
  | 'personal'
  | 'timeline'
  | 'payments'
  | 'interviews'
  | 'documents'
  | 'feedback'

const TABS: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: 'personal', label: 'Personal Details', icon: User },
  { key: 'timeline', label: 'Activity Timeline', icon: Activity },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'interviews', label: 'Interviews', icon: Users },
  { key: 'documents', label: 'Documents', icon: FolderOpen },
  { key: 'feedback', label: 'Feedback', icon: MessageSquare },
]

function displayDash(v: string | null | undefined): string {
  if (v == null || String(v).trim() === '') return '—'
  return String(v)
}

type EmptyKind = 'available' | 'assigned' | 'trainer'

function emptyMessage(kind: EmptyKind): string {
  if (kind === 'trainer') return 'No Trainer Assigned'
  if (kind === 'assigned') return 'Not Assigned'
  return 'Not Available'
}

function isFilled(v: string | null | undefined): boolean {
  return v != null && String(v).trim() !== ''
}

function formatJoined(d: string | null | undefined): string {
  if (!d) return ''
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

function formatShortDate(d: string | null): string {
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

function trainerRatingFilledStars(rating: number | null | undefined): number {
  if (rating == null || Number.isNaN(rating)) return 0
  return Math.min(3, Math.max(0, Math.round(Number(rating))))
}

function isActiveStudent(lastActivity: string | null): boolean {
  if (!lastActivity) return true
  const t = new Date(lastActivity).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() - t < 14 * 24 * 60 * 60 * 1000
}

type TimelineItem = {
  id: string
  sort: number
  title: string
  sub: string
  dateLabel: string
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
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [interviews, setInterviews] = useState<InterviewRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [tab, setTab] = useState<TabKey>('personal')
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement | null>(null)
  const [editOpen, setEditOpen] = useState(false)
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
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data: st, error: stErr } = await supabase
      .from('students')
      .select(
        'id,student_name,email,phone,gender,location,degree,previous_company,previous_job_role,experience_years,domain,enrollment_date,resume_url,linkedin_url,naukri_url,portfolio_url,stage,payment_status,attendance_pct,progress_pct,trainer_rating,comments,last_activity_at,course_fee,amount_paid',
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

    const [{ data: sbRows, error: sbErr }, { data: payRows }, { data: intRows }, { data: actRows }] =
      await Promise.all([
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
      ])

    if (sbErr) {
      setError(sbErr.message)
    }

    setPayments((payRows ?? []) as PaymentRow[])
    setInterviews((intRows ?? []) as InterviewRow[])
    setActivities((actRows ?? []) as ActivityRow[])

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
      experience_years:
        student.experience_years != null ? String(student.experience_years) : '',
      domain: student.domain ?? '',
      stage: student.stage,
      payment_status: student.payment_status,
      resume_url: student.resume_url ?? '',
      linkedin_url: student.linkedin_url ?? '',
      naukri_url: student.naukri_url ?? '',
      portfolio_url: student.portfolio_url ?? '',
      comments: student.comments ?? '',
    })
    setEditOpen(true)
    setMoreOpen(false)
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
        const upAc = new AbortController()
        const upTo = window.setTimeout(() => upAc.abort(), 120_000)
        let upRes: Response
        try {
          upRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: fd,
            signal: upAc.signal,
          })
        } catch (netErr) {
          const msg =
            netErr instanceof DOMException && netErr.name === 'AbortError'
              ? 'Resume upload timed out. Check that the backend is running and reachable.'
              : netErr instanceof Error
                ? netErr.message
                : 'Could not reach the server to upload the resume.'
          setError(
            `${msg} Expected API at ${uploadUrl}. If the app is not on the same machine, set VITE_BACKEND_URL or VITE_ZOOM_API_BASE in the frontend env.`,
          )
          return
        } finally {
          window.clearTimeout(upTo)
        }
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

      const exp = editForm.experience_years.trim()
        ? Number.parseFloat(editForm.experience_years)
        : null

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
      }

      const patchUrl = `${origin}/api/admin/students/${student.id}`
      const ac = new AbortController()
      const to = window.setTimeout(() => ac.abort(), 120_000)
      try {
        const res = await fetch(patchUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(patchBody),
          signal: ac.signal,
        })
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          setError(body.error ?? `Save failed (${res.status}).`)
          return
        }
      } catch (netErr) {
        const msg =
          netErr instanceof DOMException && netErr.name === 'AbortError'
            ? 'Save timed out. Check that the backend is running (same URL as resume upload).'
            : netErr instanceof Error
              ? netErr.message
              : 'Could not reach the server to save.'
        setError(`${msg} Expected API at ${patchUrl}.`)
        return
      } finally {
        window.clearTimeout(to)
      }

      setPendingResumeFile(null)
      setEditOpen(false)
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

  const timelineItems = useMemo((): TimelineItem[] => {
    const out: TimelineItem[] = []
    for (const a of activities) {
      const d = a.activity_date ?? a.created_at?.slice(0, 10) ?? null
      out.push({
        id: `act-${a.id}`,
        sort: d ? new Date(d).getTime() : 0,
        title: a.activity_type,
        sub: displayDash(a.notes),
        dateLabel: formatShortDate(d),
      })
    }
    for (const p of payments) {
      out.push({
        id: `pay-${p.id}`,
        sort: p.paid_on ? new Date(p.paid_on).getTime() : 0,
        title: `Payment ₹${Number(p.amount).toLocaleString('en-IN')}`,
        sub: `${p.payment_mode.replace(/_/g, ' ')}${p.notes ? ` · ${p.notes}` : ''}`,
        dateLabel: formatShortDate(p.paid_on),
      })
    }
    for (const i of interviews) {
      out.push({
        id: `int-${i.id}`,
        sort: i.interview_date ? new Date(i.interview_date).getTime() : 0,
        title: `Interview · ${i.company_name}`,
        sub: `${humanizeStage(i.stage)}${i.role_title ? ` · ${i.role_title}` : ''}`,
        dateLabel: formatShortDate(i.interview_date),
      })
    }
    out.sort((x, y) => y.sort - x.sort)
    return out
  }, [activities, payments, interviews])

  const filledStarCount = trainerRatingFilledStars(student?.trainer_rating ?? null)
  const activeNow = student != null && isActiveStudent(student.last_activity_at)

  const progressPct = Math.min(
    100,
    Math.max(0, Math.round(student?.progress_pct ?? 0)),
  )
  const attendPct = Math.min(
    100,
    Math.max(0, Math.round(student?.attendance_pct ?? 0)),
  )

  if (loading) {
    return (
      <div className="admin-student-profile-page">
        <p className="asp-muted">Loading student…</p>
      </div>
    )
  }

  if (error && !student) {
    return (
      <div className="admin-student-profile-page">
        <button type="button" className="asp-back" onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={2} />
          <span>Back to Students</span>
        </button>
        <p className="asp-error">{error}</p>
      </div>
    )
  }

  if (!student) {
    return null
  }

  return (
    <div className="admin-student-profile-page">
      <button type="button" className="asp-back" onClick={onBack}>
        <ArrowLeft size={18} strokeWidth={2} className="asp-back-icon" />
        <span>Back to Students</span>
      </button>

      {error ? <p className="asp-error-banner">{error}</p> : null}

      <header className="asp-header-card">
        <div className="asp-header-grid">
          <div className="asp-profile-block">
            <div className="asp-avatar-wrap">
              <div className="asp-avatar">{studentInitials(student.student_name)}</div>
              <span className="asp-avatar-dot" aria-hidden />
            </div>
            <div className="asp-profile-info">
              <div className="asp-name-row">
                <h1 className="asp-name">{student.student_name}</h1>
                <span className="asp-name-rating-stars" aria-label={`Trainer rating ${filledStarCount} of 3`}>
                  {[0, 1, 2].map((i) => (
                    <Star
                      key={i}
                      size={14}
                      strokeWidth={2}
                      className={i < filledStarCount ? 'asp-star asp-star-filled' : 'asp-star asp-star-empty'}
                      fill={i < filledStarCount ? '#F59E0B' : 'none'}
                      color={i < filledStarCount ? '#F59E0B' : '#CBD5E1'}
                    />
                  ))}
                </span>
              </div>
              <div className="asp-contact-list">
                <div className="asp-contact-row">
                  <Mail size={16} strokeWidth={2} className="asp-contact-ic" />
                  <span className={isFilled(student.email) ? 'asp-contact-text' : 'asp-empty-value'}>
                    {isFilled(student.email) ? student.email : emptyMessage('available')}
                  </span>
                </div>
                <div className="asp-contact-row">
                  <Phone size={16} strokeWidth={2} className="asp-contact-ic" />
                  <span className={isFilled(student.phone) ? 'asp-contact-text' : 'asp-empty-value'}>
                    {isFilled(student.phone) ? student.phone! : emptyMessage('available')}
                  </span>
                </div>
              </div>
              <div className="asp-profile-status-row">
                <span className="asp-stage-pill">{humanizeStage(student.stage)}</span>
                <span className={`asp-status-badge ${activeNow ? '' : 'is-inactive'}`}>
                  {activeNow ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          <div className="asp-info-col asp-info-col-border">
            <div className="asp-metric">
              <Layers size={20} strokeWidth={2} className="asp-metric-icon-side" />
              <div className="asp-metric-body">
                <span className="asp-metric-label">Current batch</span>
                <span
                  className={
                    isFilled(primaryBatch?.batch_code ?? null)
                      ? 'asp-metric-value'
                      : 'asp-empty-value'
                  }
                >
                  {isFilled(primaryBatch?.batch_code ?? null)
                    ? primaryBatch!.batch_code
                    : emptyMessage('assigned')}
                </span>
              </div>
            </div>
            <div className="asp-metric">
              <User size={20} strokeWidth={2} className="asp-metric-icon-side" />
              <div className="asp-metric-body">
                <span className="asp-metric-label">Trainer</span>
                <span
                  className={
                    isFilled(primaryBatch?.trainer_name ?? null)
                      ? 'asp-metric-value'
                      : 'asp-empty-value'
                  }
                >
                  {isFilled(primaryBatch?.trainer_name ?? null)
                    ? primaryBatch!.trainer_name!
                    : emptyMessage('trainer')}
                </span>
              </div>
            </div>
            <div className="asp-metric">
              <Calendar size={20} strokeWidth={2} className="asp-metric-icon-side" />
              <div className="asp-metric-body">
                <span className="asp-metric-label">Joined on</span>
                {primaryBatch?.joined_at ? (
                  <span className="asp-metric-value">{formatJoined(primaryBatch.joined_at)}</span>
                ) : (
                  <span className="asp-empty-value">{emptyMessage('available')}</span>
                )}
              </div>
            </div>
          </div>

          <div className="asp-info-col">
            <div className="asp-metric">
              <Target size={20} strokeWidth={2} className="asp-metric-icon-side" />
              <div className="asp-metric-body">
                <span className="asp-metric-label">Current stage</span>
                <span className="asp-metric-value">{humanizeStage(student.stage)}</span>
              </div>
            </div>
            <div className="asp-metric">
              <Percent size={20} strokeWidth={2} className="asp-metric-icon-side" />
              <div className="asp-metric-body">
                <span className="asp-metric-label">Attendance</span>
                {student.attendance_pct != null ? (
                  <span className="asp-metric-value">{`${attendPct}%`}</span>
                ) : (
                  <span className="asp-empty-value">{emptyMessage('available')}</span>
                )}
              </div>
            </div>
            <div className="asp-metric asp-metric-progress">
              <TrendingUp size={20} strokeWidth={2} className="asp-metric-icon-side" />
              <div className="asp-metric-body">
                <span className="asp-metric-label">Progress</span>
                {student.progress_pct != null ? (
                  <>
                    <span className="asp-metric-value">{`${progressPct}%`}</span>
                    <div className="asp-progress-below" role="presentation">
                      <div className="asp-progress-track">
                        <div className="asp-progress-fill" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="asp-empty-value">{emptyMessage('available')}</span>
                )}
              </div>
            </div>
          </div>

          <div className="asp-header-actions" ref={moreRef}>
            <button type="button" className="asp-btn asp-btn-secondary asp-btn-header" onClick={openEdit}>
              <Pencil size={14} strokeWidth={2} />
              Edit
            </button>
            <div className="asp-more-wrap">
              <button
                type="button"
                className="asp-btn asp-btn-ghost asp-btn-header"
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
              >
                More Actions
                <MoreHorizontal size={14} strokeWidth={2} />
              </button>
              {moreOpen ? (
                <div className="asp-dropdown">
                  <button
                    type="button"
                    onClick={() => copyText('Student ID', student.id)}
                  >
                    Copy student ID
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText('Email', student.email)}
                  >
                    Copy email
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="asp-tabs-outer">
        <div className="asp-tabs-scroll">
          <div className="asp-tabs">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`asp-tab ${tab === key ? 'is-active' : ''}`}
                onClick={() => setTab(key)}
              >
                <Icon size={16} strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="asp-content">
        {tab === 'personal' ? (
          <section className="asp-card asp-personal-combined">
            <div className="asp-personal-block">
              <div className="asp-card-head">
                <div className="asp-card-head-left">
                  <User size={18} strokeWidth={2} className="asp-card-head-icon" />
                  <h2 className="asp-card-title">Basic information</h2>
                </div>
                <button type="button" className="asp-btn asp-btn-ghost asp-btn-sm" onClick={openEdit}>
                  Edit profile
                </button>
              </div>
              <div className="asp-field-grid asp-field-grid-5">
                {(
                  [
                    ['Full name', student.student_name, 'available' as const],
                    ['Email', student.email, 'available' as const],
                    ['Phone', student.phone, 'available' as const],
                    ['Gender', student.gender, 'available' as const],
                    ['City', student.location, 'assigned' as const],
                  ] as const
                ).map(([label, val, kind]) => (
                  <div key={label} className="asp-field">
                    <span className="asp-field-label">{label}</span>
                    <span className={isFilled(val) ? 'asp-field-value' : 'asp-empty-value'}>
                      {isFilled(val) ? val! : emptyMessage(kind)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="asp-personal-divider" role="presentation" />

            <div className="asp-personal-block asp-personal-block-edu">
              <div className="asp-card-head">
                <div className="asp-card-head-left">
                  <GraduationCap size={18} strokeWidth={2} className="asp-card-head-icon" />
                  <h2 className="asp-card-title">Background</h2>
                </div>
              </div>
              <div className="asp-field-grid asp-field-grid-5">
                {(
                  [
                    ['Degree', student.degree, 'available' as const],
                    ['Previous company', student.previous_company, 'assigned' as const],
                    ['Previous role', student.previous_job_role, 'available' as const],
                    [
                      'Experience',
                      student.experience_years != null ? `${student.experience_years} yrs` : null,
                      'available' as const,
                    ],
                    ['Domain', student.domain, 'assigned' as const],
                  ] as const
                ).map(([label, val, kind]) => (
                  <div key={label} className="asp-field">
                    <span className="asp-field-label">{label}</span>
                    <span className={isFilled(val) ? 'asp-field-value' : 'asp-empty-value'}>
                      {isFilled(val) ? val! : emptyMessage(kind)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="asp-personal-divider" role="presentation" />

            <div className="asp-personal-block">
              <div className="asp-card-head">
                <div className="asp-card-head-left">
                  <Link2 size={18} strokeWidth={2} className="asp-card-head-icon" />
                  <h2 className="asp-card-title">Profile links</h2>
                </div>
              </div>
              <div className="asp-link-grid">
                {(
                  [
                    {
                      title: 'Resume',
                      sub: student.resume_url ? 'Open file' : 'Not added',
                      url: student.resume_url,
                      icon: FileText,
                    },
                    {
                      title: 'LinkedIn',
                      sub: student.linkedin_url ? 'View profile' : 'Not added',
                      url: student.linkedin_url,
                      icon: Link2,
                    },
                    {
                      title: 'Naukri',
                      sub: student.naukri_url ? 'View profile' : 'Not added',
                      url: student.naukri_url,
                      icon: Link2,
                    },
                    {
                      title: 'Portfolio',
                      sub: student.portfolio_url ? 'View site' : 'Not added',
                      url: student.portfolio_url,
                      icon: ExternalLink,
                    },
                  ] as const
                ).map((item) =>
                  item.url ? (
                    <a
                      key={item.title}
                      href={item.url}
                      className="asp-link-tile"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="asp-link-tile-left">
                        <item.icon size={18} strokeWidth={2} className="asp-card-head-icon" />
                        <div>
                          <div className="asp-link-tile-title">{item.title}</div>
                          <div className="asp-link-tile-sub">{item.sub}</div>
                        </div>
                      </div>
                      <ExternalLink size={16} strokeWidth={2} className="asp-link-tile-ext" />
                    </a>
                  ) : (
                    <button key={item.title} type="button" className="asp-link-tile is-disabled">
                      <div className="asp-link-tile-left">
                        <item.icon size={18} strokeWidth={2} className="asp-card-head-icon" />
                        <div>
                          <div className="asp-link-tile-title">{item.title}</div>
                          <div className="asp-link-tile-sub">{item.sub}</div>
                        </div>
                      </div>
                      <ExternalLink size={16} strokeWidth={2} className="asp-link-tile-ext" />
                    </button>
                  ),
                )}
              </div>
            </div>
          </section>
        ) : null}

        {tab === 'timeline' ? (
          <section className="asp-card">
            <div className="asp-card-head">
              <div className="asp-card-head-left">
                <Activity size={18} strokeWidth={2} className="asp-card-head-icon" />
                <h2 className="asp-card-title">Activity timeline</h2>
              </div>
            </div>
            {timelineItems.length === 0 ? (
              <p className="asp-muted">No activity, payments, or interviews recorded yet.</p>
            ) : (
              <ul className="asp-timeline">
                {timelineItems.map((row) => (
                  <li key={row.id} className="asp-timeline-item">
                    <div className="asp-timeline-dot" />
                    <div className="asp-timeline-body">
                      <div className="asp-timeline-top">
                        <strong>{row.title}</strong>
                        <span className="asp-timeline-date">{row.dateLabel}</span>
                      </div>
                      <p className="asp-timeline-sub">{row.sub}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {tab === 'payments' ? (
          <section className="asp-card asp-card-table-wrap">
            <div className="asp-card-head">
              <div className="asp-card-head-left">
                <CreditCard size={18} strokeWidth={2} className="asp-card-head-icon" />
                <h2 className="asp-card-title">Payments</h2>
              </div>
            </div>
            {payments.length === 0 ? (
              <p className="asp-muted">No payment records.</p>
            ) : (
              <div className="asp-table-scroll">
                <table className="asp-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Mode</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{formatShortDate(p.paid_on)}</td>
                        <td>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                        <td>{humanizeStage(p.payment_mode)}</td>
                        <td>{displayDash(p.notes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {tab === 'interviews' ? (
          <section className="asp-card asp-card-table-wrap">
            <div className="asp-card-head">
              <div className="asp-card-head-left">
                <Users size={18} strokeWidth={2} className="asp-card-head-icon" />
                <h2 className="asp-card-title">Interviews</h2>
              </div>
            </div>
            {interviews.length === 0 ? (
              <p className="asp-muted">No interviews logged.</p>
            ) : (
              <div className="asp-table-scroll">
                <table className="asp-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Role</th>
                      <th>Stage</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interviews.map((i) => (
                      <tr key={i.id}>
                        <td>{i.company_name}</td>
                        <td>{displayDash(i.role_title)}</td>
                        <td>{humanizeStage(i.stage)}</td>
                        <td>{formatShortDate(i.interview_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {tab === 'documents' ? (
          <section className="asp-card">
            <div className="asp-card-head">
              <div className="asp-card-head-left">
                <FolderOpen size={18} strokeWidth={2} className="asp-card-head-icon" />
                <h2 className="asp-card-title">Documents</h2>
              </div>
            </div>
            {student.resume_url ? (
              <a
                href={student.resume_url}
                target="_blank"
                rel="noreferrer"
                className="asp-doc-link"
              >
                <FileText size={18} strokeWidth={2} />
                Resume
                <ExternalLink size={16} strokeWidth={2} />
              </a>
            ) : (
              <p className="asp-muted">No documents uploaded. Add a resume from Edit student (upload or URL).</p>
            )}
          </section>
        ) : null}

        {tab === 'feedback' ? (
          <section className="asp-card">
            <div className="asp-card-head">
              <div className="asp-card-head-left">
                <MessageSquare size={18} strokeWidth={2} className="asp-card-head-icon" />
                <h2 className="asp-card-title">Trainer feedback</h2>
              </div>
            </div>
            <p className="asp-muted">
              Trainer rating:{' '}
              <strong className="asp-strong">
                {student.trainer_rating != null ? `${student.trainer_rating.toFixed(1)} / 5` : '—'}
              </strong>
            </p>
            <p className="asp-feedback-body">{displayDash(student.comments)}</p>
            <button type="button" className="asp-btn asp-btn-secondary" onClick={openEdit}>
              Edit notes
            </button>
          </section>
        ) : null}
      </div>

      {editOpen ? (
        <div className="asp-modal-overlay" role="presentation" onClick={() => setEditOpen(false)}>
          <div
            className="asp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asp-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="asp-modal-head">
              <h2 id="asp-edit-title" className="asp-modal-title">
                Edit student
              </h2>
              <button type="button" className="asp-modal-close" onClick={() => setEditOpen(false)}>
                ×
              </button>
            </div>
            <div className="asp-modal-body">
              <label className="asp-label">
                Full name
                <input
                  className="asp-input"
                  value={editForm.student_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, student_name: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Email
                <input
                  className="asp-input"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Phone
                <input
                  className="asp-input"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Gender
                <input
                  className="asp-input"
                  value={editForm.gender}
                  onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                City
                <input
                  className="asp-input"
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Degree
                <input
                  className="asp-input"
                  value={editForm.degree}
                  onChange={(e) => setEditForm((f) => ({ ...f, degree: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Previous company
                <input
                  className="asp-input"
                  value={editForm.previous_company}
                  onChange={(e) => setEditForm((f) => ({ ...f, previous_company: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Previous role
                <input
                  className="asp-input"
                  value={editForm.previous_job_role}
                  onChange={(e) => setEditForm((f) => ({ ...f, previous_job_role: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Experience (years)
                <input
                  className="asp-input"
                  value={editForm.experience_years}
                  onChange={(e) => setEditForm((f) => ({ ...f, experience_years: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Domain
                <input
                  className="asp-input"
                  value={editForm.domain}
                  onChange={(e) => setEditForm((f) => ({ ...f, domain: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Stage
                <select
                  className="asp-input"
                  value={editForm.stage}
                  onChange={(e) => setEditForm((f) => ({ ...f, stage: e.target.value }))}
                >
                  <option value="training">Training</option>
                  <option value="trial_classes">Trial classes</option>
                  <option value="mock_interviews">Mock interviews</option>
                  <option value="searching_for_jobs">Searching for jobs</option>
                  <option value="taking_interviews">Taking interviews</option>
                  <option value="placed">Placed</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="asp-label">
                Payment status
                <select
                  className="asp-input"
                  value={editForm.payment_status}
                  onChange={(e) => setEditForm((f) => ({ ...f, payment_status: e.target.value }))}
                >
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>
              </label>
              <label className="asp-label">
                Resume
                <input
                  type="file"
                  className="asp-input asp-input-file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    setPendingResumeFile(f)
                  }}
                />
                {pendingResumeFile ? (
                  <span className="asp-muted">{pendingResumeFile.name} — will upload on Save</span>
                ) : editForm.resume_url.trim() ? (
                  <span className="asp-muted">Current link kept unless you replace it below.</span>
                ) : (
                  <span className="asp-muted">
                    PDF or Word · uploads go through the app backend (service role). Ensure it is running
                    and your account has admin access.
                  </span>
                )}
              </label>
              <label className="asp-label">
                Resume URL (optional)
                <input
                  className="asp-input"
                  placeholder="https://…"
                  value={editForm.resume_url}
                  onChange={(e) => setEditForm((f) => ({ ...f, resume_url: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                LinkedIn URL
                <input
                  className="asp-input"
                  placeholder="https://www.linkedin.com/in/…"
                  value={editForm.linkedin_url}
                  onChange={(e) => setEditForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Naukri URL
                <input
                  className="asp-input"
                  placeholder="https://…"
                  value={editForm.naukri_url}
                  onChange={(e) => setEditForm((f) => ({ ...f, naukri_url: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Portfolio URL
                <input
                  className="asp-input"
                  placeholder="https://…"
                  value={editForm.portfolio_url}
                  onChange={(e) => setEditForm((f) => ({ ...f, portfolio_url: e.target.value }))}
                />
              </label>
              <label className="asp-label">
                Internal notes
                <textarea
                  className="asp-textarea"
                  rows={4}
                  value={editForm.comments}
                  onChange={(e) => setEditForm((f) => ({ ...f, comments: e.target.value }))}
                />
              </label>
            </div>
            <div className="asp-modal-foot">
              <button type="button" className="asp-btn asp-btn-ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="asp-btn asp-btn-primary"
                disabled={saving}
                onClick={() => void saveEdit()}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
