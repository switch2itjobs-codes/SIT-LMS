import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  Edit3,
  FileText,
  Filter,
  Link2,
  Medal,
  MoreVertical,
  Paperclip,
  Search,
  Star,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type AdminAssignmentDetailPageProps = {
  assignmentId: string
  batchId: string
  onBack: () => void
}

type AssignmentRow = {
  id: string
  title: string
  description: string | null
  attachment_url: string | null
  submission_type: string
  max_marks: number | null
  due_at: string
  batch_id: string
}

type SubmissionView = {
  id: string | null
  student_id: string
  student_name: string
  student_email: string | null
  submitted_at: string | null
  file_url: string | null
  text_answer: string | null
  marks: number | null
  feedback: string | null
  feedback_file: string | null
}

type SortOption = 'latest' | 'oldest' | 'marks_desc'
type StatusFilter = 'all' | 'submitted' | 'pending' | 'late'

function formatDateTime(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function getFileName(url: string | null) {
  if (!url) return null
  try {
    const last = url.split('/').pop() ?? ''
    return decodeURIComponent(last.split('?')[0]) || 'submission'
  } catch {
    return 'submission'
  }
}

function getFileTypeClass(name: string | null) {
  if (!name) return ''
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'is-pdf'
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'is-doc'
  return 'is-file'
}

export function AdminAssignmentDetailPage({
  assignmentId,
  batchId,
  onBack,
}: AdminAssignmentDetailPageProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null)
  const [batchCode, setBatchCode] = useState('')
  const [trainerName, setTrainerName] = useState('')
  const [totalStudents, setTotalStudents] = useState(0)
  const [submissions, setSubmissions] = useState<SubmissionView[]>([])
  const [overviewOpen, setOverviewOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('latest')
  const [activeSubmission, setActiveSubmission] = useState<SubmissionView | null>(null)
  const [drawerMarks, setDrawerMarks] = useState('')
  const [drawerFeedback, setDrawerFeedback] = useState('')
  const [drawerFeedbackFile, setDrawerFeedbackFile] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      const { data: assignmentRow, error: assignmentError } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .maybeSingle()

      if (assignmentError || !assignmentRow) {
        setError(assignmentError?.message ?? 'Assignment not found.')
        setLoading(false)
        return
      }

      setAssignment(assignmentRow as AssignmentRow)

      const [{ data: batchRow }, { data: studentBatchRows }, { data: submissionRows }] =
        await Promise.all([
          supabase
            .from('batches')
            .select('batch_code,trainer_id,trainers(trainer_name)')
            .eq('id', batchId)
            .maybeSingle(),
          supabase
            .from('student_batches')
            .select('student_id,students(id,student_name,email)')
            .eq('batch_id', batchId)
            .eq('is_active', true),
          supabase.from('assignment_submissions').select('*').eq('assignment_id', assignmentId),
        ])

      const trainerValue = (batchRow as any)?.trainers
      setBatchCode((batchRow as any)?.batch_code ?? '')
      setTrainerName(
        Array.isArray(trainerValue)
          ? trainerValue[0]?.trainer_name ?? ''
          : trainerValue?.trainer_name ?? '',
      )

      const students = (studentBatchRows ?? []).flatMap((row: any) => {
        const raw = row.students
        if (!raw) return []
        return Array.isArray(raw) ? raw : [raw]
      })
      const studentMetaById = new Map<string, { name: string; email: string | null }>(
        students.map((s: any) => [
          s.id,
          { name: s.student_name ?? 'Student', email: s.email ?? null },
        ]),
      )
      setTotalStudents(studentMetaById.size)

      const submissionByStudentId = new Map<string, any>()
      for (const submission of submissionRows ?? []) {
        submissionByStudentId.set((submission as any).student_id, submission)
      }

      const merged: SubmissionView[] = Array.from(studentMetaById.entries()).map(
        ([studentId, studentMeta]) => {
          const submission = submissionByStudentId.get(studentId)
          return {
            id: submission?.id ?? null,
            student_id: studentId,
            student_name: studentMeta.name,
            student_email: studentMeta.email,
            submitted_at: submission?.submitted_at ?? null,
            file_url: submission?.file_url ?? null,
            text_answer: submission?.text_answer ?? null,
            marks: submission?.marks ?? null,
            feedback: submission?.feedback ?? null,
            feedback_file: submission?.feedback_file ?? submission?.feedback_file_url ?? null,
          }
        },
      )
      setSubmissions(merged)
      setLoading(false)
    }

    void load()
  }, [assignmentId, batchId])

  const withStatus = useMemo(() => {
    const due = assignment?.due_at ? new Date(assignment.due_at).getTime() : Number.MAX_SAFE_INTEGER
    return submissions.map((submission) => {
      const submitted = Boolean(submission.submitted_at)
      const late =
        submitted &&
        submission.submitted_at &&
        new Date(submission.submitted_at).getTime() > due
      const status = late ? 'late' : submitted ? 'submitted' : 'pending'
      return { ...submission, status }
    })
  }, [submissions, assignment?.due_at])

  const submittedCount = withStatus.filter((s) => s.status !== 'pending').length
  const lateCount = withStatus.filter((s) => s.status === 'late').length
  const pendingCount = Math.max(0, totalStudents - submittedCount)
  const scored = withStatus.filter((s) => typeof s.marks === 'number')
  const avgScore = scored.length
    ? Math.round((scored.reduce((sum, s) => sum + (s.marks as number), 0) / scored.length) * 10) /
      10
    : 0
  const topScore = scored.length ? Math.max(...scored.map((s) => s.marks as number)) : 0

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = withStatus.filter((row) => {
      const searchOk = !q || row.student_name.toLowerCase().includes(q)
      const statusOk = statusFilter === 'all' || row.status === statusFilter
      return searchOk && statusOk
    })
    if (sortBy === 'latest') {
      rows = [...rows].sort(
        (a, b) =>
          new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime(),
      )
    } else if (sortBy === 'oldest') {
      rows = [...rows].sort(
        (a, b) =>
          new Date(a.submitted_at ?? 0).getTime() - new Date(b.submitted_at ?? 0).getTime(),
      )
    } else {
      rows = [...rows].sort((a, b) => (b.marks ?? -1) - (a.marks ?? -1))
    }
    return rows
  }, [withStatus, search, statusFilter, sortBy])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const submissionPct = totalStudents ? Math.round((submittedCount / totalStudents) * 100) : 0
  const pendingPct = totalStudents ? Math.round((pendingCount / totalStudents) * 100) : 0
  const latePct = totalStudents ? Math.round((lateCount / totalStudents) * 100) : 0

  const openReview = (row: SubmissionView) => {
    setActiveSubmission(row)
    setDrawerMarks(row.marks === null ? '' : String(row.marks))
    setDrawerFeedback(row.feedback ?? '')
    setDrawerFeedbackFile(row.feedback_file ?? '')
  }

  const saveFeedback = async (event: FormEvent) => {
    event.preventDefault()
    if (!assignment || !activeSubmission) return
    const parsedMarks = drawerMarks.trim() ? Number(drawerMarks) : null
    if (parsedMarks !== null && (!Number.isFinite(parsedMarks) || parsedMarks < 0)) {
      setError('Marks should be a valid number.')
      return
    }
    if (
      parsedMarks !== null &&
      assignment.max_marks !== null &&
      parsedMarks > assignment.max_marks
    ) {
      setError(`Marks cannot exceed ${assignment.max_marks}.`)
      return
    }

    setSaving(true)
    setError('')
    const payload: Record<string, unknown> = {
      assignment_id: assignment.id,
      student_id: activeSubmission.student_id,
      marks: parsedMarks,
      feedback: drawerFeedback.trim() || null,
      feedback_file: drawerFeedbackFile.trim() || null,
      submitted_at: activeSubmission.submitted_at,
      file_url: activeSubmission.file_url,
      text_answer: activeSubmission.text_answer,
    }

    const query = activeSubmission.id
      ? supabase.from('assignment_submissions').update(payload).eq('id', activeSubmission.id)
      : supabase.from('assignment_submissions').insert(payload)

    const { data, error: saveError } = await query.select('*').maybeSingle()
    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    const saved = (data as any) ?? activeSubmission
    setSubmissions((prev) =>
      prev.map((row) =>
        row.student_id === activeSubmission.student_id
          ? {
              ...row,
              id: saved.id ?? row.id,
              marks: saved.marks ?? parsedMarks,
              feedback: saved.feedback ?? drawerFeedback,
              feedback_file: saved.feedback_file ?? drawerFeedbackFile,
            }
          : row,
      ),
    )
    setActiveSubmission(null)
    setSaving(false)
  }

  const exportCsv = () => {
    const header = ['Student', 'Status', 'Submitted At', 'Marks', 'Feedback']
    const rows = filteredRows.map((row) => [
      row.student_name,
      row.status,
      row.submitted_at ?? '',
      row.marks ?? '',
      row.feedback ?? '',
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `assignment-${assignmentId}-submissions.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const upsertSubmission = async (
    target: SubmissionView,
    changes: { marks?: number | null; feedback?: string | null },
  ) => {
    if (!assignment) return
    const payload: Record<string, unknown> = {
      assignment_id: assignment.id,
      student_id: target.student_id,
      marks: changes.marks ?? target.marks,
      feedback: changes.feedback ?? target.feedback,
      feedback_file: target.feedback_file,
      submitted_at: target.submitted_at,
      file_url: target.file_url,
      text_answer: target.text_answer,
    }
    const query = target.id
      ? supabase.from('assignment_submissions').update(payload).eq('id', target.id)
      : supabase.from('assignment_submissions').insert(payload)
    const { data, error: updateError } = await query.select('*').maybeSingle()
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSubmissions((prev) =>
      prev.map((row) =>
        row.student_id === target.student_id
          ? {
              ...row,
              id: (data as any)?.id ?? row.id,
              marks: (data as any)?.marks ?? payload.marks ?? null,
              feedback: (data as any)?.feedback ?? payload.feedback ?? null,
            }
          : row,
      ),
    )
  }

  if (loading) {
    return <section className="panel">Loading assignment details...</section>
  }

  if (!assignment) {
    return (
      <section className="panel">
        <button type="button" className="batch-detail-back" onClick={onBack}>
          ← Back
        </button>
        <p className="error">{error || 'Assignment not found.'}</p>
      </section>
    )
  }

  return (
    <section className="assignment-detail-page">
      <header className="assignment-detail-header">
        <div>
          <button type="button" className="assignment-back-link" onClick={onBack}>
            ← Back to Live Classes
          </button>
          <div className="assignment-title-actions-row">
            <div className="assignment-title-row">
              <h1>{assignment.title}</h1>
              <span className="tag-pill assignment-status-pending">Upcoming</span>
            </div>
            <div className="assignment-detail-head-actions">
              <button type="button" className="batch-schedule-cancel" onClick={onBack}>
                Back
              </button>
              <button type="button" className="batch-link-btn">
                <Edit3 size={14} /> Edit Assignment
              </button>
              <button type="button" className="batch-schedule-submit" onClick={exportCsv}>
                <Download size={14} /> Export Submissions (CSV)
              </button>
            </div>
          </div>
          <p className="muted-dark">
            <CalendarDays size={13} /> Batch: <strong>{batchCode || '—'}</strong> · Trainer:{' '}
            <Users size={13} /> <strong>{trainerName || '—'}</strong> · Due:{' '}
            <CalendarDays size={13} />{' '}
            <strong>{formatDateTime(assignment.due_at)}</strong>
          </p>
        </div>
      </header>

      <article className="assignment-overview-card">
        <button
          type="button"
          className="assignment-overview-toggle"
          onClick={() => setOverviewOpen((prev) => !prev)}
        >
          <span>Assignment Overview</span>
          {overviewOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {overviewOpen ? (
          <div className="assignment-overview-grid">
            <article>
              <h4>
                <FileText size={13} /> Description
              </h4>
              <p>{assignment.description || 'No description provided.'}</p>
            </article>
            <article>
              <h4>
                <Link2 size={13} /> Submission Type
              </h4>
              <p>{assignment.submission_type || 'both'}</p>
            </article>
            <article>
              <h4>
                <Medal size={13} /> Max Marks
              </h4>
              <p>{assignment.max_marks ?? 10}</p>
            </article>
            <article>
              <h4>
                <Paperclip size={13} /> Attachments
              </h4>
              {assignment.attachment_url ? (
                <a href={assignment.attachment_url} target="_blank" rel="noreferrer">
                  <Paperclip size={13} /> Assignment_Brief.pdf
                </a>
              ) : (
                <p>—</p>
              )}
            </article>
          </div>
        ) : null}
      </article>

      <section className="assignment-kpi-grid">
        <article className="assignment-kpi-card">
          <span className="assignment-kpi-icon is-total">
            <FileText size={15} />
          </span>
          <div className="assignment-kpi-main">
            <p>Total Students</p>
            <h3 className="assignment-kpi-value-row">{totalStudents}</h3>
          </div>
        </article>
        <article className="assignment-kpi-card">
          <span className="assignment-kpi-icon is-submitted">
            <CheckCircle2 size={15} />
          </span>
          <div className="assignment-kpi-main">
            <p>Submitted</p>
            <h3 className="assignment-kpi-value-row">
              {submittedCount} <span>{submissionPct}%</span>
            </h3>
          </div>
        </article>
        <article className="assignment-kpi-card">
          <span className="assignment-kpi-icon is-pending">
            <Clock3 size={15} />
          </span>
          <div className="assignment-kpi-main">
            <p>Pending</p>
            <h3 className="assignment-kpi-value-row">
              {pendingCount} <span>{pendingPct}%</span>
            </h3>
          </div>
        </article>
        <article className="assignment-kpi-card">
          <span className="assignment-kpi-icon is-late">
            <AlertTriangle size={15} />
          </span>
          <div className="assignment-kpi-main">
            <p>Late Submissions</p>
            <h3 className="assignment-kpi-value-row">
              {lateCount} <span>{latePct}%</span>
            </h3>
          </div>
        </article>
        <article className="assignment-kpi-card">
          <span className="assignment-kpi-icon is-average">
            <Star size={15} />
          </span>
          <div className="assignment-kpi-main">
            <p>Average Score</p>
            <h3 className="assignment-kpi-value-row">{avgScore} / 10</h3>
          </div>
        </article>
        <article className="assignment-kpi-card">
          <span className="assignment-kpi-icon is-top">
            <Trophy size={15} />
          </span>
          <div className="assignment-kpi-main">
            <p>Top Score</p>
            <h3 className="assignment-kpi-value-row">{topScore} / 10</h3>
          </div>
        </article>
      </section>

      <section className="assignment-progress-row">
        <p>
          Submission Progress <span>{submittedCount} of {totalStudents} students submitted</span>
        </p>
        <div className="assignment-progress-track">
          <div style={{ width: `${submissionPct}%` }} />
        </div>
        <span>{submissionPct}%</span>
      </section>

      <section className="assignment-filters">
        <label className="live-filter-search assignment-search">
          <Search size={13} />
          <input
            type="text"
            placeholder="Search by student name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
          <option value="all">All</option>
          <option value="submitted">Submitted</option>
          <option value="pending">Pending</option>
          <option value="late">Late</option>
        </select>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
          <option value="latest">Latest</option>
          <option value="oldest">Oldest</option>
          <option value="marks_desc">Marks High → Low</option>
        </select>
        <button type="button" className="batch-link-btn">
          <Filter size={13} /> Filters
        </button>
      </section>

      <section className="panel assignment-submissions-panel">
        <div className="batch-table-wrap">
          <table className="batch-roster-table assignment-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Submitted At</th>
                <th>File</th>
                <th>Marks (Out of 10)</th>
                <th>Feedback</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.student_id}>
                  <td>
                    <div className="assignment-student-cell">
                      <span className="assignment-avatar">
                        {row.student_name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <strong>{row.student_name}</strong>
                        <p>{row.student_email ?? `${row.student_name.toLowerCase().replace(/\s+/g, '')}@example.com`}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`tag-pill assignment-status-${row.status}`}>
                      {row.status === 'submitted'
                        ? 'Submitted'
                        : row.status === 'pending'
                          ? 'Pending'
                          : 'Late'}
                    </span>
                  </td>
                  <td>{formatDateTime(row.submitted_at)}</td>
                  <td>
                    {row.file_url ? (
                      <div className="assignment-file-cell">
                        <a
                          href={row.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className={`assignment-file-link ${getFileTypeClass(getFileName(row.file_url))}`}
                        >
                          {getFileName(row.file_url)}
                        </a>
                        <a
                          href={row.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="assignment-file-download"
                          aria-label="Download file"
                        >
                          <Download size={12} />
                        </a>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className="assignment-marks-inline">
                      <input
                        type="number"
                        min={0}
                        max={assignment.max_marks ?? 10}
                        value={row.marks ?? ''}
                        onChange={(event) => {
                          const value = event.target.value
                          setSubmissions((prev) =>
                            prev.map((item) =>
                              item.student_id === row.student_id
                                ? {
                                    ...item,
                                    marks: value === '' ? null : Number(value),
                                  }
                                : item,
                            ),
                          )
                        }}
                        onBlur={() => void upsertSubmission(row, { marks: row.marks })}
                      />
                      <span>/ 10</span>
                    </div>
                  </td>
                  <td className="assignment-feedback-cell">
                    {row.feedback ? row.feedback.slice(0, 40) : '—'}
                  </td>
                  <td>
                    <div className="assignment-actions-cell">
                      <button
                        type="button"
                        className="batch-link-btn"
                        onClick={() => openReview(row)}
                      >
                        Review
                      </button>
                      <button type="button" className="assignment-row-menu-btn" aria-label="More actions">
                        <MoreVertical size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="assignment-table-footer">
          <p>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length}{' '}
            students
          </p>
          <div className="assignment-pagination">
            <button
              type="button"
              className="batch-link-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => idx + 1).map((page) => (
              <button
                key={page}
                type="button"
                className={`batch-link-btn ${currentPage === page ? 'assignment-page-active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              className="batch-link-btn"
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
            >
              ›
            </button>
          </div>
        </div>
      </section>

      {activeSubmission ? (
        <aside className="assignment-feedback-drawer">
          <div className="assignment-feedback-head">
            <h3>Review · {activeSubmission.student_name}</h3>
            <button type="button" className="batch-schedule-close" onClick={() => setActiveSubmission(null)}>
              <X size={14} />
            </button>
          </div>
          <div className="assignment-feedback-body">
            <p className="muted-dark">
              Submission: {activeSubmission.file_url ? 'File available' : 'No file uploaded'}
            </p>
            <form onSubmit={saveFeedback} className="assignment-feedback-form">
              <label>
                Marks (0-{assignment.max_marks ?? 10})
                <input
                  type="number"
                  min={0}
                  max={assignment.max_marks ?? 10}
                  value={drawerMarks}
                  onChange={(event) => setDrawerMarks(event.target.value)}
                />
              </label>
              <label>
                Feedback
                <textarea
                  rows={5}
                  value={drawerFeedback}
                  onChange={(event) => setDrawerFeedback(event.target.value)}
                />
              </label>
              <label>
                Feedback file URL (optional)
                <input
                  type="url"
                  value={drawerFeedbackFile}
                  onChange={(event) => setDrawerFeedbackFile(event.target.value)}
                />
              </label>
              {error ? <p className="error">{error}</p> : null}
              <button type="submit" className="batch-schedule-submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Feedback'}
              </button>
            </form>
          </div>
        </aside>
      ) : null}
    </section>
  )
}
