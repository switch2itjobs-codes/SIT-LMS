import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  Filter,
  MoreVertical,
  Plus,
  Search,
  Users,
  UserCheck,
  UserX,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type TrainerRow = {
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
  trainer_id: string | null
  start_date: string | null
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
  status: 'scheduled' | 'completed' | 'missed'
}

type Availability = 'available' | 'almost_full' | 'full'

type TrainerMetric = {
  trainer: TrainerRow
  activeBatches: BatchRow[]
  allBatches: BatchRow[]
  batchTags: string[]
  currentBatchCount: number
  maxBatchCapacity: number
  slotsLeft: number
  availability: Availability
  studentCount: number
  assignmentCompletionPct: number
  mockCompletedCount: number
  mockCompletionPct: number
  interviewSuccessPct: number
  placementCount: number
  placementPct: number
  performanceScore: number
  totalClasses: number
  upcomingClasses: number
  missedClasses: number
  upcomingClassRows: ClassSessionRow[]
}

const MAX_BATCH_CAPACITY = 3

export function AdminTrainersPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [trainers, setTrainers] = useState<TrainerRow[]>([])
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [studentBatches, setStudentBatches] = useState<StudentBatchRow[]>([])
  const [classSessions, setClassSessions] = useState<ClassSessionRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmissionRow[]>([])
  const [interviews, setInterviews] = useState<InterviewRow[]>([])
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [mockInterviews, setMockInterviews] = useState<MockInterviewRow[]>([])

  const [searchText, setSearchText] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | Availability>('all')
  const [batchCountFilter, setBatchCountFilter] = useState<'all' | '0' | '1' | '2' | '3plus'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'idle'>('all')
  const [page, setPage] = useState(1)

  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null)
  const [drawerTab, setDrawerTab] = useState<
    'overview' | 'batches' | 'performance' | 'classes' | 'interviews' | 'placements' | 'mock' | 'notes'
  >('overview')

  const [showAddTrainer, setShowAddTrainer] = useState(false)
  const [addTrainerSaving, setAddTrainerSaving] = useState(false)
  const [newTrainerForm, setNewTrainerForm] = useState({
    trainer_name: '',
    email: '',
    phone: '',
    comments: '',
  })

  const loadData = async () => {
    setLoading(true)
    setError('')
    const [
      { data: trainerRows, error: trainerError },
      { data: batchRows, error: batchError },
      { data: studentBatchRows, error: sbError },
      { data: classRows, error: classError },
      { data: assignmentRows, error: assignmentError },
      { data: submissionRows, error: submissionError },
      { data: interviewRows, error: interviewError },
      { data: placementRows, error: placementError },
      { data: mockRows, error: mockError },
    ] = await Promise.all([
      supabase.from('trainers').select('id,trainer_name,email,phone,comments').order('trainer_name', { ascending: true }),
      supabase.from('batches').select('id,batch_code,status,trainer_id,start_date'),
      supabase.from('student_batches').select('student_id,batch_id,is_active'),
      supabase.from('class_sessions').select('id,batch_id,trainer_id,starts_at,zoom_status'),
      supabase.from('assignments').select('id,batch_id'),
      supabase.from('assignment_submissions').select('assignment_id,submitted_at'),
      supabase.from('interviews').select('student_id,stage'),
      supabase.from('placements').select('student_id'),
      supabase.from('mock_interviews').select('trainer_id,status'),
    ])

    if (
      trainerError ||
      batchError ||
      sbError ||
      classError ||
      assignmentError ||
      submissionError ||
      interviewError ||
      placementError ||
      mockError
    ) {
      setError(
        trainerError?.message ??
          batchError?.message ??
          sbError?.message ??
          classError?.message ??
          assignmentError?.message ??
          submissionError?.message ??
          interviewError?.message ??
          placementError?.message ??
          mockError?.message ??
          'Failed to load trainer data.',
      )
      setLoading(false)
      return
    }

    setTrainers((trainerRows ?? []) as TrainerRow[])
    setBatches((batchRows ?? []) as BatchRow[])
    setStudentBatches((studentBatchRows ?? []) as StudentBatchRow[])
    setClassSessions((classRows ?? []) as ClassSessionRow[])
    setAssignments((assignmentRows ?? []) as AssignmentRow[])
    setAssignmentSubmissions((submissionRows ?? []) as AssignmentSubmissionRow[])
    setInterviews((interviewRows ?? []) as InterviewRow[])
    setPlacements((placementRows ?? []) as PlacementRow[])
    setMockInterviews((mockRows ?? []) as MockInterviewRow[])
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

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

  const submittedAssignmentCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of assignmentSubmissions) {
      if (!row.submitted_at) continue
      map.set(row.assignment_id, (map.get(row.assignment_id) ?? 0) + 1)
    }
    return map
  }, [assignmentSubmissions])

  const trainerMetrics = useMemo(() => {
    const now = Date.now()
    const placementStudentIdSet = new Set(placements.map((row) => row.student_id))
    return trainers.map((trainer) => {
      const allBatches = batches.filter((b) => b.trainer_id === trainer.id)
      const activeBatches = allBatches.filter((b) => !['completed', 'archived', 'cancelled'].includes((b.status ?? '').toLowerCase()))
      const batchIds = new Set(allBatches.map((b) => b.id))
      const batchTags = activeBatches.slice(0, 2).map((b) => b.batch_code)
      const currentBatchCount = activeBatches.length
      const slotsLeft = Math.max(0, MAX_BATCH_CAPACITY - currentBatchCount)
      const availability: Availability =
        currentBatchCount >= MAX_BATCH_CAPACITY ? 'full' : currentBatchCount === MAX_BATCH_CAPACITY - 1 ? 'almost_full' : 'available'

      const studentIds = new Set<string>()
      for (const batchId of batchIds) {
        for (const studentId of studentIdsByBatch.get(batchId) ?? []) {
          studentIds.add(studentId)
        }
      }
      const studentCount = studentIds.size

      const trainerAssignments = assignments.filter((a) => batchIds.has(a.batch_id))
      const expectedSubmissions = trainerAssignments.length * Math.max(studentCount, 1)
      const actualSubmissions = trainerAssignments.reduce(
        (sum, assignment) => sum + (submittedAssignmentCounts.get(assignment.id) ?? 0),
        0,
      )
      const assignmentCompletionPct =
        expectedSubmissions > 0 ? Math.max(0, Math.min(100, Math.round((actualSubmissions / expectedSubmissions) * 100))) : 0

      const trainerMocks = mockInterviews.filter((m) => m.trainer_id === trainer.id)
      const mockCompletedCount = trainerMocks.filter((m) => m.status === 'completed').length
      const mockCompletionPct = trainerMocks.length ? Math.round((mockCompletedCount / trainerMocks.length) * 100) : 0

      const studentIdList = Array.from(studentIds)
      const trainerInterviews = interviews.filter((i) => studentIds.has(i.student_id))
      const selectedInterviewCount = trainerInterviews.filter((i) => i.stage === 'selected').length
      const interviewSuccessPct = trainerInterviews.length
        ? Math.round((selectedInterviewCount / trainerInterviews.length) * 100)
        : 0

      const placementCount = studentIdList.filter((id) => placementStudentIdSet.has(id)).length
      const placementPct = studentCount ? Math.round((placementCount / studentCount) * 100) : 0

      const performanceScore = Math.round(
        assignmentCompletionPct * 0.4 +
          mockCompletionPct * 0.2 +
          interviewSuccessPct * 0.2 +
          placementPct * 0.2,
      )

      const trainerClasses = classSessions.filter((c) => c.trainer_id === trainer.id)
      const upcomingClasses = trainerClasses.filter((c) => new Date(c.starts_at).getTime() > now).length
      const missedClasses = trainerClasses.filter((c) => (c.zoom_status ?? '').toLowerCase() === 'cancelled').length
      const upcomingClassRows = trainerClasses
        .filter((c) => new Date(c.starts_at).getTime() > now)
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
        .slice(0, 6)

      return {
        trainer,
        activeBatches,
        allBatches,
        batchTags,
        currentBatchCount,
        maxBatchCapacity: MAX_BATCH_CAPACITY,
        slotsLeft,
        availability,
        studentCount,
        assignmentCompletionPct,
        mockCompletedCount,
        mockCompletionPct,
        interviewSuccessPct,
        placementCount,
        placementPct,
        performanceScore,
        totalClasses: trainerClasses.length,
        upcomingClasses,
        missedClasses,
        upcomingClassRows,
      } satisfies TrainerMetric
    })
  }, [
    assignments,
    batches,
    classSessions,
    interviews,
    mockInterviews,
    placements,
    studentIdsByBatch,
    submittedAssignmentCounts,
    trainers,
  ])

  const filteredMetrics = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return trainerMetrics.filter((metric) => {
      const matchesSearch =
        !query ||
        metric.trainer.trainer_name.toLowerCase().includes(query) ||
        (metric.trainer.email ?? '').toLowerCase().includes(query) ||
        (metric.trainer.phone ?? '').toLowerCase().includes(query)
      const matchesAvailability = availabilityFilter === 'all' || metric.availability === availabilityFilter
      const matchesBatchCount =
        batchCountFilter === 'all' ||
        (batchCountFilter === '0' && metric.currentBatchCount === 0) ||
        (batchCountFilter === '1' && metric.currentBatchCount === 1) ||
        (batchCountFilter === '2' && metric.currentBatchCount === 2) ||
        (batchCountFilter === '3plus' && metric.currentBatchCount >= 3)
      const status = metric.currentBatchCount > 0 ? 'active' : 'idle'
      const matchesStatus = statusFilter === 'all' || statusFilter === status
      return matchesSearch && matchesAvailability && matchesBatchCount && matchesStatus
    })
  }, [availabilityFilter, batchCountFilter, searchText, statusFilter, trainerMetrics])
  const pageSize = 6
  const totalPages = Math.max(1, Math.ceil(filteredMetrics.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedMetrics = useMemo(
    () => filteredMetrics.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredMetrics],
  )

  const totalTrainers = trainerMetrics.length
  const activeTrainers = trainerMetrics.filter((m) => m.currentBatchCount > 0).length
  const availableTrainers = trainerMetrics.filter((m) => m.availability === 'available').length
  const overloadedTrainers = trainerMetrics.filter((m) => m.availability === 'full').length

  const selectedMetric = useMemo(
    () => trainerMetrics.find((m) => m.trainer.id === selectedTrainerId) ?? null,
    [selectedTrainerId, trainerMetrics],
  )

  const addTrainer = async (event: FormEvent) => {
    event.preventDefault()
    if (!newTrainerForm.trainer_name.trim()) return
    setAddTrainerSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('trainers').insert({
      trainer_name: newTrainerForm.trainer_name.trim(),
      email: newTrainerForm.email.trim() || null,
      phone: newTrainerForm.phone.trim() || null,
      comments: newTrainerForm.comments.trim() || null,
    })
    if (insertError) {
      setError(insertError.message)
      setAddTrainerSaving(false)
      return
    }
    setNewTrainerForm({ trainer_name: '', email: '', phone: '', comments: '' })
    setShowAddTrainer(false)
    setAddTrainerSaving(false)
    await loadData()
  }

  useEffect(() => {
    setPage(1)
  }, [availabilityFilter, batchCountFilter, searchText, statusFilter])

  const availabilityUi = (availability: Availability) => {
    if (availability === 'full') return { label: 'Full', className: 'badge-red' }
    if (availability === 'almost_full') return { label: 'Almost Full', className: 'badge-yellow' }
    return { label: 'Available', className: 'badge-green' }
  }

  if (loading) {
    return <div className="center-screen dashboard-loading">Loading trainer dashboard...</div>
  }

  return (
    <section className="trainer-management-page">
      <header className="trainer-management-head">
        <div>
          <h1>Trainer Management</h1>
          <p>Manage trainers, track performance, batches and availability.</p>
        </div>
        <button type="button" className="placement-primary-btn" onClick={() => setShowAddTrainer(true)}>
          <Plus size={14} /> Add Trainer
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <section className="trainer-stats-grid">
        <article className="placement-stat-card">
          <span className="placement-stat-icon"><Users size={16} /></span>
          <p>Total Trainers</p>
          <h3>{totalTrainers}</h3>
          <small>All registered</small>
        </article>
        <article className="placement-stat-card">
          <span className="placement-stat-icon"><UserCheck size={16} /></span>
          <p>Active Trainers</p>
          <h3>{activeTrainers}</h3>
          <small>Currently handling batches</small>
        </article>
        <article className="placement-stat-card">
          <span className="placement-stat-icon"><CheckCircle2 size={16} /></span>
          <p>Available Trainers</p>
          <h3>{availableTrainers}</h3>
          <small>Can take new batches</small>
        </article>
        <article className="placement-stat-card">
          <span className="placement-stat-icon"><UserX size={16} /></span>
          <p>Overloaded Trainers</p>
          <h3>{overloadedTrainers}</h3>
          <small>At maximum capacity</small>
        </article>
      </section>

      <section className="trainer-filters-row">
        <label className="placement-filter-input">
          <Search size={14} />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search trainer by name, email, phone..."
          />
        </label>
        <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value as 'all' | Availability)}>
          <option value="all">Availability: All</option>
          <option value="available">Available</option>
          <option value="almost_full">Almost Full</option>
          <option value="full">Full</option>
        </select>
        <select value={batchCountFilter} onChange={(event) => setBatchCountFilter(event.target.value as 'all' | '0' | '1' | '2' | '3plus')}>
          <option value="all">Batch Count: All</option>
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3plus">3+</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'idle')}>
          <option value="all">Status: All</option>
          <option value="active">Active</option>
          <option value="idle">Idle</option>
        </select>
        <button type="button" className="placement-filter-btn">
          <Filter size={14} /> Filter
        </button>
      </section>

      <section className="trainer-main-grid">
        <article className="trainer-table-card">
          <div className="placement-table-wrap">
            <table className="placement-table trainer-table">
              <thead>
                <tr>
                  <th>Trainer</th>
                  <th>Contact</th>
                  <th>Batches</th>
                  <th>Capacity</th>
                  <th>Availability</th>
                  <th>Students</th>
                  <th>Performance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedMetrics.map((metric) => {
                  const availability = availabilityUi(metric.availability)
                  const extraBatchCount = metric.activeBatches.length - metric.batchTags.length
                  return (
                    <tr key={metric.trainer.id} onClick={() => setSelectedTrainerId(metric.trainer.id)}>
                      <td>
                        <div className="trainer-cell">
                          <div className="trainer-avatar">{metric.trainer.trainer_name[0]?.toUpperCase()}</div>
                          <div>
                            <p>{metric.trainer.trainer_name}</p>
                            <small>{metric.currentBatchCount >= 3 ? 'Senior Trainer' : 'Trainer'}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="trainer-contact">
                          <small>{metric.trainer.email ?? '—'}</small>
                          <small>{metric.trainer.phone ?? '—'}</small>
                        </div>
                      </td>
                      <td>
                        <div className="trainer-batches-cell">
                          <span>{metric.currentBatchCount} Active</span>
                          <div>
                            {metric.batchTags.length ? (
                              <>
                                {metric.batchTags.map((tag) => <span key={tag} className="trainer-batch-tag">{tag}</span>)}
                                {extraBatchCount > 0 ? (
                                  <span className="trainer-batch-tag trainer-batch-tag-more">+{extraBatchCount}</span>
                                ) : null}
                              </>
                            ) : (
                              <span className="trainer-batch-tag is-empty">—</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{metric.currentBatchCount} / {metric.maxBatchCapacity}</td>
                      <td>
                        <div className="trainer-availability">
                          <span className={`tag-pill ${availability.className}`}>{availability.label}</span>
                          <small>{metric.slotsLeft} slot{metric.slotsLeft === 1 ? '' : 's'} left</small>
                        </div>
                      </td>
                      <td>{metric.studentCount}</td>
                      <td>
                        <div className="trainer-performance-cell">
                          <span>{metric.performanceScore}%</span>
                          <div className="trainer-performance-bar">
                            <i style={{ width: `${metric.performanceScore}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="trainer-actions">
                          <button
                            type="button"
                            className="placement-icon-btn"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedTrainerId(metric.trainer.id)
                            }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="placement-icon-btn"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!pagedMetrics.length ? (
                  <tr>
                    <td className="placement-empty" colSpan={8}>No trainers match current filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="trainer-table-footer">
            <p>
              Showing {filteredMetrics.length ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredMetrics.length)} of {filteredMetrics.length} trainers
            </p>
            <div className="trainer-pagination">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }).slice(0, 4).map((_, idx) => {
                const pageNo = idx + 1
                return (
                  <button
                    key={pageNo}
                    type="button"
                    className={currentPage === pageNo ? 'active' : ''}
                    onClick={() => setPage(pageNo)}
                  >
                    {pageNo}
                  </button>
                )
              })}
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </article>
      </section>

      {selectedMetric ? (
        <aside className="placement-drawer-overlay" onClick={() => setSelectedTrainerId(null)}>
          <div className="placement-drawer trainer-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="placement-drawer-head">
              <h3>{selectedMetric.trainer.trainer_name}</h3>
              <button type="button" onClick={() => setSelectedTrainerId(null)}><X size={16} /></button>
            </div>

            <nav className="trainer-drawer-tabs">
              {['overview', 'batches', 'performance', 'classes', 'interviews', 'placements', 'mock', 'notes'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={drawerTab === tab ? 'active' : ''}
                  onClick={() => setDrawerTab(tab as typeof drawerTab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            {drawerTab === 'overview' ? (
              <div className="trainer-drawer-grid">
                <article className="trainer-mini-card"><p>Assignments Completion</p><h4>{selectedMetric.assignmentCompletionPct}%</h4></article>
                <article className="trainer-mini-card"><p>Mock Interviews</p><h4>{selectedMetric.mockCompletedCount}</h4></article>
                <article className="trainer-mini-card"><p>Interview Success</p><h4>{selectedMetric.interviewSuccessPct}%</h4></article>
                <article className="trainer-mini-card"><p>Placements</p><h4>{selectedMetric.placementCount}</h4></article>
              </div>
            ) : null}

            {drawerTab === 'batches' ? (
              <div className="trainer-drawer-list">
                {selectedMetric.allBatches.map((batch) => (
                  <article key={batch.id}>
                    <h5>{batch.batch_code}</h5>
                    <p>{batch.status}</p>
                    <small>{batch.start_date ? new Date(batch.start_date).toLocaleDateString('en-GB') : 'TBD'}</small>
                  </article>
                ))}
                {!selectedMetric.allBatches.length ? <p className="muted-dark">No batches assigned.</p> : null}
              </div>
            ) : null}

            {drawerTab === 'performance' ? (
              <div className="trainer-drawer-grid">
                <article className="trainer-mini-card"><p>Performance Score</p><h4>{selectedMetric.performanceScore}%</h4></article>
                <article className="trainer-mini-card"><p>Assignment Completion</p><h4>{selectedMetric.assignmentCompletionPct}%</h4></article>
                <article className="trainer-mini-card"><p>Interview Success</p><h4>{selectedMetric.interviewSuccessPct}%</h4></article>
                <article className="trainer-mini-card"><p>Placement Conversion</p><h4>{selectedMetric.placementPct}%</h4></article>
              </div>
            ) : null}

            {drawerTab === 'classes' ? (
              <div className="trainer-drawer-grid">
                <article className="trainer-mini-card"><p>Total Classes</p><h4>{selectedMetric.totalClasses}</h4></article>
                <article className="trainer-mini-card"><p>Upcoming Classes</p><h4>{selectedMetric.upcomingClasses}</h4></article>
                <article className="trainer-mini-card"><p>Missed Classes</p><h4>{selectedMetric.missedClasses}</h4></article>
                <article className="trainer-mini-card"><p>Students</p><h4>{selectedMetric.studentCount}</h4></article>
                <div className="trainer-upcoming-list">
                  {selectedMetric.upcomingClassRows.map((row) => (
                    <p key={row.id}>
                      <CalendarDays size={13} />
                      {new Date(row.starts_at).toLocaleString('en-GB')}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {drawerTab === 'interviews' ? (
              <div className="trainer-drawer-grid">
                <article className="trainer-mini-card"><p>Interview Success Rate</p><h4>{selectedMetric.interviewSuccessPct}%</h4></article>
              </div>
            ) : null}

            {drawerTab === 'placements' ? (
              <div className="trainer-drawer-grid">
                <article className="trainer-mini-card"><p>Total Placements</p><h4>{selectedMetric.placementCount}</h4></article>
                <article className="trainer-mini-card"><p>Placement Conversion</p><h4>{selectedMetric.placementPct}%</h4></article>
              </div>
            ) : null}

            {drawerTab === 'mock' ? (
              <div className="trainer-drawer-grid">
                <article className="trainer-mini-card"><p>Mock Completion</p><h4>{selectedMetric.mockCompletionPct}%</h4></article>
                <article className="trainer-mini-card"><p>Mock Completed</p><h4>{selectedMetric.mockCompletedCount}</h4></article>
              </div>
            ) : null}

            {drawerTab === 'notes' ? (
              <div className="trainer-drawer-grid">
                <article className="trainer-mini-card">
                  <p>Comments</p>
                  <h4>{selectedMetric.trainer.comments ?? 'No notes yet.'}</h4>
                </article>
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}

      {showAddTrainer ? (
        <aside className="placement-drawer-overlay" onClick={() => setShowAddTrainer(false)}>
          <div className="placement-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="placement-drawer-head">
              <h3>Add Trainer</h3>
              <button type="button" onClick={() => setShowAddTrainer(false)}><X size={16} /></button>
            </div>
            <form className="placement-drawer-fields" onSubmit={addTrainer}>
              <label>
                Trainer Name
                <input
                  value={newTrainerForm.trainer_name}
                  onChange={(event) => setNewTrainerForm((prev) => ({ ...prev, trainer_name: event.target.value }))}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={newTrainerForm.email}
                  onChange={(event) => setNewTrainerForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
              <label>
                Phone
                <input
                  value={newTrainerForm.phone}
                  onChange={(event) => setNewTrainerForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </label>
              <label>
                Comments
                <textarea
                  rows={3}
                  value={newTrainerForm.comments}
                  onChange={(event) => setNewTrainerForm((prev) => ({ ...prev, comments: event.target.value }))}
                />
              </label>
              <button type="submit" className="placement-primary-btn" disabled={addTrainerSaving}>
                {addTrainerSaving ? 'Adding...' : 'Add Trainer'}
              </button>
            </form>
          </div>
        </aside>
      ) : null}
    </section>
  )
}

