import { useEffect, useMemo, useState } from 'react'
import { SpxLoader } from '../components/SpxLoader'
import { ArrowLeft, Mail, Phone, Users, BookOpen, Award, Calendar, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export type AdminTrainerDetailPageProps = {
  trainerId: string
  onBack: () => void
}

type TrainerRecord = {
  id: string
  trainer_name: string
  email: string | null
  phone: string | null
  comments: string | null
}

type BatchRow = {
  id: string
  batch_code: string
  status: string
  start_date: string | null
  trainer_id: string | null
}

type StudentBatchRow = {
  student_id: string
  batch_id: string
  is_active: boolean
}

type ClassSessionRow = {
  id: string
  batch_id: string
  trainer_id: string | null
  starts_at: string
  zoom_status: string | null
}

type AssignmentRow = {
  id: string
  batch_id: string
}

type AssignmentSubmissionRow = {
  assignment_id: string
  submitted_at: string | null
}

type InterviewRow = {
  student_id: string
  stage: string
}

type PlacementRow = {
  student_id: string
}

type MockInterviewRow = {
  trainer_id: string | null
  status: string
}

type TabKey = 'overview' | 'batches' | 'classes' | 'performance' | 'notes'

type Availability = 'available' | 'almost_full' | 'full'

const MAX_BATCH_CAPACITY = 3

const tabs: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'batches', label: 'Batches' },
  { key: 'classes', label: 'Classes' },
  { key: 'performance', label: 'Performance' },
  { key: 'notes', label: 'Notes' },
]

export function AdminTrainerDetailPage({ trainerId, onBack }: AdminTrainerDetailPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trainer, setTrainer] = useState<TrainerRecord | null>(null)
  const [allBatches, setAllBatches] = useState<BatchRow[]>([])
  const [studentBatches, setStudentBatches] = useState<StudentBatchRow[]>([])
  const [classSessions, setClassSessions] = useState<ClassSessionRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmissionRow[]>([])
  const [interviews, setInterviews] = useState<InterviewRow[]>([])
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [mockInterviews, setMockInterviews] = useState<MockInterviewRow[]>([])
  const [tab, setTab] = useState<TabKey>('overview')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      const { data: tr, error: trErr } = await supabase
        .from('trainers')
        .select('id,trainer_name,email,phone,comments')
        .eq('id', trainerId)
        .maybeSingle()

      if (trErr || !tr) {
        setError(trErr?.message ?? 'Trainer not found.')
        setTrainer(null)
        setLoading(false)
        return
      }

      setTrainer(tr as TrainerRecord)

      const [
        { data: batchRows },
        { data: sbRows },
        { data: classRows },
        { data: assignmentRows },
        { data: submissionRows },
        { data: interviewRows },
        { data: placementRows },
        { data: mockRows },
      ] = await Promise.all([
        supabase.from('batches').select('id,batch_code,status,start_date,trainer_id').eq('trainer_id', trainerId),
        supabase.from('student_batches').select('student_id,batch_id,is_active'),
        supabase.from('class_sessions').select('id,batch_id,trainer_id,starts_at,zoom_status').eq('trainer_id', trainerId),
        supabase.from('assignments').select('id,batch_id'),
        supabase.from('assignment_submissions').select('assignment_id,submitted_at'),
        supabase.from('interviews').select('student_id,stage'),
        supabase.from('placements').select('student_id'),
        supabase.from('mock_interviews').select('trainer_id,status').eq('trainer_id', trainerId),
      ])

      setAllBatches((batchRows ?? []) as BatchRow[])
      setStudentBatches((sbRows ?? []) as StudentBatchRow[])
      setClassSessions((classRows ?? []) as ClassSessionRow[])
      setAssignments((assignmentRows ?? []) as AssignmentRow[])
      setAssignmentSubmissions((submissionRows ?? []) as AssignmentSubmissionRow[])
      setInterviews((interviewRows ?? []) as InterviewRow[])
      setPlacements((placementRows ?? []) as PlacementRow[])
      setMockInterviews((mockRows ?? []) as MockInterviewRow[])
      setLoading(false)
    }

    void load()
  }, [trainerId])

  const activeBatches = useMemo(
    () => allBatches.filter((b) => !['completed', 'archived', 'cancelled'].includes((b.status ?? '').toLowerCase())),
    [allBatches],
  )

  const availability: Availability = useMemo(() => {
    const count = activeBatches.length
    if (count >= MAX_BATCH_CAPACITY) return 'full'
    if (count === MAX_BATCH_CAPACITY - 1) return 'almost_full'
    return 'available'
  }, [activeBatches])

  const batchIds = useMemo(() => new Set(allBatches.map((b) => b.id)), [allBatches])

  const studentIdsByBatch = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const row of studentBatches) {
      if (!row.is_active) continue
      const set = map.get(row.batch_id) ?? new Set<string>()
      set.add(row.student_id)
      map.set(row.batch_id, set)
    }
    return map
  }, [studentBatches])

  const studentCountByBatch = useMemo(() => {
    const map = new Map<string, number>()
    for (const bId of batchIds) {
      map.set(bId, studentIdsByBatch.get(bId)?.size ?? 0)
    }
    return map
  }, [batchIds, studentIdsByBatch])

  const studentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const bId of batchIds) {
      for (const sId of studentIdsByBatch.get(bId) ?? []) {
        ids.add(sId)
      }
    }
    return ids
  }, [batchIds, studentIdsByBatch])

  const studentCount = studentIds.size

  const submittedAssignmentCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of assignmentSubmissions) {
      if (!row.submitted_at) continue
      map.set(row.assignment_id, (map.get(row.assignment_id) ?? 0) + 1)
    }
    return map
  }, [assignmentSubmissions])

  const trainerAssignments = useMemo(
    () => assignments.filter((a) => batchIds.has(a.batch_id)),
    [assignments, batchIds],
  )

  const assignmentCompletionPct = useMemo(() => {
    const expectedSubmissions = trainerAssignments.length * Math.max(studentCount, 1)
    const actualSubmissions = trainerAssignments.reduce(
      (sum, a) => sum + (submittedAssignmentCounts.get(a.id) ?? 0),
      0,
    )
    return expectedSubmissions > 0
      ? Math.max(0, Math.min(100, Math.round((actualSubmissions / expectedSubmissions) * 100)))
      : 0
  }, [trainerAssignments, studentCount, submittedAssignmentCounts])

  const mockCompletedCount = useMemo(
    () => mockInterviews.filter((m) => m.status === 'completed').length,
    [mockInterviews],
  )

  const mockCompletionPct = useMemo(
    () => (mockInterviews.length ? Math.round((mockCompletedCount / mockInterviews.length) * 100) : 0),
    [mockInterviews, mockCompletedCount],
  )

  const trainerInterviews = useMemo(
    () => interviews.filter((i) => studentIds.has(i.student_id)),
    [interviews, studentIds],
  )

  const interviewSuccessPct = useMemo(() => {
    const selected = trainerInterviews.filter((i) => i.stage === 'selected').length
    return trainerInterviews.length ? Math.round((selected / trainerInterviews.length) * 100) : 0
  }, [trainerInterviews])

  const placementStudentIdSet = useMemo(
    () => new Set(placements.map((r) => r.student_id)),
    [placements],
  )

  const placementCount = useMemo(
    () => Array.from(studentIds).filter((id) => placementStudentIdSet.has(id)).length,
    [studentIds, placementStudentIdSet],
  )

  const placementPct = studentCount ? Math.round((placementCount / studentCount) * 100) : 0

  const performanceScore = Math.round(
    assignmentCompletionPct * 0.4 +
      mockCompletionPct * 0.2 +
      interviewSuccessPct * 0.2 +
      placementPct * 0.2,
  )

  const now = Date.now()

  const totalClasses = classSessions.length
  const upcomingClasses = useMemo(
    () => classSessions.filter((c) => new Date(c.starts_at).getTime() > now).length,
    [classSessions, now],
  )
  const missedClasses = useMemo(
    () => classSessions.filter((c) => (c.zoom_status ?? '').toLowerCase() === 'cancelled').length,
    [classSessions],
  )
  const upcomingClassRows = useMemo(
    () =>
      classSessions
        .filter((c) => new Date(c.starts_at).getTime() > now)
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
        .slice(0, 6),
    [classSessions, now],
  )

  if (loading) {
    return <SpxLoader label="Loading trainer..." />
  }

  if (error && !trainer) {
    return (
      <div className="spx-page">
        <div className="spx-topbar">
          <button type="button" className="spx-back-btn" onClick={onBack}>
            <ArrowLeft size={15} /> Back to Trainers
          </button>
        </div>
        <div style={{ padding: 32, color: '#DC2626' }}>{error}</div>
      </div>
    )
  }

  if (!trainer) return null

  return (
    <div className="spx-page">
      <div className="spx-topbar">
        <button type="button" className="spx-back-btn" onClick={onBack}>
          <ArrowLeft size={15} /> Back to Trainers
        </button>
      </div>

      {error && <div className="spx-error-banner">{error}</div>}

      <div className="spx-body">
        <div className="spx-col-main">
          {/* Hero */}
          <div className="spx-hero">
            <div className="spx-hero-top">
              <div className="spx-avatar">
                {trainer.trainer_name[0]?.toUpperCase()}
                {trainer.trainer_name.split(' ')[1]?.[0]?.toUpperCase() ?? ''}
              </div>
              <div className="spx-hero-info">
                <div className="spx-hero-name-row">
                  <span className="spx-hero-name">{trainer.trainer_name}</span>
                </div>
                <div className="spx-hero-meta">
                  <span className="spx-meta-item">
                    <Mail size={14} /> {trainer.email ?? '—'}
                  </span>
                  {trainer.phone && (
                    <span className="spx-meta-item">
                      <Phone size={14} /> {trainer.phone}
                    </span>
                  )}
                </div>
                <div className="spx-badge-row">
                  <span className="spx-badge spx-badge-training">
                    {activeBatches.length >= 3 ? 'Senior Trainer' : 'Trainer'}
                  </span>
                  <span
                    className={`spx-badge ${
                      availability === 'available'
                        ? 'spx-badge-active'
                        : availability === 'full'
                          ? 'spx-badge-inactive'
                          : 'spx-badge-training'
                    }`}
                  >
                    {availability === 'available'
                      ? 'Available'
                      : availability === 'full'
                        ? 'Full'
                        : 'Almost Full'}
                  </span>
                  <span
                    className={`spx-badge ${
                      activeBatches.length > 0 ? 'spx-badge-active' : 'spx-badge-inactive'
                    }`}
                  >
                    <CheckCircle size={11} /> {activeBatches.length > 0 ? 'Active' : 'Idle'}
                  </span>
                </div>
              </div>
            </div>

            <div className="spx-hero-stats">
              <div className="spx-stat">
                <div className="spx-stat-lbl">Active Batches</div>
                <div className="spx-stat-val">{activeBatches.length}</div>
              </div>
              <div className="spx-stat">
                <div className="spx-stat-lbl">Total Students</div>
                <div className="spx-stat-val">{studentCount}</div>
              </div>
              <div className="spx-stat">
                <div className="spx-stat-lbl">Performance Score</div>
                <div className="spx-stat-val">{performanceScore}%</div>
              </div>
              <div className="spx-stat">
                <div className="spx-stat-lbl">Total Classes</div>
                <div className="spx-stat-val">{totalClasses}</div>
              </div>
              <div className="spx-stat">
                <div className="spx-stat-lbl">Mock Completed</div>
                <div className="spx-stat-val">{mockCompletedCount}</div>
              </div>
              <div className="spx-stat">
                <div className="spx-stat-lbl">Placements</div>
                <div className="spx-stat-val">{placementCount}</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="spx-tabs">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`spx-tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {tab === 'overview' && (
            <div className="spx-section">
              <div className="spx-section-hdr">
                <span className="spx-section-title">
                  <Award size={16} /> Key Metrics
                </span>
              </div>
              <div className="spx-field-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="trainer-kpi-card">
                  <p>Assignment Completion</p>
                  <h3>{assignmentCompletionPct}%</h3>
                  <div className="trainer-kpi-bar">
                    <div style={{ width: `${assignmentCompletionPct}%` }} />
                  </div>
                </div>
                <div className="trainer-kpi-card">
                  <p>Mock Completion</p>
                  <h3>{mockCompletionPct}%</h3>
                  <div className="trainer-kpi-bar">
                    <div style={{ width: `${mockCompletionPct}%` }} />
                  </div>
                </div>
                <div className="trainer-kpi-card">
                  <p>Interview Success</p>
                  <h3>{interviewSuccessPct}%</h3>
                  <div className="trainer-kpi-bar">
                    <div style={{ width: `${interviewSuccessPct}%` }} />
                  </div>
                </div>
                <div className="trainer-kpi-card">
                  <p>Placement Conversion</p>
                  <h3>{placementPct}%</h3>
                  <div className="trainer-kpi-bar">
                    <div style={{ width: `${placementPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Batches Tab */}
          {tab === 'batches' && (
            <div className="spx-section">
              <div className="spx-section-hdr">
                <span className="spx-section-title">
                  <BookOpen size={16} /> Assigned Batches
                </span>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {allBatches.length} batch{allBatches.length !== 1 ? 'es' : ''} total
                </span>
              </div>
              {allBatches.length === 0 ? (
                <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                  No batches assigned to this trainer.
                </div>
              ) : (
                <table className="batch-roster-table">
                  <thead>
                    <tr>
                      <th>Batch Code</th>
                      <th>Status</th>
                      <th>Students</th>
                      <th>Start Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBatches.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <strong>{b.batch_code}</strong>
                        </td>
                        <td>
                          <span
                            className={`tag-pill ${
                              b.status === 'active'
                                ? 'badge-green'
                                : b.status === 'completed'
                                  ? 'badge-gray'
                                  : b.status === 'planned'
                                    ? 'badge-yellow'
                                    : 'badge-gray'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td>{studentCountByBatch.get(b.id) ?? 0}</td>
                        <td>
                          {b.start_date
                            ? new Date(b.start_date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Classes Tab */}
          {tab === 'classes' && (
            <>
              <div className="spx-section">
                <div className="spx-section-hdr">
                  <span className="spx-section-title">
                    <Calendar size={16} /> Class Summary
                  </span>
                </div>
                <div className="spx-field-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  <div className="trainer-kpi-card">
                    <p>Total Classes</p>
                    <h3>{totalClasses}</h3>
                  </div>
                  <div className="trainer-kpi-card">
                    <p>Upcoming Classes</p>
                    <h3>{upcomingClasses}</h3>
                  </div>
                  <div className="trainer-kpi-card">
                    <p>Missed / Cancelled</p>
                    <h3>{missedClasses}</h3>
                  </div>
                </div>
              </div>
              <div className="spx-section">
                <div className="spx-section-hdr">
                  <span className="spx-section-title">
                    <Calendar size={16} /> Upcoming Classes
                  </span>
                </div>
                {upcomingClassRows.length === 0 ? (
                  <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
                    No upcoming classes scheduled.
                  </div>
                ) : (
                  <div className="spx-field-grid" style={{ gridTemplateColumns: '1fr' }}>
                    {upcomingClassRows.map((row) => (
                      <div
                        key={row.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 14px',
                          background: '#FAFAF8',
                          borderRadius: 8,
                          fontSize: 13,
                        }}
                      >
                        <Calendar size={14} style={{ color: '#6B7280', flexShrink: 0 }} />
                        <span style={{ fontWeight: 500 }}>
                          {new Date(row.starts_at).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span style={{ color: '#9CA3AF', marginLeft: 'auto', fontSize: 12 }}>
                          {row.zoom_status ?? 'scheduled'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Performance Tab */}
          {tab === 'performance' && (
            <div className="spx-section">
              <div className="spx-section-hdr">
                <span className="spx-section-title">
                  <Award size={16} /> Performance Breakdown
                </span>
              </div>
              <div className="spx-field-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="trainer-kpi-card">
                  <p>Performance Score</p>
                  <h3>{performanceScore}%</h3>
                  <div className="trainer-kpi-bar">
                    <div style={{ width: `${performanceScore}%` }} />
                  </div>
                </div>
                <div className="trainer-kpi-card">
                  <p>Assignment Completion</p>
                  <h3>{assignmentCompletionPct}%</h3>
                  <div className="trainer-kpi-bar">
                    <div style={{ width: `${assignmentCompletionPct}%` }} />
                  </div>
                </div>
                <div className="trainer-kpi-card">
                  <p>Interview Success</p>
                  <h3>{interviewSuccessPct}%</h3>
                  <div className="trainer-kpi-bar">
                    <div style={{ width: `${interviewSuccessPct}%` }} />
                  </div>
                </div>
                <div className="trainer-kpi-card">
                  <p>Placement Conversion</p>
                  <h3>{placementPct}%</h3>
                  <div className="trainer-kpi-bar">
                    <div style={{ width: `${placementPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes Tab */}
          {tab === 'notes' && (
            <div className="spx-section">
              <div className="spx-section-hdr">
                <span className="spx-section-title">
                  <Users size={16} /> Trainer Notes
                </span>
              </div>
              <div
                style={{
                  padding: '16px 18px',
                  background: '#FAFAF8',
                  borderRadius: 10,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: trainer.comments ? '#1F2937' : '#9CA3AF',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {trainer.comments ?? 'No notes yet.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
