import { useEffect, useMemo, useState } from 'react'
import { GraduationCap, Search } from 'lucide-react'
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

export function AdminBatchesPage({ onOpenBatch }: AdminBatchesPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [trainers, setTrainers] = useState<TrainerRow[]>([])
  const [progressByBatchId, setProgressByBatchId] = useState<
    Record<string, number | null>
  >({})

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [trainerFilter, setTrainerFilter] = useState<string>('all')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      const [
        { data: batchRows, error: batchError },
        { data: trainerRows, error: trainerError },
        { data: sbRows, error: sbError },
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
      ])

      if (batchError || trainerError || sbError) {
        setError(
          batchError?.message ??
            trainerError?.message ??
            sbError?.message ??
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

      const sums = new Map<string, { total: number; count: number }>()

      if (studentIds.length && (sbRows?.length ?? 0) > 0) {
        const { data: studentRows, error: studentError } = await supabase
          .from('students')
          .select('id,progress_pct')
          .in('id', studentIds)

        if (studentError) {
          setError(studentError.message)
          setLoading(false)
          return
        }

        const pctByStudent = new Map(
          (studentRows ?? []).map((s) => [s.id, s.progress_pct ?? null]),
        )

        for (const link of sbRows ?? []) {
          const pct = pctByStudent.get(link.student_id)
          if (typeof pct !== 'number') continue
          const cur = sums.get(link.batch_id) ?? { total: 0, count: 0 }
          cur.total += pct
          cur.count += 1
          sums.set(link.batch_id, cur)
        }
      }

      const progressRecord: Record<string, number | null> = {}
      for (const b of batchRows ?? []) {
        const agg = sums.get(b.id)
        progressRecord[b.id] =
          agg && agg.count > 0 ? Math.round(agg.total / agg.count) : null
      }

      setProgressByBatchId(progressRecord)
      setLoading(false)
    }

    void load()
  }, [])

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

  const statusPillClass = (status: string) => {
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
              const progress = progressByBatchId[batch.id]
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
                    <div className="batch-card-meta">
                      <GraduationCap size={15} className="batch-card-meta-icon" />
                      <span>
                        {progress === null
                          ? 'Avg. progress — no data yet'
                          : `Avg. progress ${progress}%`}
                      </span>
                    </div>
                    <div className="batch-card-status-row">
                      <span className={statusPillClass(batch.status)}>
                        {formatLabel(batch.status)}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}
