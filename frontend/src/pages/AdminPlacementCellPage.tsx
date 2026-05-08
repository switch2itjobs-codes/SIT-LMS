import { useEffect, useMemo, useState } from 'react'
import { SpxLoader } from '../components/SpxLoader'
import type { FormEvent } from 'react'
import {
  Building2,
  Eye,
  Filter,
  LineChart,
  Plus,
  Search,
  Trophy,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type PlacementTab = 'interviews' | 'mock' | 'placements' | 'reports'

type StudentLite = {
  id: string
  student_name: string
  stage: string
}

type InterviewRow = {
  id: string
  student_id: string
  company_name: string
  role_title: string | null
  stage: string
  interview_date: string | null
  created_at: string
}

type PlacementRow = {
  id: string
  student_id: string
  company_name: string
  job_role: string | null
  salary_package: number | null
  placement_date: string
  notes: string | null
  offer_letter_url: string | null
  hr_contact: string | null
  company_website: string | null
  created_at: string
}

type MockInterviewRow = {
  id: string
  student_id: string
  trainer_id: string | null
  scheduled_at: string
  status: 'scheduled' | 'completed' | 'missed'
  feedback_communication: string | null
  feedback_confidence: string | null
  feedback_technical: string | null
  feedback_suggestions: string | null
  overall_rating: number | null
  notes: string | null
  created_at: string
}

type StudentBatchMap = {
  student_id: string
  batch_id: string
  batch_code: string
  trainer_id: string | null
  trainer_name: string
}

const INTERVIEW_STAGE_OPTIONS = ['scheduled', 'selected', 'rejected', 'completed']

export function AdminPlacementCellPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<PlacementTab>('interviews')

  const [students, setStudents] = useState<StudentLite[]>([])
  const [interviews, setInterviews] = useState<InterviewRow[]>([])
  const [mockInterviews, setMockInterviews] = useState<MockInterviewRow[]>([])
  const [placements, setPlacements] = useState<PlacementRow[]>([])
  const [studentBatchMap, setStudentBatchMap] = useState<Map<string, StudentBatchMap>>(new Map())

  const [searchText, setSearchText] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [mockSearchText, setMockSearchText] = useState('')
  const [mockStatusFilter, setMockStatusFilter] = useState('all')
  const [mockDateFilter, setMockDateFilter] = useState('')

  const [selectedInterview, setSelectedInterview] = useState<InterviewRow | null>(null)
  const [interviewFeedback, setInterviewFeedback] = useState('')
  const [interviewNotes, setInterviewNotes] = useState('')
  const [interviewStageEdit, setInterviewStageEdit] = useState('scheduled')
  const [interviewDateEdit, setInterviewDateEdit] = useState('')
  const [interviewSaving, setInterviewSaving] = useState(false)

  const [showAddInterview, setShowAddInterview] = useState(false)
  const [newInterview, setNewInterview] = useState({
    student_id: '',
    company_name: '',
    role_title: '',
    stage: 'scheduled',
    interview_date: '',
  })
  const [addInterviewSaving, setAddInterviewSaving] = useState(false)

  const [showAddPlacement, setShowAddPlacement] = useState(false)
  const [newPlacement, setNewPlacement] = useState({
    student_id: '',
    company_name: '',
    job_role: '',
    salary_package: '',
    placement_date: '',
    offer_letter_url: '',
    hr_contact: '',
    company_website: '',
    notes: '',
  })
  const [addPlacementSaving, setAddPlacementSaving] = useState(false)
  const [showAddMock, setShowAddMock] = useState(false)
  const [addMockSaving, setAddMockSaving] = useState(false)
  const [selectedMockInterview, setSelectedMockInterview] = useState<MockInterviewRow | null>(null)
  const [mockFeedbackSaving, setMockFeedbackSaving] = useState(false)
  const [newMock, setNewMock] = useState({
    student_id: '',
    scheduled_at: '',
    status: 'scheduled' as 'scheduled' | 'completed' | 'missed',
  })
  const [mockFeedbackForm, setMockFeedbackForm] = useState({
    status: 'scheduled' as 'scheduled' | 'completed' | 'missed',
    communication: '',
    confidence: '',
    technical: '',
    suggestions: '',
    overall_rating: '',
    notes: '',
  })

  const studentById = useMemo(() => {
    const map = new Map<string, StudentLite>()
    for (const student of students) map.set(student.id, student)
    return map
  }, [students])

  const loadPlacementData = async () => {
    setLoading(true)
    setError('')
    const [
      { data: studentsRows, error: studentsError },
      { data: interviewRows, error: interviewError },
      { data: mockRows, error: mockError },
      { data: placementRows, error: placementError },
      { data: sbRows, error: sbError },
    ] = await Promise.all([
      supabase
        .from('students')
        .select('id,student_name,stage')
        .order('student_name', { ascending: true }),
      supabase
        .from('interviews')
        .select('id,student_id,company_name,role_title,stage,interview_date,created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('mock_interviews')
        .select('id,student_id,trainer_id,scheduled_at,status,feedback_communication,feedback_confidence,feedback_technical,feedback_suggestions,overall_rating,notes,created_at')
        .order('scheduled_at', { ascending: false }),
      supabase
        .from('placements')
        .select(
          'id,student_id,company_name,job_role,salary_package,placement_date,notes,offer_letter_url,hr_contact,company_website,created_at',
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('student_batches')
        .select('student_id,batch_id,batches(trainer_id,batch_code,trainers(trainer_name))')
        .eq('is_active', true),
    ])

    if (studentsError || interviewError || mockError || placementError || sbError) {
      setError(
        studentsError?.message ??
          interviewError?.message ??
          mockError?.message ??
          placementError?.message ??
          sbError?.message ??
          'Failed to load placement data.',
      )
      setLoading(false)
      return
    }

    const map = new Map<string, StudentBatchMap>()
    for (const row of sbRows ?? []) {
      const batchRaw = (row.batches as
        | {
            trainer_id?: string | null
            batch_code?: string
            trainers?: { trainer_name?: string } | Array<{ trainer_name?: string } | null> | null
          }
        | Array<{
            trainer_id?: string | null
            batch_code?: string
            trainers?: { trainer_name?: string } | Array<{ trainer_name?: string } | null> | null
          } | null>
        | null) ?? null
      const batch = Array.isArray(batchRaw) ? batchRaw[0] : batchRaw
      const trainerRaw = (batch?.trainers as
        | { trainer_name?: string }
        | Array<{ trainer_name?: string } | null>
        | null) ?? null
      const trainer = Array.isArray(trainerRaw) ? trainerRaw[0] : trainerRaw
      map.set(row.student_id, {
        student_id: row.student_id,
        batch_id: row.batch_id,
        batch_code: batch?.batch_code ?? '—',
        trainer_id: batch?.trainer_id ?? null,
        trainer_name: trainer?.trainer_name ?? '—',
      })
    }

    setStudentBatchMap(map)
    setStudents((studentsRows ?? []) as StudentLite[])
    setInterviews((interviewRows ?? []) as InterviewRow[])
    setMockInterviews((mockRows ?? []) as MockInterviewRow[])
    setPlacements((placementRows ?? []) as PlacementRow[])
    setLoading(false)
  }

  useEffect(() => {
    void loadPlacementData()
  }, [])

  useEffect(() => {
    if (!selectedInterview) return
    setInterviewStageEdit(selectedInterview.stage ?? 'scheduled')
    setInterviewDateEdit(selectedInterview.interview_date ?? '')
    setInterviewFeedback('')
    setInterviewNotes('')
  }, [selectedInterview])

  useEffect(() => {
    if (!selectedMockInterview) return
    setMockFeedbackForm({
      status: selectedMockInterview.status,
      communication: selectedMockInterview.feedback_communication ?? '',
      confidence: selectedMockInterview.feedback_confidence ?? '',
      technical: selectedMockInterview.feedback_technical ?? '',
      suggestions: selectedMockInterview.feedback_suggestions ?? '',
      overall_rating:
        selectedMockInterview.overall_rating !== null
          ? String(selectedMockInterview.overall_rating)
          : '',
      notes: selectedMockInterview.notes ?? '',
    })
  }, [selectedMockInterview])

  const interviewCount = interviews.length
  const selectedCount = interviews.filter((item) => item.stage === 'selected').length
  const placementCount = placements.length
  const totalStudentsInPlacementPhase = students.filter((s) =>
    (s.stage ?? '').toLowerCase().includes('placement'),
  ).length

  const filteredInterviews = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return interviews.filter((item) => {
      const studentName = studentById.get(item.student_id)?.student_name ?? ''
      const companyMatch =
        companyFilter === 'all' || item.company_name.toLowerCase() === companyFilter.toLowerCase()
      const stageMatch = stageFilter === 'all' || item.stage.toLowerCase() === stageFilter.toLowerCase()
      const dateMatch = !dateFilter || item.interview_date === dateFilter
      const queryMatch =
        !query ||
        studentName.toLowerCase().includes(query) ||
        item.company_name.toLowerCase().includes(query) ||
        (item.role_title ?? '').toLowerCase().includes(query)
      return companyMatch && stageMatch && dateMatch && queryMatch
    })
  }, [companyFilter, dateFilter, interviews, searchText, stageFilter, studentById])

  const companyOptions = useMemo(
    () =>
      Array.from(new Set(interviews.map((item) => item.company_name.trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [interviews],
  )
  const filteredMockInterviews = useMemo(() => {
    const query = mockSearchText.trim().toLowerCase()
    return mockInterviews.filter((row) => {
      const studentName = (studentById.get(row.student_id)?.student_name ?? '').toLowerCase()
      const trainerName = (studentBatchMap.get(row.student_id)?.trainer_name ?? '').toLowerCase()
      const statusMatch = mockStatusFilter === 'all' || row.status === mockStatusFilter
      const rowDate = new Date(row.scheduled_at)
      const dateText = Number.isNaN(rowDate.getTime())
        ? ''
        : `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}-${String(rowDate.getDate()).padStart(2, '0')}`
      const dateMatch = !mockDateFilter || dateText === mockDateFilter
      const queryMatch =
        !query ||
        studentName.includes(query) ||
        trainerName.includes(query) ||
        row.status.toLowerCase().includes(query)
      return statusMatch && dateMatch && queryMatch
    })
  }, [mockDateFilter, mockInterviews, mockSearchText, mockStatusFilter, studentBatchMap, studentById])

  const monthlyPlacementCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of placements) {
      const d = new Date(row.placement_date)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
  }, [placements])

  const avgPackage = useMemo(() => {
    const valid = placements.filter((item) => item.salary_package !== null)
    if (!valid.length) return 0
    const total = valid.reduce((sum, item) => sum + Number(item.salary_package ?? 0), 0)
    return total / valid.length
  }, [placements])

  const highestPackage = useMemo(
    () => Math.max(0, ...placements.map((item) => Number(item.salary_package ?? 0))),
    [placements],
  )

  const interviewSuccessRate = interviewCount
    ? Math.round((selectedCount / interviewCount) * 100)
    : 0
  const placementRate = totalStudentsInPlacementPhase
    ? Math.round((placementCount / totalStudentsInPlacementPhase) * 100)
    : 0

  const saveInterviewUpdate = async () => {
    if (!selectedInterview) return
    setInterviewSaving(true)
    setError('')
    const payload: Record<string, unknown> = {
      stage: interviewStageEdit,
      interview_date: interviewDateEdit || null,
    }
    if (interviewNotes.trim()) {
      payload.role_title = `${selectedInterview.role_title ?? ''}${selectedInterview.role_title ? ' · ' : ''}${interviewNotes.trim()}`
    }
    const { error: updateError } = await supabase
      .from('interviews')
      .update(payload)
      .eq('id', selectedInterview.id)
    if (updateError) {
      setError(updateError.message)
      setInterviewSaving(false)
      return
    }
    await loadPlacementData()
    setInterviewSaving(false)
    setSelectedInterview(null)
  }

  const handleAddInterview = async (event: FormEvent) => {
    event.preventDefault()
    if (!newInterview.student_id || !newInterview.company_name.trim()) return
    setAddInterviewSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('interviews').insert({
      student_id: newInterview.student_id,
      company_name: newInterview.company_name.trim(),
      role_title: newInterview.role_title.trim() || null,
      stage: newInterview.stage,
      interview_date: newInterview.interview_date || null,
    })
    if (insertError) {
      setError(insertError.message)
      setAddInterviewSaving(false)
      return
    }
    setNewInterview({
      student_id: '',
      company_name: '',
      role_title: '',
      stage: 'scheduled',
      interview_date: '',
    })
    setShowAddInterview(false)
    setAddInterviewSaving(false)
    await loadPlacementData()
  }

  const handleAddPlacement = async (event: FormEvent) => {
    event.preventDefault()
    if (!newPlacement.student_id || !newPlacement.company_name.trim() || !newPlacement.placement_date) return
    setAddPlacementSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('placements').insert({
      student_id: newPlacement.student_id,
      company_name: newPlacement.company_name.trim(),
      job_role: newPlacement.job_role.trim() || null,
      salary_package: newPlacement.salary_package ? Number(newPlacement.salary_package) : null,
      placement_date: newPlacement.placement_date,
      offer_letter_url: newPlacement.offer_letter_url.trim() || null,
      hr_contact: newPlacement.hr_contact.trim() || null,
      company_website: newPlacement.company_website.trim() || null,
      notes: newPlacement.notes.trim() || null,
    })
    if (insertError) {
      setError(insertError.message)
      setAddPlacementSaving(false)
      return
    }
    setNewPlacement({
      student_id: '',
      company_name: '',
      job_role: '',
      salary_package: '',
      placement_date: '',
      offer_letter_url: '',
      hr_contact: '',
      company_website: '',
      notes: '',
    })
    setShowAddPlacement(false)
    setAddPlacementSaving(false)
    await loadPlacementData()
  }

  const handleAddMockInterview = async (event: FormEvent) => {
    event.preventDefault()
    if (!newMock.student_id || !newMock.scheduled_at) return
    setAddMockSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('mock_interviews').insert({
      student_id: newMock.student_id,
      trainer_id: studentBatchMap.get(newMock.student_id)?.trainer_id ?? null,
      scheduled_at: newMock.scheduled_at,
      status: newMock.status,
    })
    if (insertError) {
      setError(insertError.message)
      setAddMockSaving(false)
      return
    }
    setNewMock({
      student_id: '',
      scheduled_at: '',
      status: 'scheduled',
    })
    setShowAddMock(false)
    setAddMockSaving(false)
    await loadPlacementData()
  }

  const handleSaveMockFeedback = async () => {
    if (!selectedMockInterview) return
    setMockFeedbackSaving(true)
    setError('')
    const { error: updateError } = await supabase
      .from('mock_interviews')
      .update({
        status: mockFeedbackForm.status,
        feedback_communication: mockFeedbackForm.communication.trim() || null,
        feedback_confidence: mockFeedbackForm.confidence.trim() || null,
        feedback_technical: mockFeedbackForm.technical.trim() || null,
        feedback_suggestions: mockFeedbackForm.suggestions.trim() || null,
        overall_rating: mockFeedbackForm.overall_rating
          ? Number(mockFeedbackForm.overall_rating)
          : null,
        notes: mockFeedbackForm.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedMockInterview.id)
    if (updateError) {
      setError(updateError.message)
      setMockFeedbackSaving(false)
      return
    }
    setSelectedMockInterview(null)
    setMockFeedbackSaving(false)
    await loadPlacementData()
  }

  const stageClassName = (stage: string) => {
    const value = (stage ?? '').toLowerCase()
    if (value === 'selected') return 'badge-green'
    if (value === 'scheduled') return 'badge-blue'
    if (value === 'rejected') return 'badge-red'
    return 'badge-gray'
  }

  if (loading) {
    return <SpxLoader label="Loading placement cell…" />
  }

  return (
    <section className="placement-page">
      <section className="placement-top-shell">
        <header className="placement-header">
          <div>
            <h1>Placement Cell</h1>
            <p>Manage interviews, mock interviews, placements and performance reports.</p>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </header>

        <nav className="batch-detail-tabs admin-batch-detail-tabs placement-tabs">
          {[
            { id: 'interviews', label: 'Interviews', count: interviews.length },
            { id: 'mock', label: 'Mock Interviews', count: mockInterviews.length },
            { id: 'placements', label: 'Placements', count: placements.length },
            { id: 'reports', label: 'Reports', count: null },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`batch-detail-tab ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id as PlacementTab)}
            >
              {item.label}
              {item.count != null ? <span className="placement-tab-count">{item.count}</span> : null}
            </button>
          ))}
        </nav>
      </section>

      {tab === 'interviews' ? (
        <section className="placement-content-card">
          <div className="placement-toolbar">
            <div className="placement-filters">
              <label className="placement-filter-input">
                <Search size={14} />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search student / company / role"
                />
              </label>
              <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
                <option value="all">All Companies</option>
                {companyOptions.map((company) => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
              <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                <option value="all">All Stages</option>
                {INTERVIEW_STAGE_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
              <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
              <button type="button" className="placement-filter-btn">
                <Filter size={14} /> Filter
              </button>
            </div>
            <button type="button" className="placement-primary-btn" onClick={() => setShowAddInterview(true)}>
              <Plus size={14} /> Add Interview
            </button>
          </div>

          <div className="placement-table-wrap">
            <table className="placement-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Stage</th>
                  <th>Interview Date</th>
                  <th>Trainer Feedback</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInterviews.map((row) => {
                  const student = studentById.get(row.student_id)
                  return (
                    <tr key={row.id} onClick={() => setSelectedInterview(row)}>
                      <td>
                        <div className="placement-student-cell">
                          <span>{student?.student_name ?? 'Unknown Student'}</span>
                          <small>{student?.stage ?? '—'}</small>
                        </div>
                      </td>
                      <td>{row.company_name}</td>
                      <td>{row.role_title ?? '—'}</td>
                      <td><span className={`tag-pill ${stageClassName(row.stage)}`}>{row.stage}</span></td>
                      <td>{row.interview_date ? new Date(row.interview_date).toLocaleDateString('en-GB') : '—'}</td>
                      <td><span className="tag-pill badge-gray">Pending</span></td>
                      <td><button type="button" className="placement-icon-btn"><Eye size={14} /></button></td>
                    </tr>
                  )
                })}
                {!filteredInterviews.length ? (
                  <tr>
                    <td colSpan={7} className="placement-empty">No interviews added yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'mock' ? (
        <section className="placement-content-card">
          <div className="placement-toolbar">
            <div className="placement-filters">
              <label className="placement-filter-input">
                <Search size={14} />
                <input
                  value={mockSearchText}
                  onChange={(event) => setMockSearchText(event.target.value)}
                  placeholder="Search student / trainer / status"
                />
              </label>
              <select value={mockStatusFilter} onChange={(event) => setMockStatusFilter(event.target.value)}>
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="missed">Missed</option>
              </select>
              <input type="date" value={mockDateFilter} onChange={(event) => setMockDateFilter(event.target.value)} />
              <button type="button" className="placement-filter-btn">
                <Filter size={14} /> Filter
              </button>
            </div>
            <button type="button" className="placement-primary-btn" onClick={() => setShowAddMock(true)}>
              <Plus size={14} /> Schedule Mock
            </button>
          </div>
          <div className="placement-table-wrap">
            <table className="placement-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Trainer</th>
                  <th>Scheduled Date</th>
                  <th>Status</th>
                  <th>Feedback</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMockInterviews.map((row) => {
                  const student = studentById.get(row.student_id)
                  const batch = studentBatchMap.get(row.student_id)
                  const hasFeedback =
                    Boolean(row.feedback_communication) ||
                    Boolean(row.feedback_confidence) ||
                    Boolean(row.feedback_technical) ||
                    Boolean(row.feedback_suggestions) ||
                    row.overall_rating !== null
                  return (
                    <tr key={row.id} onClick={() => setSelectedMockInterview(row)}>
                      <td>{student?.student_name ?? 'Unknown Student'}</td>
                      <td>{batch?.trainer_name ?? '—'}</td>
                      <td>{new Date(row.scheduled_at).toLocaleString('en-GB')}</td>
                      <td>
                        <span className={`tag-pill ${row.status === 'completed' ? 'badge-green' : row.status === 'missed' ? 'badge-red' : 'badge-blue'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <span className={`tag-pill ${hasFeedback ? 'badge-green' : 'badge-gray'}`}>
                          {hasFeedback ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                      <td><button type="button" className="placement-icon-btn"><Eye size={14} /></button></td>
                    </tr>
                  )
                })}
                {!filteredMockInterviews.length ? (
                  <tr>
                    <td colSpan={6} className="placement-empty">No mock interviews added yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'placements' ? (
        <section className="placement-content-card">
          <div className="placement-toolbar">
            <h3>Placements</h3>
            <button type="button" className="placement-primary-btn" onClick={() => setShowAddPlacement(true)}>
              <Plus size={14} /> Add Placement
            </button>
          </div>
          <div className="placement-table-wrap">
            <table className="placement-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Package</th>
                  <th>Placement Date</th>
                  <th>Batch</th>
                  <th>Trainer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {placements.map((row) => {
                  const student = studentById.get(row.student_id)
                  const batch = studentBatchMap.get(row.student_id)
                  const isTopPlacement = Number(row.salary_package ?? 0) >= 20
                  return (
                    <tr key={row.id}>
                      <td>{student?.student_name ?? 'Unknown Student'}</td>
                      <td>
                        <div className="placement-company-cell">
                          <Building2 size={14} />
                          {row.company_name}
                        </div>
                      </td>
                      <td>{row.job_role ?? '—'}</td>
                      <td>
                        <strong className="placement-package">
                          {row.salary_package != null ? `₹${Number(row.salary_package).toFixed(2)} LPA` : '—'}
                        </strong>
                        {isTopPlacement ? (
                          <span className="tag-pill badge-orange placement-top-tag">
                            <Trophy size={12} /> Top Placement
                          </span>
                        ) : null}
                      </td>
                      <td>{new Date(row.placement_date).toLocaleDateString('en-GB')}</td>
                      <td>{batch?.batch_code ?? '—'}</td>
                      <td>{batch?.trainer_name ?? '—'}</td>
                      <td>
                        <a className="placement-link-btn" href={row.offer_letter_url ?? '#'} target="_blank" rel="noreferrer">
                          View
                        </a>
                      </td>
                    </tr>
                  )
                })}
                {!placements.length ? (
                  <tr>
                    <td colSpan={8} className="placement-empty">No placements added yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'reports' ? (
        <section className="placement-content-card placement-reports-grid">
          <article className="placement-stat-card">
            <p>Placement Rate</p>
            <h3>{placementRate}%</h3>
          </article>
          <article className="placement-stat-card">
            <p>Avg Package</p>
            <h3>₹{avgPackage.toFixed(2)} LPA</h3>
          </article>
          <article className="placement-stat-card">
            <p>Highest Package</p>
            <h3>₹{highestPackage.toFixed(2)} LPA</h3>
          </article>
          <article className="placement-stat-card">
            <p>Interview Success Rate</p>
            <h3>{interviewSuccessRate}%</h3>
          </article>

          <article className="placement-chart-card">
            <h4><LineChart size={15} /> Placement Trend</h4>
            <div className="placement-mini-bars">
              {monthlyPlacementCounts.map(([month, count]) => (
                <div key={month} className="placement-mini-bar-col">
                  <span style={{ height: `${Math.max(10, count * 20)}px` }} />
                  <small>{month.slice(5)}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="placement-chart-card">
            <h4>Company-wise Hiring</h4>
            <ul className="placement-company-list">
              {Array.from(
                placements.reduce((map, row) => {
                  map.set(row.company_name, (map.get(row.company_name) ?? 0) + 1)
                  return map
                }, new Map<string, number>()),
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([company, count]) => (
                  <li key={company}>
                    <span>{company}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
            </ul>
          </article>
        </section>
      ) : null}

      {selectedInterview ? (
        <aside className="placement-drawer-overlay" onClick={() => setSelectedInterview(null)}>
          <div className="placement-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="placement-drawer-head">
              <h3>Interview Details</h3>
              <button type="button" onClick={() => setSelectedInterview(null)}><X size={16} /></button>
            </div>
            <div className="placement-drawer-fields">
              <label>
                Student
                <input value={studentById.get(selectedInterview.student_id)?.student_name ?? ''} disabled />
              </label>
              <label>
                Company
                <input value={selectedInterview.company_name} disabled />
              </label>
              <label>
                Role
                <input value={selectedInterview.role_title ?? ''} disabled />
              </label>
              <label>
                Stage
                <select value={interviewStageEdit} onChange={(e) => setInterviewStageEdit(e.target.value)}>
                  {INTERVIEW_STAGE_OPTIONS.map((stage) => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </label>
              <label>
                Interview Date
                <input type="date" value={interviewDateEdit} onChange={(e) => setInterviewDateEdit(e.target.value)} />
              </label>
              <label>
                Trainer Feedback
                <textarea
                  rows={3}
                  value={interviewFeedback}
                  onChange={(e) => setInterviewFeedback(e.target.value)}
                  placeholder="Add feedback"
                />
              </label>
              <label>
                Admin Notes
                <textarea
                  rows={3}
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </label>
              <button type="button" className="placement-primary-btn" onClick={saveInterviewUpdate} disabled={interviewSaving}>
                {interviewSaving ? 'Saving...' : 'Save Updates'}
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      {showAddInterview ? (
        <aside className="placement-drawer-overlay" onClick={() => setShowAddInterview(false)}>
          <div className="placement-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="placement-drawer-head">
              <h3>Add Interview</h3>
              <button type="button" onClick={() => setShowAddInterview(false)}><X size={16} /></button>
            </div>
            <form className="placement-drawer-fields" onSubmit={handleAddInterview}>
              <label>
                Student
                <select
                  value={newInterview.student_id}
                  onChange={(e) => setNewInterview((prev) => ({ ...prev, student_id: e.target.value }))}
                  required
                >
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.student_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Company
                <input
                  value={newInterview.company_name}
                  onChange={(e) => setNewInterview((prev) => ({ ...prev, company_name: e.target.value }))}
                  required
                />
              </label>
              <label>
                Role
                <input
                  value={newInterview.role_title}
                  onChange={(e) => setNewInterview((prev) => ({ ...prev, role_title: e.target.value }))}
                />
              </label>
              <label>
                Stage
                <select
                  value={newInterview.stage}
                  onChange={(e) => setNewInterview((prev) => ({ ...prev, stage: e.target.value }))}
                >
                  {INTERVIEW_STAGE_OPTIONS.map((stage) => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </label>
              <label>
                Interview Date
                <input
                  type="date"
                  value={newInterview.interview_date}
                  onChange={(e) => setNewInterview((prev) => ({ ...prev, interview_date: e.target.value }))}
                />
              </label>
              <button type="submit" className="placement-primary-btn" disabled={addInterviewSaving}>
                {addInterviewSaving ? 'Adding...' : 'Add Interview'}
              </button>
            </form>
          </div>
        </aside>
      ) : null}

      {showAddPlacement ? (
        <aside className="placement-drawer-overlay" onClick={() => setShowAddPlacement(false)}>
          <div className="placement-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="placement-drawer-head">
              <h3>Add Placement</h3>
              <button type="button" onClick={() => setShowAddPlacement(false)}><X size={16} /></button>
            </div>
            <form className="placement-drawer-fields" onSubmit={handleAddPlacement}>
              <label>
                Student
                <select
                  value={newPlacement.student_id}
                  onChange={(e) => setNewPlacement((prev) => ({ ...prev, student_id: e.target.value }))}
                  required
                >
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.student_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Company Name
                <input value={newPlacement.company_name} onChange={(e) => setNewPlacement((prev) => ({ ...prev, company_name: e.target.value }))} required />
              </label>
              <label>
                Job Role
                <input value={newPlacement.job_role} onChange={(e) => setNewPlacement((prev) => ({ ...prev, job_role: e.target.value }))} />
              </label>
              <label>
                Salary Package (LPA)
                <input type="number" step="0.01" value={newPlacement.salary_package} onChange={(e) => setNewPlacement((prev) => ({ ...prev, salary_package: e.target.value }))} />
              </label>
              <label>
                Placement Date
                <input type="date" value={newPlacement.placement_date} onChange={(e) => setNewPlacement((prev) => ({ ...prev, placement_date: e.target.value }))} required />
              </label>
              <label>
                Batch
                <input value={studentBatchMap.get(newPlacement.student_id)?.batch_code ?? 'Auto'} disabled />
              </label>
              <label>
                Trainer
                <input value={studentBatchMap.get(newPlacement.student_id)?.trainer_name ?? 'Auto'} disabled />
              </label>
              <label>
                Offer Letter URL
                <input value={newPlacement.offer_letter_url} onChange={(e) => setNewPlacement((prev) => ({ ...prev, offer_letter_url: e.target.value }))} />
              </label>
              <label>
                HR Contact
                <input value={newPlacement.hr_contact} onChange={(e) => setNewPlacement((prev) => ({ ...prev, hr_contact: e.target.value }))} />
              </label>
              <label>
                Company Website
                <input value={newPlacement.company_website} onChange={(e) => setNewPlacement((prev) => ({ ...prev, company_website: e.target.value }))} />
              </label>
              <label>
                Notes
                <textarea rows={3} value={newPlacement.notes} onChange={(e) => setNewPlacement((prev) => ({ ...prev, notes: e.target.value }))} />
              </label>
              <button type="submit" className="placement-primary-btn" disabled={addPlacementSaving}>
                {addPlacementSaving ? 'Adding...' : 'Add Placement'}
              </button>
            </form>
          </div>
        </aside>
      ) : null}

      {showAddMock ? (
        <aside className="placement-drawer-overlay" onClick={() => setShowAddMock(false)}>
          <div className="placement-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="placement-drawer-head">
              <h3>Schedule Mock Interview</h3>
              <button type="button" onClick={() => setShowAddMock(false)}><X size={16} /></button>
            </div>
            <form className="placement-drawer-fields" onSubmit={handleAddMockInterview}>
              <label>
                Student
                <select
                  value={newMock.student_id}
                  onChange={(e) => setNewMock((prev) => ({ ...prev, student_id: e.target.value }))}
                  required
                >
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.student_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Trainer
                <input value={studentBatchMap.get(newMock.student_id)?.trainer_name ?? 'Auto from batch'} disabled />
              </label>
              <label>
                Scheduled Date & Time
                <input
                  type="datetime-local"
                  value={newMock.scheduled_at}
                  onChange={(e) => setNewMock((prev) => ({ ...prev, scheduled_at: e.target.value }))}
                  required
                />
              </label>
              <label>
                Status
                <select
                  value={newMock.status}
                  onChange={(e) => setNewMock((prev) => ({ ...prev, status: e.target.value as 'scheduled' | 'completed' | 'missed' }))}
                >
                  <option value="scheduled">scheduled</option>
                  <option value="completed">completed</option>
                  <option value="missed">missed</option>
                </select>
              </label>
              <button type="submit" className="placement-primary-btn" disabled={addMockSaving}>
                {addMockSaving ? 'Scheduling...' : 'Schedule Mock'}
              </button>
            </form>
          </div>
        </aside>
      ) : null}

      {selectedMockInterview ? (
        <aside className="placement-drawer-overlay" onClick={() => setSelectedMockInterview(null)}>
          <div className="placement-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="placement-drawer-head">
              <h3>Mock Interview Feedback</h3>
              <button type="button" onClick={() => setSelectedMockInterview(null)}><X size={16} /></button>
            </div>
            <div className="placement-drawer-fields">
              <label>
                Student
                <input value={studentById.get(selectedMockInterview.student_id)?.student_name ?? ''} disabled />
              </label>
              <label>
                Status
                <select
                  value={mockFeedbackForm.status}
                  onChange={(e) =>
                    setMockFeedbackForm((prev) => ({
                      ...prev,
                      status: e.target.value as 'scheduled' | 'completed' | 'missed',
                    }))
                  }
                >
                  <option value="scheduled">scheduled</option>
                  <option value="completed">completed</option>
                  <option value="missed">missed</option>
                </select>
              </label>
              <label>
                Communication
                <textarea rows={2} value={mockFeedbackForm.communication} onChange={(e) => setMockFeedbackForm((prev) => ({ ...prev, communication: e.target.value }))} />
              </label>
              <label>
                Confidence
                <textarea rows={2} value={mockFeedbackForm.confidence} onChange={(e) => setMockFeedbackForm((prev) => ({ ...prev, confidence: e.target.value }))} />
              </label>
              <label>
                Technical
                <textarea rows={2} value={mockFeedbackForm.technical} onChange={(e) => setMockFeedbackForm((prev) => ({ ...prev, technical: e.target.value }))} />
              </label>
              <label>
                Suggestions
                <textarea rows={3} value={mockFeedbackForm.suggestions} onChange={(e) => setMockFeedbackForm((prev) => ({ ...prev, suggestions: e.target.value }))} />
              </label>
              <label>
                Overall Rating (0-10)
                <input type="number" min="0" max="10" step="0.1" value={mockFeedbackForm.overall_rating} onChange={(e) => setMockFeedbackForm((prev) => ({ ...prev, overall_rating: e.target.value }))} />
              </label>
              <label>
                Notes
                <textarea rows={3} value={mockFeedbackForm.notes} onChange={(e) => setMockFeedbackForm((prev) => ({ ...prev, notes: e.target.value }))} />
              </label>
              <button type="button" className="placement-primary-btn" onClick={handleSaveMockFeedback} disabled={mockFeedbackSaving}>
                {mockFeedbackSaving ? 'Saving...' : 'Save Feedback'}
              </button>
            </div>
          </div>
        </aside>
      ) : null}
    </section>
  )
}

