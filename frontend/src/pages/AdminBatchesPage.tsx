import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Search, Star, User, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

type AdminBatchesPageProps = {
  onOpenBatch: (batchId: string, batchCode: string) => void
}

type BatchRow = {
  id: string
  batch_code: string
  status: string
  batch_type: string
  trainer_id: string | null
}

type TrainerRow = {
  id: string
  trainer_name: string
}

type StudentOption = {
  id: string
  student_name: string
  email: string | null
  phone: string | null
  stage: string
}

function addMonthsIsoDate(dateIso: string, months: number) {
  if (!dateIso) return ''
  const [year, month, day] = dateIso.split('-').map(Number)
  if (!year || !month || !day) return ''
  const utcDate = new Date(Date.UTC(year, month - 1, day))
  utcDate.setUTCMonth(utcDate.getUTCMonth() + months)
  return utcDate.toISOString().slice(0, 10)
}

export function AdminBatchesPage({ onOpenBatch }: AdminBatchesPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [trainers, setTrainers] = useState<TrainerRow[]>([])
  const [studentCountByBatchId, setStudentCountByBatchId] = useState<
    Record<string, number>
  >({})
  const [threeStarCountByBatchId, setThreeStarCountByBatchId] = useState<
    Record<string, number>
  >({})
  const [lastClassTopicByBatchId, setLastClassTopicByBatchId] = useState<
    Record<string, string | null>
  >({})

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [trainerFilter, setTrainerFilter] = useState<string>('all')
  const [refreshTick, setRefreshTick] = useState(0)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<1 | 2>(1)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const [batchForm, setBatchForm] = useState({
    batch_code: '',
    trainer_id: '',
    start_date: '',
    batch_type: 'custom',
  })
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])

  const calculatedEndDate = useMemo(
    () => addMonthsIsoDate(batchForm.start_date, 4),
    [batchForm.start_date],
  )

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      const [
        { data: batchRows, error: batchError },
        { data: trainerRows, error: trainerError },
        { data: sbRows, error: sbError },
        { data: classRows, error: classError },
      ] = await Promise.all([
        supabase
          .from('batches')
          .select('id,batch_code,status,batch_type,trainer_id')
          .order('batch_code', { ascending: true }),
        supabase
          .from('trainers')
          .select('id,trainer_name')
          .order('trainer_name', { ascending: true }),
        supabase
          .from('student_batches')
          .select('batch_id,student_id')
          .eq('is_active', true),
        supabase
          .from('class_sessions')
          .select('batch_id,title,starts_at')
          .order('starts_at', { ascending: false }),
      ])

      if (batchError || trainerError || sbError || classError) {
        setError(
          batchError?.message ??
            trainerError?.message ??
            sbError?.message ??
            classError?.message ??
            'Failed to load batches.',
        )
        setLoading(false)
        return
      }

      setBatches(batchRows ?? [])
      setTrainers(trainerRows ?? [])

      const studentIds = Array.from(
        new Set((sbRows ?? []).map((r) => r.student_id)),
      )

      if (studentIds.length && (sbRows?.length ?? 0) > 0) {
        const { data: studentRows, error: studentError } = await supabase
          .from('students')
          .select('id,trainer_rating')
          .in('id', studentIds)

        if (studentError) {
          setError(studentError.message)
          setLoading(false)
          return
        }

        const ratingByStudentId = new Map(
          (studentRows ?? []).map((s) => [s.id, s.trainer_rating ?? null]),
        )

        const uniqueStudentsByBatch = new Map<string, Set<string>>()
        for (const link of sbRows ?? []) {
          const batchStudents =
            uniqueStudentsByBatch.get(link.batch_id) ?? new Set<string>()
          batchStudents.add(link.student_id)
          uniqueStudentsByBatch.set(link.batch_id, batchStudents)
        }

        const studentCountRecord: Record<string, number> = {}
        const threeStarRecord: Record<string, number> = {}
        for (const b of batchRows ?? []) {
          const studentsInBatch = uniqueStudentsByBatch.get(b.id) ?? new Set<string>()
          studentCountRecord[b.id] = studentsInBatch.size

          let threeStarCount = 0
          for (const studentId of studentsInBatch) {
            const rating = ratingByStudentId.get(studentId)
            if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) {
              continue
            }
            const normalized = Math.min(3, Math.max(1, Math.round(rating)))
            if (normalized === 3) threeStarCount += 1
          }
          threeStarRecord[b.id] = threeStarCount
        }
        setStudentCountByBatchId(studentCountRecord)
        setThreeStarCountByBatchId(threeStarRecord)
      } else {
        const studentCountRecord: Record<string, number> = {}
        const threeStarRecord: Record<string, number> = {}
        for (const b of batchRows ?? []) {
          studentCountRecord[b.id] = 0
          threeStarRecord[b.id] = 0
        }
        setStudentCountByBatchId(studentCountRecord)
        setThreeStarCountByBatchId(threeStarRecord)
      }

      const lastClassRecord: Record<string, string | null> = {}
      for (const b of batchRows ?? []) {
        lastClassRecord[b.id] = null
      }
      for (const row of classRows ?? []) {
        if (!lastClassRecord[row.batch_id]) {
          lastClassRecord[row.batch_id] = row.title ?? null
        }
      }
      setLastClassTopicByBatchId(lastClassRecord)
      setLoading(false)
    }

    void load()
  }, [refreshTick])

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return batches.filter((b) => {
      const textOk =
        !q || b.batch_code.toLowerCase().includes(q)
      const statusOk = statusFilter === 'all' || b.status === statusFilter
      const typeOk = typeFilter === 'all' || b.batch_type === typeFilter
      const trainerOk =
        trainerFilter === 'all' || b.trainer_id === trainerFilter
      return textOk && statusOk && typeOk && trainerOk
    })
  }, [batches, search, statusFilter, typeFilter, trainerFilter])

  const formatLabel = (value: string) =>
    value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const batchStatusMetricClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'is-active'
      case 'completed':
        return 'is-completed'
      case 'cancelled':
        return 'is-cancelled'
      default:
        return 'is-planned'
    }
  }

  const loadStudentsForPicker = async () => {
    setStudentsLoading(true)
    const { data, error: studentError } = await supabase
      .from('students')
      .select('id,student_name,email,phone,stage')
      .order('student_name', { ascending: true })

    if (studentError) {
      setCreateError(studentError.message)
      setStudentsLoading(false)
      return
    }

    setStudentOptions((data ?? []) as StudentOption[])
    setStudentsLoading(false)
  }

  const openCreateBatch = () => {
    setIsCreateOpen(true)
    setCreateStep(1)
    setCreateSaving(false)
    setCreateError('')
    setBatchForm({
      batch_code: '',
      trainer_id: '',
      start_date: '',
      batch_type: 'custom',
    })
    setStudentSearch('')
    setSelectedStudentIds([])
    void loadStudentsForPicker()
  }

  const closeCreateBatch = () => {
    if (createSaving) return
    setIsCreateOpen(false)
  }

  const goToStudentStep = () => {
    setCreateError('')
    if (!batchForm.batch_code.trim()) {
      setCreateError('Batch name is required.')
      return
    }
    if (!batchForm.trainer_id) {
      setCreateError('Trainer is required.')
      return
    }
    if (!batchForm.start_date) {
      setCreateError('Start date is required.')
      return
    }
    if (!calculatedEndDate) {
      setCreateError('Could not calculate end date.')
      return
    }
    setCreateStep(2)
  }

  const filteredStudentOptions = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return studentOptions
    return studentOptions.filter((student) =>
      `${student.student_name} ${student.email ?? ''} ${student.phone ?? ''} ${student.stage}`
        .toLowerCase()
        .includes(q),
    )
  }, [studentOptions, studentSearch])

  const selectedStudentNames = useMemo(() => {
    if (!selectedStudentIds.length) return []
    const byId = new Map(studentOptions.map((student) => [student.id, student.student_name]))
    return selectedStudentIds
      .map((id) => byId.get(id))
      .filter((name): name is string => Boolean(name))
  }, [selectedStudentIds, studentOptions])

  const createBatch = async (event: FormEvent) => {
    event.preventDefault()
    setCreateError('')
    if (!batchForm.batch_code.trim()) {
      setCreateError('Batch name is required.')
      return
    }
    if (!batchForm.trainer_id || !batchForm.start_date || !calculatedEndDate) {
      setCreateError('Please complete step 1 details.')
      return
    }

    setCreateSaving(true)
    const { data: createdBatch, error: createBatchError } = await supabase
      .from('batches')
      .insert({
        batch_code: batchForm.batch_code.trim(),
        trainer_id: batchForm.trainer_id,
        start_date: batchForm.start_date,
        end_date: calculatedEndDate,
        batch_type: batchForm.batch_type,
      })
      .select('id')
      .single()

    if (createBatchError || !createdBatch) {
      setCreateSaving(false)
      setCreateError(createBatchError?.message ?? 'Unable to create batch.')
      return
    }

    if (selectedStudentIds.length) {
      const mappings = selectedStudentIds.map((studentId) => ({
        student_id: studentId,
        batch_id: createdBatch.id,
        joined_at: batchForm.start_date,
        is_active: true,
      }))
      const { error: mappingError } = await supabase
        .from('student_batches')
        .insert(mappings)
      if (mappingError) {
        setCreateSaving(false)
        setCreateError(mappingError.message)
        return
      }
    }

    setCreateSaving(false)
    setIsCreateOpen(false)
    setRefreshTick((prev) => prev + 1)
  }

  if (loading) {
    return (
      <section className="panel">
        <p className="muted-dark">Loading batches...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="panel">
        <p className="error">{error}</p>
      </section>
    )
  }

  return (
    <>
      <section className="panel">
        <div className="panel-top">
          <div>
            <h3>Batches</h3>
            <p className="muted-dark">
              All course batches at a glance. Open a batch for full details
              soon.
            </p>
          </div>
          <button type="button" className="create-student-btn" onClick={openCreateBatch}>
            <Plus size={14} />
            Create New Batch
          </button>
        </div>

        <div className="filters-row batches-filters">
          <div className="search-box batches-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by batch name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="filter-select">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="filter-select">
            <span>Type</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All types</option>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="weekend">Weekend</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="filter-select">
            <span>Trainer</span>
            <select
              value={trainerFilter}
              onChange={(e) => setTrainerFilter(e.target.value)}
            >
              <option value="all">All trainers</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.trainer_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {filteredBatches.length === 0 ? (
        <section className="panel">
          <p className="empty-state">No batches match your filters.</p>
        </section>
      ) : (
        <section className="batch-cards-section">
          <h4 className="batch-cards-heading">Your batches</h4>
          <div className="batch-cards-grid">
            {filteredBatches.map((batch) => {
              const studentCount = studentCountByBatchId[batch.id] ?? 0
              const threeStarStudents = threeStarCountByBatchId[batch.id] ?? 0
              const lastClassTopic = lastClassTopicByBatchId[batch.id]
              return (
                <button
                  type="button"
                  key={batch.id}
                  className="batch-card"
                  onClick={() => onOpenBatch(batch.id, batch.batch_code)}
                >
                  <div className="batch-card-media" aria-hidden>
                    <img
                      src="/course-cover.png"
                      alt=""
                      className="batch-card-cover"
                    />
                  </div>
                  <div className="batch-card-body">
                    <h4 className="batch-card-title">{batch.batch_code}</h4>
                    <div className="batch-card-metrics-row">
                      <div className="batch-metric-item">
                        <Users size={14} />
                        <span className="batch-metric-count">{studentCount}</span>
                      </div>
                      <span className="batch-metric-divider" aria-hidden />
                      <div className="batch-metric-item batch-metric-stars">
                        <span className="three-star-candidate-icon" aria-hidden>
                          <User size={14} />
                          <Star size={10} />
                        </span>
                        <span className="batch-metric-count">{threeStarStudents}</span>
                      </div>
                      <span className="batch-metric-divider" aria-hidden />
                      <div
                        className={`batch-metric-item batch-metric-status ${batchStatusMetricClass(batch.status)}`}
                      >
                        <span>{formatLabel(batch.status)}</span>
                      </div>
                    </div>
                    <p className="batch-card-last-class">
                      Last class:{' '}
                      <span>{lastClassTopic ?? 'No classes yet'}</span>
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {isCreateOpen ? (
        <>
          <div className="drawer-overlay" onClick={closeCreateBatch} />
          <div className="batch-create-modal">
            <div className="batch-create-head">
              <h3>Create New Batch</h3>
              <p className="muted-dark">Step {createStep} of 2</p>
            </div>

            {createStep === 1 ? (
              <form
                className="batch-create-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  goToStudentStep()
                }}
              >
                <label>
                  Batch name
                  <input
                    type="text"
                    value={batchForm.batch_code}
                    onChange={(event) =>
                      setBatchForm((prev) => ({
                        ...prev,
                        batch_code: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  Trainer
                  <select
                    value={batchForm.trainer_id}
                    onChange={(event) =>
                      setBatchForm((prev) => ({
                        ...prev,
                        trainer_id: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select trainer</option>
                    {trainers.map((trainer) => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.trainer_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Start date
                  <input
                    type="date"
                    value={batchForm.start_date}
                    onChange={(event) =>
                      setBatchForm((prev) => ({
                        ...prev,
                        start_date: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  Batch type
                  <select
                    value={batchForm.batch_type}
                    onChange={(event) =>
                      setBatchForm((prev) => ({
                        ...prev,
                        batch_type: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                    <option value="weekend">Weekend</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>

                <label>
                  End date (auto +4 months)
                  <input type="date" value={calculatedEndDate} readOnly />
                </label>

                {createError ? <p className="error">{createError}</p> : null}
                <div className="batch-create-actions">
                  <button type="button" className="bulk-clear-btn" onClick={closeCreateBatch}>
                    Cancel
                  </button>
                  <button type="submit" className="bulk-update-btn">
                    Next: Add Students
                  </button>
                </div>
              </form>
            ) : (
              <form className="batch-create-form" onSubmit={createBatch}>
                <div className="search-box batch-student-picker-search">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search students"
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                  />
                </div>

                <div className="batch-student-picker-list">
                  {studentsLoading ? (
                    <p className="muted-dark">Loading students...</p>
                  ) : filteredStudentOptions.length ? (
                    filteredStudentOptions.map((student) => {
                      const checked = selectedStudentIds.includes(student.id)
                      return (
                        <label key={student.id} className="batch-student-picker-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedStudentIds((prev) => [...prev, student.id])
                              } else {
                                setSelectedStudentIds((prev) =>
                                  prev.filter((id) => id !== student.id),
                                )
                              }
                            }}
                          />
                          <div>
                            <p>{student.student_name}</p>
                            <span>
                              {student.email ?? '-'} | {student.phone ?? '-'} |{' '}
                              {formatLabel(student.stage)}
                            </span>
                          </div>
                        </label>
                      )
                    })
                  ) : (
                    <p className="muted-dark">No students found.</p>
                  )}
                </div>

                <p className="batch-student-picker-summary">
                  {selectedStudentIds.length} students selected
                </p>
                {selectedStudentNames.length ? (
                  <div className="batch-student-selected-list">
                    {selectedStudentNames.map((name) => (
                      <span key={name}>{name}</span>
                    ))}
                  </div>
                ) : null}
                {createError ? <p className="error">{createError}</p> : null}
                <div className="batch-create-actions">
                  <button
                    type="button"
                    className="bulk-clear-btn"
                    onClick={() => setCreateStep(1)}
                    disabled={createSaving}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="bulk-update-btn"
                    disabled={createSaving}
                  >
                    {createSaving ? 'Creating...' : 'Add Students & Create New Batch'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      ) : null}
    </>
  )
}
